import { FoundryPuppeteerValidator } from './foundry-puppeteer-validator.mjs';

export class WorldManager {
    constructor(validator) {
        if (!(validator instanceof FoundryPuppeteerValidator)) {
            throw new Error("WorldManager requires an instance of FoundryPuppeteerValidator.");
        }
        this.validator = validator;
    }

    async search(documentType, namePattern = null) {
        console.log(`Searching for ${documentType} documents with pattern: ${namePattern}`);
        const page = this.validator.serverManager.page;
        if (!page) {
            throw new Error("Puppeteer page not available.");
        }

        const documents = await page.evaluate(async (type, pattern) => {
            // Check if game and collections are available
            if (!window.game || !window.game.collections) {
                return { error: `Game context not fully initialized. Collections not available.` };
            }
            
            // Normalize the input type to match FoundryVTT's internal capitalization
            const normalizedType = type.split('-')
                                       .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                       .join('');

            // First, check if it's a direct collection name (Item, Actor, Scene, etc.)
            let collection = game.collections.get(normalizedType);
            let filterByType = null;
            
            // If not a direct collection, check if it's a subtype
            if (!collection) {
                // Check if it's an Item subtype
                if (window.CONFIG?.Item?.typeLabels?.[type]) {
                    collection = game.collections.get('Item');
                    filterByType = type;
                } 
                // Check if it's an Actor subtype
                else if (window.CONFIG?.Actor?.typeLabels?.[type]) {
                    collection = game.collections.get('Actor');
                    filterByType = type;
                }
                // Check other document types
                else {
                    for (const [docType, config] of Object.entries(window.CONFIG)) {
                        if (config?.typeLabels?.[type]) {
                            collection = game.collections.get(docType);
                            filterByType = type;
                            break;
                        }
                    }
                }
            }
            
            if (!collection) {
                return { error: `Collection for type "${type}" (normalized: ${normalizedType}) not found.` };
            }

            let results = Array.from(collection.values());
            
            // Filter by subtype if needed
            if (filterByType) {
                results = results.filter(doc => doc.type === filterByType);
            }

            // Filter by name pattern if provided
            if (pattern) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
                results = results.filter(doc => regex.test(doc.name));
            }

            return results.map(doc => ({
                id: doc.id,
                name: doc.name,
                // Add other relevant properties you want to return
                // For now, just id and name for basic search
            }));
        }, documentType, namePattern);

        if (documents.error) {
            throw new Error(documents.error);
        }

        return documents;
    }

    // Placeholder for create, update, delete methods
    async create(documentType, data, options = {}) {
        console.log(`Creating ${documentType} document with data:`, data);
        
        // Validate the document first (includes image validation unless noImage is true)
        await this.validator.validateDocument(documentType, data, options);
        
        const page = this.validator.serverManager.page;
        if (!page) {
            throw new Error("Puppeteer page not available.");
        }

        const result = await page.evaluate(async (type, docData) => {
            try {
                // Check if game and collections are available
                if (!window.game || !window.game.collections) {
                    return { error: `Game context not fully initialized. Collections not available.` };
                }
                
                // Normalize the input type to match FoundryVTT's internal capitalization
                // e.g., "journalentry" -> "JournalEntry", "rolltable" -> "RollTable"
                const normalizedType = type.split('-')
                                           .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                           .join('');

                let collection = game.collections.get(normalizedType);
                let actualType = normalizedType; // Assume normalizedType is the actual document type

                // If not a direct collection, check if it's a subtype
                if (!collection) {
                    // Check if it's an Item subtype
                    if (window.CONFIG?.Item?.typeLabels?.[type]) {
                        collection = game.collections.get('Item');
                        actualType = 'Item';
                        docData.type = type; // Original type is the subtype
                    } 
                    // Check if it's an Actor subtype
                    else if (window.CONFIG?.Actor?.typeLabels?.[type]) {
                        collection = game.collections.get('Actor');
                        actualType = 'Actor';
                        docData.type = type; // Original type is the subtype
                    }
                    // Check other document types (for subtypes within other top-level documents)
                    else {
                        for (const [docType, config] of Object.entries(window.CONFIG)) {
                            if (config?.typeLabels?.[type]) {
                                collection = game.collections.get(docType);
                                actualType = docType;
                                docData.type = type; // Original type is the subtype
                                break;
                            }
                        }
                    }
                }
                
                if (!collection) {
                    return { error: `Collection for type "${type}" (normalized: ${normalizedType}) not found.` };
                }
                
                let DocumentClass = null;
                // Try to get from CONFIG first using the actualType
                if (window.CONFIG?.[actualType]?.documentClass) {
                    DocumentClass = window.CONFIG[actualType].documentClass;
                } else {
                    // Fallback for cases where documentClass might be nested or not directly on CONFIG
                    for (const key in window.CONFIG) {
                        if (key.toLowerCase() === actualType.toLowerCase() && window.CONFIG[key].documentClass) {
                            DocumentClass = window.CONFIG[key].documentClass;
                            break;
                        }
                    }
                    if (!DocumentClass && window[actualType]) { // Fallback to global object for core types
                        DocumentClass = window[actualType];
                    } else if (!DocumentClass && collection?.documentClass) { // Fallback to collection's documentClass
                        DocumentClass = collection.documentClass;
                    }
                }

                if (!DocumentClass) {
                    return { error: `Document class not found for type: ${actualType}` };
                }
                
                // Ensure docData.type is set for all document creations
                if (!docData.type) {
                    docData.type = normalizedType;
                }

                const createdDocument = await DocumentClass.create(docData);
                return { success: true, id: createdDocument.id, name: createdDocument.name };
            } catch (e) {
                return { error: e.message || "Failed to create document." };
            }
        }, documentType, data);

        if (result.error) {
            throw new Error(result.error);
        }

        return result;
    }

    async update(documentType, id, data) {
        console.log(`Updating ${documentType} document with ID: ${id} with data:`, data);
        const page = this.validator.serverManager.page;
        if (!page) {
            throw new Error("Puppeteer page not available.");
        }

        const result = await page.evaluate(async (type, docId, updateData) => {
            try {
                // Check if game and collections are available
                if (!window.game || !window.game.collections) {
                    return { error: `Game context not fully initialized. Collections not available.` };
                }
                
                // Normalize the input type to match FoundryVTT's internal capitalization
                const normalizedType = type.split('-')
                                           .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                           .join('');

                // First, check if it's a direct collection name (Item, Actor, Scene, etc.)
                let collection = game.collections.get(normalizedType);
                
                // If not a direct collection, check if it's a subtype
                if (!collection) {
                    // Check if it's an Item subtype
                    if (window.CONFIG?.Item?.typeLabels?.[type]) {
                        collection = game.collections.get('Item');
                    } 
                    // Check if it's an Actor subtype
                    else if (window.CONFIG?.Actor?.typeLabels?.[type]) {
                        collection = game.collections.get('Actor');
                    }
                    // Check other document types
                    else {
                        for (const [docType, config] of Object.entries(window.CONFIG)) {
                            if (config?.typeLabels?.[type]) {
                                collection = game.collections.get(docType);
                                break;
                            }
                        }
                    }
                }
                
                if (!collection) {
                    return { error: `Collection for type "${type}" (normalized: ${normalizedType}) not found.` };
                }
                
                const document = collection.get(docId);
                if (!document) {
                    // If document not found in collection, it might be a filtered subtype
                    // Try to find it by searching all documents of the correct type
                    const allDocs = Array.from(collection.values());
                    const foundDoc = allDocs.find(doc => doc.id === docId && (!type || doc.type === type));
                    if (!foundDoc) {
                        return { error: `Document with ID "${docId}" not found.` };
                    }
                    const updatedDocument = await foundDoc.update(updateData);
                    return { success: true, id: updatedDocument.id, name: updatedDocument.name };
                }
                
                const updatedDocument = await document.update(updateData);
                return { success: true, id: updatedDocument.id, name: updatedDocument.name };
            } catch (e) {
                return { error: e.message || "Failed to update document." };
            }
        }, documentType, id, data);

        if (result.error) {
            throw new Error(result.error);
        }

        return result;
    }

    async delete(documentType, id) {
        console.log(`Deleting ${documentType} document with ID: ${id}`);
        const page = this.validator.serverManager.page;
        if (!page) {
            throw new Error("Puppeteer page not available.");
        }

        const result = await page.evaluate(async (type, docId) => {
            try {
                // Check if game and collections are available
                if (!window.game || !window.game.collections) {
                    return { error: `Game context not fully initialized. Collections not available.` };
                }
                
                // Normalize the input type to match FoundryVTT's internal capitalization
                const normalizedType = type.split('-')
                                       .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                       .join('');

                // First, check if it's a direct collection name (Item, Actor, Scene, etc.)
                let collection = game.collections.get(normalizedType);
                
                // If not a direct collection, check if it's a subtype
                if (!collection) {
                    // Check if it's an Item subtype
                    if (window.CONFIG?.Item?.typeLabels?.[type]) {
                        collection = game.collections.get('Item');
                    } 
                    // Check if it's an Actor subtype
                    else if (window.CONFIG?.Actor?.typeLabels?.[type]) {
                        collection = game.collections.get('Actor');
                    }
                    // Check other document types
                    else {
                        for (const [docType, config] of Object.entries(window.CONFIG)) {
                            if (config?.typeLabels?.[type]) {
                                collection = game.collections.get(docType);
                                break;
                            }
                        }
                    }
                }
                
                if (!collection) {
                    return { error: `Collection for type "${type}" (normalized: ${normalizedType}) not found.` };
                }
                
                const document = collection.get(docId);
                if (!document) {
                    // If document not found in collection, it might be a filtered subtype
                    // Try to find it by searching all documents
                    const allDocs = Array.from(collection.values());
                    const foundDoc = allDocs.find(doc => doc.id === docId);
                    if (!foundDoc) {
                        return { error: `Document with ID "${docId}" not found.` };
                    }
                    await foundDoc.delete();
                    return { success: true, id: docId };
                }
                
                await document.delete();
                return { success: true, id: docId };
            } catch (e) {
                return { error: e.message || "Failed to delete document." };
            }
        }, documentType, id);

        if (result.error) {
            throw new Error(result.error);
        }

        return result;
    }
}