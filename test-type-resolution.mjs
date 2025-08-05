#!/usr/bin/env node

/**
 * Test script to verify type resolution fixes
 * Tests the disconnect between listTypes() and getSchema()/validateDocument()
 */

import { FoundryManager } from './foundry-manager.mjs';

async function testTypeResolution() {
    console.log('🧪 Testing Type Resolution Fixes...\n');
    
    const manager = new FoundryManager({ verbose: true });
    
    try {
        console.log('1️⃣ Testing server startup and initialization...');
        await manager.initialize();
        console.log('✅ Initialization successful\n');
        
        console.log('2️⃣ Testing listTypes()...');
        const types = await manager.listTypes();
        console.log(`✅ Found ${Object.keys(types.types).length} document types\n`);
        
        // Get first few types to test
        const testTypes = [];
        for (const [docType, subtypes] of Object.entries(types.types)) {
            const subtypeKeys = Object.keys(subtypes);
            if (subtypeKeys.length > 0) {
                testTypes.push(subtypeKeys[0]); // Take first subtype
                if (testTypes.length >= 3) break; // Test first 3 types
            }
        }
        
        console.log(`📋 Testing these types: ${testTypes.join(', ')}\n`);
        
        // Test each type
        for (const type of testTypes) {
            console.log(`3️⃣ Testing getSchema('${type}')...`);
            try {
                const schema = await manager.getSchema(type);
                if (schema.success) {
                    console.log(`✅ getSchema('${type}') - SUCCESS`);
                    console.log(`   Document class: ${schema.documentClass}`);
                    console.log(`   Available types: ${schema.availableTypes?.join(', ') || 'none'}`);
                } else {
                    console.log(`❌ getSchema('${type}') - FAILED: ${schema.error}`);
                }
            } catch (error) {
                console.log(`❌ getSchema('${type}') - ERROR: ${error.message}`);
            }
            
            console.log(`4️⃣ Testing validateDocument('${type}')...`);
            try {
                const testData = {
                    name: `Test ${type}`,
                    type: type
                };
                
                const result = await manager.validateDocument(type, testData);
                if (result.success) {
                    console.log(`✅ validateDocument('${type}') - SUCCESS`);
                    console.log(`   Document class: ${result.documentClass}`);
                    console.log(`   Type: ${result.type}`);
                } else {
                    console.log(`❌ validateDocument('${type}') - FAILED: ${result.error}`);
                }
            } catch (error) {
                console.log(`❌ validateDocument('${type}') - ERROR: ${error.message}`);
            }
            
            console.log(''); // Empty line for readability
        }
        
        console.log('🎉 Type resolution testing completed!');
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        if (error.stack) {
            console.error(`Stack: ${error.stack}`);
        }
    } finally {
        await manager.cleanup();
    }
}

// Run the test
testTypeResolution().catch(error => {
    console.error('Unexpected test error:', error);
    process.exit(1);
});