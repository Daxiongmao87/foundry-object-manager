#!/usr/bin/env node

/**
 * FoundryPuppeteerValidator - Document Validation using FoundryVTT
 * 
 * Works with FoundryServerManager to provide actual FoundryVTT validation
 * through Puppeteer browser automation.
 */

import { ServerState } from './foundry-server-manager.mjs';
import fs from 'fs/promises';

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
        this.validationTimeout = options.validationTimeout || 10000; // 10 seconds default
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

        // 3. Navigate to game page - but handle the fact that world launch might not be complete
        console.log('🎮 Navigating to game interface...');
        const serverUrl = this.serverManager.getServerUrl();
        
        try {
            await this.serverManager.page.goto(`${serverUrl}/game`, {
                waitUntil: 'domcontentloaded',
                timeout: 0  // Wait indefinitely
            });
        } catch (error) {
            if (error.message.includes('timeout')) {
                console.log('⚠️  Direct /game navigation timed out - world may still be launching');
                console.log('   Falling back to setup page and waiting for world completion...');
                
                // Navigate to setup page instead
                await this.serverManager.page.goto(`${serverUrl}/setup`, {
                    waitUntil: 'domcontentloaded',
                    timeout: 0
                });
                
                // Wait for world launch to complete (look for navigation to /game)
                console.log('   Waiting for world launch to complete...');
                try {
                    await this.serverManager.page.waitForFunction(
                        () => window.location.pathname === '/game' || window.location.href.includes('/game'),
                        { timeout: 120000 } // 2 minutes for world launch
                    );
                    console.log('✅ World launch completed, now on game page');
                } catch (waitError) {
                    console.log('⚠️  World launch did not complete within timeout');
                    // Try to proceed anyway in case we can still access validation APIs
                }
            } else {
                throw error; // Re-throw non-timeout errors
            }
        }

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

            // DEBUG: Log all buttons and form elements on the /join page to a file
            console.log('🔍 Debugging: Capturing DOM structure to join-page-debug.txt...');
            
            // Add a 3-second delay before capturing DOM structure
            await new Promise(resolve => setTimeout(resolve, 3000));

            const pageUrl = this.serverManager.page.url();
            const pageTitle = await this.serverManager.page.title();
            const pageReadyState = await this.serverManager.page.evaluate(() => document.readyState);
            const pageHtml = await this.serverManager.page.content();

            let debugOutput = `--- Page Info ---
`;
            debugOutput += `URL: ${pageUrl}
`;
            debugOutput += `Title: ${pageTitle}
`;
            debugOutput += `Ready State: ${pageReadyState}

`;

            debugOutput += await this.serverManager.page.evaluate(() => {
                let output = '';
                const append = (msg) => { output += msg + '\n'; };

                const buttons = Array.from(document.querySelectorAll('button'));
                append('--- Buttons ---');
                buttons.forEach((btn, index) => {
                    append(`Button ${index}:`);
                    append(`  OuterHTML: ${btn.outerHTML}`);
                    append(`  TextContent: ${btn.textContent.trim()}`);
                    append(`  Attributes: ${JSON.stringify(Array.from(btn.attributes).map(attr => ({ name: attr.name, value: attr.value })))}`);
                });

                const inputs = Array.from(document.querySelectorAll('input'));
                append('--- Inputs ---');
                inputs.forEach((input, index) => {
                    append(`Input ${index}:`);
                    append(`  OuterHTML: ${input.outerHTML}`);
                    append(`  Type: ${input.type}`);
                    append(`  Name: ${input.name}`);
                    append(`  Attributes: ${JSON.stringify(Array.from(input.attributes).map(attr => ({ name: attr.name, value: attr.value })))}`);
                });

                const forms = Array.from(document.querySelectorAll('form'));
                append('--- Forms ---');
                forms.forEach((form, index) => {
                    append(`Form ${index}:`);
                    append(`  OuterHTML: ${form.outerHTML}`);
                    append(`  Action: ${form.action}`);
                    append(`  Method: ${form.method}`);
                    append(`  Attributes: ${JSON.stringify(Array.from(form.attributes).map(attr => ({ name: attr.name, value: attr.value })))}`);
                });
                return output;
            });
            
            debugOutput += `
--- Full Page HTML ---
`;
            debugOutput += pageHtml;

            await fs.writeFile('/home/patrick/Projects/foundry-object-manager/join-page-debug.txt', debugOutput);
            console.log('✅ DOM structure and page info written to join-page-debug.txt');
            
            // If we're on a Critical Failure page, navigate to setup first
            
            // If we're on a Critical Failure page, navigate to setup first
            if (pageTitle.includes('Critical Failure')) {
                console.log('   Critical Failure detected, navigating to setup page...');
                await this.serverManager.page.goto(`${serverUrl}/setup`, {
                    waitUntil: 'networkidle0',
                    timeout: 0
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
                                timeout: 0 
                            });
                        }
                    } catch (error) {
                        console.log(`   World launch attempt failed: ${error.message}`);
                    }
                }
            }
            
            // Get credentials
            const adminPassword = await this.serverManager.credentialManager.getAdminPassword();
            const worldPassword = await this.serverManager.credentialManager.getWorldPassword();
            
            let authenticated = false;

            // Check for user selection dropdown and select a user if available
            const userSelect = await this.serverManager.page.$('select[name="userid"]');
            if (userSelect) {
                console.log('👤 User selection dropdown found. Attempting to select a user...');
                const options = await this.serverManager.page.$$('select[name="userid"] option');
                let selectedUser = false;
                
                // Get all option values and texts
                for (const option of options) {
                    const value = await option.evaluate(el => el.value);
                    const text = await option.evaluate(el => el.textContent.trim());
                    
                    if (value && value.length > 0) { // Select the first available user
                        await userSelect.select(value);
                        console.log(`   Selected user: ${text} (${value})`);
                        selectedUser = true;
                        break;
                    }
                }
                
                if (!selectedUser) {
                    console.log('   No valid user found to select in the dropdown.');
                }
            }

            // Try admin password first if available and field exists
            const adminPasswordField = await this.serverManager.page.$('input[name="adminPassword"]');
            if (adminPassword && adminPasswordField) {
                console.log('🔑 Using admin credentials for authentication...');
                await adminPasswordField.type(adminPassword);
                const joinButton = await this.serverManager.page.$('#join-game-setup button[type="submit"]');
                if (joinButton) {
                    console.log('   Submitting admin login...');
                    await joinButton.click();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const afterClickUrl = this.serverManager.page.url();
                    if (!afterClickUrl.includes('/join') && !afterClickUrl.includes('/auth')) {
                        console.log('✅ Admin authentication successful');
                        authenticated = true;
                    } else {
                        console.log('⚠️  Admin authentication may have failed, still on auth page');
                    }
                } else {
                    console.error('❌ Join button not found for admin login');
                }
            } 
            
            // If not authenticated by admin, try world password if available and field exists
            if (!authenticated) {
                const worldPasswordField = await this.serverManager.page.$('input[name="password"]');
                if (worldPassword && worldPasswordField) {
                    console.log('🔑 Using world credentials for authentication...');
                    await worldPasswordField.type(worldPassword);
                    const joinButton = await this.serverManager.page.$('#join-game-form button[name="join"]');
                    if (joinButton) {
                        console.log('   Submitting world login...');
                        await joinButton.click();
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        const afterClickUrl = this.serverManager.page.url();
                        if (afterClickUrl.includes('/game') || !afterClickUrl.includes('/join')) {
                            console.log('✅ World authentication successful');
                            authenticated = true;
                        } else {
                            console.log('⚠️  World authentication may have failed, still on join page');
                        }
                    } else {
                        console.error('❌ Join button not found for world login');
                    }
                }
            }

            // If still not authenticated, try to join without any password
            if (!authenticated) {
                console.log('⚠️  No credentials used or authentication failed, trying to join without password...');
                
                // Clear any password fields first
                const worldPasswordField = await this.serverManager.page.$('input[name="password"]');
                if (worldPasswordField) {
                    await worldPasswordField.click({ clickCount: 3 }); // Select all
                    await worldPasswordField.press('Backspace'); // Clear
                    console.log('   Cleared password field');
                }
                
                const joinButton = await this.serverManager.page.$('#join-game-form button[name="join"]');
                if (joinButton) {
                    // Click and wait for either navigation or URL change
                    await joinButton.click();
                    console.log('   Clicked join button, waiting for response...');
                    
                    // Wait a bit for any immediate response
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Check if URL changed or if we're still on join page
                    const afterClickUrl = this.serverManager.page.url();
                    if (afterClickUrl.includes('/game') || !afterClickUrl.includes('/join')) {
                        console.log('✅ Join successful, navigated away from join page');
                        authenticated = true;
                    } else {
                        console.log('⚠️  Still on join page after clicking');
                        
                        // Check for any error messages
                        const errorMessages = await this.serverManager.page.evaluate(() => {
                            const notifications = document.querySelectorAll('.notification.error, .error-message, [class*="error"]');
                            return Array.from(notifications).map(el => el.textContent.trim()).filter(text => text.length > 0);
                        });
                        
                        if (errorMessages.length > 0) {
                            console.log('❌ Join errors:', errorMessages);
                        }
                        
                        // Try waiting for navigation in case it's delayed
                        try {
                            await this.serverManager.page.waitForNavigation({ 
                                waitUntil: 'domcontentloaded', 
                                timeout: 5000 
                            });
                            console.log('✅ Navigation completed after delay');
                            authenticated = true;
                        } catch (navError) {
                            console.log('⚠️  No navigation occurred within 5 seconds');
                        }
                    }
                } else {
                    console.log('❌ No join button found for unauthenticated access.');
                }
            }
            
            // Check if we're now on the game page
            const newUrl = this.serverManager.page.url();
            console.log(`📍 Post-auth URL: ${newUrl}`);
            
            // Re-check for authentication error after attempts
            const newPageTitle = await this.serverManager.page.title();
            const stillHasAuthError = newPageTitle.includes('Critical Failure') || 
                                       newUrl.includes('/join') || 
                                       newUrl.includes('/auth');

            if (stillHasAuthError) {
                console.error('❌ Authentication failed after all attempts. Still on join/auth page.');
                throw new Error('Authentication failed: Could not access game context after login attempts.');
            } else {
                console.log('✅ Authentication appears successful, proceeding to game context check.');
            }
        }

        // 5. Wait for either game context or valid setup context
        console.log('⌛ Waiting for game context...');
        try {
            await this.serverManager.page.waitForFunction(
                () => {
                    console.log('Context check - Game:', !!window.game, window.game?.ready, 'Collections:', !!window.game?.collections, 'Foundry:', !!window.foundry, 'Config:', !!window.CONFIG);
                    // Accept either a ready game context with collections OR a valid setup context
                    return (window.game && window.game.ready === true && window.game.collections) || 
                           (window.foundry && window.CONFIG && document.title.includes('Foundry Virtual Tabletop'));
                },
                { timeout: 0 }
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
        
        // Give the game a moment to fully initialize collections
        console.log('⏳ Waiting for game collections to initialize...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verify collections are now available
        const collectionsCheck = await this.serverManager.page.evaluate(() => {
            return {
                hasCollections: !!window.game?.collections,
                collectionNames: window.game?.collections ? Array.from(window.game.collections.keys()) : []
            };
        });
        
        console.log('📦 Collections check:', collectionsCheck);
        
        if (!collectionsCheck.hasCollections) {
            throw new Error('Game collections failed to initialize');
        }
        
        this.initialized = true;
    }

    /**
     * Get available images from various sources using FoundryVTT's FilePicker API
     * @returns {Promise<Object>} Available images organized by source
     */
    async getAvailableImages() {
        await this._ensureInitialized();

        return await this.serverManager.page.evaluate(async () => {
            const images = {
                core: [],
                system: [],
                user: [],
                metadata: {
                    systemId: window.game?.system?.id,
                    systemTitle: window.game?.system?.title
                }
            };

            // Helper to browse a directory for images (non-recursive for performance)
            const browseDirectoryImages = async (source, path = "") => {
                try {
                    const response = await FilePicker.browse(source, path);
                    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
                    const foundImages = [];
                    
                    // Add image files from current directory
                    if (response.files) {
                        for (const file of response.files) {
                            const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
                            if (imageExtensions.includes(ext)) {
                                // Convert to FoundryVTT-style path
                                let relativePath = file;
                                if (source === 'data') {
                                    relativePath = file.replace(/^.*\/Data\//, '');
                                } else if (source === 'public') {
                                    relativePath = file.replace(/^.*\/public\//, '');
                                }
                                foundImages.push(relativePath);
                            }
                        }
                    }
                    
                    return { images: foundImages, dirs: response.dirs || [] };
                } catch (error) {
                    console.log(`Could not browse ${source}:${path} - ${error.message}`);
                    return { images: [], dirs: [] };
                }
            };

            // Browse core FoundryVTT icons - check key directories
            const coreDirectories = [
                'icons/svg',
                'icons/commodities',
                'icons/weapons', 
                'icons/equipment',
                'icons/creatures',
                'icons/environment',
                'icons/magic',
                'icons/consumables',
                'icons/containers',
                'icons/tools',
                'icons/sundries',
                'icons/skills'
            ];

            for (const dir of coreDirectories) {
                try {
                    const result = await browseDirectoryImages('public', dir);
                    images.core.push(...result.images);
                    
                    // Browse one level of subdirectories for each main category
                    for (const subdir of result.dirs.slice(0, 10)) { // Limit to prevent timeouts
                        const subResult = await browseDirectoryImages('public', subdir);
                        images.core.push(...subResult.images);
                    }
                } catch (error) {
                    console.log(`Could not browse core directory ${dir}:`, error.message);
                }
            }

            // Browse system-specific icons
            if (window.game?.system?.id) {
                const systemId = window.game.system.id;
                const systemDirectories = [
                    `systems/${systemId}/icons`,
                    `systems/${systemId}/assets`,
                    `systems/${systemId}/ui`,
                    `systems/${systemId}`
                ];

                for (const dir of systemDirectories) {
                    try {
                        const result = await browseDirectoryImages('data', dir);
                        images.system.push(...result.images);
                        
                        // Browse one level of subdirectories
                        for (const subdir of result.dirs.slice(0, 5)) { // Limit for performance
                            const subResult = await browseDirectoryImages('data', subdir);
                            images.system.push(...subResult.images);
                        }
                    } catch (error) {
                        console.log(`Could not browse system directory ${dir}:`, error.message);
                    }
                }
            }

            // Browse user data icons
            const userDirectories = ['icons', 'assets/images', 'ui/icons'];
            for (const dir of userDirectories) {
                try {
                    const result = await browseDirectoryImages('data', dir);
                    images.user.push(...result.images);
                } catch (error) {
                    console.log(`Could not browse user directory ${dir}:`, error.message);
                }
            }

            // Remove duplicates
            images.core = [...new Set(images.core)];
            images.system = [...new Set(images.system)];
            images.user = [...new Set(images.user)];

            return images;
        });
    }

    /**
     * Validate that an image path exists and is accessible
     * @param {string} imagePath - Image path to validate
     * @returns {Promise<boolean>} True if image exists
     */
    async validateImageExists(imagePath) {
        if (!imagePath) return false;

        await this._ensureInitialized();

        return await this.serverManager.page.evaluate(async (path) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = path;
                // Timeout after 3 seconds
                setTimeout(() => resolve(false), 3000);
            });
        }, imagePath);
    }

    /**
     * Validate image requirements for document creation
     * @param {Object} documentData - Document data to validate
     * @param {Object} options - Validation options
     * @param {boolean} options.noImage - Skip image validation
     * @returns {Promise<Object>} Validation result
     */
    async validateImageRequirements(documentData, options = {}) {
        // Skip image validation if explicitly disabled
        if (options.noImage) {
            return { success: true, message: 'Image validation skipped' };
        }

        const defaultImages = [
            'icons/svg/mystery-man.svg',
            'icons/svg/item-bag.svg',
            'icons/svg/mystery-man-black.svg'
        ];

        // Check if image is missing or is a default placeholder
        if (!documentData.img || defaultImages.includes(documentData.img)) {
            const availableImages = await this.getAvailableImages();
            const totalImages = availableImages.core.length + availableImages.system.length + availableImages.user.length;
            
            throw new ValidationError(
                `Image is required for document creation. Found ${totalImages} available images. Use --list-images to see available images.`,
                'img',
                'MISSING_IMAGE'
            );
        }

        // Validate that the specified image actually exists
        const imageExists = await this.validateImageExists(documentData.img);
        if (!imageExists) {
            throw new ValidationError(
                `Image not found: ${documentData.img}. Use --list-images to see available images.`,
                'img',
                'IMAGE_NOT_FOUND'
            );
        }

        return { 
            success: true, 
            message: 'Image validation passed',
            imagePath: documentData.img 
        };
    }

    /**
     * Validate a document using FoundryVTT's validation system
     * @param {string} documentType - Type of document (Item, Actor, etc.)
     * @param {Object} documentData - Document data to validate
     * @param {Object} options - Validation options
     * @param {boolean} options.noImage - Skip image validation
     * @returns {Promise<Object>} Validation result with success status and validated data
     */
    async validateDocument(documentType, documentData, options = {}) {
        await this._ensureInitialized();

        console.log(`🔍 Validating ${documentType}: ${documentData.name || 'Unnamed'}`);

        // Perform image validation first (for creation only, not updates)
        if (!options.skipImageValidation) {
            await this.validateImageRequirements(documentData, options);
        }

        try {
            // Map the document type before evaluation to ensure proper class lookup
            const availableTypes = await this.getAvailableTypes();
            
            let mappedDocumentType = documentType;
            let originalType = documentType;
            
            // If it's a subtype, map to the parent document type
            for (const [docType, subtypes] of Object.entries(availableTypes.types)) {
                if (subtypes[documentType]) {
                    mappedDocumentType = docType;
                    break;
                }
            }
            
            console.log(`🔗 Type mapping: ${originalType} → ${mappedDocumentType}`);
            
            const result = await this.serverManager.page.evaluate(async (docType, docData, timeout, subType) => {
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
                        
                        // If we have a subtype, ensure the type field is set correctly
                        if (subType && subType !== docType) {
                            docData.type = subType;
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
                        
                        // The document creation itself validates the data
                        // If we get here without an error, the validation passed
                        
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
                
            }, mappedDocumentType, documentData, this.validationTimeout, originalType);

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