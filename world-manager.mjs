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
            const collection = game.collections.get(type);
            if (!collection) {
                return { error: `Collection for type "${type}" not found.` };
            }

            let results = Array.from(collection.values());

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
    async create(documentType, data) {
        console.log(`Creating ${documentType} document with data:`, data);
        const page = this.validator.serverManager.page;
        if (!page) {
            throw new Error("Puppeteer page not available.");
        }

        const result = await page.evaluate(async (type, docData) => {
            try {
                const collection = game.collections.get(type);
                if (!collection) {
                    return { error: `Collection for type "${type}" not found.` };
                }
                const createdDocument = await collection.documentClass.create(docData);
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
                const collection = game.collections.get(type);
                if (!collection) {
                    return { error: `Collection for type "${type}" not found.` };
                }
                const document = collection.get(docId);
                if (!document) {
                    return { error: `Document with ID "${docId}" not found in collection "${type}".` };
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
                const collection = game.collections.get(type);
                if (!collection) {
                    return { error: `Collection for type "${type}" not found.` };
                }
                const document = collection.get(docId);
                if (!document) {
                    return { error: `Document with ID "${docId}" not found in collection "${type}".` };
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
