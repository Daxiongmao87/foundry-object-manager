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
        this.foundryPath = foundryPath || join(__dirname, 'foundry');
        this.resourcesPath = join(this.foundryPath, 'resources', 'app');
        this.dataPath = this.findDataPath();
        this.systemsPath = join(this.dataPath, 'systems');
        
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
            process.env.HOME ? join(process.env.HOME, '.local', 'share', 'FoundryVTT', 'Data') : null,
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
        // Mock global objects that FoundryVTT expects
        globalThis.foundry = this.foundry;
        globalThis.CONFIG = this.CONFIG;
        
        // Mock minimal browser environment
        globalThis.window = globalThis;
        globalThis.document = {
            createElement: () => ({ style: {} }),
            head: { appendChild: () => {} }
        };
        
        // Mock console if needed
        if (!globalThis.console) {
            globalThis.console = console;
        }
    }

    /**
     * Load core FoundryVTT modules
     */
    async loadCoreModules() {
        const coreModules = [
            'common/abstract/data.mjs',
            'common/data/fields.mjs',
            'common/abstract/type-data.mjs',
            'common/documents/_module.mjs'
        ];

        for (const modulePath of coreModules) {
            const fullPath = join(this.resourcesPath, modulePath);
            
            if (existsSync(fullPath)) {
                try {
                    console.log(`Loading core module: ${modulePath}`);
                    const module = await import(`file://${fullPath}`);
                    
                    // Attach module exports to foundry global
                    if (modulePath.includes('data.mjs')) {
                        this.foundry.abstract = this.foundry.abstract || {};
                        Object.assign(this.foundry.abstract, module);
                    } else if (modulePath.includes('fields.mjs')) {
                        this.foundry.data = this.foundry.data || {};
                        this.foundry.data.fields = module;
                    } else if (modulePath.includes('type-data.mjs')) {
                        this.foundry.abstract = this.foundry.abstract || {};
                        Object.assign(this.foundry.abstract, module);
                    }
                } catch (error) {
                    console.warn(`Failed to load core module ${modulePath}:`, error.message);
                }
            } else {
                console.warn(`Core module not found: ${fullPath}`);
            }
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
    }

    /**
     * Load a specific system
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

        // Load system module if it exists
        const systemModule = join(systemPath, `${systemId}.mjs`);
        if (existsSync(systemModule)) {
            try {
                console.log(`Loading system module: ${systemId}`);
                await import(`file://${systemModule}`);
            } catch (error) {
                console.warn(`Failed to load system module ${systemId}:`, error.message);
            }
        }

        return manifestData;
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