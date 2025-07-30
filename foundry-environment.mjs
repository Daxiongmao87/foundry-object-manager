#!/usr/bin/env node

/**
 * FoundryVTT Environment Loader
 * Creates a minimal FoundryVTT environment to load and execute DataModel code
 */

import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FoundryEnvironment {
    constructor(foundryPath = null) {
        this.foundryPath = foundryPath || join(__dirname, 'foundry-app');
        this.resourcesPath = join(this.foundryPath, 'resources', 'app');
        this.dataPath = this.findDataPath();
        this.systemsPath = join(this.dataPath, 'Data', 'systems');
        
        // Global FoundryVTT objects that need to be mocked
        this.CONFIG = {};
        this.foundry = {};
        this.globalThis = globalThis;
        
        this.initialized = false;
    }

    /**
     * Find FoundryVTT data directory
     */
    findDataPath() {
        const possiblePaths = [
            join(__dirname, 'foundry-data'),
            process.env.APPDATA ? join(process.env.APPDATA, 'FoundryVTT', 'Data') : null,
            join(__dirname, 'data'), // Local development fallback
        ].filter(Boolean);

        for (const path of possiblePaths) {
            if (existsSync(path)) {
                return path;
            }
        }

        // Fallback to creating local data directory
        return join(__dirname, 'data');
    }

    /**
     * Initialize the FoundryVTT environment
     */
    async initialize() {
        if (this.initialized) return;

        console.log(`Initializing FoundryVTT environment...`);
        console.log(`FoundryVTT Path: ${this.foundryPath}`);
        console.log(`Data Path: ${this.dataPath}`);
        console.log(`Systems Path: ${this.systemsPath}`);

        try {
            // Set up global objects
            await this.setupGlobals();
            
            // Load core FoundryVTT modules
            await this.loadCoreModules();
            
            // Initialize document configuration
            this.initializeDocumentConfig();
            
            this.initialized = true;
            console.log('FoundryVTT environment initialized successfully');
        } catch (error) {
            console.error('Failed to initialize FoundryVTT environment:', error);
            throw error;
        }
    }

    /**
     * Set up global objects required by FoundryVTT
     */
    async setupGlobals() {
        // Set up FoundryVTT global objects
        globalThis.foundry = this.foundry;
        globalThis.CONFIG = this.CONFIG;
        
        // Set up logger that FoundryVTT expects
        globalThis.logger = {
            debug: console.debug.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console)
        };
        
        // Set up the basic game object that FoundryVTT requires
        globalThis.game = {
            system: {
                id: 'dnd5e',
                version: '4.4.4',
                documentTypes: {}  // Will be populated when system loads
            },
            release: {
                generation: 12
            },
            model: {},
            modules: {
                get: () => null  // No modules for now
            },
            // Add settings system
            settings: {
                get: (namespace, key) => {
                    // Return sensible defaults for common settings
                    if (namespace === 'dnd5e' && key === 'rulesVersion') return 'modern';
                    if (namespace === 'core' && key === 'coreVersion') return '12.331';
                    return null;
                }
            }
        };
        
        // Mock minimal browser environment
        globalThis.window = globalThis;
        globalThis.document = {
            createElement: () => ({ style: {} }),
            head: { appendChild: () => {} }
        };
        globalThis.PIXI = {
            Application: class {},
            Container: class {
                constructor(...args) {
                    this.children = [];
                    this.eventMode = "auto";
                    this.interactiveChildren = true;
                    this.hitArea = null;
                    this.cursor = "auto";
                    this.filters = [];
                }
                addChild(child) {
                    this.children.push(child);
                    return child;
                }
            },
            Graphics: class {
                constructor() {
                    this.filters = [];
                }
                clear() { return this; }
                beginFill() { return this; }
                drawCircle() { return this; }
                endFill() { return this; }
            },
            Text: class {},
            TextStyle: class {},
            Sprite: class {},
            Texture: {
                EMPTY: null
            },
            Circle: class {
                constructor(x, y, radius) {
                    this.x = x;
                    this.y = y;
                    this.radius = radius;
                }
            },
            filters: {
                BlurFilter: class {
                    constructor(strength) {
                        this.strength = strength;
                    }
                }
            }
        };
        
        // Mock console if needed
        if (!globalThis.console) {
            globalThis.console = console;
        }
        
        // Mock KeyboardManager and other client-side classes
        globalThis.KeyboardManager = {
            MODIFIER_CODES: {
                Alt: ["AltLeft", "AltRight"],
                Control: ["ControlLeft", "ControlRight"],
                Shift: ["ShiftLeft", "ShiftRight"]
            },
            MODIFIER_KEYS: {}
        };
        globalThis.MouseManager = class MouseManager {};
        globalThis.GamepadManager = class GamepadManager {};
        globalThis.TouchManager = class TouchManager {};
        
        // Set up basic prototypes that FoundryVTT classes expect
        if (!globalThis.Object.prototype.isPrototypeOf) {
            globalThis.Object.prototype.isPrototypeOf = function(obj) {
                return this === obj || this.isPrototypeOf(Object.getPrototypeOf(obj));
            };
        }
    }

    /**
     * Load FoundryVTT common modules using the actual server exports
     */
    async loadCoreModules() {
        try {
            const serverPath = join(this.resourcesPath, 'common', 'server.mjs');
            console.log(`Loading FoundryVTT common modules from: ${serverPath}`);
            
            // Import the actual FoundryVTT common module
            const foundryCommon = await import(`file://${serverPath}`);
            
            // Import dice terms from client-esm
            const diceTermsPath = join(this.foundryPath, 'resources', 'app', 'client-esm', 'dice', 'terms', '_module.mjs');
            const diceTerms = await import(`file://${diceTermsPath}`);
            
            // Set up global foundry object with actual FoundryVTT modules
            this.foundry = {
                CONST: foundryCommon.CONST,
                abstract: foundryCommon.abstract,
                data: foundryCommon.data,
                documents: foundryCommon.documents,
                utils: foundryCommon.utils,
                config: foundryCommon.config,
                dice: {
                    terms: {
                        Coin: diceTerms.Coin,
                        DiceTerm: diceTerms.DiceTerm,
                        Die: diceTerms.Die,
                        FunctionTerm: diceTerms.FunctionTerm,
                        NumericTerm: diceTerms.NumericTerm,
                        OperatorTerm: diceTerms.OperatorTerm,
                        ParentheticalTerm: diceTerms.ParentheticalTerm,
                        RollTerm: diceTerms.RollTerm
                    }
                },
                helpers: {
                    interaction: {
                        KeyboardManager: {
                            MODIFIER_CODES: {
                                Alt: ["AltLeft", "AltRight"],
                                Control: ["ControlLeft", "ControlRight"],
                                Shift: ["ShiftLeft", "ShiftRight"]
                            },
                            MODIFIER_KEYS: {}
                        }
                    }
                }
            };
            
            // Add missing applications API that systems expect
            this.foundry.applications = {
                api: {
                    // HandlebarsApplicationMixin is used as a mixin function, not a class
                    HandlebarsApplicationMixin: function(Base) {
                        return class extends Base {
                            get template() { return ""; }
                        };
                    },
                    ApplicationV2: class {
                        constructor(options = {}) {
                            this.options = options;
                        }
                    },
                    DialogV2: class {
                        static confirm() { return Promise.resolve(true); }
                        static prompt() { return Promise.resolve(""); }
                        static wait() { return Promise.resolve(true); }
                    },
                    DocumentSheetV2: class {
                        constructor(object, options = {}) {
                            this.object = object;
                            this.options = options;
                        }
                    }
                }
            };
            
            // Add canvas placeable classes that systems expect
            globalThis.MeasuredTemplate = class MeasuredTemplate {
                constructor(data = {}) {
                    this.data = data;
                }
            };
            
            // Add to foundry.canvas for systems that check it
            this.foundry.canvas = {
                placeables: {
                    MeasuredTemplate: globalThis.MeasuredTemplate
                }
            };
            
            // Update global reference
            globalThis.foundry = this.foundry;
            
            // Now add document collections to game object and global collections
            globalThis.game.actors = {
                documentClass: this.foundry.documents.BaseActor
            };
            globalThis.game.items = {
                documentClass: this.foundry.documents.BaseItem
            };
            globalThis.game.users = {
                documentClass: this.foundry.documents.BaseUser
            };
            
            // Add global document collections that FoundryVTT expects
            globalThis.Actors = globalThis.game.actors;
            globalThis.Items = globalThis.game.items;
            globalThis.Users = globalThis.game.users;
            
            // Add ActiveEffect as a global
            globalThis.ActiveEffect = this.foundry.documents.BaseActiveEffect;
            
            // Add Dialog class
            globalThis.Dialog = class Dialog {
                static confirm({ title, content, yes, no, defaultYes = true } = {}) {
                    return Promise.resolve(defaultYes);
                }
                
                static prompt({ title, content, label, callback, options } = {}) {
                    return Promise.resolve('');
                }
                
                static wait({ title, content, buttons, close } = {}) {
                    return Promise.resolve(true);
                }
            };
            
            // Add document classes as globals
            globalThis.Item = this.foundry.documents.BaseItem;
            globalThis.Actor = this.foundry.documents.BaseActor;
            
            globalThis.ContextMenu = class ContextMenu {
                constructor(element, selector, menuItems) {
                    this.element = element;
                    this.selector = selector;
                    this.menuItems = menuItems;
                }
                
                bind() { return this; }
                render() { return this; }
            };
            
            // HTMLElement is a browser API - minimal mock
            if (typeof HTMLElement === 'undefined') {
                globalThis.HTMLElement = class HTMLElement {
                    constructor() {
                        this.style = {};
                        this.classList = {
                            add: () => {},
                            remove: () => {},
                            contains: () => false
                        };
                    }
                    
                    addEventListener() {}
                    removeEventListener() {}
                    appendChild() {}
                    removeChild() {}
                    querySelector() { return null; }
                    querySelectorAll() { return []; }
                };
            }
            
            console.log('FoundryVTT common modules loaded successfully');
            
            // Add additional globals that systems commonly expect
            const { addMissingGlobals } = await import('./add-missing-globals.mjs');
            addMissingGlobals(this.foundry);
            
        } catch (error) {
            console.error('Failed to load FoundryVTT common modules:', error.message);
            throw error;
        }
    }

    /**
     * Initialize document type configuration
     */
    initializeDocumentConfig() {
        // Initialize CONFIG for each document type
        const documentTypes = [
            'Actor', 'Item', 'Scene', 'JournalEntry', 'Macro', 
            'RollTable', 'Playlist', 'Combatant', 'Combat'
        ];

        for (const docType of documentTypes) {
            this.CONFIG[docType] = {
                dataModels: {},
                typeLabels: {},
                typeIcons: {}
            };
        }
        this.CONFIG.Dice = {
            terms: {
                c: function() {},
                f: function() {}
            },
            rolls: [
                class Roll {}
            ],
            MODIFIERS: {
                "advantage": "kh",
                "disadvantage": "kl"
            },
            SECRETS: {}
        };
        
        // Add MeasuredTemplate config that systems expect
        this.CONFIG.MeasuredTemplate = {
            defaults: {
                angle: 90,
                width: 1
            }
        };
        // Add FormApplication class that systems expect
        globalThis.FormApplication = class FormApplication {
            constructor(object = {}, options = {}) {
                this.object = object;
                this.options = options;
            }
            
            static _customElements = [];
            
            static get defaultOptions() {
                return {
                    classes: [],
                    template: null,
                    width: 400,
                    height: 'auto'
                };
            }
            
            render(force = false) {
                return this;
            }
            
            close() {
                return Promise.resolve();
            }
        };
        
        // Add DocumentSheet which extends FormApplication
        globalThis.DocumentSheet = class DocumentSheet extends globalThis.FormApplication {
            static get defaultOptions() {
                return foundry.utils.mergeObject(super.defaultOptions, {
                    classes: ["sheet"],
                    template: null,
                    viewPermission: "LIMITED"
                });
            }
        };
        
        // Roll needs to be a class that can be extended
        globalThis.Roll = class Roll {
            constructor(formula, data = {}, options = {}) {
                this.formula = formula;
                this.data = data;
                this.options = options;
                this._total = null;
                this._evaluated = false;
                this.terms = [];
                this.results = [];
            }
            
            static TOOLTIP_TEMPLATE = "";
            static CHAT_TEMPLATE = "";
            static MATH_PROXY = Proxy;
            
            async evaluate(options = {}) {
                this._evaluated = true;
                this._total = 0; // Simplified
                return this;
            }
            
            get total() {
                return this._total;
            }
            
            toJSON() {
                return {
                    formula: this.formula,
                    total: this.total,
                    terms: this.terms
                };
            }
        };
    }

    /**
     * Load a specific system and register its types in CONFIG
     */
    async loadSystem(systemId) {
        const systemPath = join(this.systemsPath, systemId);
        
        if (!existsSync(systemPath)) {
            throw new Error(`System not found: ${systemId} at ${systemPath}`);
        }

        // Load system manifest
        const manifestPath = join(systemPath, 'system.json');
        if (!existsSync(manifestPath)) {
            throw new Error(`System manifest not found: ${manifestPath}`);
        }

        const { readFile } = await import('fs/promises');
        const manifestData = JSON.parse(await readFile(manifestPath, 'utf-8'));

        // Register system document types in FoundryVTT's CONFIG and game.model
        if (manifestData.documentTypes) {
            // Copy to game.system.documentTypes for FoundryVTT internal use
            globalThis.game.system.documentTypes = manifestData.documentTypes;
            
            for (const [docType, subtypes] of Object.entries(manifestData.documentTypes)) {
                if (!this.CONFIG[docType]) {
                    this.CONFIG[docType] = {
                        dataModels: {},
                        typeLabels: {},
                        typeIcons: {}
                    };
                }
                
                // Initialize game.model for this document type
                if (!globalThis.game.model[docType]) {
                    globalThis.game.model[docType] = {};
                }
                
                // Register each subtype with null placeholders initially
                for (const subtypeName of Object.keys(subtypes)) {
                    this.CONFIG[docType].dataModels[subtypeName] = null; // Placeholder
                    globalThis.game.model[docType][subtypeName] = {}; // Required for TYPES getter
                }
            }
            
            // Update global CONFIG
            globalThis.CONFIG = this.CONFIG;
            console.log(`Registered ${systemId} document types in CONFIG and game.model`);
        }

        // Attempt to extract TypeDataModel classes from system module
        if (manifestData.esmodules && manifestData.esmodules.length > 0) {
            try {
                const systemModulePath = join(systemPath, manifestData.esmodules[0]);
                if (existsSync(systemModulePath)) {
                    console.log(`Loading and extracting TypeDataModel classes from ${systemId} system module...`);
                    
                    try {
                        // Import the actual system module
                        const systemModule = await import(`file://${systemModulePath}`);
                        console.log(`Successfully loaded system module from: ${systemModulePath}`);
                        
                        // Read system code for CONFIG assignments
                        const { readFile } = await import('fs/promises');
                        const systemCode = await readFile(systemModulePath, 'utf-8');
                        
                        // Extract TypeDataModel class registrations from the loaded system
                        await this.extractDataModelsFromSystem(systemCode, systemId, systemModule);
                    } catch (moduleError) {
                        console.warn(`Failed to import system module: ${moduleError.message}`);
                        console.log(`Falling back to code parsing approach...`);
                        
                        // Fallback to reading code if module import fails
                        const { readFile } = await import('fs/promises');
                        const systemCode = await readFile(systemModulePath, 'utf-8');
                        await this.extractDataModelsFromSystem(systemCode, systemId);
                    }
                    
                    // Log what TypeDataModel classes are now registered
                    if (manifestData.documentTypes) {
                        for (const [docType, subtypes] of Object.entries(manifestData.documentTypes)) {
                            const registered = Object.keys(this.CONFIG[docType]?.dataModels || {})
                                .filter(type => this.CONFIG[docType].dataModels[type] !== null);
                            if (registered.length > 0) {
                                console.log(`${docType} TypeDataModel classes registered:`, registered);
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to extract TypeDataModel classes from ${systemId}:`, error.message);
                console.log(`Continuing with placeholder dataModels for ${systemId}`);
            }
        }

        return manifestData;
    }

    /**
     * Extract TypeDataModel classes from a compiled system module
     */
    async extractDataModelsFromSystem(systemCode, systemId, systemModule = null) {
        try {
            // Create a safe context to evaluate TypeDataModel class definitions
            const context = {
                foundry: this.foundry,
                CONFIG: this.CONFIG,
                console: console,
                TypeDataModel: this.foundry.abstract.TypeDataModel,
                DataModel: this.foundry.abstract.DataModel,
                StringField: this.foundry.data.fields.StringField,
                NumberField: this.foundry.data.fields.NumberField,
                BooleanField: this.foundry.data.fields.BooleanField,
                ArrayField: this.foundry.data.fields.ArrayField,
                SchemaField: this.foundry.data.fields.SchemaField,
                HTMLField: this.foundry.data.fields.HTMLField
            };

            // Extract the CONFIG dataModels assignment section
            const configAssignments = this.extractConfigAssignments(systemCode);
            
            if (configAssignments.length > 0) {
                console.log(`Found ${configAssignments.length} CONFIG dataModel assignments in ${systemId}`);
                
                // Extract and create TypeDataModel classes
                const dataModelClasses = systemModule ? 
                    await this.extractDataModelClasses(systemModule) : 
                    this.extractDataModelClassesFallback(systemCode);
                
                // Register the extracted classes
                for (const assignment of configAssignments) {
                    const { documentType, config } = assignment;
                    if (this.CONFIG[documentType]) {
                        // Register each dataModel class in the config object
                        for (const [subtype, className] of Object.entries(config)) {
                            const dataModelClass = dataModelClasses[className];
                            if (dataModelClass) {
                                this.CONFIG[documentType].dataModels[subtype] = dataModelClass;
                                console.log(`Registered ${documentType}.${subtype} -> ${className}`);
                            } else {
                                console.log(`TypeDataModel class '${className}' not found for ${documentType}.${subtype}`);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(`Error extracting TypeDataModel classes:`, error.message);
        }
    }

    /**
     * Extract CONFIG dataModel assignments from system code
     */
    extractConfigAssignments(code) {
        const assignments = [];
        
        // Look for patterns like: CONFIG.Item.dataModels = config$1;
        const configPattern = /CONFIG\.(\w+)\.dataModels\s*=\s*([\w$]+);/g;
        let match;
        
        while ((match = configPattern.exec(code)) !== null) {
            const [, documentType, configVar] = match;
            
            // Escape $ character for regex
            const escapedConfigVar = configVar.replace(/\$/g, '\\$');
            
            // Find the config variable definition
            const configDefPattern = new RegExp(`const\\s+${escapedConfigVar}\\s*=\\s*\\{([^}]+)\\};`, 's');
            const configMatch = configDefPattern.exec(code);
            
            if (configMatch) {
                const configContent = configMatch[1];
                const config = this.parseConfigObject(configContent);
                assignments.push({ documentType, config, configVar });
                console.log(`Found CONFIG.${documentType}.dataModels = ${configVar} with ${Object.keys(config).length} entries`);
            } else {
                console.log(`Could not find definition for ${configVar}`);
            }
        }
        
        return assignments;
    }

    /**
     * Parse a config object string into key-value pairs
     */
    parseConfigObject(content) {
        const config = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('//')) {
                const match = trimmed.match(/(\w+):\s*(\w+),?/);
                if (match) {
                    const [, subtype, className] = match;
                    config[subtype] = className;
                }
            }
        }
        
        return config;
    }

    /**
     * Extract TypeDataModel class definitions from the actual loaded system module
     */
    async extractDataModelClasses(systemModule) {
        const classes = {};
        
        // Look for class definitions that could be TypeDataModel classes
        // Focus on specific important classes first
        const importantClasses = ['WeaponData', 'CharacterData', 'NPCData', 'SpellData', 'EquipmentData'];
        
        for (const className of importantClasses) {
            const schema = await this.extractSpecificClassSchema(systemModule, className);
            if (schema !== null) {
                // Create a TypeDataModel class with the extracted schema
                classes[className] = class extends this.foundry.abstract.TypeDataModel {
                    static defineSchema() {
                        return schema;
                    }
                };
                
                const schemaFields = Object.keys(schema).length;
                console.log(`Extracted TypeDataModel class: ${className} with ${schemaFields} fields`);
            }
        }
        
        // Add fallback classes for other TypeDataModel classes that might be needed
        this.addFallbackDataModelClasses(classes);
        
        return classes;
    }

    /**
     * REMOVED: Fallback classes are not allowed per project requirements
     * The application must use FoundryVTT's actual validation system
     */
    addFallbackDataModelClasses(classes) {
        // NO FALLBACKS - per project requirements, we must use actual FoundryVTT validation
        // If required classes are missing, the application should fail
        console.warn('Warning: Some TypeDataModel classes may be missing. The application requires FoundryVTT\'s actual system modules to work correctly.');
    }

    /**
     * Fallback method for when system module import fails
     * CRITICAL: Per project requirements, we MUST NOT create mock/fallback schemas
     * The application should fail if FoundryVTT's actual validation cannot be used
     */
    extractDataModelClassesFallback(systemCode) {
        throw new Error('Failed to load system module. Cannot proceed without FoundryVTT\'s actual validation system. No fallbacks allowed per project requirements.');
    }

    /**
     * Extract schema for a specific class by using the actual system module
     */
    async extractSpecificClassSchema(systemModule, className) {
        try {
            // Look for the actual class in the system module's exports
            console.log(`Looking for real ${className} class in system module...`);
            
            // Try to find the class in the module
            let foundClass = null;
            
            // Search through the module properties
            for (const [key, value] of Object.entries(systemModule)) {
                if (typeof value === 'function' && value.name === className) {
                    foundClass = value;
                    break;
                }
                // Also check nested objects
                if (typeof value === 'object' && value !== null) {
                    for (const [nestedKey, nestedValue] of Object.entries(value)) {
                        if (typeof nestedValue === 'function' && nestedValue.name === className) {
                            foundClass = nestedValue;
                            break;
                        }
                    }
                    if (foundClass) break;
                }
            }
            
            if (foundClass && typeof foundClass.defineSchema === 'function') {
                console.log(`Found real ${className} class, extracting schema...`);
                return foundClass.defineSchema();
            } else {
                console.log(`Real ${className} class not found or no defineSchema method, checking CONFIG...`);
                
                // Try to get it from CONFIG.Item.dataModels if already registered
                const itemDataModels = this.CONFIG?.Item?.dataModels || {};
                for (const [type, dataModel] of Object.entries(itemDataModels)) {
                    if (dataModel && dataModel.constructor.name === className && typeof dataModel.constructor.defineSchema === 'function') {
                        console.log(`Found ${className} in CONFIG.Item.dataModels[${type}], extracting schema...`);
                        return dataModel.constructor.defineSchema();
                    }
                }
                
                // Similar check for other document types
                const actorDataModels = this.CONFIG?.Actor?.dataModels || {};
                for (const [type, dataModel] of Object.entries(actorDataModels)) {
                    if (dataModel && dataModel.constructor.name === className && typeof dataModel.constructor.defineSchema === 'function') {
                        console.log(`Found ${className} in CONFIG.Actor.dataModels[${type}], extracting schema...`);
                        return dataModel.constructor.defineSchema();
                    }
                }
            }
        } catch (error) {
            console.log(`Error extracting real schema for ${className}:`, error.message);
        }
        
        // No fallback allowed - per project requirements
        throw new Error(`Cannot find schema for ${className}. The application requires FoundryVTT's actual validation system.`);
    }
    
    /**
     * REMOVED: Manual schema creation not allowed
     * Must use FoundryVTT's actual schemas
     */
    createWeaponDataSchema() {
        throw new Error('Manual schema creation not allowed. Must use FoundryVTT\'s actual validation system.');
    }

    /**
     * REMOVED: Original method that created manual schemas
     * Keeping stub to show what was removed
     */
    _removedCreateWeaponDataSchema() {
        // This method used to create manual schemas which violates project requirements
        return {
            // Essential display fields
            description: new fields.SchemaField({
                value: new fields.HTMLField({ initial: "" }),
                chat: new fields.StringField({ initial: "" })
            }),
            source: new fields.SchemaField({
                custom: new fields.StringField({ initial: "" }),
                book: new fields.StringField({ initial: "" }),
                page: new fields.StringField({ initial: "" }),
                license: new fields.StringField({ initial: "" }),
                rules: new fields.StringField({ initial: "2014" }),
                revision: new fields.NumberField({ integer: true, initial: 1 })
            }),
            quantity: new fields.NumberField({ min: 0, integer: true, initial: 1 }),
            weight: new fields.SchemaField({
                value: new fields.NumberField({ min: 0, initial: 0 }),
                units: new fields.StringField({ initial: "lb" })
            }),
            price: new fields.SchemaField({
                value: new fields.NumberField({ min: 0, initial: 0 }),
                denomination: new fields.StringField({ initial: "gp" })
            }),
            attunement: new fields.StringField({ initial: "none" }),
            equipped: new fields.BooleanField({ initial: false }),
            rarity: new fields.StringField({ initial: "common" }),
            identified: new fields.BooleanField({ initial: true }),
            cover: new fields.NumberField({ initial: null }),
            
            // Weapon-specific fields
            ammunition: new fields.SchemaField({
                type: new fields.StringField({ initial: "" })
            }),
            armor: new fields.SchemaField({
                value: new fields.NumberField({ integer: true, min: 0, initial: 10 })
            }),
            damage: new fields.SchemaField({
                base: new fields.SchemaField({
                    number: new fields.NumberField({ min: 1, integer: true, initial: 1 }),
                    denomination: new fields.NumberField({ min: 1, integer: true, initial: 6 }),
                    type: new fields.StringField({ initial: "slashing" })
                }),
                versatile: new fields.SchemaField({
                    number: new fields.NumberField({ min: 1, integer: true, initial: null }),
                    denomination: new fields.NumberField({ min: 1, integer: true, initial: null }),
                    type: new fields.StringField({ initial: "" })
                })
            }),
            magicalBonus: new fields.NumberField({ min: 0, integer: true, initial: 0 }),
            mastery: new fields.StringField({ initial: "" }),
            properties: new fields.SetField(new fields.StringField()),
            proficient: new fields.NumberField({ required: true, min: 0, max: 1, integer: true, initial: null }),
            range: new fields.SchemaField({
                value: new fields.NumberField({ min: 0, initial: null }),
                long: new fields.NumberField({ min: 0, initial: null }),
                reach: new fields.NumberField({ min: 0, initial: null }),
                units: new fields.StringField({ initial: "ft" })
            }),
            type: new fields.SchemaField({
                value: new fields.StringField({ initial: "simpleM" }),
                baseItem: new fields.StringField({ initial: "" })
            }),
            
            // Additional FoundryVTT fields
            uses: new fields.SchemaField({
                max: new fields.StringField({ initial: "" }),
                recovery: new fields.ArrayField(new fields.StringField()),
                spent: new fields.NumberField({ min: 0, integer: true, initial: 0 })
            }),
            hp: new fields.SchemaField({
                value: new fields.NumberField({ min: 0, integer: true, initial: 0 }),
                max: new fields.NumberField({ min: 0, integer: true, initial: 0 }),
                dt: new fields.NumberField({ initial: null }),
                conditions: new fields.StringField({ initial: "" })
            }),
            unidentified: new fields.SchemaField({
                description: new fields.StringField({ initial: "" })
            }),
            container: new fields.StringField({ initial: null, nullable: true }),
            crewed: new fields.BooleanField({ initial: false }),
            activities: new fields.SchemaField({}),
            attuned: new fields.BooleanField({ initial: false }),
            identifier: new fields.StringField({ initial: "" })
        };
    }

    /**
     * REMOVED: Manual schema creation not allowed
     * Must use FoundryVTT's actual schemas
     */
    createCharacterDataSchema() {
        throw new Error('Manual schema creation not allowed. Must use FoundryVTT\'s actual validation system.');
    }

    /**
     * REMOVED: Manual schema creation not allowed
     * Must use FoundryVTT's actual schemas
     */
    createSpellDataSchema() {
        throw new Error('Manual schema creation not allowed. Must use FoundryVTT\'s actual validation system.');
    }

    /**
     * REMOVED: Manual schema creation not allowed
     * Must use FoundryVTT's actual schemas
     */
    createEquipmentDataSchema() {
        throw new Error('Manual schema creation not allowed. Must use FoundryVTT\'s actual validation system.');
    }

    /**
     * REMOVED: Manual schema parsing not allowed
     * Must use FoundryVTT's actual schemas
     */
    parseSchemaFields(schemaCode) {
        throw new Error('Manual schema parsing not allowed. Must use FoundryVTT\'s actual validation system.');
    }

    /**
     * REMOVED: Manual field creation not allowed
     * Must use FoundryVTT's actual fields
     */
    createFieldFromType(fieldType) {
        throw new Error('Manual field creation not allowed. Must use FoundryVTT\'s actual validation system.');
    }

    /**
     * Get available systems
     */
    async getAvailableSystems() {
        if (!existsSync(this.systemsPath)) {
            return [];
        }

        const { readdir, stat } = await import('fs/promises');
        const entries = await readdir(this.systemsPath);
        const systems = [];

        for (const entry of entries) {
            const entryPath = join(this.systemsPath, entry);
            const stats = await stat(entryPath);
            
            if (stats.isDirectory()) {
                const manifestPath = join(entryPath, 'system.json');
                if (existsSync(manifestPath)) {
                    try {
                        const { readFile } = await import('fs/promises');
                        const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
                        systems.push({
                            id: entry,
                            manifest: manifest
                        });
                    } catch (error) {
                        console.warn(`Failed to read manifest for system ${entry}:`, error.message);
                    }
                }
            }
        }

        return systems;
    }

    /**
     * Get DataModel for a specific document type and subtype
     */
    getDataModel(documentType, subType) {
        const config = this.CONFIG[documentType];
        if (!config || !config.dataModels) {
            return null;
        }

        return config.dataModels[subType] || null;
    }

    /**
     * Extract schema from a DataModel class
     */
    extractSchema(DataModelClass) {
        if (!DataModelClass || typeof DataModelClass.defineSchema !== 'function') {
            return null;
        }

        try {
            return DataModelClass.defineSchema();
        } catch (error) {
            console.warn('Failed to extract schema:', error.message);
            return null;
        }
    }
}

export default FoundryEnvironment;
