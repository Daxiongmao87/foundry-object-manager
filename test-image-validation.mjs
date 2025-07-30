#!/usr/bin/env node

import FoundryValidator from './foundry-manager.mjs';

async function testImageValidation() {
    const validator = new FoundryValidator();
    await validator.foundryEnv.initialize();
    
    console.log('Testing image field validation...\n');
    
    const tests = [
        {
            name: "No img field",
            data: { name: "Test1", type: "npc" }
        },
        {
            name: "Empty img string", 
            data: { name: "Test2", type: "npc", img: "" }
        },
        {
            name: "Null img",
            data: { name: "Test3", type: "npc", img: null }
        },
        {
            name: "Valid img",
            data: { name: "Test4", type: "npc", img: "icons/svg/mystery-man.svg" }
        }
    ];
    
    for (const test of tests) {
        console.log(`\nTest: ${test.name}`);
        console.log(`Input: ${JSON.stringify(test.data)}`);
        
        try {
            const systemInfo = await validator.systemDiscovery.getSystemInfo('dnd5e');
            const documentData = await validator.createFoundryDocument(
                JSON.stringify(test.data),
                'Actor',
                {
                    systemId: 'dnd5e',
                    systemVersion: systemInfo.version,
                    userId: 'TESTUSER12345678'
                }
            );
            
            console.log('✓ Validation passed');
            console.log(`  img value: ${JSON.stringify(documentData.img)}`);
            
        } catch (error) {
            console.log('✗ Validation failed:', error.message);
        }
    }
}

testImageValidation().catch(console.error);