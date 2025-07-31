#!/usr/bin/env node

/**
 * FoundryVTT Object Validator - Main CLI Interface
 * Command-line tool for validating JSON objects against FoundryVTT system schemas
 */

import { parseArgs } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import FoundryEnvironment from './foundry-environment.mjs';
import SystemDiscovery from './system-discovery.mjs';
import WorldManager from './world-manager.mjs';

class FoundryValidator {
    constructor() {
        this.foundryEnv = new FoundryEnvironment();
        this.systemDiscovery = new SystemDiscovery(this.foundryEnv);
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
            'list-systems': {
                type: 'boolean',
                description: 'List available systems'
            },
            'list-worlds': {
                type: 'boolean',
                description: 'List available worlds'
            },
            'list-types': {
                type: 'boolean',
                description: 'List available object types for a system (requires -s)'
            },
            world: {
                type: 'string',
                short: 'w',
                description: 'Target world for insertion (use with --insert)'
            },
            insert: {
                type: 'boolean',
                short: 'i',
                description: 'Insert validated object into specified world'
            },
            update: {
                type: 'boolean',
                short: 'u',
                description: 'Update existing object in specified world'
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
                type: 'boolean',
                description: 'Show full JSON data for found documents'
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
            'no-image': {
                type: 'boolean',
                description: 'Bypass mandatory image requirement for objects'
            },
            'list-images': {
                type: 'boolean',
                description: 'List available images from core and user data'
            },
            schema: {
                type: 'boolean',
                description: 'Extract and display the expected structure (schema) for an object type'
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
                listSystems: values['list-systems'],
                listWorlds: values['list-worlds'],
                listTypes: values['list-types'],
                world: values.world,
                insert: values.insert,
                update: values.update,
                search: values.search,
                name: values.name,
                id: values.id,
                limit: values.limit ? parseInt(values.limit) : undefined,
                details: values.details,
                json: values.json,
                verbose: values.verbose,
                help: values.help,
                noImage: values['no-image'],
                listImages: values['list-images'],
                schema: values.schema,
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
  # Core Operations
  -i, --insert            Insert validated object into specified world
  -u, --update            Update existing object in specified world  
  -r, --search            Search and retrieve objects from a world
  --schema                Extract and display the expected structure (schema)

  # Required Parameters
  -s, --system <name>     System name (e.g., dnd5e, pf2e) - Required for validation-only and schema extraction
  -t, --type <type>       Object type (e.g., character, weapon, spell, npc)
  -w, --world <name>      Target world (auto-detects system when used with -i, -u, -r, --schema)

  # Discovery Operations  
  --list-systems          List available systems
  --list-worlds           List available worlds
  --list-types            List available object types for a system (requires -s)
  --list-images           List available images from core and user data

  # Search Filters
  --name <pattern>        Search by name pattern (supports wildcards * and ?)
  --id <pattern>          Search by ID pattern (supports wildcards * and ?)
  --limit <number>        Limit number of results returned

  # Output Options
  --details               Show detailed information about found documents
  --json                  Show full JSON data for search results (not for schema extraction)
  --no-image              Bypass mandatory image requirement for objects
  -v, --verbose           Enable verbose output
  -h, --help              Show this help message

EXAMPLES:
  # Complete Workflow: Discovery → Schema → Create
  foundry-manager.mjs --list-systems                              # 1. Find available systems
  foundry-manager.mjs --list-types -s dnd5e                       # 2. Find object types for system
  foundry-manager.mjs -s dnd5e -t character --schema              # 3. Get expected structure
  foundry-manager.mjs -w my-world -t character -i '{"name":"Hero","type":"character"}'  # 4. Create object

  # Discovery Operations
  foundry-manager.mjs --list-systems                              # List available systems
  foundry-manager.mjs --list-worlds                               # List available worlds
  foundry-manager.mjs --list-types -s dnd5e                       # List object types for D&D 5e
  foundry-manager.mjs --list-images                               # List available images

  # Schema Extraction
  foundry-manager.mjs -s dnd5e -t character --schema              # Extract character schema (with system)
  foundry-manager.mjs -w my-world -t weapon --schema              # Extract weapon schema (auto-detect system)

  # Object Creation & Validation
  foundry-manager.mjs -s dnd5e -t character '{"name":"Test","type":"character"}'  # Validate only
  foundry-manager.mjs -w my-world -t character -i '{"name":"Hero","type":"character"}'  # Insert into world
  foundry-manager.mjs -w my-world -t character -i --no-image '{"name":"Hero","type":"character"}'  # Skip image validation

  # Search Operations
  foundry-manager.mjs -w my-world -t character -r                 # Search all characters
  foundry-manager.mjs -w my-world -t character -r --name "Hero*"  # Search by name pattern
  foundry-manager.mjs -w my-world -t item -r --details --limit 5  # Search with details, limit results
  foundry-manager.mjs -w my-world -t item -r --json               # Search and show full JSON

  # Update Operations
  foundry-manager.mjs -w my-world -t character -u --id "abc123" '{"name":"New Name"}'     # Update by ID
  foundry-manager.mjs -w my-world -t character -u --name "Hero" '{"hp":{"value":50}}'     # Update by name
  foundry-manager.mjs -w my-world -t item -u --id "xyz789" '{"name":"Magic Sword","system":{"price":100}}'  # Update multiple fields

  # Advanced Usage
  foundry-manager.mjs -s dnd5e -t item < my-item.json             # Validate from file

EXIT CODES:
  0    Validation successful
  1    Validation failed or error occurred
`;
        console.log(helpText.trim());
    }

    /**
     * Extract and display the schema for a given object type
     */
    async extractSchema(args) {
        let { system, type, world, verbose } = args;

        // Auto-detect system from world if not provided
        if (!system && world) {
            try {
                const worldInfo = await this.worldManager.getWorldInfo(world);
                system = worldInfo.system;
                if (verbose) {
                    console.log(`Auto-detected system: ${system} from world: ${world}`);
                }
            } catch (error) {
                console.error(`Error: Could not auto-detect system from world '${world}': ${error.message}`);
                console.error('Use -l --listWorlds to list available worlds');
                process.exit(1);
            }
        }

        // Validate required arguments for schema extraction
        if (!system) {
            console.error('Error: System (-s) is required for schema extraction when no world (-w) is specified');
            console.error('Use -l to list available systems, or specify a world with -w to auto-detect system');
            process.exit(1);
        }

        if (!type) {
            console.error('Error: Object type (-t) is required for schema extraction');
            console.error(`Use -s ${system} -l to list available object types`);
            process.exit(1);
        }

        if (verbose) {
            console.log(`Extracting schema for ${type} in system: ${system}`);
        }

        try {
            // Validate system and object type combination
            const validation = await this.systemDiscovery.validateSystemObjectType(system, type);
            if (!validation.valid) {
                console.error(`Error: ${validation.error}`);
                process.exit(1);
            }

            const documentType = validation.documentType;
            const systemInfo = await this.systemDiscovery.getSystemInfo(system);

            if (verbose) {
                console.log(`Loading system: ${system}`);
                console.log(`Document type: ${documentType}`);
            }

            // Create a minimal document to extract the actual structure
            const dummyData = {
                name: "SchemaExtraction",
                type: type
            };

            // Use FoundryVTT's actual document creation to get the real structure
            const documentData = await this.createFoundryDocument(dummyData, documentType, {
                systemId: system,
                systemVersion: systemInfo.version,
                userId: 'VALIDATEONLYUSER', // Same as validation-only mode
                noImage: true
            });

            // Display the actual structure that FoundryVTT creates
            console.log(`Expected structure for ${type} (${documentType}) in ${system}:`);
            console.log('='.repeat(60));
            console.log('This is the actual structure created by FoundryVTT with all validation and defaults applied:');
            console.log('');
            console.log(JSON.stringify(documentData, null, 2));

        } catch (error) {
            // Enhanced error handling for schema extraction
            await this.handleEnhancedError(error, {
                operation: 'schema extraction',
                system: system,
                type: type,
                world: world,
                verbose: verbose
            });
            process.exit(1);
        }
    }



    /**
     * Enhanced error handling that provides actionable guidance
     */
    async handleEnhancedError(error, context) {
        const { operation, system, type, world, verbose } = context;
        
        console.error(`${operation} error: ${error.message}`);
        
        if (verbose) {
            console.error(error.stack);
        }
        
        // Check if this is an invalid object type error
        if (error.message.includes('not found in system') || error.message.includes('is not a valid type for')) {
            console.error('\n📋 Available object types for this system:');
            
            // Get and display the actual available types
            try {
                const systemInfo = await this.systemDiscovery.getSystemInfo(system);
                const objectTypes = await this.systemDiscovery.getSystemObjectTypes(system);
                
                for (const [docType, config] of Object.entries(systemInfo.documentTypes)) {
                    console.error(`\n${docType} Document Types:`);
                    for (const subtype of config.subtypes) {
                        console.error(`  • ${subtype}`);
                    }
                }
            } catch (listError) {
                console.error(`Run: ./foundry-manager.mjs --list-types -s ${system}`);
            }
            console.error('');
            return;
        }
        
        // Check if this is a validation error (FoundryVTT document validation)
        if (error.message.includes('validation errors') || error.message.includes('may not be undefined')) {
            console.error('\n📋 Expected structure for this object type:');
            console.error(`Run: ./foundry-manager.mjs -s ${system} -t ${type} --schema`);
            console.error('');
            console.error('💡 This will show you the complete expected JSON structure with all required fields.');
            
            // If we have world context, show that the schema is specific to this system
            if (world) {
                console.error(`   (Schema for ${type} in ${system} system used by world '${world}')`);
            }
            console.error('');
            return;
        }
        
        // For other errors, just show the basic error
        console.error('');
    }

    /**
     * Main execution function
     */
    async run() {
        if (process.argv.length === 2) {
            this.showHelp();
            process.exit(0);
        }

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
            if (args.listSystems || args.listWorlds || args.listTypes) {
                await this.handleListOperation(args);
                process.exit(0);
            }

            // Handle image listing
            if (args.listImages) {
                await this.listAvailableImages(args);
                process.exit(0);
            }

            // Handle schema extraction
            if (args.schema) {
                await this.extractSchema(args);
                process.exit(0);
            }

            // Auto-detect system from world if world is provided but system is not
            if (!args.system && args.world) {
                try {
                    const worldInfo = await this.worldManager.getWorldInfo(args.world);
                    args.system = worldInfo.system;
                    if (args.verbose) {
                        console.log(`Auto-detected system: ${args.system} from world: ${args.world}`);
                    }
                } catch (error) {
                    console.error(`Error: Could not auto-detect system from world '${args.world}': ${error.message}`);
                    console.error('Use -l --listWorlds to list available worlds');
                    process.exit(1);
                }
            }

            // Validate required arguments for validation
            if (!args.system) {
                console.error('Error: System (-s) is required for validation when no world (-w) is specified');
                console.error('Use -l to list available systems, or specify a world with -w to auto-detect system');
                process.exit(1);
            }

            if (!args.type) {
                console.error('Error: Object type (-t) is required for validation');
                console.error(`Use -s ${args.system} -l to list available object types`);
                process.exit(1);
            }

            if (!args.search && !args.update && !args.jsonString) {
                console.error('Error: JSON string is required for validation');
                console.error('Provide JSON as command line argument or via stdin');
                process.exit(1);
            }

            // Handle search operations
            if (args.search) {
                await this.performSearch(args);
            }
            // Handle update operations
            else if (args.update) {
                await this.performUpdate(args);
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
            // Always try enhanced error handling for operations with type parameter
            if (args.type && (args.insert || args.update || args.search)) {
                // If we have a world, try to auto-detect system for error handling
                let systemForError = args.system;
                if (!systemForError && args.world) {
                    try {
                        const worldInfo = await this.worldManager.getWorldInfo(args.world);
                        systemForError = worldInfo.system;
                    } catch (worldError) {
                        // Fall through to basic error handling
                    }
                }
                
                if (systemForError) {
                    await this.handleEnhancedError(error, {
                        operation: 'operation',
                        system: systemForError,
                        type: args.type,
                        world: args.world,
                        verbose: args.verbose
                    });
                    process.exit(1);
                }
            }
            
            // Fallback to basic error handling
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
        } else if (args.listSystems) {
            // List all available systems
            const output = await this.systemDiscovery.listSystems();
            console.log(output);
        } else if (args.listTypes) {
            // List object types for specific system
            if (!args.system) {
                console.error('Error: System (-s) is required when using --list-types');
                console.error('Use --list-systems to see available systems');
                process.exit(1);
            }
            const output = await this.systemDiscovery.listSystemObjectTypes(args.system);
            console.log(output);
        }
    }

    /**
     * Perform search operations
     */
    async performSearch(args) {
        let { system, type, world, name, id, limit, details, json, verbose } = args;

        // Validate required arguments for search
        if (!world) {
            console.error('Error: World (-w) is required for search');
            console.error('Use -l --listWorlds to list available worlds');
            process.exit(1);
        }

        // Auto-detect system from world if not provided
        if (!system && world) {
            try {
                const worldInfo = await this.worldManager.getWorldInfo(world);
                system = worldInfo.system;
                if (verbose) {
                    console.log(`Auto-detected system: ${system} from world: ${world}`);
                }
            } catch (error) {
                console.error(`Error: Could not auto-detect system from world '${world}': ${error.message}`);
                console.error('Use -l --listWorlds to list available worlds');
                process.exit(1);
            }
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
            if (type && validation && validation.subtypes && validation.subtypes.includes(type)) {
                searchOptions.type = type;
            }
            if (limit) searchOptions.limit = limit;

            // Perform search
            const searchResult = await this.worldManager.searchDocuments(world, documentType, searchOptions);

            // Format and display results
            const formatOptions = {
                showDetails: details || false,
                showJSON: json || false
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
        const { system, type, world, jsonString, verbose, noImage } = args;

        // Validate required arguments for insertion
        if (!world) {
            console.error('Error: World (-w) is required for insertion');
            console.error('Use -l -w to list available worlds');
            process.exit(1);
        }

        if (verbose) {
            console.log(`Validating ${type} object for insertion into world: ${world}`);
        }

        let validation;
        try {
            // Validate system and object type combination
            validation = await this.systemDiscovery.validateSystemObjectType(system, type);
            if (!validation.valid) {
                // Create error object for enhanced error handling
                const error = new Error(validation.error);
                await this.handleEnhancedError(error, {
                    operation: 'validation',
                    system: system,
                    type: type,
                    world: world,
                    verbose: verbose
                });
                process.exit(1);
            }
        } catch (error) {
            // Enhanced error handling for invalid object type
            await this.handleEnhancedError(error, {
                operation: 'validation',
                system: system,
                type: type,
                world: world,
                verbose: verbose
            });
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
            
            if (verbose) {
                console.log('Loading FoundryVTT document class...');
            }

            // Get the actual GM user ID from the world
            const gmUserId = await this.worldManager.getGMUserId(world);
            
            // Use FoundryVTT's actual document creation process
            const documentData = await this.createFoundryDocument(jsonString, documentType, {
                systemId: system,
                systemVersion: systemInfo.version,
                userId: gmUserId,
                noImage: noImage
            });

            if (verbose) {
                console.log('✓ Document created with FoundryVTT validation');
                console.log('Inserting into world...');
            }

            // Insert into world
            const insertResult = await this.worldManager.insertDocument(
                world, 
                documentType, 
                documentData,
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
                    console.log(JSON.stringify(insertResult.insertedData, null, 2));
                }
                
                process.exit(0);
            } else {
                console.error('✗ Insertion failed');
                console.error(`Error: ${insertResult.error}`);
                process.exit(1);
            }

        } catch (error) {
            // Enhanced error handling with auto-detected system
            await this.handleEnhancedError(error, {
                operation: 'validation/insertion',
                system: system,
                type: type,
                world: world,
                verbose: verbose
            });
            process.exit(1);
        }
    }

    /**
     * Perform document update operation
     */
    async performUpdate(args) {
        const { system, type, world, id, name, jsonString, verbose, noImage } = args;

        // Validate required arguments for update
        if (!world) {
            console.error('Error: World (-w) is required for update');
            console.error('Use -l --listWorlds to list available worlds');
            process.exit(1);
        }

        if (!id && !name) {
            console.error('Error: Document ID (--id) or name pattern (--name) is required for update');
            console.error('Specify which document to update');
            process.exit(1);
        }

        if (!jsonString) {
            console.error('Error: JSON update data is required');
            console.error('Provide JSON as command line argument or via stdin');
            process.exit(1);
        }

        if (verbose) {
            console.log(`Updating ${type} object in world: ${world}`);
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
            let targetDocumentId = id;

            // If searching by name, find the document first
            if (!targetDocumentId && name) {
                const searchResult = await this.worldManager.searchDocuments(world, documentType, { name });
                
                if (!searchResult.success) {
                    console.error(`Search error: ${searchResult.error}`);
                    process.exit(1);
                }

                if (searchResult.documents.length === 0) {
                    console.error(`No documents found matching name pattern: ${name}`);
                    process.exit(1);
                }

                if (searchResult.documents.length > 1) {
                    console.error(`Multiple documents found matching name pattern: ${name}`);
                    console.error('Please use --id to specify exact document, or refine your search pattern.');
                    console.error('\nMatching documents:');
                    searchResult.documents.forEach(doc => {
                        console.error(`  - ${doc.name} (ID: ${doc._id})`);
                    });
                    process.exit(1);
                }

                targetDocumentId = searchResult.documents[0]._id;
                if (verbose) {
                    console.log(`Found document: ${searchResult.documents[0].name} (ID: ${targetDocumentId})`);
                }
            }

            // Parse the update JSON
            let updateData;
            try {
                updateData = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
            } catch (error) {
                console.error(`Invalid JSON: ${error.message}`);
                process.exit(1);
            }

            if (verbose) {
                console.log(`Loading system: ${system}`);
                console.log(`Document type: ${documentType}`);
                console.log(`Document ID: ${targetDocumentId}`);
            }

            const systemInfo = await this.systemDiscovery.getSystemInfo(system);

            // First, retrieve the existing document
            const getResult = await this.worldManager.getDocument(world, documentType, targetDocumentId);
            
            if (!getResult.success) {
                console.error(`Error retrieving document: ${getResult.error}`);
                process.exit(1);
            }

            const existingDocument = getResult.document;
            
            if (verbose) {
                console.log('✓ Document retrieved successfully');
                console.log(`Current name: ${existingDocument.name}`);
            }

            // Merge the update data with existing document
            const mergedData = this.worldManager.mergeDocumentData(existingDocument, updateData);

            // Validate the merged document using FoundryVTT's validation
            const gmUserId = await this.worldManager.getGMUserId(world);
            
            // Use FoundryVTT's actual document creation process for validation
            const validatedData = await this.createFoundryDocument(mergedData, documentType, {
                systemId: system,
                systemVersion: systemInfo.version,
                userId: gmUserId,
                noImage: noImage
            });

            if (verbose) {
                console.log('✓ Updated document validated with FoundryVTT');
                console.log('Performing update...');
            }

            // Perform the update
            const updateResult = await this.worldManager.updateDocument(
                world, 
                documentType, 
                targetDocumentId, 
                updateData,
                {
                    systemId: system,
                    systemVersion: systemInfo.version,
                    userId: gmUserId
                }
            );

            if (updateResult.success) {
                console.log('✓ Successfully updated document');
                console.log(`Document ID: ${updateResult.documentId}`);
                console.log(`World: ${updateResult.worldId}`);
                console.log(`Type: ${updateResult.documentType}`);
                
                if (verbose) {
                    console.log('\nUpdated document:');
                    console.log(JSON.stringify(updateResult.updatedData, null, 2));
                }
                
                process.exit(0);
            } else {
                console.error('✗ Update failed');
                console.error(`Error: ${updateResult.error}`);
                process.exit(1);
            }

        } catch (error) {
            // Enhanced error handling with auto-detected system
            await this.handleEnhancedError(error, {
                operation: 'update',
                system: system,
                type: type,
                world: world,
                verbose: verbose
            });
            process.exit(1);
        }
    }

    /**
     * Perform JSON validation
     */
    async performValidation(args) {
        const { system, type, jsonString, verbose, noImage } = args;

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
            if (verbose) {
                console.log(`Loading system: ${system}`);
                console.log(`Document type: ${documentType}`);
            }

            const systemInfo = await this.systemDiscovery.getSystemInfo(system);
            
            if (verbose) {
                console.log('Creating document with FoundryVTT validation...');
            }

            // Use FoundryVTT's actual document creation process (validation only, no world context)
            const documentData = await this.createFoundryDocument(jsonString, documentType, {
                systemId: system,
                systemVersion: systemInfo.version,
                userId: 'VALIDATEONLYUSER',
                noImage: noImage
            });

            console.log('✓ Validation successful');
            
            if (verbose) {
                console.log('\nValidated and normalized JSON:');
            }
            console.log(JSON.stringify(documentData, null, 2));
            
            process.exit(0);

        } catch (error) {
            console.error(`Validation error: ${error.message}`);
            if (verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    /**
     * Create a document using FoundryVTT's actual document creation process
     */
    async createFoundryDocument(jsonString, documentType, options = {}) {
        try {
            // Parse the input JSON
            let inputData;
            try {
                inputData = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
            } catch (error) {
                throw new Error(`Invalid JSON: ${error.message}`);
            }

            // Import the actual FoundryVTT document class
            const documentPath = join(this.foundryEnv.resourcesPath, 'common', 'documents', `${documentType.toLowerCase()}.mjs`);
            
            if (!existsSync(documentPath)) {
                throw new Error(`Document class not found: ${documentType}`);
            }
            
            const DocumentClass = await import(`file://${documentPath}`);
            const BaseDocument = DocumentClass.default;
            
            if (!BaseDocument) {
                throw new Error(`Invalid document class: ${documentType}`);
            }

            // Add required fields with proper FoundryVTT structure
            // Generate userId if not provided
            const userId = options.userId || this.generateUserId();
            
            const documentData = {
                ...inputData,
                _id: inputData._id || this.generateDocumentId(),
                _stats: {
                    compendiumSource: null,
                    duplicateSource: null,
                    coreVersion: options.coreVersion || "12.331",
                    systemId: options.systemId || "unknown",
                    systemVersion: options.systemVersion || "1.0.0",
                    createdTime: Date.now(),
                    modifiedTime: Date.now(),
                    lastModifiedBy: userId
                }
            };

            // Create document instance using FoundryVTT's constructor
            // This will handle validation and apply defaults
            
            const doc = new BaseDocument(documentData, {});
            
            // Get the validated document data
            const validatedData = doc.toObject();
            
            // Custom image validation (unless bypassed with --no-image)
            if (!options.noImage) {
                // Check if the document has an img field and if it's valid
                const defaultImages = ["icons/svg/mystery-man.svg", "icons/svg/item-bag.svg"];
                if (!validatedData.img || defaultImages.includes(validatedData.img)) {
                    throw new Error(
                        `Image is required for ${documentType} objects. ` +
                        `Provide an 'img' field with a valid image path, or use --no-image to bypass this requirement. ` +
                        `Use --list-images to see available images.`
                    );
                }
                
                // Check if the image file actually exists in foundry-data or foundry-app
                if (!await this.validateImageExists(validatedData.img)) {
                    throw new Error(
                        `Image file '${validatedData.img}' does not exist in foundry-data or foundry-app directories. ` +
                        `Use --list-images to see available images, or use --no-image to bypass this requirement.`
                    );
                }
            }
            
            // Return the validated and normalized document data
            return validatedData;
            
        } catch (error) {
            throw new Error(`Failed to create FoundryVTT document: ${error.message}`);
        }
    }

    /**
     * Validate that an image file exists in foundry-data or foundry-app directories
     */
    async validateImageExists(imagePath) {
        if (!imagePath) return false;
        
        try {
            // Check for various possible image locations
            const possiblePaths = [];
            
            // 1. Core FoundryVTT app icons (foundry-app/resources/app/ui/icons/)
            if (imagePath.startsWith('icons/')) {
                possiblePaths.push(join(this.foundryEnv.foundryPath, 'resources', 'app', 'ui', imagePath));
            }
            
            // 2. System icons (foundry-data/Data/systems/{system}/icons/)
            if (imagePath.startsWith('systems/')) {
                possiblePaths.push(join(this.foundryEnv.dataPath, 'Data', imagePath));
            }
            
            // 3. User data icons (foundry-data/Data/icons/)
            if (imagePath.startsWith('icons/')) {
                possiblePaths.push(join(this.foundryEnv.dataPath, 'Data', imagePath));
            }
            
            // 4. Direct path in user data (foundry-data/Data/)
            possiblePaths.push(join(this.foundryEnv.dataPath, 'Data', imagePath));
            
            // 5. Alternative core locations (foundry-app/resources/app/public/icons/)
            if (imagePath.startsWith('icons/')) {
                possiblePaths.push(join(this.foundryEnv.foundryPath, 'resources', 'app', 'public', imagePath));
            }
            
            // Check if any of these paths exist
            for (const path of possiblePaths) {
                if (existsSync(path)) {
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            // If there's an error checking paths, return false (image doesn't exist)
            return false;
        }
    }

    /**
     * List available images from core and user data
     */
    async listAvailableImages(args) {
        const { verbose } = args;
        
        try {
            const { readdir, stat } = await import('fs/promises');
            const images = {
                core: [],
                systems: {},
                userData: []
            };
            
            // Image extensions to look for
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
            
            // Helper function to recursively scan directories
            const scanDirectory = async (dir, baseDir, collection, depth = 0, maxDepth = 3) => {
                if (depth > maxDepth) return;
                
                try {
                    const entries = await readdir(dir);
                    
                    for (const entry of entries) {
                        const fullPath = join(dir, entry);
                        const stats = await stat(fullPath);
                        
                        if (stats.isDirectory() && !entry.startsWith('.')) {
                            await scanDirectory(fullPath, baseDir, collection, depth + 1, maxDepth);
                        } else if (stats.isFile()) {
                            const ext = entry.toLowerCase().substring(entry.lastIndexOf('.'));
                            if (imageExtensions.includes(ext)) {
                                const relativePath = fullPath.replace(baseDir + '/', '');
                                collection.push(relativePath);
                            }
                        }
                    }
                } catch (error) {
                    if (verbose) {
                        console.warn(`Could not scan directory ${dir}: ${error.message}`);
                    }
                }
            };
            
            // Scan core icons
            const coreIconsPath = join(this.foundryEnv.foundryPath, 'resources', 'app', 'ui', 'icons');
            if (existsSync(coreIconsPath)) {
                console.log('Scanning core icons...');
                await scanDirectory(coreIconsPath, coreIconsPath, images.core);
            }
            
            // Scan system icons
            const systemsPath = this.foundryEnv.systemsPath;
            if (existsSync(systemsPath)) {
                const systems = await readdir(systemsPath);
                for (const systemId of systems) {
                    const systemIconsPath = join(systemsPath, systemId, 'icons');
                    if (existsSync(systemIconsPath)) {
                        console.log(`Scanning ${systemId} system icons...`);
                        images.systems[systemId] = [];
                        await scanDirectory(systemIconsPath, join(systemsPath, systemId), images.systems[systemId]);
                    }
                }
            }
            
            // Scan user data icons
            const userDataPath = this.foundryEnv.dataPath;
            const userIconsPath = join(userDataPath, 'icons');
            if (existsSync(userIconsPath)) {
                console.log('Scanning user data icons...');
                await scanDirectory(userIconsPath, userDataPath, images.userData);
            }
            
            // Display results
            console.log('\n=== Available Images ===\n');
            
            if (images.core.length > 0) {
                console.log(`Core Icons (${images.core.length} found):`);
                console.log('Base path: icons/');
                
                // Group by subdirectory
                const grouped = {};
                for (const img of images.core.sort()) {
                    const parts = img.split('/');
                    const category = parts[0] || 'root';
                    if (!grouped[category]) grouped[category] = [];
                    grouped[category].push(img);
                }
                
                for (const [category, imgs] of Object.entries(grouped)) {
                    console.log(`\n  ${category}/`);
                    for (const img of imgs.slice(0, 5)) {
                        console.log(`    icons/${img}`);
                    }
                    if (imgs.length > 5) {
                        console.log(`    ... and ${imgs.length - 5} more`);
                    }
                }
            }
            
            // Display system icons
            for (const [systemId, systemImages] of Object.entries(images.systems)) {
                if (systemImages.length > 0) {
                    console.log(`\n\n${systemId} System Icons (${systemImages.length} found):`);
                    console.log(`Use as: systems/${systemId}/icons/...`);
                    
                    // Group by subdirectory
                    const grouped = {};
                    for (const img of systemImages.sort()) {
                        const parts = img.replace('icons/', '').split('/');
                        const category = parts[0] || 'root';
                        if (!grouped[category]) grouped[category] = [];
                        grouped[category].push(img);
                    }
                    
                    for (const [category, imgs] of Object.entries(grouped)) {
                        console.log(`\n  ${category}/`);
                        for (const img of imgs.slice(0, 3)) {
                            console.log(`    systems/${systemId}/${img}`);
                        }
                        if (imgs.length > 3) {
                            console.log(`    ... and ${imgs.length - 3} more`);
                        }
                    }
                }
            }
            
            if (images.userData.length > 0) {
                console.log(`\n\nUser Data Icons (${images.userData.length} found):`);
                console.log(`Base path: ${userDataPath}`);
                
                for (const img of images.userData.slice(0, 10)) {
                    console.log(`  ${img}`);
                }
                if (images.userData.length > 10) {
                    console.log(`  ... and ${images.userData.length - 10} more`);
                }
            }
            
            console.log('\n=== Usage ===');
            console.log('Use these paths in the "img" field of your objects.');
            console.log('System icons: "systems/{systemId}/icons/..."');
            console.log('User icons: "icons/..."');
            
            if (!images.core.length && Object.keys(images.systems).length === 0 && !images.userData.length) {
                console.log('\nNo custom images found. You can:');
                console.log('1. Add images to: ' + join(userDataPath, 'icons'));
                console.log('2. Use external URLs (if supported by your FoundryVTT configuration)');
                console.log('3. Use system-provided images from installed systems');
            }
            
        } catch (error) {
            console.error(`Error listing images: ${error.message}`);
            if (verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    /**
     * Generate a random user ID for FoundryVTT (16-character alphanumeric)
     */
    generateUserId() {
        // FoundryVTT expects exactly 16 alphanumeric characters
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        
        for (let i = 0; i < 16; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        
        return result;
    }

    /**
     * Generate a random document ID for FoundryVTT
     */
    generateDocumentId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const bytes = randomBytes(16);
        
        for (let i = 0; i < 16; i++) {
            result += chars[bytes[i] % chars.length];
        }
        
        return result;
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
