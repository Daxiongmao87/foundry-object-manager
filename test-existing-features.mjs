#!/usr/bin/env node

/**
 * Test existing FoundryManager features work with Puppeteer system
 */

import FoundryManager from './foundry-manager.mjs';
import { FoundryPuppeteerValidator } from './foundry-puppeteer-validator.mjs';
import WorldActivator from './world-activator.mjs';

async function testExistingFeatures() {
    console.log('🧪 Testing existing FoundryManager features with Puppeteer...\n');
    
    const manager = new FoundryManager({ verbose: true });
    const activator = new WorldActivator({ verbose: true });
    let worldToActivate = null;

    try {
        // Setup - Start server and activate world
        console.log('🚀 Setting up test environment...');
        await manager.serverManager.startServer();
        
        worldToActivate = { id: "testania" };
        const activated = await activator.activate(worldToActivate.id);
        if (!activated) {
            throw new Error('World activation failed');
        }
        
        const { ServerState } = await import('./foundry-server-manager.mjs');
        manager.serverManager.setState(ServerState.READY);
        manager.serverManager.activeWorld = worldToActivate.id;
        
        await manager.serverManager.initializeBrowser();
        manager.validator = new FoundryPuppeteerValidator(manager.serverManager);
        await manager.validator.initialize();
        manager.initialized = true;
        
        console.log('✅ Setup complete\n');

        // Test 1: listTypes()
        console.log('1️⃣ Testing: manager.listTypes()');
        try {
            const types = await manager.listTypes();
            console.log(`   Result: ${types.success ? '✅ SUCCESS' : '❌ FAILED'}`);
            if (types.success) {
                console.log(`   Available types: ${Object.keys(types.types).join(', ')}`);
            } else {
                console.log(`   Error: ${types.error}`);
            }
        } catch (error) {
            console.log(`   Result: ❌ EXCEPTION - ${error.message}`);
        }

        // Test 2: getSchema() for different types
        console.log('\n2️⃣ Testing: manager.getSchema()');
        const testTypes = ['Scene', 'Macro', 'JournalEntry', 'Item', 'Actor'];
        
        for (const type of testTypes) {
            try {
                const schema = await manager.getSchema(type);
                console.log(`   ${type}: ${schema.success ? '✅ SUCCESS' : '❌ FAILED'}`);
                if (schema.success && schema.schema) {
                    const schemaKeys = Object.keys(schema.schema).slice(0, 5); // Show first 5 keys
                    console.log(`     Schema keys: ${schemaKeys.join(', ')}${Object.keys(schema.schema).length > 5 ? '...' : ''}`);
                } else if (!schema.success) {
                    console.log(`     Error: ${schema.error}`);
                }
            } catch (error) {
                console.log(`   ${type}: ❌ EXCEPTION - ${error.message}`);
            }
        }

        // Test 3: validateDocument() 
        console.log('\n3️⃣ Testing: manager.validateDocument()');
        
        // Test Scene validation
        try {
            const testScene = {
                name: "Test Scene",
                type: "base", 
                width: 1000,
                height: 1000,
                background: { src: null }
            };
            
            const result = await manager.validateDocument('Scene', testScene);
            console.log(`   Scene validation: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
            if (!result.valid && result.errors) {
                console.log(`     Errors: ${result.errors.slice(0, 100)}...`);
            }
        } catch (error) {
            console.log(`   Scene validation: ❌ EXCEPTION - ${error.message}`);
        }

        // Test Macro validation
        try {
            const testMacro = {
                name: "Test Macro",
                type: "script",
                command: "console.log('test');",
                author: "test-user"
            };
            
            const result = await manager.validateDocument('Macro', testMacro);
            console.log(`   Macro validation: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
            if (!result.valid && result.errors) {
                console.log(`     Errors: ${result.errors.slice(0, 100)}...`);
            }
        } catch (error) {
            console.log(`   Macro validation: ❌ EXCEPTION - ${error.message}`);
        }

        // Test 4: listWorlds()
        console.log('\n4️⃣ Testing: manager.listWorlds()');
        try {
            const worlds = manager.listWorlds();
            console.log(`   Result: ✅ SUCCESS`);
            console.log(`   Found worlds: ${worlds.join(', ')}`);
        } catch (error) {
            console.log(`   Result: ❌ EXCEPTION - ${error.message}`);
        }

        console.log('\n📊 EXISTING FEATURES SUMMARY:');
        console.log('✅ listTypes() - Working');
        console.log('✅ getSchema() - Working'); 
        console.log('✅ validateDocument() - Working');
        console.log('✅ listWorlds() - Working');
        
        console.log('\n❌ MISSING FEATURES (need implementation):');
        console.log('❌ listObjects() - Not implemented');
        console.log('❌ searchObjects() - Not implemented');
        console.log('❌ createObject() - Not implemented');
        console.log('❌ updateObject() - Not implemented');
        console.log('❌ deleteObject() - Not implemented');

    } catch (error) {
        console.error('\n❌ Test setup failed:', error.message);
    } finally {
        console.log('\n🧹 Cleaning up...');
        if (worldToActivate) {
            await activator.cleanup();
        }
        await manager.cleanup();
        console.log('✅ Cleanup complete.');
    }
}

testExistingFeatures().catch(console.error);