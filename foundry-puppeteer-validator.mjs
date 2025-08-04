#!/usr/bin/env node

/**
 * FoundryPuppeteerValidator - Document Validation using FoundryVTT
 * 
 * Works with FoundryServerManager to provide actual FoundryVTT validation
 * through Puppeteer browser automation.
 */

import { ServerState } from './foundry-server-manager.mjs';

// Custom error class for validation errors
export class ValidationError extends Error {
    constructor(message, field = null, code = 'VALIDATION_ERROR') {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.code = code;
    }
}

export class FoundryPuppeteerValidator {
    /**
     * Create a new validator instance
     * @param {FoundryServerManager} serverManager - Configured server manager instance
     * @param {Object} options - Configuration options
     * @param {number} options.validationTimeout - Timeout for validation operations (default: 30000ms)
     */
    constructor(serverManager, options = {}) {
        if (!serverManager) {
            throw new Error('FoundryServerManager instance is required');
        }
        
        this.serverManager = serverManager;
        this.validationTimeout = options.validationTimeout || 60000; // 60 seconds default
        this.initialized = false;
        this._systemCache = null;
        this._objectTypeCache = null;
    }

    /**
     * Initialize the validator
     * Ensures server is ready and game context is available
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) {
            console.log('🎮 Validator already initialized');
            return;
        }

        console.log('🚀 Initializing validator...');

        // 1. Check server state - must be READY (world activated)
        const serverState = this.serverManager.getState();
        if (serverState !== ServerState.READY) {
            throw new Error(`Server must be in READY state with activated world. Current state: ${serverState}`);
        }

        // 2. Ensure browser is initialized
        if (!this.serverManager.browser || !this.serverManager.page) {
            throw new Error('Browser must be initialized. Call serverManager.initializeBrowser() first');
        }

        // 3. Navigate to game page
        console.log('🎮 Navigating to game interface...');
        const serverUrl = this.serverManager.getServerUrl();
        await this.serverManager.page.goto(`${serverUrl}/game`, {
            waitUntil: 'networkidle0',
            timeout: this.validationTimeout
        });

        // 4. Check current URL and handle redirects
        const currentUrl = this.serverManager.page.url();
        console.log(`📍 Current URL after navigation: ${currentUrl}`);
        
        // Check if we have an authentication error (Critical Failure page)
        const pageTitle = await this.serverManager.page.title();
        const hasAuthError = pageTitle.includes('Critical Failure') || 
                           currentUrl.includes('/join') || 
                           currentUrl.includes('/auth');
        
        if (hasAuthError) {
            console.log('🔐 Authentication required, attempting login...');
            
            // If we're on a Critical Failure page, navigate to setup first
            if (pageTitle.includes('Critical Failure')) {
                console.log('   Critical Failure detected, navigating to setup page...');
                await this.serverManager.page.goto(`${serverUrl}/setup`, {
                    waitUntil: 'networkidle0',
                    timeout: this.validationTimeout
                });
                // Wait a moment for the setup page to fully load
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Try to launch the world from setup page
                const worldId = this.serverManager.activeWorld;
                if (worldId) {
                    console.log(`   Attempting to launch world '${worldId}' from setup page...`);
                    try {
                        // Look for the world element and click it
                        const worldSelector = `[data-package-id="${worldId}"]`;
                        const worldElement = await this.serverManager.page.$(worldSelector);
                        if (worldElement) {
                            await worldElement.click();
                            console.log('   World element clicked, waiting for navigation...');
                            await this.serverManager.page.waitForNavigation({ 
                                waitUntil: 'networkidle0', 
                                timeout: this.validationTimeout 
                            });
                        }
                    } catch (error) {
                        console.log(`   World launch attempt failed: ${error.message}`);
                    }
                }
            }
            
            // Get admin password
            const adminPassword = await this.serverManager.credentialManager.getAdminPassword();
            
            if (adminPassword) {
                console.log('🔑 Using admin credentials for authentication...');
                
                // Look for admin password field
                const adminPasswordField = await this.serverManager.page.$('input[name="adminPassword"]');
                if (adminPasswordField) {
                    console.log('   Found admin password field, entering credentials...');
                    await adminPasswordField.type(adminPassword);
                    
                    // Find and click join button
                    const joinButton = await this.serverManager.page.$('button[type="submit"], input[type="submit"], button[name="join"]');
                    if (joinButton) {
                        console.log('   Submitting admin login...');
                        await Promise.all([
                            this.serverManager.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: this.validationTimeout }),
                            joinButton.click()
                        ]);
                        console.log('✅ Admin authentication completed');
                    } else {
                        console.error('❌ Join button not found');
                    }
                } else {
                    // Try world-level authentication
                    const worldPasswordField = await this.serverManager.page.$('input[name="password"]');
                    if (worldPasswordField) {
                        console.log('   No admin field, trying world authentication...');
                        // For now, try empty password or skip auth
                        const joinButton = await this.serverManager.page.$('button[type="submit"], input[type="submit"]');
                        if (joinButton) {
                            await joinButton.click();
                            await this.serverManager.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: this.validationTimeout });
                        }
                    }
                }
            } else {
                console.log('⚠️  No admin password configured, trying to join without password...');
                // Try to join without password
                const joinButton = await this.serverManager.page.$('button[type="submit"], input[type="submit"]');
                if (joinButton) {
                    await joinButton.click();
                    await this.serverManager.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
                }
            }
            
            // Check if we're now on the game page
            const newUrl = this.serverManager.page.url();
            console.log(`📍 Post-auth URL: ${newUrl}`);
        }

        // 5. Wait for either game context or valid setup context
        console.log('⌛ Waiting for game context...');
        try {
            await this.serverManager.page.waitForFunction(
                () => {
                    console.log('Context check - Game:', !!window.game, window.game?.ready, 'Foundry:', !!window.foundry, 'Config:', !!window.CONFIG);
                    // Accept either a ready game context OR a valid setup context with FoundryVTT
                    return (window.game && window.game.ready === true) || 
                           (window.foundry && window.CONFIG && document.title.includes('Foundry Virtual Tabletop'));
                },
                { timeout: this.validationTimeout }
            );
            console.log('✅ Game or setup context ready');
        } catch (error) {
            // Get more debugging info
            const debugInfo = await this.serverManager.page.evaluate(() => {
                return {
                    hasGame: !!window.game,
                    gameReady: window.game?.ready,
                    gameVersion: window.game?.version,
                    currentUrl: window.location.href,
                    pageTitle: document.title,
                    bodyClasses: document.body?.className,
                    hasFoundry: !!window.foundry,
                    errors: window.console?.errors || 'none'
                };
            });
            console.error('❌ Game context debug info:', debugInfo);
            throw new Error(`Game context failed to initialize. Debug: ${JSON.stringify(debugInfo)}`);
        }

        // 5. Verify we have access to validation systems
        const validationCheck = await this.serverManager.page.evaluate(() => {
            return {
                hasGame: !!window.game,
                gameReady: window.game?.ready,
                hasConfig: !!window.CONFIG,
                hasItemClass: !!window.CONFIG?.Item?.documentClass,
                hasActorClass: !!window.CONFIG?.Actor?.documentClass,
                systemId: window.game?.system?.id,
                systemTitle: window.game?.system?.title,
                worldId: window.game?.world?.id,
                worldTitle: window.game?.world?.title
            };
        });

        console.log('📊 Validation check:', validationCheck);

        if (!validationCheck.hasConfig || !validationCheck.hasItemClass || !validationCheck.hasActorClass) {
            throw new Error('FoundryVTT validation system not properly loaded');
        }

        console.log(`✅ Validator initialized for ${validationCheck.systemTitle} (${validationCheck.systemId})`);
        console.log(`   World: ${validationCheck.worldTitle} (${validationCheck.worldId})`);
        
        this.initialized = true;
    }

    /**
     * Validate a document using FoundryVTT's validation system
     * @param {string} documentType - Type of document (Item, Actor, etc.)
     * @param {Object} documentData - Document data to validate
     * @returns {Promise<Object>} Validation result with success status and validated data
     */
    async validateDocument(documentType, documentData) {
        await this._ensureInitialized();

        console.log(`🔍 Validating ${documentType}: ${documentData.name || 'Unnamed'}`);

        try {
            const result = await this.serverManager.page.evaluate(async (docType, docData, timeout) => {
                // Helper function to extract validation errors
                const extractValidationErrors = (error) => {
                    const errors = [];
                    
                    // Check for validation failure array
                    if (error.validationFailures) {
                        for (const [field, failure] of Object.entries(error.validationFailures)) {
                            errors.push({
                                field,
                                message: failure.message || failure.toString(),
                                invalidValue: failure.invalidValue
                            });
                        }
                    } else {
                        // Single error
                        errors.push({
                            field: error.field || null,
                            message: error.message,
                            invalidValue: error.invalidValue
                        });
                    }
                    
                    return errors;
                };

                // Set up timeout promise
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Validation timeout after ${timeout}ms`)), timeout);
                });

                // Set up validation promise
                const validationPromise = new Promise((resolve) => {
                    try {
                        // Normalize document type to proper case
                        const normalizedType = docType.charAt(0).toUpperCase() + docType.slice(1).toLowerCase();
                        
                        // Get the appropriate document class
                        let DocumentClass;
                        if (normalizedType === 'Item') {
                            DocumentClass = window.CONFIG?.Item?.documentClass || window.Item;
                        } else if (normalizedType === 'Actor') {
                            DocumentClass = window.CONFIG?.Actor?.documentClass || window.Actor;
                        } else {
                            // Try generic CONFIG lookup
                            DocumentClass = window.CONFIG?.[normalizedType]?.documentClass;
                        }
                        
                        if (!DocumentClass) {
                            resolve({
                                success: false,
                                error: `Document class not available for type: ${docType}`,
                                code: 'INVALID_DOCUMENT_TYPE',
                                documentType: docType
                            });
                            return;
                        }
                        
                        // Validate required fields
                        if (!docData.name) {
                            resolve({
                                success: false,
                                error: 'Document must have a name',
                                code: 'MISSING_REQUIRED_FIELD',
                                field: 'name',
                                documentType: docType
                            });
                            return;
                        }
                        
                        if (!docData.type) {
                            resolve({
                                success: false,
                                error: 'Document must have a type',
                                code: 'MISSING_REQUIRED_FIELD',
                                field: 'type',
                                documentType: docType
                            });
                            return;
                        }
                        
                        // Check if type is valid for this document class
                        const validTypes = window.CONFIG?.[normalizedType]?.typeLabels;
                        if (validTypes && !validTypes[docData.type]) {
                            resolve({
                                success: false,
                                error: `Invalid type '${docData.type}' for ${normalizedType}`,
                                code: 'INVALID_TYPE',
                                field: 'type',
                                validTypes: Object.keys(validTypes),
                                documentType: docType
                            });
                            return;
                        }
                        
                        // Create document with validation
                        const doc = new DocumentClass(docData, { 
                            strict: true,
                            partial: false,
                            keepId: true
                        });
                        
                        // Use validateUpdate to check the data
                        const validation = doc.validateUpdate(docData, {});
                        if (validation === false) {
                            resolve({
                                success: false,
                                error: 'Document validation failed',
                                code: 'VALIDATION_FAILED',
                                documentType: docType
                            });
                            return;
                        }
                        
                        // Get the validated document data
                        const validatedData = doc.toObject();
                        
                        // Extract schema information
                        const schema = doc.constructor.schema;
                        const schemaFields = schema ? Object.keys(schema.fields || {}) : [];
                        
                        resolve({
                            success: true,
                            documentClass: DocumentClass.name,
                            systemId: window.game?.system?.id,
                            type: doc.type || docType,
                            data: validatedData,
                            metadata: {
                                hasImg: !!validatedData.img,
                                hasSystem: !!validatedData.system,
                                systemDataKeys: validatedData.system ? Object.keys(validatedData.system) : [],
                                schemaFields: schemaFields,
                                id: doc.id || doc._id
                            }
                        });
                        
                    } catch (error) {
                        // Parse validation errors
                        const validationErrors = extractValidationErrors(error);
                        
                        resolve({
                            success: false,
                            error: error.message,
                            code: 'VALIDATION_ERROR',
                            validationErrors: validationErrors,
                            stack: error.stack,
                            documentType: docType,
                            validationError: true
                        });
                    }
                });

                // Race between validation and timeout
                return await Promise.race([validationPromise, timeoutPromise]);
                
            }, documentType, documentData, this.validationTimeout);

            if (result.success) {
                console.log(`✅ Validation successful using ${result.documentClass}`);
                console.log(`   Type: ${result.type}, System: ${result.systemId}`);
                console.log(`   ID: ${result.metadata.id}`);
                if (result.metadata.systemDataKeys.length > 0) {
                    console.log(`   System data keys: ${result.metadata.systemDataKeys.join(', ')}`);
                }
            } else {
                console.error(`❌ Validation failed: ${result.error}`);
                if (result.validationErrors) {
                    result.validationErrors.forEach(err => {
                        console.error(`   - Field '${err.field}': ${err.message}`);
                    });
                }
                
                // Throw custom ValidationError for better error handling
                throw new ValidationError(
                    result.error,
                    result.field || null,
                    result.code || 'VALIDATION_ERROR'
                );
            }

            return result;

        } catch (error) {
            // Re-throw ValidationError as-is
            if (error instanceof ValidationError) {
                throw error;
            }
            
            // Wrap other errors
            console.error(`❌ Validation error: ${error.message}`);
            throw new ValidationError(
                `Document validation failed: ${error.message}`,
                null,
                'EXECUTION_ERROR'
            );
        }
    }

    /**
     * Get available systems in the FoundryVTT instance
     * @returns {Promise<Array>} List of available systems with metadata
     */
    async getAvailableSystems() {
        await this._ensureInitialized();

        // Return cached value if available
        if (this._systemCache) {
            return this._systemCache;
        }

        try {
            const systems = await this.serverManager.page.evaluate(() => {
                const systemsList = [];
                
                // Get current active system
                if (window.game?.system) {
                    const system = window.game.system;
                    systemsList.push({
                        id: system.id,
                        title: system.title,
                        version: system.version,
                        author: system.author,
                        description: system.description,
                        active: true,
                        documentTypes: {
                            actors: Object.keys(window.CONFIG?.Actor?.typeLabels || {}),
                            items: Object.keys(window.CONFIG?.Item?.typeLabels || {})
                        }
                    });
                }
                
                // Note: Other installed systems aren't directly accessible from game context
                // Only the active system is loaded
                
                return systemsList;
            });

            this._systemCache = systems;
            console.log(`📦 Found ${systems.length} active system(s)`);
            
            return systems;

        } catch (error) {
            console.error(`❌ Failed to get systems: ${error.message}`);
            return [];
        }
    }

    /**
     * Get available object types for the current system
     * @param {boolean} includeBaseTypes - Include base document types (default: true)
     * @returns {Promise<Object>} Map of object types to their metadata
     */
    async getSystemObjectTypes(includeBaseTypes = true) {
        await this._ensureInitialized();

        // Return cached value if available
        if (this._objectTypeCache) {
            return this._objectTypeCache;
        }

        try {
            const objectTypes = await this.serverManager.page.evaluate((includeBase) => {
                const types = {};
                
                // Get Item types
                if (window.CONFIG?.Item?.typeLabels) {
                    for (const [type, label] of Object.entries(window.CONFIG.Item.typeLabels)) {
                        types[type] = {
                            documentType: 'Item',
                            subtype: type,
                            label: label,
                            hasDataModel: !!window.CONFIG.Item.dataModels?.[type]
                        };
                    }
                }
                
                // Get Actor types
                if (window.CONFIG?.Actor?.typeLabels) {
                    for (const [type, label] of Object.entries(window.CONFIG.Actor.typeLabels)) {
                        types[type] = {
                            documentType: 'Actor',
                            subtype: type,
                            label: label,
                            hasDataModel: !!window.CONFIG.Actor.dataModels?.[type]
                        };
                    }
                }
                
                // Add base document types if requested
                if (includeBase) {
                    types.item = {
                        documentType: 'Item',
                        subtype: null,
                        label: 'Generic Item',
                        isBase: true
                    };
                    
                    types.actor = {
                        documentType: 'Actor',
                        subtype: null,
                        label: 'Generic Actor',
                        isBase: true
                    };
                }
                
                return types;
            }, includeBaseTypes);

            this._objectTypeCache = objectTypes;
            
            const typeCount = Object.keys(objectTypes).length;
            console.log(`📋 Found ${typeCount} object types`);
            
            // Log some examples
            const examples = Object.entries(objectTypes).slice(0, 5);
            examples.forEach(([key, value]) => {
                console.log(`   ${key}: ${value.label} (${value.documentType})`);
            });
            
            if (typeCount > 5) {
                console.log(`   ... and ${typeCount - 5} more`);
            }
            
            return objectTypes;

        } catch (error) {
            console.error(`❌ Failed to get object types: ${error.message}`);
            return {};
        }
    }

    /**
     * Validate multiple documents in batch
     * @param {Array<Object>} documents - Array of {type, data} objects
     * @returns {Promise<Array>} Array of validation results
     */
    async validateBatch(documents) {
        await this._ensureInitialized();

        console.log(`📦 Validating batch of ${documents.length} documents...`);
        
        const results = [];
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            console.log(`\n[${i + 1}/${documents.length}] Processing ${doc.type}: ${doc.data.name || 'Unnamed'}`);
            
            const result = await this.validateDocument(doc.type, doc.data);
            results.push({
                index: i,
                ...result
            });
            
            if (result.success) {
                successCount++;
            } else {
                failureCount++;
            }
        }

        console.log(`\n📊 Batch validation complete: ${successCount} succeeded, ${failureCount} failed`);
        
        return results;
    }

    /**
     * Get detailed schema information for a document type
     * @param {string} documentType - Document type (Item, Actor)
     * @param {string} subtype - Optional subtype (e.g., weapon, spell, character)
     * @returns {Promise<Object>} Detailed schema information
     */
    async getSchema(documentType, subtype = null) {
        await this._ensureInitialized();

        try {
            const schema = await this.serverManager.page.evaluate((docType, sub) => {
                // Helper to extract field definition
                const extractFieldDefinition = (field) => {
                    if (!field) return null;
                    
                    const def = {
                        type: field.constructor.name,
                        required: field.required || false,
                        nullable: field.nullable || false,
                        initial: field.initial
                    };
                    
                    // Extract specific field properties
                    if (field.choices) def.choices = field.choices;
                    if (field.min !== undefined) def.min = field.min;
                    if (field.max !== undefined) def.max = field.max;
                    if (field.positive) def.positive = true;
                    if (field.integer) def.integer = true;
                    
                    // Handle nested schemas
                    if (field.fields) {
                        def.fields = {};
                        for (const [key, subfield] of Object.entries(field.fields)) {
                            def.fields[key] = extractFieldDefinition(subfield);
                        }
                    }
                    
                    return def;
                };
                
                try {
                    const normalizedType = docType.charAt(0).toUpperCase() + docType.slice(1).toLowerCase();
                    
                    let DocumentClass;
                    if (normalizedType === 'Item') {
                        DocumentClass = window.CONFIG?.Item?.documentClass || window.Item;
                    } else if (normalizedType === 'Actor') {
                        DocumentClass = window.CONFIG?.Actor?.documentClass || window.Actor;
                    } else {
                        DocumentClass = window.CONFIG?.[normalizedType]?.documentClass;
                    }
                    
                    if (!DocumentClass) {
                        return {
                            success: false,
                            error: `Document class not found for ${docType}`
                        };
                    }
                    
                    // Get base schema
                    const schema = DocumentClass.schema;
                    const schemaFields = {};
                    
                    if (schema && schema.fields) {
                        for (const [key, field] of Object.entries(schema.fields)) {
                            schemaFields[key] = extractFieldDefinition(field);
                        }
                    }
                    
                    // Get system-specific schema if subtype provided
                    let systemSchema = null;
                    if (sub && window.CONFIG?.[normalizedType]?.dataModels?.[sub]) {
                        const DataModel = window.CONFIG[normalizedType].dataModels[sub];
                        if (DataModel.schema && DataModel.schema.fields) {
                            systemSchema = {};
                            for (const [key, field] of Object.entries(DataModel.schema.fields)) {
                                systemSchema[key] = extractFieldDefinition(field);
                            }
                        }
                    }
                    
                    // Get available types
                    const availableTypes = window.CONFIG?.[normalizedType]?.typeLabels || {};
                    
                    return {
                        success: true,
                        documentClass: DocumentClass.name,
                        documentType: normalizedType,
                        subtype: sub,
                        availableTypes: Object.keys(availableTypes),
                        requiredFields: ['name', 'type'],
                        fields: schemaFields,
                        systemFields: systemSchema,
                        metadata: {
                            hasSchema: !!schema,
                            systemId: window.game?.system?.id,
                            systemTitle: window.game?.system?.title
                        }
                    };
                    
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        stack: error.stack
                    };
                }
            }, documentType, subtype);

            if (schema.success) {
                console.log(`📋 Schema for ${documentType}${subtype ? ` (${subtype})` : ''}:`);
                console.log(`   Document class: ${schema.documentClass}`);
                console.log(`   Available types: ${schema.availableTypes.join(', ')}`);
                console.log(`   Field count: ${Object.keys(schema.fields).length}`);
                if (schema.systemFields) {
                    console.log(`   System field count: ${Object.keys(schema.systemFields).length}`);
                }
            } else {
                console.error(`❌ Failed to get schema: ${schema.error}`);
            }

            return schema;

        } catch (error) {
            console.error(`❌ Schema extraction error: ${error.message}`);
            throw new ValidationError(
                `Failed to extract schema: ${error.message}`,
                null,
                'SCHEMA_ERROR'
            );
        }
    }

    /**
     * Get validation schema for a specific document type (legacy method)
     * @param {string} documentType - Document type (Item, Actor)
     * @param {string} subtype - Subtype (e.g., weapon, spell, character)
     * @returns {Promise<Object>} Schema information
     * @deprecated Use getSchema() instead
     */
    async getValidationSchema(documentType, subtype = null) {
        console.warn('⚠️  getValidationSchema is deprecated. Use getSchema() instead.');
        return this.getSchema(documentType, subtype);
    }

    /**
     * Get available document types and their subtypes
     * @returns {Promise<Object>} Available document types
     */
    async getAvailableTypes() {
        await this._ensureInitialized();

        try {
            const types = await this.serverManager.page.evaluate(() => {
                const result = {
                    Item: {},
                    Actor: {},
                    Scene: {},
                    JournalEntry: {},
                    Macro: {},
                    RollTable: {},
                    Playlist: {}
                };

                // Get Item types
                if (window.CONFIG?.Item?.typeLabels) {
                    result.Item = { ...window.CONFIG.Item.typeLabels };
                }

                // Get Actor types
                if (window.CONFIG?.Actor?.typeLabels) {
                    result.Actor = { ...window.CONFIG.Actor.typeLabels };
                }

                // Get other document types if available
                const otherTypes = ['Scene', 'JournalEntry', 'Macro', 'RollTable', 'Playlist'];
                for (const type of otherTypes) {
                    if (window.CONFIG?.[type]?.typeLabels) {
                        result[type] = { ...window.CONFIG[type].typeLabels };
                    } else if (window.CONFIG?.[type]?.documentClass) {
                        // Document type exists but no subtypes
                        result[type] = { [type.toLowerCase()]: type };
                    }
                }

                // Add metadata
                return {
                    success: true,
                    systemId: window.game?.system?.id,
                    systemTitle: window.game?.system?.title,
                    types: result
                };
            });

            if (types.success) {
                console.log(`📋 Available document types for ${types.systemTitle}:`);
                for (const [docType, subtypes] of Object.entries(types.types)) {
                    const subtypeCount = Object.keys(subtypes).length;
                    if (subtypeCount > 0) {
                        console.log(`   ${docType}: ${subtypeCount} subtype(s)`);
                    }
                }
            }

            return types;

        } catch (error) {
            console.error(`❌ Failed to get available types: ${error.message}`);
            throw new ValidationError(
                `Failed to get available types: ${error.message}`,
                null,
                'TYPE_ERROR'
            );
        }
    }

    /**
     * Clear cached data
     */
    clearCache() {
        this._systemCache = null;
        this._objectTypeCache = null;
        console.log('🔄 Validator cache cleared');
    }

    /**
     * Check if validator is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Ensure validator is initialized
     * @private
     */
    async _ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    /**
     * Reset validator state
     */
    reset() {
        this.initialized = false;
        this.clearCache();
        console.log('🔄 Validator reset');
    }
}

export default FoundryPuppeteerValidator;