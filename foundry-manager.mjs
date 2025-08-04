#!/usr/bin/env node

/**
 * FoundryVTT Object Validator - Main CLI Interface
 * Command-line tool for validating JSON objects against FoundryVTT system schemas
 * 
 * Now uses Puppeteer-based validation with real FoundryVTT engine
 */

import { parseArgs } from 'util';
import { readFileSync, existsSync } from 'fs';
import { randomBytes } from 'crypto';
import { FoundryServerManagerPatched as FoundryServerManager, ServerState } from './foundry-server-manager-patched.mjs';
import { FoundryPuppeteerValidator, ValidationError } from './foundry-puppeteer-validator.mjs';
import CredentialManager from './credential-manager.mjs';

// Progress indicator helper
class ProgressIndicator {
    constructor() {
        this.spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.current = 0;
        this.interval = null;
        this.message = '';
    }

    start(message) {
        this.message = message;
        this.current = 0;
        process.stdout.write(`\r${this.spinner[this.current]} ${this.message}`);
        this.interval = setInterval(() => {
            this.current = (this.current + 1) % this.spinner.length;
            process.stdout.write(`\r${this.spinner[this.current]} ${this.message}`);
        }, 100);
    }

    update(message) {
        this.message = message;
        process.stdout.write(`\r${this.spinner[this.current]} ${this.message}`);
    }

    stop(success = true, finalMessage = null) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        const icon = success ? '✅' : '❌';
        const msg = finalMessage || this.message;
        process.stdout.write(`\r${icon} ${msg}\n`);
    }
}

/**
 * Main FoundryManager class using Puppeteer-based validation
 */
export class FoundryManager {
    constructor(options = {}) {
        this.serverManager = new FoundryServerManager(options.server || {});
        this.validator = null;
        this.initialized = false;
        this.credentialManager = new CredentialManager();
        this.progress = new ProgressIndicator();
        this.verbose = options.verbose || false;
        this.selectedWorld = null;
        this.selectedSystem = null;
    }

    /**
     * Generate a random 16-character alphanumeric ID for FoundryVTT
     * @returns {string} A 16-character alphanumeric ID
     */
    static generateRandomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const bytes = randomBytes(16);
        
        for (let i = 0; i < 16; i++) {
            result += chars[bytes[i] % chars.length];
        }
        
        return result;
    }

    /**
     * Initialize the validation environment
     * @param {string} worldId - Optional world ID to use
     */
    async initialize(worldId = null) {
        if (this.initialized) {
            return;
        }

        try {
            console.log('🚀 Initializing validation system...');
            
            // Start server
            this.progress.start('Starting FoundryVTT server...');
            await this.serverManager.startServer();
            this.progress.stop(true, 'FoundryVTT server started');

            // Initialize browser first for Puppeteer-based world discovery
            this.progress.start('Initializing browser...');
            await this.serverManager.initializeBrowser();
            this.progress.stop(true, 'Browser initialized');

            // Get available worlds if not specified (now uses Puppeteer)
            if (!worldId) {
                this.progress.start('Discovering available worlds...');
                const worlds = await this.serverManager.getAvailableWorlds();
                this.progress.stop(true, `Found ${worlds.length} worlds`);
                
                if (worlds.length === 0) {
                    throw new Error('No worlds available. Please create a world first.');
                }
                worldId = worlds[0];
                if (this.verbose) {
                    console.log(`   Using first available world: ${worldId}`);
                }
            }

            // Activate world
            this.progress.start(`Activating world: ${worldId}...`);
            await this.serverManager.activateWorld(worldId);
            this.selectedWorld = worldId;
            this.progress.stop(true, `World activated: ${worldId}`);

            // Create and initialize validator
            this.progress.start('Initializing validator...');
            this.validator = new FoundryPuppeteerValidator(this.serverManager);
            await this.validator.initialize();
            this.progress.stop(true, 'Validator initialized');

            // Get system info
            const status = await this.serverManager.getServerStatus();
            this.selectedSystem = status.system;
            
            console.log(`📋 Validation system ready!`);
            console.log(`   System: ${this.selectedSystem}`);
            console.log(`   World: ${this.selectedWorld}`);
            
            this.initialized = true;

        } catch (error) {
            this.progress.stop(false, 'Initialization failed');
            throw error;
        }
    }

    /**
     * Ensure the system is initialized
     * @private
     */
    async _ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    /**
     * Validate a document
     * @param {string} type - Document type (e.g., 'weapon', 'npc')
     * @param {Object} data - Document data to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateDocument(type, data) {
        await this._ensureInitialized();

        // Determine document type (Item vs Actor)
        const availableTypes = await this.validator.getAvailableTypes();
        
        let documentType = null;
        if (availableTypes.types.Item[type]) {
            documentType = 'Item';
        } else if (availableTypes.types.Actor[type]) {
            documentType = 'Actor';
        } else {
            // Check other document types
            for (const [docType, subtypes] of Object.entries(availableTypes.types)) {
                if (subtypes[type]) {
                    documentType = docType;
                    break;
                }
            }
        }

        if (!documentType) {
            throw new ValidationError(
                `Unknown type: ${type}. Use --list-types to see available types.`,
                'type',
                'UNKNOWN_TYPE'
            );
        }

        // Ensure the data has the correct type field
        if (!data.type) {
            data.type = type;
        }

        return await this.validator.validateDocument(documentType, data);
    }

    /**
     * Get schema for a document type
     * @param {string} type - Document type
     * @returns {Promise<Object>} Schema information
     */
    async getSchema(type) {
        await this._ensureInitialized();

        // Determine document type
        const availableTypes = await this.validator.getAvailableTypes();
        
        let documentType = null;
        if (availableTypes.types.Item[type]) {
            documentType = 'Item';
        } else if (availableTypes.types.Actor[type]) {
            documentType = 'Actor';
        } else {
            for (const [docType, subtypes] of Object.entries(availableTypes.types)) {
                if (subtypes[type]) {
                    documentType = docType;
                    break;
                }
            }
        }

        if (!documentType) {
            throw new ValidationError(
                `Unknown type: ${type}. Use --list-types to see available types.`,
                'type',
                'UNKNOWN_TYPE'
            );
        }

        return await this.validator.getSchema(documentType, type);
    }

    /**
     * List available types
     * @returns {Promise<Object>} Available types
     */
    async listTypes() {
        await this._ensureInitialized();
        return await this.validator.getAvailableTypes();
    }

    /**
     * List available worlds using Puppeteer-based discovery
     * @returns {Promise<Array<string>>} Available world IDs
     */
    async listWorlds() {
        // Start server and initialize browser if not already done
        if (!this.serverManager.isServerRunning()) {
            await this.serverManager.startServer();
        }
        if (!this.serverManager.browser) {
            await this.serverManager.initializeBrowser();
        }
        
        return await this.serverManager.getAvailableWorlds();
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.serverManager) {
            await this.serverManager.cleanup();
        }
        this.initialized = false;
        this.validator = null;
    }
}

/**
 * CLI Validator class
 */
class FoundryValidator {
    constructor() {
        this.manager = null;
        this.credentialManager = new CredentialManager();
    }

    /**
     * Parse command line arguments
     */
    parseArguments() {
        const options = {
            system: {
                type: 'string',
                short: 's',
                description: 'System name (not used with Puppeteer validation)'
            },
            type: {
                type: 'string',
                short: 't',
                description: 'Object type (e.g., actor, item, weapon, spell)'
            },
            'list-worlds': {
                type: 'boolean',
                description: 'List available worlds'
            },
            'list-types': {
                type: 'boolean',
                description: 'List available object types'
            },
            schema: {
                type: 'boolean',
                description: 'Extract and display the expected schema'
            },
            world: {
                type: 'string',
                short: 'w',
                description: 'World ID to use for validation'
            },
            file: {
                type: 'string',
                short: 'f',
                description: 'JSON file containing object data'
            },
            create: {
                type: 'boolean',
                short: 'c',
                description: 'Validate for document creation'
            },
            update: {
                type: 'boolean',
                short: 'u',
                description: 'Validate for document update'
            },
            verbose: {
                type: 'boolean',
                short: 'v',
                description: 'Enable verbose output'
            },
            help: {
                type: 'boolean',
                short: 'h',
                description: 'Show help message'
            },
            'set-admin-password': {
                type: 'boolean',
                description: 'Set or update FoundryVTT administrator password'
            },
            'set-world-password': {
                type: 'boolean',
                description: 'Set or update world password'
            },
            'credential-status': {
                type: 'boolean',
                description: 'Check credential storage status'
            },
            'clear-credentials': {
                type: 'boolean',
                description: 'Clear all stored credentials'
            }
        };

        const { values, positionals } = parseArgs({
            options,
            allowPositionals: true,
            strict: false
        });

        return { ...values, positionals };
    }

    /**
     * Display help message
     */
    showHelp() {
        const helpText = `
FoundryVTT Object Validator - Puppeteer Edition

USAGE:
  foundry-manager.mjs [options] [json_string]

OPTIONS:
  -t, --type <type>               Object type (e.g., weapon, npc, spell)
  -w, --world <id>                World ID to use (defaults to first available)
  -f, --file <path>               Read JSON from file
  -c, --create                    Validate for creation (default)
  -u, --update                    Validate for update
  -v, --verbose                   Enable verbose output
  -h, --help                      Show this help message

  --list-worlds                   List available worlds
  --list-types                    List available object types
  --schema                        Extract and display expected schema

  --set-admin-password            Set administrator password
  --set-world-password            Set world password
  --credential-status             Check credential status
  --clear-credentials             Clear stored credentials

EXAMPLES:
  # Validate weapon from command line
  foundry-manager.mjs -t weapon '{"name": "Longsword", "type": "weapon"}'

  # Validate from file
  foundry-manager.mjs -t npc -f my-npc.json

  # Get schema for a type
  foundry-manager.mjs -t weapon --schema

  # List available types
  foundry-manager.mjs --list-types

  # Use specific world
  foundry-manager.mjs -w myworld -t actor actor.json

EXIT CODES:
  0    Validation successful
  1    Validation failed or error occurred
`;
        console.log(helpText.trim());
    }

    /**
     * Handle credential management commands
     */
    async handleCredentialCommand(args) {
        if (args['set-admin-password']) {
            await this.credentialManager.setAdminPassword();
            return true;
        }
        
        if (args['set-world-password']) {
            await this.credentialManager.setWorldPassword();
            return true;
        }
        
        if (args['credential-status']) {
            if (typeof this.credentialManager === 'object' && this.credentialManager !== null) {
                if (typeof this.credentialManager.showStatus === 'function') {
                    this.credentialManager.showStatus();
                } else {
                    console.error('Diagnostic: this.credentialManager.showStatus is not a function.');
                    console.error('Type of this.credentialManager:', typeof this.credentialManager);
                    console.error('Keys on this.credentialManager:', Object.keys(this.credentialManager));
                    console.error('Prototype of this.credentialManager:', Object.getPrototypeOf(this.credentialManager));
                }
            } else {
                console.error('Diagnostic: this.credentialManager is not an object or is null.');
                console.error('Value of this.credentialManager:', this.credentialManager);
            }
            return true;
        }
        
        if (args['clear-credentials']) {
            await this.credentialManager.clearCredentials();
            return true;
        }
        
        return false;
    }

    /**
     * Main run method
     */
    async run() {
        const args = this.parseArguments();

        // Handle help
        if (args.help) {
            this.showHelp();
            process.exit(0);
        }

        // Handle credential commands
        if (await this.handleCredentialCommand(args)) {
            process.exit(0);
        }

        try {
            // Create manager
            this.manager = new FoundryManager({ 
                verbose: args.verbose,
                server: {
                    world: args.world
                }
            });

            // Handle list worlds
            if (args['list-worlds']) {
                const worlds = await this.manager.listWorlds();
                console.log('\n📁 Available Worlds:');
                if (worlds.length === 0) {
                    console.log('   No worlds found');
                } else {
                    worlds.forEach(world => console.log(`   - ${world}`));
                }
                await this.manager.cleanup();
                process.exit(0);
            }

            // Handle list types
            if (args['list-types']) {
                const types = await this.manager.listTypes();
                console.log(`\n📋 Available Types for ${types.systemTitle}:`);
                
                for (const [docType, subtypes] of Object.entries(types.types)) {
                    const subtypeList = Object.keys(subtypes);
                    if (subtypeList.length > 0) {
                        console.log(`\n${docType}:`);
                        subtypeList.forEach(type => {
                            console.log(`   - ${type}: ${subtypes[type]}`);
                        });
                    }
                }
                await this.manager.cleanup();
                process.exit(0);
            }

            // Handle schema extraction
            if (args.schema) {
                if (!args.type) {
                    console.error('Error: Type (-t) is required for schema extraction');
                    process.exit(1);
                }

                const schema = await this.manager.getSchema(args.type);
                console.log(`\n📋 Schema for ${args.type}:`);
                console.log('='.repeat(60));
                console.log(JSON.stringify(schema, null, 2));
                await this.manager.cleanup();
                process.exit(0);
            }

            // Validate document
            if (!args.type) {
                console.error('Error: Type (-t) is required for validation');
                console.error('Use --list-types to see available types');
                process.exit(1);
            }

            // Get JSON data
            let jsonData;
            if (args.file) {
                if (!existsSync(args.file)) {
                    console.error(`Error: File not found: ${args.file}`);
                    process.exit(1);
                }
                const fileContent = readFileSync(args.file, 'utf8');
                jsonData = JSON.parse(fileContent);
            } else if (args.positionals.length > 0) {
                jsonData = JSON.parse(args.positionals[0]);
            } else {
                // Read from stdin
                const chunks = [];
                for await (const chunk of process.stdin) {
                    chunks.push(chunk);
                }
                const input = Buffer.concat(chunks).toString();
                jsonData = JSON.parse(input);
            }

            // Validate
            console.log(`\n🔍 Validating ${args.type}...`);
            const result = await this.manager.validateDocument(args.type, jsonData);

            if (result.success) {
                console.log(`✅ Validation successful!`);
                if (args.verbose) {
                    console.log('\nValidated document:');
                    console.log(JSON.stringify(result.data, null, 2));
                }
            }

            await this.manager.cleanup();
            process.exit(0);

        } catch (error) {
            if (error instanceof ValidationError) {
                console.error(`\n❌ Validation failed:`);
                console.error(`   → ${error.message}`);
                if (error.field) {
                    console.error(`   → Field: ${error.field}`);
                }
                console.error(`   → Code: ${error.code}`);
            } else {
                console.error(`\n❌ Error: ${error.message}`);
                if (args.verbose && error.stack) {
                    console.error('\nStack trace:');
                    console.error(error.stack);
                }
            }
            
            if (this.manager) {
                await this.manager.cleanup();
            }
            process.exit(1);
        }
    }
}

// Run the validator if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new FoundryValidator();
    validator.run().catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}

// Export both classes
export { FoundryValidator };
export default FoundryManager;