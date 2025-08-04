#!/usr/bin/env node

/**
 * SystemDiscovery - Game System Enumeration and Analysis
 * 
 * Discovers available FoundryVTT game systems and their object types
 * without requiring full server initialization.
 */

import { readdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

export class SystemDiscovery {
    constructor(options = {}) {
        this.dataPath = options.dataPath || this._resolveDataPath();
        this.systemsPath = join(this.dataPath, 'systems');
        this.verbose = options.verbose || false;
        this._systemCache = null;
    }

    /**
     * Resolve FoundryVTT data path
     * @private
     */
    _resolveDataPath() {
        // Check for symbolic link first (development setup)
        const symlinkPath = resolve('./foundry-data');
        if (existsSync(symlinkPath)) {
            return resolve(symlinkPath);
        }
        
        // Default FoundryVTT data locations
        const possiblePaths = [
            process.env.FOUNDRY_VTT_DATA_PATH,
            join(process.env.HOME || process.env.USERPROFILE, '.local/share/FoundryVTT/Data'),
            join(process.env.HOME || process.env.USERPROFILE, 'FoundryVTT/Data'),
            './foundry-data'
        ].filter(path => path && existsSync(path));

        if (possiblePaths.length === 0) {
            throw new Error('Could not locate FoundryVTT data directory');
        }

        return resolve(possiblePaths[0]);
    }

    /**
     * Get all available game systems
     * @returns {Promise<Array>} List of system information
     */
    async getAllSystems() {
        if (this._systemCache) {
            return this._systemCache;
        }

        if (this.verbose) {
            console.log(`🔍 Scanning systems directory: ${this.systemsPath}`);
        }

        if (!existsSync(this.systemsPath)) {
            console.warn(`⚠️  Systems directory not found: ${this.systemsPath}`);
            return [];
        }

        const systems = [];
        
        try {
            const entries = await readdir(this.systemsPath);
            
            for (const entry of entries) {
                const systemPath = join(this.systemsPath, entry);
                const systemStat = await stat(systemPath);
                
                if (!systemStat.isDirectory()) {
                    continue;
                }

                const manifestPath = join(systemPath, 'system.json');
                if (!existsSync(manifestPath)) {
                    if (this.verbose) {
                        console.log(`   ⚠️  No system.json found for: ${entry}`);
                    }
                    continue;
                }

                try {
                    const manifestContent = await readFile(manifestPath, 'utf8');
                    const manifest = JSON.parse(manifestContent);
                    
                    const systemInfo = {
                        id: manifest.id || entry,
                        title: manifest.title || entry,
                        version: manifest.version || 'unknown',
                        author: manifest.author || 'unknown',
                        description: manifest.description || '',
                        compatibility: manifest.compatibility || {},
                        path: systemPath,
                        manifest: manifest
                    };

                    systems.push(systemInfo);
                    
                    if (this.verbose) {
                        console.log(`   ✅ Found system: ${systemInfo.title} (${systemInfo.id})`);
                    }

                } catch (error) {
                    if (this.verbose) {
                        console.log(`   ❌ Error reading system.json for ${entry}: ${error.message}`);
                    }
                }
            }

            this._systemCache = systems;
            
            if (this.verbose) {
                console.log(`📦 Total systems discovered: ${systems.length}`);
            }

            return systems;

        } catch (error) {
            console.error(`❌ Error scanning systems directory: ${error.message}`);
            return [];
        }
    }

    /**
     * Get system information by ID
     * @param {string} systemId - System identifier
     * @returns {Promise<Object|null>} System information or null if not found
     */
    async getSystemInfo(systemId) {
        const systems = await this.getAllSystems();
        return systems.find(system => system.id === systemId) || null;
    }

    /**
     * Get object types for a specific system
     * @param {string} systemId - System identifier
     * @returns {Promise<Object>} Object types organized by document type
     */
    async getSystemObjectTypes(systemId) {
        const systemInfo = await this.getSystemInfo(systemId);
        if (!systemInfo) {
            throw new Error(`System not found: ${systemId}`);
        }

        const types = {
            actors: {},
            items: {},
            other: {}
        };

        // Extract types from system manifest
        const manifest = systemInfo.manifest;

        // Get actor types
        if (manifest.documentTypes?.Actor) {
            for (const [type, config] of Object.entries(manifest.documentTypes.Actor)) {
                types.actors[type] = config.label || type;
            }
        }

        // Get item types
        if (manifest.documentTypes?.Item) {
            for (const [type, config] of Object.entries(manifest.documentTypes.Item)) {
                types.items[type] = config.label || type;
            }
        }

        // Get other document types
        for (const [docType, typeConfig] of Object.entries(manifest.documentTypes || {})) {
            if (docType !== 'Actor' && docType !== 'Item') {
                types.other[docType.toLowerCase()] = {};
                if (typeof typeConfig === 'object') {
                    for (const [type, config] of Object.entries(typeConfig)) {
                        types.other[docType.toLowerCase()][type] = config.label || type;
                    }
                }
            }
        }

        return {
            systemId,
            systemTitle: systemInfo.title,
            types
        };
    }

    /**
     * List systems for CLI display
     * @returns {Promise<void>}
     */
    async listSystems() {
        const systems = await this.getAllSystems();
        
        if (systems.length === 0) {
            console.log('📦 No game systems found');
            return;
        }

        console.log(`\\n📦 Available Game Systems (${systems.length}):`);
        console.log('='.repeat(60));
        
        for (const system of systems) {
            console.log(`\\n${system.id}:`);
            console.log(`   Title: ${system.title}`);
            console.log(`   Version: ${system.version}`);
            console.log(`   Author: ${system.author}`);
            if (system.description) {
                const desc = system.description.length > 80 
                    ? system.description.substring(0, 77) + '...'
                    : system.description;
                console.log(`   Description: ${desc}`);
            }
        }
    }

    /**
     * List object types for a system
     * @param {string} systemId - System identifier
     * @returns {Promise<void>}
     */
    async listSystemObjectTypes(systemId) {
        try {
            const typeInfo = await this.getSystemObjectTypes(systemId);
            
            console.log(`\\n📋 Object Types for ${typeInfo.systemTitle} (${systemId}):`);
            console.log('='.repeat(60));

            // Show Actor types
            const actorTypes = Object.keys(typeInfo.types.actors);
            if (actorTypes.length > 0) {
                console.log('\\n🎭 Actor Types:');
                for (const [type, label] of Object.entries(typeInfo.types.actors)) {
                    console.log(`   - ${type}: ${label}`);
                }
            }

            // Show Item types
            const itemTypes = Object.keys(typeInfo.types.items);
            if (itemTypes.length > 0) {
                console.log('\\n🎒 Item Types:');
                for (const [type, label] of Object.entries(typeInfo.types.items)) {
                    console.log(`   - ${type}: ${label}`);
                }
            }

            // Show other document types
            for (const [docType, subtypes] of Object.entries(typeInfo.types.other)) {
                const subtypeKeys = Object.keys(subtypes);
                if (subtypeKeys.length > 0) {
                    console.log(`\\n📄 ${docType.toUpperCase()} Types:`);
                    for (const [type, label] of Object.entries(subtypes)) {
                        console.log(`   - ${type}: ${label}`);
                    }
                }
            }

            const totalTypes = actorTypes.length + itemTypes.length + 
                Object.values(typeInfo.types.other).reduce((sum, types) => sum + Object.keys(types).length, 0);
            
            console.log(`\\n📊 Total object types: ${totalTypes}`);

        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            console.error('Use --list-systems to see available systems');
        }
    }

    /**
     * Validate system and object type combination
     * @param {string} systemId - System identifier
     * @param {string} objectType - Object type to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateSystemObjectType(systemId, objectType) {
        try {
            const typeInfo = await this.getSystemObjectTypes(systemId);
            
            // Check in actors
            if (typeInfo.types.actors[objectType]) {
                return {
                    valid: true,
                    documentType: 'Actor',
                    subtype: objectType,
                    label: typeInfo.types.actors[objectType]
                };
            }

            // Check in items
            if (typeInfo.types.items[objectType]) {
                return {
                    valid: true,
                    documentType: 'Item',
                    subtype: objectType,
                    label: typeInfo.types.items[objectType]
                };
            }

            // Check in other document types
            for (const [docType, subtypes] of Object.entries(typeInfo.types.other)) {
                if (subtypes[objectType]) {
                    return {
                        valid: true,
                        documentType: docType.toUpperCase(),
                        subtype: objectType,
                        label: subtypes[objectType]
                    };
                }
            }

            return {
                valid: false,
                error: `Object type '${objectType}' not found in system '${systemId}'`,
                availableTypes: {
                    actors: Object.keys(typeInfo.types.actors),
                    items: Object.keys(typeInfo.types.items),
                    other: Object.keys(typeInfo.types.other).reduce((acc, docType) => {
                        acc[docType] = Object.keys(typeInfo.types.other[docType]);
                        return acc;
                    }, {})
                }
            };

        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Auto-detect system from world
     * @param {string} worldId - World identifier
     * @returns {Promise<string|null>} System ID or null if not found
     */
    async getSystemFromWorld(worldId) {
        const worldsPath = join(this.dataPath, 'worlds');
        const worldPath = join(worldsPath, worldId);
        const worldManifestPath = join(worldPath, 'world.json');

        if (!existsSync(worldManifestPath)) {
            return null;
        }

        try {
            const manifestContent = await readFile(worldManifestPath, 'utf8');
            const manifest = JSON.parse(manifestContent);
            return manifest.system || null;
        } catch (error) {
            if (this.verbose) {
                console.error(`Error reading world manifest for ${worldId}: ${error.message}`);
            }
            return null;
        }
    }

    /**
     * Clear cached data
     */
    clearCache() {
        this._systemCache = null;
    }
}

export default SystemDiscovery;