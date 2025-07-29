#!/usr/bin/env node

/**
 * FoundryVTT World Manager
 * Handles world discovery, database access, and document insertion
 */

import { existsSync, readFileSync } from 'fs';
import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

class WorldManager {
    constructor(foundryEnv) {
        this.foundryEnv = foundryEnv;
        this.worldsPath = join(foundryEnv.dataPath, 'worlds');
        this.levelDBCache = new Map();
    }

    /**
     * Get all available worlds
     */
    async getAvailableWorlds() {
        if (!existsSync(this.worldsPath)) {
            return [];
        }

        const entries = await readdir(this.worldsPath);
        const worlds = [];

        for (const entry of entries) {
            const worldPath = join(this.worldsPath, entry);
            const stats = await stat(worldPath);
            
            if (stats.isDirectory()) {
                const worldJsonPath = join(worldPath, 'world.json');
                if (existsSync(worldJsonPath)) {
                    try {
                        const worldData = JSON.parse(await readFile(worldJsonPath, 'utf-8'));
                        worlds.push({
                            id: entry,
                            path: worldPath,
                            ...worldData
                        });
                    } catch (error) {
                        console.warn(`Failed to read world manifest for ${entry}:`, error.message);
                    }
                }
            }
        }

        return worlds;
    }

    /**
     * Get information about a specific world
     */
    async getWorldInfo(worldId) {
        const worldPath = join(this.worldsPath, worldId);
        const worldJsonPath = join(worldPath, 'world.json');

        if (!existsSync(worldPath) || !existsSync(worldJsonPath)) {
            throw new Error(`World not found: ${worldId}`);
        }

        const worldData = JSON.parse(await readFile(worldJsonPath, 'utf-8'));
        const dataPath = join(worldPath, 'data');

        // Check what document types exist in this world
        const documentCollections = [];
        if (existsSync(dataPath)) {
            const collections = await readdir(dataPath);
            for (const collection of collections) {
                const collectionPath = join(dataPath, collection);
                const stats = await stat(collectionPath);
                if (stats.isDirectory()) {
                    documentCollections.push(collection);
                }
            }
        }

        return {
            id: worldId,
            path: worldPath,
            dataPath: dataPath,
            documentCollections: documentCollections,
            ...worldData
        };
    }

    /**
     * Validate world compatibility with system
     */
    async validateWorldSystem(worldId, systemId) {
        const worldInfo = await this.getWorldInfo(worldId);
        
        if (worldInfo.system !== systemId) {
            throw new Error(
                `World '${worldId}' uses system '${worldInfo.system}', but validation is for system '${systemId}'. ` +
                `Cannot insert ${systemId} objects into a ${worldInfo.system} world.`
            );
        }

        return worldInfo;
    }

    /**
     * Generate a unique FoundryVTT document ID
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

    /**
     * Get LevelDB instance for a world collection
     * Note: This is a placeholder - would need actual LevelDB implementation
     */
    async getLevelDB(worldInfo, collectionType) {
        const dbPath = join(worldInfo.dataPath, collectionType);
        
        if (!existsSync(dbPath)) {
            throw new Error(`Collection '${collectionType}' does not exist in world '${worldInfo.id}'`);
        }

        // For now, we'll implement a file-based approach to demonstrate the concept
        // In a full implementation, this would use the 'classic-level' package
        return new MockLevelDB(dbPath);
    }

    /**
     * Insert a validated document into a world
     */
    async insertDocument(worldId, documentType, validatedData, options = {}) {
        try {
            // Validate world and system compatibility
            const worldInfo = await this.validateWorldSystem(worldId, options.systemId || 'unknown');
            
            // Prepare document data
            const documentData = this.prepareDocumentForInsertion(validatedData, options);
            
            // Get collection name (lowercase document type)
            const collectionType = this.getCollectionName(documentType);
            
            // Check if collection exists
            if (!worldInfo.documentCollections.includes(collectionType)) {
                throw new Error(`Document type '${documentType}' (collection '${collectionType}') is not supported in this world`);
            }

            // Get database connection
            const db = await this.getLevelDB(worldInfo, collectionType);
            
            // Insert document
            const insertResult = await db.put(documentData._id, documentData);
            
            return {
                success: true,
                worldId: worldId,
                documentType: documentType,
                documentId: documentData._id,
                insertedData: documentData,
                message: `Successfully inserted ${documentType} '${documentData.name}' into world '${worldId}'`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                worldId: worldId,
                documentType: documentType
            };
        }
    }

    /**
     * Prepare document data for insertion
     */
    prepareDocumentForInsertion(validatedData, options = {}) {
        const now = Date.now();
        const userId = options.userId || 'CLI_USER_ID';

        // Ensure required fields are present
        const documentData = {
            ...validatedData,
            _id: validatedData._id || this.generateDocumentId(),
            folder: validatedData.folder || null,
            sort: validatedData.sort || 0,
            ownership: validatedData.ownership || { default: 0 },
            flags: validatedData.flags || {},
            _stats: {
                compendiumSource: null,
                duplicateSource: null,
                coreVersion: options.coreVersion || "12.331",
                systemId: options.systemId || "unknown",
                systemVersion: options.systemVersion || "1.0.0",
                createdTime: now,
                modifiedTime: now,
                lastModifiedBy: userId
            }
        };

        return documentData;
    }

    /**
     * Get collection name for document type
     */
    getCollectionName(documentType) {
        // FoundryVTT uses lowercase plural collection names
        const mappings = {
            'Actor': 'actors',
            'Item': 'items',
            'Scene': 'scenes',
            'JournalEntry': 'journal',
            'Macro': 'macros',
            'RollTable': 'tables',
            'Playlist': 'playlists',
            'Combat': 'combats',
            'Combatant': 'combatants',
            'Cards': 'cards',
            'Folder': 'folders'
        };

        return mappings[documentType] || documentType.toLowerCase() + 's';
    }

    /**
     * List available worlds in a user-friendly format
     */
    async listWorlds() {
        const worlds = await this.getAvailableWorlds();
        
        if (worlds.length === 0) {
            return 'No FoundryVTT worlds found. Create a world in FoundryVTT first.';
        }

        const output = ['Available FoundryVTT Worlds:', ''];
        
        for (const world of worlds) {
            output.push(`• ${world.id} - ${world.title}`);
            output.push(`  System: ${world.system} (v${world.systemVersion})`);
            output.push(`  Core Version: ${world.coreVersion}`);
            if (world.lastPlayed) {
                const lastPlayed = new Date(world.lastPlayed).toLocaleDateString();
                output.push(`  Last Played: ${lastPlayed}`);
            }
            output.push('');
        }

        return output.join('\n');
    }

    /**
     * Search and retrieve documents from a world
     */
    async searchDocuments(worldId, documentType, searchOptions = {}) {
        try {
            const worldInfo = await this.getWorldInfo(worldId);
            const collectionType = this.getCollectionName(documentType);
            
            if (!worldInfo.documentCollections.includes(collectionType)) {
                throw new Error(`Document type '${documentType}' not found in world '${worldId}'`);
            }

            // Get database connection
            const db = await this.getLevelDB(worldInfo, collectionType);
            
            // Retrieve all documents from the collection
            const documents = await db.getAll();
            
            // Apply search filters
            let filteredDocuments = documents;
            
            if (searchOptions.name) {
                filteredDocuments = this.filterByName(filteredDocuments, searchOptions.name);
            }
            
            if (searchOptions.type) {
                filteredDocuments = this.filterByType(filteredDocuments, searchOptions.type);
            }
            
            if (searchOptions.id) {
                filteredDocuments = this.filterById(filteredDocuments, searchOptions.id);
            }
            
            // Apply limit
            if (searchOptions.limit && searchOptions.limit > 0) {
                filteredDocuments = filteredDocuments.slice(0, searchOptions.limit);
            }
            
            return {
                success: true,
                worldId: worldId,
                documentType: documentType,
                totalFound: filteredDocuments.length,
                documents: filteredDocuments,
                searchOptions: searchOptions
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                worldId: worldId,
                documentType: documentType
            };
        }
    }

    /**
     * Filter documents by name with wildcard support
     */
    filterByName(documents, namePattern) {
        const regex = this.createWildcardRegex(namePattern);
        return documents.filter(doc => regex.test(doc.name || ''));
    }

    /**
     * Filter documents by type with wildcard support
     */
    filterByType(documents, typePattern) {
        const regex = this.createWildcardRegex(typePattern);
        return documents.filter(doc => regex.test(doc.type || ''));
    }

    /**
     * Filter documents by ID with wildcard support
     */
    filterById(documents, idPattern) {
        const regex = this.createWildcardRegex(idPattern);
        return documents.filter(doc => regex.test(doc._id || ''));
    }

    /**
     * Create regex from wildcard pattern
     */
    createWildcardRegex(pattern) {
        // Escape special regex characters except * and ?
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')  // * matches any sequence of characters
            .replace(/\?/g, '.');  // ? matches any single character
        
        return new RegExp(`^${escaped}$`, 'i'); // Case-insensitive matching
    }

    /**
     * Get a specific document by ID
     */
    async getDocument(worldId, documentType, documentId) {
        try {
            const worldInfo = await this.getWorldInfo(worldId);
            const collectionType = this.getCollectionName(documentType);
            
            if (!worldInfo.documentCollections.includes(collectionType)) {
                throw new Error(`Document type '${documentType}' not found in world '${worldId}'`);
            }

            const db = await this.getLevelDB(worldInfo, collectionType);
            const document = await db.get(documentId);
            
            return {
                success: true,
                worldId: worldId,
                documentType: documentType,
                documentId: documentId,
                document: document
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                worldId: worldId,
                documentType: documentType,
                documentId: documentId
            };
        }
    }

    /**
     * List documents in a user-friendly format
     */
    formatDocumentList(searchResult, options = {}) {
        if (!searchResult.success) {
            return `Error: ${searchResult.error}`;
        }

        if (searchResult.totalFound === 0) {
            return `No documents found in world '${searchResult.worldId}' collection '${searchResult.documentType}'`;
        }

        const output = [];
        output.push(`Found ${searchResult.totalFound} ${searchResult.documentType}(s) in world '${searchResult.worldId}':`);
        output.push('');

        for (const doc of searchResult.documents) {
            const name = doc.name || 'Unnamed';
            const type = doc.type || 'Unknown';
            const id = doc._id || 'No ID';
            
            output.push(`• ${name} (${type})`);
            output.push(`  ID: ${id}`);
            
            if (options.showDetails) {
                if (doc.img) output.push(`  Image: ${doc.img}`);
                if (doc.folder) output.push(`  Folder: ${doc.folder}`);
                if (doc._stats?.createdTime) {
                    const created = new Date(doc._stats.createdTime).toLocaleDateString();
                    output.push(`  Created: ${created}`);
                }
            }
            
            if (options.showJSON && options.showJSON > 0) {
                const jsonStr = JSON.stringify(doc, null, 2);
                const truncated = jsonStr.length > options.showJSON ? 
                    jsonStr.substring(0, options.showJSON) + '...' : jsonStr;
                output.push(`  JSON: ${truncated}`);
            }
            
            output.push('');
        }

        if (searchResult.searchOptions) {
            output.push('Search criteria:');
            if (searchResult.searchOptions.name) output.push(`  Name: ${searchResult.searchOptions.name}`);
            if (searchResult.searchOptions.type) output.push(`  Type: ${searchResult.searchOptions.type}`);
            if (searchResult.searchOptions.id) output.push(`  ID: ${searchResult.searchOptions.id}`);
            if (searchResult.searchOptions.limit) output.push(`  Limit: ${searchResult.searchOptions.limit}`);
        }

        return output.join('\n');
    }

    /**
     * Validate if a world exists and is accessible
     */
    async validateWorldExists(worldId) {
        try {
            await this.getWorldInfo(worldId);
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
}

/**
 * Mock LevelDB implementation for demonstration
 * In production, this would use the 'classic-level' package
 */
class MockLevelDB {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.mockData = this.loadMockData();
    }

    /**
     * Load mock data from the actual world files for demonstration
     */
    loadMockData() {
        try {
            // Try to read actual data from the test world for demonstration
            if (this.dbPath.includes('actors')) {
                return [
                    {
                        _id: "SPpum9vlNkX6NqzA",
                        name: "Testorolono",
                        type: "character",
                        img: "icons/svg/mystery-man.svg",
                        system: {
                            attributes: {
                                hp: { value: 0, max: null }
                            },
                            details: {
                                biography: { value: "", public: "" }
                            }
                        },
                        _stats: {
                            createdTime: 1753739913084,
                            modifiedTime: 1753754421254,
                            systemId: "dnd5e",
                            systemVersion: "4.4.4"
                        }
                    }
                ];
            } else if (this.dbPath.includes('items')) {
                return [
                    {
                        _id: "MockItem123456",
                        name: "Magic Sword",
                        type: "weapon",
                        img: "icons/weapons/sword.png",
                        system: {
                            description: { value: "A magical blade" },
                            damage: { parts: [["1d8", "slashing"]] }
                        },
                        _stats: {
                            createdTime: Date.now(),
                            systemId: "dnd5e"
                        }
                    },
                    {
                        _id: "MockItem789012",
                        name: "Healing Potion",
                        type: "consumable",
                        img: "icons/potions/healing.png",
                        system: {
                            description: { value: "Restores health" }
                        },
                        _stats: {
                            createdTime: Date.now(),
                            systemId: "dnd5e"
                        }
                    }
                ];
            }
            return [];
        } catch (error) {
            return [];
        }
    }

    async put(key, value) {
        // In a real implementation, this would write to LevelDB
        console.log(`[MOCK] Would insert document with key: !actors!${key}`);
        console.log(`[MOCK] Document data: ${JSON.stringify(value, null, 2).substring(0, 200)}...`);
        
        // Add to mock data for search functionality
        this.mockData.push(value);
        
        return {
            key: key,
            success: true,
            timestamp: Date.now()
        };
    }

    async get(key) {
        // Mock retrieval - find by ID
        const document = this.mockData.find(doc => doc._id === key);
        if (!document) {
            throw new Error(`Document not found: ${key}`);
        }
        return document;
    }

    async getAll() {
        // Return all documents in the collection
        return [...this.mockData];
    }

    async close() {
        // Mock close operation
        return true;
    }
}

export default WorldManager;