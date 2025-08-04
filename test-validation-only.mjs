#!/usr/bin/env node

/**
 * Focused test script for object validation functionality.
 * Tests only the validation part after successful authentication.
 */

import FoundryManager from './foundry-manager.mjs';
import { FoundryPuppeteerValidator } from './foundry-puppeteer-validator.mjs';
import WorldActivator from './world-activator.mjs';

async function testValidationOnly() {
    console.log('🧪 Testing object validation functionality...');
    
    const manager = new FoundryManager({ verbose: true });
    const activator = new WorldActivator({ verbose: true });
    let worldToActivate = null;

    try {
        // 1. Start the server
        console.log('🚀 Starting FoundryVTT server...');
        await manager.serverManager.startServer();
        console.log('✅ Server started\n');

        // 2. Use one of the worlds that actually exists in the UI
        worldToActivate = { id: "testania" };
        console.log(`   Using world '${worldToActivate.id}' which exists in FoundryVTT UI.\n`);
        
        // Activate using Puppeteer since it works
        console.log('🤖 Using Puppeteer world activation...');
        const activated = await activator.activate(worldToActivate.id);
        if (!activated) {
            throw new Error('World activation failed. Check screenshot.');
        }
        
        // Set server state to READY after successful Puppeteer activation
        const { ServerState } = await import('./foundry-server-manager.mjs');
        manager.serverManager.setState(ServerState.READY);
        manager.serverManager.activeWorld = worldToActivate.id;
        console.log('✅ World activation successful!\n');

        // 3. Initialize the browser and validator
        console.log('🌐 Initializing browser...');
        await manager.serverManager.initializeBrowser();
        console.log('✅ Browser initialized\n');

        console.log('🛡️ Initializing validator...');
        manager.validator = new FoundryPuppeteerValidator(manager.serverManager);
        await manager.validator.initialize();
        manager.initialized = true;
        console.log('✅ Validator initialized!\n');
        
        // 4. List available types
        console.log('📝 Listing available document types...');
        try {
            const types = await manager.listTypes();
            console.log('✅ Available types:', types);
        } catch (error) {
            console.log('⚠️  Failed to list types:', error.message);
        }

        // 5. Test object validation with available types
        console.log('\n📝 Testing object validation...');
        
        // Test with a Scene (which is available)
        const testScene = {
            name: "Test Scene",
            width: 1000,
            height: 1000,
            background: {
                src: null
            }
        };

        console.log('   Validating test scene...');
        try {
            // Correct parameter order: validateDocument(documentType, documentData)
            const validationResult = await manager.validator.validateDocument('Scene', testScene);
            console.log('✅ Scene validation result:', validationResult.valid ? 'VALID' : 'INVALID');
            if (!validationResult.valid && validationResult.errors) {
                console.log('   Errors:', validationResult.errors);
            }
        } catch (error) {
            console.log('⚠️  Scene validation failed:', error.message);
        }

        // Also try validating a Macro (simpler structure)
        console.log('\n   Validating test macro...');
        const testMacro = {
            name: "Test Macro",
            type: "script",
            command: "console.log('Hello World');"
        };

        try {
            const macroResult = await manager.validator.validateDocument('Macro', testMacro);
            console.log('✅ Macro validation result:', macroResult.valid ? 'VALID' : 'INVALID');
            if (!macroResult.valid && macroResult.errors) {
                console.log('   Errors:', macroResult.errors);
            }
        } catch (error) {
            console.log('⚠️  Macro validation failed:', error.message);
        }

        console.log('\n🎉 Validation test completed!');
        
    } catch (error) {
        console.error('\n❌ Validation test failed:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
    } finally {
        console.log('\n🧹 Cleaning up...');
        if (worldToActivate) {
            await activator.cleanup();
        }
        await manager.cleanup();
        console.log('✅ Cleanup complete.');
    }
}

// Run the test
testValidationOnly().catch(console.error);