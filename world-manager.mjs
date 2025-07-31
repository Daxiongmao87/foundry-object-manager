#!/usr/bin/env node

/**
 * FoundryVTT World Manager
 * Handles world discovery, database access, and document insertion
 */

import { existsSync, readFileSync } from 'fs';
import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import pkg from 'classic-level';
const { ClassicLevel } = pkg;

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
     * Format document key for FoundryVTT database storage
     */
    formatDocumentKey(collectionType, documentId) {
        // FoundryVTT uses keys like: !items!{id}, !actors!{id}, etc.
        return `!${collectionType}!${documentId}`;
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

        // Use real LevelDB for actual database operations
        const db = new ClassicLevel(dbPath, { valueEncoding: 'json' });
        return db;
    }

    /**
     * Insert a validated document into a world
     */
    async insertDocument(worldId, documentType, validatedData, options = {}) {
        try {
            // Validate world and system compatibility
            const worldInfo = await this.validateWorldSystem(worldId, options.systemId || 'unknown');
            
            // Document data is already prepared by FoundryVTT's document creation process
            const documentData = validatedData;
            
            // Get collection name (lowercase document type)
            const collectionType = this.getCollectionName(documentType);
            
            // Check if collection exists
            if (!worldInfo.documentCollections.includes(collectionType)) {
                throw new Error(`Document type '${documentType}' (collection '${collectionType}') is not supported in this world`);
            }

            // Get database connection
            const db = await this.getLevelDB(worldInfo, collectionType);
            
            try {
                // Insert document with proper FoundryVTT key format
                const dbKey = this.formatDocumentKey(collectionType, documentData._id);
                await db.put(dbKey, documentData);
            } finally {
                await db.close();
            }
            
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
     * Prepare document data for insertion using FoundryVTT's document creation process
     */
    async prepareDocumentForInsertion(validatedData, documentType, options = {}) {
        try {
            // Import the actual FoundryVTT document class
            const documentPath = join(this.foundryEnv.resourcesPath, 'common', 'documents', `${documentType.toLowerCase()}.mjs`);
            
            if (existsSync(documentPath)) {
                const DocumentClass = await import(`file://${documentPath}`);
                const BaseDocument = DocumentClass.default;
                
                if (BaseDocument) {
                    // Use FoundryVTT's document creation process
                    const now = Date.now();
                    const userId = options.userId || 'CLI_USER_ID';
                    
                    // Let FoundryVTT create the proper document structure
                    const documentData = {
                        ...validatedData,
                        _id: validatedData._id || this.generateDocumentId(),
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
                    
                    // Create a temporary document instance to get proper defaults
                    const tempDoc = new BaseDocument(documentData, {});
                    // Use the document's data to get proper structure with defaults
                    return tempDoc.toObject();
                }
            }
            
            throw new Error(`Document class not found: ${documentType}`);
            
        } catch (error) {
            throw new Error(`Failed to use FoundryVTT document class for ${documentType}: ${error.message}`);
        }
    }
    

    /**
     * Retrieve all documents from a LevelDB database
     */
    async getAllDocuments(db) {
        const documents = [];
        
        try {
            for await (const [key, value] of db.iterator()) {
                documents.push(value);
            }
        } catch (error) {
            console.warn('Failed to retrieve documents from database:', error.message);
        }
        // Don't close here - let the caller handle closing
        
        return documents;
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
            
            let documents = [];
            try {
                // Retrieve all documents from the collection
                documents = await this.getAllDocuments(db);
            } finally {
                await db.close();
            }
            
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
     * Update an existing document in a world
     */
    async updateDocument(worldId, documentType, documentId, updateData, options = {}) {
        try {
            // First, retrieve the existing document
            const getResult = await this.getDocument(worldId, documentType, documentId);
            
            if (!getResult.success) {
                throw new Error(`Document not found: ${getResult.error}`);
            }
            
            const existingDocument = getResult.document;
            
            // Merge update data with existing document
            const mergedData = this.mergeDocumentData(existingDocument, updateData);
            
            // Validate world and system compatibility
            const worldInfo = await this.validateWorldSystem(worldId, options.systemId || existingDocument._stats?.systemId || 'unknown');
            
            // Get collection name
            const collectionType = this.getCollectionName(documentType);
            
            // Update modified time and user
            mergedData._stats = {
                ...mergedData._stats,
                modifiedTime: Date.now(),
                lastModifiedBy: options.userId || 'CLI_UPDATE_USER'
            };
            
            // Get database connection
            const db = await this.getLevelDB(worldInfo, collectionType);
            
            try {
                // Update document with proper FoundryVTT key format
                const dbKey = this.formatDocumentKey(collectionType, documentId);
                await db.put(dbKey, mergedData);
            } finally {
                await db.close();
            }
            
            return {
                success: true,
                worldId: worldId,
                documentType: documentType,
                documentId: documentId,
                updatedData: mergedData,
                message: `Successfully updated ${documentType} '${mergedData.name}' in world '${worldId}'`
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
     * Merge update data with existing document data
     */
    mergeDocumentData(existingDocument, updateData) {
        // Create a deep copy of the existing document
        const merged = JSON.parse(JSON.stringify(existingDocument));
        
        // Fields that should never be changed by updates
        const protectedFields = ['_id', '_stats.createdTime', '_stats.coreVersion', '_stats.systemId', '_stats.systemVersion'];
        
        // Deep merge function that preserves protected fields
        const deepMerge = (target, source, path = '') => {
            for (const key in source) {
                const currentPath = path ? `${path}.${key}` : key;
                
                // Skip protected fields
                if (protectedFields.includes(currentPath)) {
                    continue;
                }
                
                if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    // Ensure the target has this key as an object
                    if (!target[key] || typeof target[key] !== 'object') {
                        target[key] = {};
                    }
                    deepMerge(target[key], source[key], currentPath);
                } else {
                    // Direct assignment for primitives and arrays
                    target[key] = source[key];
                }
            }
        };
        
        deepMerge(merged, updateData);
        
        return merged;
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
            
            try {
                // Use proper FoundryVTT key format
                const dbKey = this.formatDocumentKey(collectionType, documentId);
                const document = await db.get(dbKey);
                
                return {
                    success: true,
                    worldId: worldId,
                    documentType: documentType,
                    documentId: documentId,
                    document: document
                };
            } finally {
                await db.close();
            }
            
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
            
            if (options.showJSON) {
                output.push(`  JSON: ${JSON.stringify(doc, null, 2)}`);
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

    /**
     * Get the Game Master user ID from the world
     */
    async getGMUserId(worldId) {
        try {
            const worldInfo = await this.getWorldInfo(worldId);
            const usersDb = await this.getLevelDB(worldInfo, 'users');
            
            try {
                // Find the first GM user (role 4 = GAMEMASTER)
                for await (const [key, user] of usersDb.iterator()) {
                    if (user.role === 4) { // GAMEMASTER role
                        return user._id;
                    }
                }
                
                // If no GM found, return the first user
                for await (const [key, user] of usersDb.iterator()) {
                    return user._id;
                }
                
                // Fallback: generate a 16-char ID if no users exist
                return this.generateDocumentId();
                
            } finally {
                await usersDb.close();
            }
        } catch (error) {
            // Fallback: generate a 16-char ID if users collection doesn't exist
            return this.generateDocumentId();
        }
    }
}

export default WorldManager;