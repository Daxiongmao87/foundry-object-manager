#!/usr/bin/env node

/**
 * Focused test script for FoundryManager authentication.
 * This script starts the server, activates a world, initializes the browser and validator, then exits.
 */

import FoundryManager from './foundry-manager.mjs';
import { FoundryPuppeteerValidator } from './foundry-puppeteer-validator.mjs';
import WorldActivator from './world-activator.mjs';

async function testAuthOnly() {
    console.log('🧪 Testing FoundryManager authentication only...');
    
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

        // 3. Initialize the browser and validator (where authentication happens)
        console.log('🌐 Initializing browser...');
        await manager.serverManager.initializeBrowser();
        console.log('✅ Browser initialized\n');

        console.log('🛡️ Initializing validator (authentication happens here)...');
        manager.validator = new FoundryPuppeteerValidator(manager.serverManager);
        await manager.validator.initialize();
        manager.initialized = true;
        console.log('✅ Validator initialized and authentication likely successful!\n');
        
        console.log('🎉 Authentication test completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Authentication test failed:', error.message);
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
testAuthOnly().catch(console.error);
