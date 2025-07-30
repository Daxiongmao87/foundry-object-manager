#!/usr/bin/env node

/**
 * Test script for update functionality
 */

import FoundryValidator from './foundry-manager.mjs';

async function testUpdate() {
    const validator = new FoundryValidator();
    
    console.log('Testing Update Functionality\n');
    
    // Test 1: Test document retrieval with proper key format
    console.log('1. Testing document retrieval...');
    try {
        await validator.foundryEnv.initialize();
        
        // Create a test document ID
        const testId = 'TEST123456789012';
        const testWorld = 'test-world'; // This should be an actual world in your system
        
        console.log(`   Attempting to retrieve document ID: ${testId} from world: ${testWorld}`);
        
        const result = await validator.worldManager.getDocument(testWorld, 'Actor', testId);
        
        if (result.success) {
            console.log('   ✓ Document retrieved successfully');
            console.log(`   Document name: ${result.document.name}`);
        } else {
            console.log('   ✗ Document not found (expected if no test document exists)');
            console.log(`   Error: ${result.error}`);
        }
    } catch (error) {
        console.log(`   Error: ${error.message}`);
    }
    
    // Test 2: Test mergeDocumentData function
    console.log('\n2. Testing document merge functionality...');
    
    const existingDoc = {
        _id: 'TEST123',
        name: 'Test Actor',
        type: 'character',
        _stats: {
            createdTime: 1000,
            modifiedTime: 2000,
            coreVersion: '12.331',
            systemId: 'dnd5e'
        },
        system: {
            hp: { value: 10, max: 10 },
            attributes: { str: 15 }
        }
    };
    
    const updateData = {
        name: 'Updated Actor',
        _id: 'SHOULD_NOT_CHANGE', // This should be ignored
        system: {
            hp: { value: 5 }, // Should merge, keeping max
            attributes: { dex: 12 } // Should add dex, keep str
        }
    };
    
    const merged = validator.worldManager.mergeDocumentData(existingDoc, updateData);
    
    console.log('   Original:', JSON.stringify(existingDoc, null, 2));
    console.log('   Update data:', JSON.stringify(updateData, null, 2));
    console.log('   Merged result:', JSON.stringify(merged, null, 2));
    
    // Verify merge worked correctly
    const mergeSuccess = 
        merged._id === 'TEST123' && // ID should not change
        merged.name === 'Updated Actor' && // Name should update
        merged._stats.createdTime === 1000 && // Created time should not change
        merged.system.hp.value === 5 && // HP value should update
        merged.system.hp.max === 10 && // HP max should remain
        merged.system.attributes.str === 15 && // Str should remain
        merged.system.attributes.dex === 12; // Dex should be added
    
    console.log(`   ${mergeSuccess ? '✓' : '✗'} Merge ${mergeSuccess ? 'successful' : 'failed'}`);
    
    console.log('\n3. Testing update command validation...');
    console.log('   Run the following commands to test update functionality:');
    console.log('   - List worlds: ./foundry-manager.mjs -l --listWorlds');
    console.log('   - Search for actors: ./foundry-manager.mjs -s dnd5e -t actor -w <world> -r');
    console.log('   - Update by ID: ./foundry-manager.mjs -s dnd5e -t actor -w <world> -u --id <id> \'{"name":"Updated Name"}\'');
    console.log('   - Update by name: ./foundry-manager.mjs -s dnd5e -t actor -w <world> -u --name "Existing*" \'{"name":"Updated Name"}\'');
}

testUpdate().catch(console.error);