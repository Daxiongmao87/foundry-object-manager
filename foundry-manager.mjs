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
import SystemDiscovery from './system-discovery.mjs';
import { WorldManager } from './world-manager.mjs';

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
        this.systemDiscovery = new SystemDiscovery({ verbose: options.verbose });
        this.progress = new ProgressIndicator();
        this.verbose = options.verbose || false;
        this.selectedWorld = null;
        this.selectedSystem = null;
        this.worldOption = options.server?.world || null; // Store world option from server config
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

            // Initialize WorldManager
            this.progress.start('Initializing WorldManager...');
            this.worldManager = new WorldManager(this.validator);
            this.progress.stop(true, 'WorldManager initialized');

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
            await this.initialize(this.worldOption);
        }
    }

    /**
     * Validate a document
     * @param {string} type - Document type (e.g., 'weapon', 'npc')
     * @param {Object} data - Document data to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateDocument(type, data, options = {}) {
        await this._ensureInitialized();

        // Determine document type (Item vs Actor)
        const availableTypes = await this.validator.getAvailableTypes();
        
        let documentType = null;
        // First, check if the type itself is a top-level document type (e.g., Scene, JournalEntry)
        if (availableTypes.types[type]) {
            documentType = type;
        } else if (availableTypes.types.Item[type]) {
            documentType = 'Item';
        } else if (availableTypes.types.Actor[type]) {
            documentType = 'Actor';
        } else {
            // Check other document types by iterating through their subtypes
            for (const [docType, subtypes] of Object.entries(availableTypes.types)) {
                // Check if the provided type matches a subtype key (which might be lowercase)
                if (subtypes[type] || subtypes[type.toLowerCase()]) {
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

        return await this.validator.validateDocument(documentType, data, options);
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
        // First, check if the type itself is a top-level document type (e.g., Scene, JournalEntry)
        if (availableTypes.types[type]) {
            documentType = type;
        } else if (availableTypes.types.Item[type]) {
            documentType = 'Item';
        } else if (availableTypes.types.Actor[type]) {
            documentType = 'Actor';
        } else {
            // Check other document types by iterating through their subtypes
            for (const [docType, subtypes] of Object.entries(availableTypes.types)) {
                // Check if the provided type matches a subtype key (which might be lowercase)
                if (subtypes[type] || subtypes[type.toLowerCase()]) {
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
     * List available images
     * @returns {Promise<Object>} Available images
     */
    async listImages() {
        await this._ensureInitialized();
        return await this.validator.getAvailableImages();
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
                description: 'System name (e.g., dnd5e, pf2e) for type discovery'
            },
            type: {
                type: 'string',
                short: 't',
                description: 'Object type (e.g., actor, item, weapon, spell)'
            },
            'list-systems': {
                type: 'boolean',
                description: 'List all available game systems'
            },
            'list-worlds': {
                type: 'boolean',
                description: 'List available worlds'
            },
            'list-types': {
                type: 'boolean',
                description: 'List available object types (use with -s for specific system)'
            },
            'list-images': {
                type: 'boolean',
                description: 'List available images from core and system folders'
            },
            'image-pattern': {
                type: 'string',
                description: 'Pattern for filtering images (supports wildcards: *, ?)'
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
            read: {
                type: 'boolean',
                short: 'r',
                description: 'Read/list documents'
            },
            insert: {
                type: 'boolean',
                short: 'i',
                description: 'Insert/create a new document'
            },
            name: {
                type: 'string',
                description: 'Filter by name (with wildcards *, ?)'
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
            delete: {
                type: 'boolean',
                short: 'd',
                description: 'Delete a document by ID'
            },
            id: {
                type: 'string',
                description: 'Document ID for update/delete operations'
            },
            verbose: {
                type: 'boolean',
                short: 'v',
                description: 'Enable verbose output'
            },
            'no-image': {
                type: 'boolean',
                description: 'Skip image validation (allow creation without images)'
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
  -s, --system <id>               System ID (e.g., dnd5e, pf2e) for type discovery
  -t, --type <type>               Object type (e.g., weapon, npc, spell)
  -w, --world <id>                World ID to use (defaults to first available)
  -f, --file <path>               Read JSON from file
  -r, --read                      Read/list documents
  -i, --insert                    Insert/create a new document
  --name <pattern>                Filter by name (with wildcards *, ?)
  -c, --create                    Validate for creation (default)
  -u, --update                    Validate for update
  -d, --delete                    Delete a document by ID
  --id <id>                       Document ID for update/delete operations
  -v, --verbose                   Enable verbose output
  --no-image                      Skip image validation (allow creation without images)
  -h, --help                      Show this help message

  --list-systems                  List all available game systems
  --list-worlds                   List available worlds
  --list-types                    List available object types (use with -s for specific system)
  --list-images                   List available images from core and system folders
  --image-pattern <pattern>       Filter images by pattern (supports wildcards: *, ?)
  --schema                        Extract and display expected schema

  --set-admin-password            Set administrator password
  --set-world-password            Set world password
  --credential-status             Check credential status
  --clear-credentials             Clear stored credentials

EXAMPLES:
  # System Discovery
  foundry-manager.mjs --list-systems                              # List all systems
  foundry-manager.mjs --list-types -s dnd5e                       # List D&D 5e types
  foundry-manager.mjs --list-types -s pf2e                        # List Pathfinder 2e types

  # Validation
  foundry-manager.mjs -t weapon '{"name": "Longsword", "type": "weapon"}'
  foundry-manager.mjs -t npc -f my-npc.json

  # Schema extraction
  foundry-manager.mjs -t weapon --schema                          # From active world
  foundry-manager.mjs -s dnd5e -t weapon --schema                 # From specific system

  # World operations
  foundry-manager.mjs --list-worlds                               # List worlds
  foundry-manager.mjs -w myworld -t actor actor.json              # Use specific world

  # CRUD Operations  
  foundry-manager.mjs -w world -t character -r                    # READ: List all characters
  foundry-manager.mjs -w world -t character -r --name "Hero*"     # SEARCH: Find by name pattern
  foundry-manager.mjs -w world -t character -i '{"name":"Hero"}'  # CREATE: Insert new character
  foundry-manager.mjs -w world -t character -u --id "abc123" '{"hp":{"value":50}}' # UPDATE: Modify by ID
  foundry-manager.mjs -w world -t character -d --id "abc123"      # DELETE: Remove by ID

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

            // Handle list systems (doesn't require server startup)
            if (args['list-systems']) {
                await this.manager.systemDiscovery.listSystems();
                process.exit(0);
            }

            // Handle list types with system specified (doesn't require server startup)
            if (args['list-types'] && args.system) {
                await this.manager.systemDiscovery.listSystemObjectTypes(args.system);
                process.exit(0);
            }

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
                console.log(`
📋 Available Types for ${types.systemTitle}:`);
                
                for (const [docType, subtypes] of Object.entries(types.types)) {
                    const subtypeList = Object.keys(subtypes);
                    if (subtypeList.length > 0) {
                        console.log(`
${docType}:`);
                        subtypeList.forEach(type => {
                            console.log(`   - ${type}: ${subtypes[type]}`);
                        });
                    }
                }
                await this.manager.cleanup();
                process.exit(0);
            }

            // Handle list images
            if (args['list-images']) {
                const pattern = args['image-pattern'] || '*'; // Default to all if no pattern
                console.log(`\n🖼️  Discovering available images${pattern !== '*' ? ` matching "${pattern}"` : ''}...`);
                const images = await this.manager.listImages();
                
                // Helper function to filter images by pattern
                const filterByPattern = (imageList, searchPattern) => {
                    if (searchPattern === '*' || !searchPattern) return imageList;
                    const regex = new RegExp(searchPattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
                    return imageList.filter(img => regex.test(img));
                };
                
                const filteredCore = filterByPattern(images.core, pattern);
                const filteredSystem = filterByPattern(images.system, pattern);
                const filteredUser = filterByPattern(images.user, pattern);
                
                console.log(`\n📋 Available Images for ${images.metadata.systemTitle || 'FoundryVTT'}:`);
                
                if (filteredCore.length > 0) {
                    console.log(`\n🎯 Core FoundryVTT Icons (${filteredCore.length}):`);
                    filteredCore.forEach(img => {
                        console.log(`   - ${img}`);
                    });
                }
                
                if (filteredSystem.length > 0) {
                    console.log(`\n🎲 System Icons (${filteredSystem.length}):`);
                    filteredSystem.forEach(img => {
                        console.log(`   - ${img}`);
                    });
                }
                
                if (filteredUser.length > 0) {
                    console.log(`\n👤 User Images (${filteredUser.length}):`);
                    filteredUser.forEach(img => {
                        console.log(`   - ${img}`);
                    });
                }
                
                const totalFiltered = filteredCore.length + filteredSystem.length + filteredUser.length;
                const totalImages = images.core.length + images.system.length + images.user.length;
                
                if (pattern !== '*' && pattern) {
                    console.log(`\n📊 Found ${totalFiltered} images matching "${pattern}" (${totalImages} total available)`);
                } else {
                    console.log(`\n📊 Total available images: ${totalImages}`);
                }
                
                if (totalFiltered === 0 && pattern !== '*') {
                    console.log(`\n💡 No images found matching "${pattern}". Try a different pattern or use --list-images to see all available images.`);
                } else {
                    console.log('\n💡 Use any of these image paths in your document data');
                }
                
                await this.manager.cleanup();
                process.exit(0);
            }

            // Handle read/search documents
            if (args.read) {
                if (!args.type) {
                    console.error('Error: Document type (-t) is required for read/search operations.');
                    process.exit(1);
                }
                console.log(`
🔍 Searching for ${args.type} documents...`);
                await this.manager._ensureInitialized();
                
                try {
                    const documents = await this.manager.worldManager.search(args.type, args.name);
                    if (documents.length === 0) {
                        console.log('   No documents found matching criteria.');
                    } else {
                        console.log(`   Found ${documents.length} documents:`);
                        documents.forEach(doc => {
                            console.log(`   - ID: ${doc.id}, Name: ${doc.name}`);
                        });
                    }
                } catch (error) {
                    // If it's a type error, show available types
                    if (error.message.includes('not found') || error.message.includes('Invalid type')) {
                        console.error(`\n❌ Error: ${error.message}`);
                        
                        // Get available types from the system
                        try {
                            const availableTypes = await this.manager.validator.getSystemObjectTypes();
                            console.log('\n📋 Available object types for this system:');
                            
                            // Group by document type
                            const grouped = {};
                            for (const [key, info] of Object.entries(availableTypes)) {
                                if (!grouped[info.documentType]) {
                                    grouped[info.documentType] = [];
                                }
                                grouped[info.documentType].push({ key, label: info.label });
                            }
                            
                            // Display grouped types
                            for (const [docType, types] of Object.entries(grouped)) {
                                console.log(`\n  ${docType}s:`);
                                types.forEach(({ key, label }) => {
                                    console.log(`    - ${key}: ${label}`);
                                });
                            }
                            
                            console.log('\n💡 Tip: Use one of the above types with the -t option');
                        } catch (typeError) {
                            // Fallback: try to get types from listTypes
                            try {
                                const types = await this.manager.listTypes();
                                console.log(`\n📋 Available types for ${types.systemTitle}:`);
                                
                                for (const [docType, subtypes] of Object.entries(types.types)) {
                                    const subtypeList = Object.keys(subtypes);
                                    if (subtypeList.length > 0) {
                                        console.log(`\n${docType}:`);
                                        subtypeList.forEach(type => {
                                            console.log(`   - ${type}: ${subtypes[type]}`);
                                        });
                                    }
                                }
                                
                                console.log('\n💡 Tip: Use one of the above types with the -t option');
                            } catch (fallbackError) {
                                console.error('Could not retrieve available types:', fallbackError.message);
                            }
                        }
                        await this.manager.cleanup();
                        process.exit(1);
                    } else {
                        throw error;
                    }
                }
                
                await this.manager.cleanup();
                process.exit(0);
            }

            // Handle insert/create document
            if (args.insert) {
                if (!args.type) {
                    console.error('Error: Document type (-t) is required for insert operations.');
                    process.exit(1);
                }
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
                    console.error('Error: JSON data or file (-f) is required for insert operations.');
                    process.exit(1);
                }

                console.log(`
➕ Creating ${args.type} document...`);
                await this.manager._ensureInitialized();
                const result = await this.manager.worldManager.create(args.type, jsonData, { noImage: args['no-image'] });
                console.log(`✅ Document created successfully! ID: ${result.id}, Name: ${result.name}`);
                await this.manager.cleanup();
                process.exit(0);
            }

            // Handle update document
            if (args.update) {
                if (!args.type) {
                    console.error('Error: Document type (-t) is required for update operations.');
                    process.exit(1);
                }
                if (!args.id) {
                    console.error('Error: Document ID (--id) is required for update operations.');
                    process.exit(1);
                }
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
                    console.error('Error: JSON data or file (-f) is required for update operations.');
                    process.exit(1);
                }

                console.log(`\n🔄 Updating ${args.type} document with ID: ${args.id}...`);
                await this.manager._ensureInitialized();
                const result = await this.manager.worldManager.update(args.type, args.id, jsonData);
                console.log(`✅ Document updated successfully! ID: ${result.id}, Name: ${result.name}`);
                await this.manager.cleanup();
                process.exit(0);
            }

            // Handle delete document
            if (args.delete) {
                if (!args.type) {
                    console.error('Error: Document type (-t) is required for delete operations.');
                    process.exit(1);
                }
                if (!args.id) {
                    console.error('Error: Document ID (--id) is required for delete operations.');
                    process.exit(1);
                }

                console.log(`
🗑️ Deleting ${args.type} document with ID: ${args.id}...`);
                await this.manager._ensureInitialized();
                const result = await this.manager.worldManager.delete(args.type, args.id);
                console.log(`✅ Document with ID: ${result.id} deleted successfully!`);
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
            const result = await this.manager.validateDocument(args.type, jsonData, { noImage: args['no-image'] });

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