#!/usr/bin/env node

/**
 * Basic functionality test for the new Puppeteer-based FoundryManager
 */

import FoundryManager from './foundry-manager.mjs';
import { FoundryPuppeteerValidator, ValidationError } from './foundry-puppeteer-validator.mjs';
import WorldActivator from './world-activator.mjs';

async function testBasicFunctionality() {
    console.log('🧪 Testing basic FoundryManager functionality...\n');
    
    const manager = new FoundryManager({ verbose: true });
    const activator = new WorldActivator({ verbose: true });
    
    try {
        // Start the server first
        console.log('🚀 Starting FoundryVTT server...');
        await manager.serverManager.startServer();
        console.log('✅ Server started\n');

        // Use one of the worlds that actually exists in the UI
        const worldToActivate = { id: "testania" };
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

        // At this point, the world is active. We can proceed with tests.
        const serverStatus = await manager.serverManager.getServerStatus();
        
        // Test 1: List worlds
        console.log('1️⃣ Testing list worlds...');
        const worlds = manager.listWorlds();
        console.log(`   Found ${worlds.length} worlds: ${worlds.join(', ')}`);
        
        if (worlds.length === 0) {
            console.error('   ⚠️  No worlds available. Please create a world first.');
            return;
        }
        
        // Test 2: Initialize system
        console.log('\n2️⃣ Testing initialization...');
        // Since world is now active, we just need to initialize browser and validator
        await manager.serverManager.initializeBrowser();
        manager.validator = new FoundryPuppeteerValidator(manager.serverManager);
        await manager.validator.initialize();
        manager.initialized = true;
        manager.selectedWorld = serverStatus.world;
        manager.selectedSystem = serverStatus.system;
        console.log('   ✅ Initialization complete');
        
        // Test 3: List available types
        console.log('\n3️⃣ Testing list types...');
        const types = await manager.listTypes();
        console.log(`   System: ${types.systemId}`);
        
        let itemTypes = Object.keys(types.types.Item);
        let actorTypes = Object.keys(types.types.Actor);
        console.log(`   Item types: ${itemTypes.slice(0, 5).join(', ')}${itemTypes.length > 5 ? '...' : ''}`);
        console.log(`   Actor types: ${actorTypes.slice(0, 5).join(', ')}${actorTypes.length > 5 ? '...' : ''}`);
        
        // Test 4: Get schema
        console.log('\n4️⃣ Testing schema extraction...');
        if (itemTypes.length > 0) {
            const testType = itemTypes[0];
            console.log(`   Getting schema for: ${testType}`);
            const schema = await manager.getSchema(testType);
            console.log(`   Document class: ${schema.documentClass}`);
            console.log(`   Field count: ${Object.keys(schema.fields).length}`);
            console.log(`   Required fields: ${schema.requiredFields.join(', ')}`);
        }
        
        // Test 5: Validate valid document
        console.log('\n5️⃣ Testing valid document validation...');
        const validDoc = {
            name: "Test Item",
            type: itemTypes[0] || "weapon"
        };
        console.log(`   Validating: ${JSON.stringify(validDoc)}`);
        
        const validResult = await manager.validateDocument(validDoc.type, validDoc);
        console.log(`   ✅ Validation successful!`);
        console.log(`   Document ID: ${validResult.metadata.id}`);
        
        // Test 6: Test invalid document
        console.log('\n6️⃣ Testing invalid document validation...');
        const invalidDoc = {
            // Missing name
            type: "weapon"
        };
        
        try {
            await manager.validateDocument("weapon", invalidDoc);
            console.log('   ❌ Expected validation to fail!');
        } catch (error) {
            if (error instanceof ValidationError) {
                console.log(`   ✅ Validation correctly failed: ${error.message}`);
                console.log(`   Code: ${error.code}`);
                console.log(`   Field: ${error.field}`);
            } else {
                throw error;
            }
        }
        
        // Test 7: Test unknown type
        console.log('\n7️⃣ Testing unknown type...');
        try {
            await manager.validateDocument("unknown_type_xyz", { name: "Test" });
            console.log('   ❌ Expected validation to fail!');
        } catch (error) {
            if (error instanceof ValidationError) {
                console.log(`   ✅ Correctly rejected unknown type: ${error.message}`);
            } else {
                throw error;
            }
        }
        
        // Test 8: Generate random ID
        console.log('\n8️⃣ Testing ID generation...');
        const id1 = FoundryManager.generateRandomId();
        const id2 = FoundryManager.generateRandomId();
        console.log(`   ID 1: ${id1}`);
        console.log(`   ID 2: ${id2}`);
        console.log(`   IDs are unique: ${id1 !== id2}`);
        console.log(`   ID length correct: ${id1.length === 16}`);
        
        console.log('\n✅ All tests completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
    } finally {
        console.log('\n🧹 Cleaning up...');
        await activator.cleanup();
        await manager.cleanup();
    }
}

// Run tests
testBasicFunctionality().catch(console.error);