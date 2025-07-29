#!/usr/bin/env node

/**
 * FoundryVTT Object Validator - Main CLI Interface
 * Command-line tool for validating JSON objects against FoundryVTT system schemas
 */

import { parseArgs } from 'util';
import { existsSync } from 'fs';
import FoundryEnvironment from './foundry-environment.mjs';
import SystemDiscovery from './system-discovery.mjs';
import SchemaExtractor from './schema-extractor.mjs';
import ValidationEngine from './validation-engine.mjs';
import WorldManager from './world-manager.mjs';

class FoundryValidator {
    constructor() {
        this.foundryEnv = new FoundryEnvironment();
        this.systemDiscovery = new SystemDiscovery(this.foundryEnv);
        this.schemaExtractor = new SchemaExtractor(this.foundryEnv);
        this.validationEngine = new ValidationEngine();
        this.worldManager = new WorldManager(this.foundryEnv);
    }

    /**
     * Parse command line arguments
     */
    parseArguments() {
        const options = {
            system: {
                type: 'string',
                short: 's',
                description: 'System name (e.g., dnd5e, pf2e)'
            },
            type: {
                type: 'string',
                short: 't',
                description: 'Object type (e.g., actor, item, weapon, spell)'
            },
            list: {
                type: 'boolean',
                short: 'l',
                description: 'List available systems, object types, or worlds'
            },
            world: {
                type: 'string',
                short: 'w',
                description: 'Target world for insertion (use with --insert)'
            },
            listWorlds: {
                type: 'boolean',
                description: 'List available worlds instead of systems'
            },
            insert: {
                type: 'boolean',
                short: 'i',
                description: 'Insert validated object into specified world'
            },
            search: {
                type: 'boolean',
                short: 'r',
                description: 'Search and retrieve objects from a world'
            },
            name: {
                type: 'string',
                description: 'Search by name pattern (supports wildcards * and ?)'
            },
            id: {
                type: 'string',
                description: 'Search by ID pattern (supports wildcards * and ?)'
            },
            limit: {
                type: 'string',
                description: 'Limit number of results returned'
            },
            details: {
                type: 'boolean',
                description: 'Show detailed information about found documents'
            },
            json: {
                type: 'string',
                description: 'Show JSON data (specify max characters, e.g., --json 500)'
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
            }
        };

        try {
            const { values, positionals } = parseArgs({
                options,
                allowPositionals: true
            });

            return {
                system: values.system,
                type: values.type,
                list: values.list,
                world: values.world,
                listWorlds: values.listWorlds,
                insert: values.insert,
                search: values.search,
                name: values.name,
                id: values.id,
                limit: values.limit ? parseInt(values.limit) : undefined,
                details: values.details,
                json: values.json ? parseInt(values.json) : undefined,
                verbose: values.verbose,
                help: values.help,
                jsonString: positionals[0]
            };
        } catch (error) {
            console.error(`Error parsing arguments: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * Show help message
     */
    showHelp() {
        const helpText = `
FoundryVTT Object Manager

USAGE:
  foundry-manager.mjs [OPTIONS] [JSON_STRING]

OPTIONS:
  -s, --system <name>     System name (e.g., dnd5e, pf2e)
  -t, --type <type>       Object type (e.g., actor, item, weapon, spell)
  -l, --list              List available systems, object types, or worlds
  -w, --world <name>      Target world for insertion/search
  -i, --insert            Insert validated object into specified world
  -r, --search            Search and retrieve objects from a world
  --name <pattern>        Search by name pattern (supports wildcards * and ?)
  --id <pattern>          Search by ID pattern (supports wildcards * and ?)
  --limit <number>        Limit number of results returned
  --details               Show detailed information about found documents
  --json <number>         Show JSON data (specify max characters)
  -v, --verbose           Enable verbose output
  -h, --help              Show this help message

EXAMPLES:
  # List available systems
  foundry-manager.mjs -l

  # List available worlds
  foundry-manager.mjs -l --listWorlds

  # List object types for D&D 5e system
  foundry-manager.mjs -s dnd5e -l

  # Validate an actor JSON object
  foundry-manager.mjs -s dnd5e -t actor '{"name":"Test Character","type":"character"}'

  # Validate and insert into world
  foundry-manager.mjs -s dnd5e -t actor -w test-world -i '{"name":"Hero","type":"character"}'

  # Search for actors in a world
  foundry-manager.mjs -s dnd5e -t actor -w test-world -r

  # Search for actors by name pattern
  foundry-manager.mjs -s dnd5e -t actor -w test-world -r --name "Test*"

  # Search with detailed output
  foundry-manager.mjs -s dnd5e -t actor -w test-world -r --details --limit 5

  # Search and show JSON data
  foundry-manager.mjs -s dnd5e -t item -w test-world -r --json 500

  # Validate from file (using shell redirection)
  foundry-manager.mjs -s dnd5e -t item < my-item.json

EXIT CODES:
  0    Validation successful
  1    Validation failed or error occurred
`;
        console.log(helpText.trim());
    }

    /**
     * Main execution function
     */
    async run() {
        const args = this.parseArguments();

        if (args.help) {
            this.showHelp();
            process.exit(0);
        }

        try {
            // Initialize the environment
            if (args.verbose) {
                console.log('Initializing FoundryVTT environment...');
            }
            await this.foundryEnv.initialize();

            // Handle listing operations
            if (args.list) {
                await this.handleListOperation(args);
                process.exit(0);
            }

            // Validate required arguments for validation
            if (!args.system) {
                console.error('Error: System (-s) is required for validation');
                console.error('Use -l to list available systems');
                process.exit(1);
            }

            if (!args.type) {
                console.error('Error: Object type (-t) is required for validation');
                console.error(`Use -s ${args.system} -l to list available object types`);
                process.exit(1);
            }

            if (!args.search && !args.jsonString) {
                console.error('Error: JSON string is required for validation');
                console.error('Provide JSON as command line argument or via stdin');
                process.exit(1);
            }

            // Handle search operations
            if (args.search) {
                await this.performSearch(args);
            }
            // Handle world insertion validation
            else if (args.insert) {
                await this.performValidationAndInsertion(args);
            } 
            // Perform regular validation
            else {
                await this.performValidation(args);
            }

        } catch (error) {
            console.error(`Fatal error: ${error.message}`);
            if (args.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    /**
     * Handle list operations
     */
    async handleListOperation(args) {
        if (args.listWorlds) {
            // List all available worlds
            const output = await this.worldManager.listWorlds();
            console.log(output);
        } else if (!args.system) {
            // List all available systems
            const output = await this.systemDiscovery.listSystems();
            console.log(output);
        } else {
            // List object types for specific system
            const output = await this.systemDiscovery.listSystemObjectTypes(args.system);
            console.log(output);
        }
    }

    /**
     * Perform search operations
     */
    async performSearch(args) {
        const { system, type, world, name, id, limit, details, json, verbose } = args;

        // Validate required arguments for search
        if (!world) {
            console.error('Error: World (-w) is required for search');
            console.error('Use -l --listWorlds to list available worlds');
            process.exit(1);
        }

        if (verbose) {
            console.log(`Searching for ${type} objects in world: ${world}`);
        }

        // Validate system and object type combination
        const validation = await this.systemDiscovery.validateSystemObjectType(system, type);
        if (!validation.valid) {
            console.error(`Error: ${validation.error}`);
            process.exit(1);
        }

        // Validate world exists
        const worldValidation = await this.worldManager.validateWorldExists(world);
        if (!worldValidation.valid) {
            console.error(`Error: ${worldValidation.error}`);
            process.exit(1);
        }

        const documentType = validation.documentType;

        try {
            if (verbose) {
                console.log(`Document type: ${documentType}`);
                console.log(`Search patterns: name="${name || 'any'}", id="${id || 'any'}"`);
                if (limit) console.log(`Limit: ${limit} results`);
            }

            // Build search options
            const searchOptions = {};
            if (name) searchOptions.name = name;
            if (id) searchOptions.id = id;
            if (type && validation.subtypes.includes(type)) {
                searchOptions.type = type;
            }
            if (limit) searchOptions.limit = limit;

            // Perform search
            const searchResult = await this.worldManager.searchDocuments(world, documentType, searchOptions);

            // Format and display results
            const formatOptions = {
                showDetails: details || false,
                showJSON: json || 0
            };

            const output = this.worldManager.formatDocumentList(searchResult, formatOptions);
            console.log(output);

            if (searchResult.success && searchResult.totalFound > 0) {
                process.exit(0);
            } else if (searchResult.success && searchResult.totalFound === 0) {
                console.log('\nNo matching documents found.');
                process.exit(0);
            } else {
                console.error('\nSearch failed.');
                process.exit(1);
            }

        } catch (error) {
            console.error(`Search error: ${error.message}`);
            if (verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    /**
     * Perform JSON validation and world insertion
     */
    async performValidationAndInsertion(args) {
        const { system, type, world, jsonString, verbose } = args;

        // Validate required arguments for insertion
        if (!world) {
            console.error('Error: World (-w) is required for insertion');
            console.error('Use -l -w to list available worlds');
            process.exit(1);
        }

        if (verbose) {
            console.log(`Validating ${type} object for insertion into world: ${world}`);
        }

        // Validate system and object type combination
        const validation = await this.systemDiscovery.validateSystemObjectType(system, type);
        if (!validation.valid) {
            console.error(`Error: ${validation.error}`);
            process.exit(1);
        }

        // Validate world exists
        const worldValidation = await this.worldManager.validateWorldExists(world);
        if (!worldValidation.valid) {
            console.error(`Error: ${worldValidation.error}`);
            process.exit(1);
        }

        const documentType = validation.documentType;

        try {
            // Perform normal validation first
            if (verbose) {
                console.log(`Loading system: ${system}`);
                console.log(`Document type: ${documentType}`);
                console.log(`Target world: ${world}`);
            }

            const systemInfo = await this.systemDiscovery.getSystemInfo(system);
            
            // Get base document schema
            const baseSchema = await this.extractDocumentSchema(documentType);
            
            // Get type-specific schema if available
            let typeSchema = null;
            if (validation.subtypes.includes(type)) {
                try {
                    typeSchema = await this.systemDiscovery.extractSchemaForType(system, documentType, type);
                } catch (error) {
                    if (verbose) {
                        console.warn(`Could not extract type-specific schema for ${type}: ${error.message}`);
                    }
                }
            }

            // Create complete validation schema
            const completeSchema = this.schemaExtractor.createCompleteSchema(baseSchema, typeSchema);

            if (verbose) {
                console.log('Schema extracted successfully');
                console.log('Validating JSON object...');
            }

            // Perform validation
            const result = this.validationEngine.validate(jsonString, completeSchema, '', {
                coerceTypes: true
            });

            if (!result.valid) {
                console.error('✗ Validation failed - cannot insert invalid object\n');
                console.error('Errors:');
                result.errors.forEach(error => {
                    console.error(`  ${error.path}: ${error.message}`);
                    if (error.value !== undefined) {
                        console.error(`    Received: ${JSON.stringify(error.value)}`);
                    }
                });
                process.exit(1);
            }

            if (verbose) {
                console.log('✓ Validation successful');
                console.log('Inserting into world...');
            }

            // Insert into world
            const insertResult = await this.worldManager.insertDocument(
                world, 
                documentType, 
                result.normalizedData,
                {
                    systemId: system,
                    systemVersion: systemInfo.version,
                    userId: 'CLI_USER'
                }
            );

            if (insertResult.success) {
                console.log('✓ Successfully inserted into world');
                console.log(`Document ID: ${insertResult.documentId}`);
                console.log(`World: ${insertResult.worldId}`);
                console.log(`Type: ${insertResult.documentType}`);
                
                if (verbose) {
                    console.log('\nInserted JSON:');
                    console.log(this.validationEngine.prettifyJSON(insertResult.insertedData));
                }
                
                process.exit(0);
            } else {
                console.error('✗ Insertion failed');
                console.error(`Error: ${insertResult.error}`);
                process.exit(1);
            }

        } catch (error) {
            console.error(`Validation/insertion error: ${error.message}`);
            if (verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    /**
     * Perform JSON validation
     */
    async performValidation(args) {
        const { system, type, jsonString, verbose } = args;

        if (verbose) {
            console.log(`Validating ${type} object for system: ${system}`);
        }

        // Validate system and object type combination
        const validation = await this.systemDiscovery.validateSystemObjectType(system, type);
        if (!validation.valid) {
            console.error(`Error: ${validation.error}`);
            process.exit(1);
        }

        const documentType = validation.documentType;

        try {
            // Load system and extract schema
            if (verbose) {
                console.log(`Loading system: ${system}`);
                console.log(`Document type: ${documentType}`);
            }

            const systemInfo = await this.systemDiscovery.getSystemInfo(system);
            
            // Get base document schema
            const baseSchema = await this.extractDocumentSchema(documentType);
            
            // Get type-specific schema if available
            let typeSchema = null;
            if (validation.subtypes.includes(type)) {
                try {
                    typeSchema = await this.systemDiscovery.extractSchemaForType(system, documentType, type);
                } catch (error) {
                    if (verbose) {
                        console.warn(`Could not extract type-specific schema for ${type}: ${error.message}`);
                    }
                }
            }

            // Create complete validation schema
            const completeSchema = this.schemaExtractor.createCompleteSchema(baseSchema, typeSchema);

            if (verbose) {
                console.log('Schema extracted successfully');
                console.log('Validating JSON object...');
            }

            // Perform validation
            const result = this.validationEngine.validate(jsonString, completeSchema, '', {
                coerceTypes: true
            });

            // Output results
            if (result.valid) {
                console.log('✓ Validation successful');
                
                if (verbose) {
                    console.log('\nNormalized JSON:');
                }
                console.log(this.validationEngine.prettifyJSON(result.normalizedData));
                
                if (result.warnings.length > 0) {
                    console.log('\nWarnings:');
                    result.warnings.forEach(warning => {
                        console.log(`  ${warning.path}: ${warning.message}`);
                    });
                }
                
                process.exit(0);
            } else {
                console.error('✗ Validation failed\n');
                console.error('Errors:');
                result.errors.forEach(error => {
                    console.error(`  ${error.path}: ${error.message}`);
                    if (error.value !== undefined) {
                        console.error(`    Received: ${JSON.stringify(error.value)}`);
                    }
                });
                
                if (result.warnings.length > 0) {
                    console.log('\nWarnings:');
                    result.warnings.forEach(warning => {
                        console.log(`  ${warning.path}: ${warning.message}`);
                    });
                }
                
                process.exit(1);
            }

        } catch (error) {
            console.error(`Validation error: ${error.message}`);
            if (verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    /**
     * Extract schema for a base document type
     */
    async extractDocumentSchema(documentType) {
        // This would extract the base document schema from FoundryVTT core
        // For now, return a basic schema structure
        const baseSchema = {
            type: 'object',
            properties: {
                _id: {
                    type: 'string',
                    pattern: '^[a-zA-Z0-9]{16}$',
                    description: 'Document ID'
                },
                name: {
                    type: 'string',
                    minLength: 1,
                    description: 'Document name'
                },
                img: {
                    type: 'string',
                    description: 'Image path'
                },
                type: {
                    type: 'string',
                    description: 'Document subtype'
                },
                system: {
                    type: 'object',
                    description: 'System-specific data',
                    additionalProperties: true
                }
            },
            required: ['name'],
            additionalProperties: true
        };

        // Add document-type specific fields
        switch (documentType) {
            case 'Actor':
                baseSchema.properties.items = {
                    type: 'array',
                    description: 'Actor items',
                    items: { type: 'object' }
                };
                baseSchema.properties.effects = {
                    type: 'array',
                    description: 'Active effects',
                    items: { type: 'object' }
                };
                break;
            case 'Item':
                baseSchema.properties.description = {
                    type: 'object',
                    description: 'Item description',
                    properties: {
                        value: { type: 'string' }
                    }
                };
                break;
        }

        return baseSchema;
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

export default FoundryValidator;
