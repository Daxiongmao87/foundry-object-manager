#!/usr/bin/env node

/**
 * FoundryVTT System Discovery
 * Scans and parses FoundryVTT systems and their data models
 */

import { existsSync } from 'fs';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import FoundryEnvironment from './foundry-environment.mjs';

class SystemDiscovery {
    constructor(foundryEnv = null) {
        this.foundryEnv = foundryEnv || new FoundryEnvironment();
        this.systemCache = new Map();
    }

    /**
     * Initialize the discovery system
     */
    async initialize() {
        if (!this.foundryEnv.initialized) {
            await this.foundryEnv.initialize();
        }
    }

    /**
     * Get all available systems
     */
    async getAllSystems() {
        await this.initialize();
        
        const systems = await this.foundryEnv.getAvailableSystems();
        const systemList = [];

        for (const system of systems) {
            try {
                const systemInfo = await this.getSystemInfo(system.id);
                systemList.push(systemInfo);
            } catch (error) {
                console.warn(`Failed to get info for system ${system.id}:`, error.message);
            }
        }

        return systemList;
    }

    /**
     * Get detailed information about a specific system
     */
    async getSystemInfo(systemId) {
        if (this.systemCache.has(systemId)) {
            return this.systemCache.get(systemId);
        }

        await this.initialize();

        const systemPath = join(this.foundryEnv.systemsPath, systemId);
        if (!existsSync(systemPath)) {
            throw new Error(`System not found: ${systemId}`);
        }

        // Load system manifest
        const manifestPath = join(systemPath, 'system.json');
        if (!existsSync(manifestPath)) {
            throw new Error(`System manifest not found: ${systemId}`);
        }

        const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
        
        // Extract document types from manifest
        const documentTypes = this.extractDocumentTypes(manifest);
        
        // Load system to register DataModels
        try {
            await this.foundryEnv.loadSystem(systemId);
        } catch (error) {
            console.warn(`Failed to load system ${systemId}:`, error.message);
        }

        const systemInfo = {
            id: systemId,
            title: manifest.title || systemId,
            description: manifest.description || '',
            version: manifest.version || 'unknown',
            compatibility: manifest.compatibility || {},
            documentTypes: documentTypes,
            path: systemPath
        };

        this.systemCache.set(systemId, systemInfo);
        return systemInfo;
    }

    /**
     * Extract document types and subtypes from system manifest
     */
    extractDocumentTypes(manifest) {
        const documentTypes = {};

        if (manifest.documentTypes) {
            for (const [docType, subtypes] of Object.entries(manifest.documentTypes)) {
                documentTypes[docType] = {
                    subtypes: Object.keys(subtypes),
                    htmlFields: {}
                };

                // Extract HTML fields for each subtype
                for (const [subtype, config] of Object.entries(subtypes)) {
                    if (config.htmlFields) {
                        documentTypes[docType].htmlFields[subtype] = config.htmlFields;
                    }
                }
            }
        }

        return documentTypes;
    }

    /**
     * Get available object types for a specific system
     */
    async getSystemObjectTypes(systemId) {
        const systemInfo = await this.getSystemInfo(systemId);
        const objectTypes = {};

        for (const [docType, config] of Object.entries(systemInfo.documentTypes)) {
            objectTypes[docType.toLowerCase()] = {
                documentType: docType,
                subtypes: config.subtypes,
                description: this.getDocumentTypeDescription(docType)
            };
        }

        return objectTypes;
    }

    /**
     * Get description for document types
     */
    getDocumentTypeDescription(docType) {
        const descriptions = {
            'Actor': 'Characters, NPCs, monsters, and other entities',
            'Item': 'Equipment, spells, features, and other items',
            'Scene': 'Maps and environments for gameplay',
            'JournalEntry': 'Notes, lore, and reference materials',
            'Macro': 'Custom scripts and automated actions',
            'RollTable': 'Random generation tables',
            'Playlist': 'Audio playlists and ambient sounds',
            'Combat': 'Combat encounters and initiative tracking',
            'Combatant': 'Individual participants in combat'
        };

        return descriptions[docType] || `${docType} documents`;
    }

    /**
     * List available systems in a user-friendly format
     */
    async listSystems() {
        const systems = await this.getAllSystems();
        
        if (systems.length === 0) {
            return 'No FoundryVTT systems found. Please install some systems first.';
        }

        const output = ['Available FoundryVTT Systems:', ''];
        
        for (const system of systems) {
            output.push(`• ${system.id} - ${system.title}`);
            if (system.description) {
                output.push(`  ${system.description}`);
            }
            output.push(`  Version: ${system.version}`);
            
            const docTypeCount = Object.keys(system.documentTypes).length;
            if (docTypeCount > 0) {
                output.push(`  Document Types: ${Object.keys(system.documentTypes).join(', ')}`);
            }
            output.push('');
        }

        return output.join('\n');
    }

    /**
     * List available object types for a system
     */
    async listSystemObjectTypes(systemId) {
        try {
            const objectTypes = await this.getSystemObjectTypes(systemId);
            
            if (Object.keys(objectTypes).length === 0) {
                return `No object types found for system: ${systemId}`;
            }

            const output = [`Object types available in system '${systemId}':`, ''];
            
            for (const [typeKey, config] of Object.entries(objectTypes)) {
                output.push(`• ${typeKey} (${config.documentType})`);
                output.push(`  ${config.description}`);
                
                if (config.subtypes.length > 0) {
                    output.push(`  Subtypes: ${config.subtypes.join(', ')}`);
                }
                output.push('');
            }

            return output.join('\n');
        } catch (error) {
            return `Error listing object types for system '${systemId}': ${error.message}`;
        }
    }

    /**
     * Validate if a system and object type combination is valid
     */
    async validateSystemObjectType(systemId, objectType) {
        try {
            const objectTypes = await this.getSystemObjectTypes(systemId);
            
            // Check if object type exists (case-insensitive)
            const normalizedObjectType = objectType.toLowerCase();
            
            if (!objectTypes[normalizedObjectType]) {
                const availableTypes = Object.keys(objectTypes);
                throw new Error(
                    `Object type '${objectType}' not found in system '${systemId}'. ` +
                    `Available types: ${availableTypes.join(', ')}`
                );
            }

            return {
                valid: true,
                documentType: objectTypes[normalizedObjectType].documentType,
                subtypes: objectTypes[normalizedObjectType].subtypes
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Get DataModel class for a specific system document type
     */
    async getDataModel(systemId, documentType, subtype = null) {
        await this.getSystemInfo(systemId); // Ensure system is loaded
        
        // Try to get the DataModel from CONFIG
        const dataModel = this.foundryEnv.getDataModel(documentType, subtype);
        
        if (!dataModel) {
            // If no specific subtype model, try to get the base document model
            if (subtype) {
                return this.getDataModel(systemId, documentType, null);
            }
            return null;
        }

        return dataModel;
    }

    /**
     * Extract schema for a specific system document type
     */
    async extractSchemaForType(systemId, documentType, subtype = null) {
        const dataModel = await this.getDataModel(systemId, documentType, subtype);
        
        if (!dataModel) {
            throw new Error(
                `No DataModel found for ${documentType}` + 
                (subtype ? `.${subtype}` : '') + 
                ` in system ${systemId}`
            );
        }

        return this.foundryEnv.extractSchema(dataModel);
    }
}

export default SystemDiscovery;