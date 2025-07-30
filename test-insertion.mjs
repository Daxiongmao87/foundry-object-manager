#!/usr/bin/env node

/**
 * Test script to demonstrate item creation and retrieval using FoundryVTT's native validation
 */

import FoundryValidator from './foundry-manager.mjs';

async function testInsertion() {
    console.log('=== FoundryVTT Object Manager - Insertion Test ===\n');
    
    const validator = new FoundryValidator();
    
    // Test data for different document types
    const testItems = [
        {
            name: "Flaming Longsword",
            type: "weapon", 
            img: "icons/weapons/sword-fire.png",
            system: {
                description: { value: "A sword wreathed in magical flames." },
                damage: { 
                    base: {
                        number: 1,
                        denomination: 8,
                        bonus: "",
                        types: ["slashing"],
                        custom: { enabled: false, formula: "" }
                    }
                },
                properties: ["mgc", "ver"],  // magic, versatile
                type: {
                    value: "martialM",
                    baseItem: "longsword"
                }
            }
        },
        {
            name: "Potion of Healing", 
            type: "consumable",
            img: "icons/potions/healing-red.png",
            system: {
                description: { value: "A magical red potion that heals wounds." },
                uses: { value: 1, max: 1, per: "charges" }
            }
        }
    ];
    
    const testActor = {
        name: "Eldric the Wizard",
        type: "character",
        img: "actors/wizard.png", 
        system: {
            attributes: { hp: { value: 22, max: 22 } },
            details: { biography: { value: "A wise and powerful spellcaster." } }
        }
    };
    
    try {
        // Initialize environment
        await validator.foundryEnv.initialize();
        
        console.log('1. Creating test items...\n');
        
        for (const item of testItems) {
            console.log(`Creating: ${item.name} (${item.type})`);
            
            // Use FoundryVTT's document creation for validation
            const systemInfo = await validator.systemDiscovery.getSystemInfo('dnd5e');
            
            try {
                const documentData = await validator.createFoundryDocument(
                    JSON.stringify(item), 
                    'Item', 
                    {
                        systemId: 'dnd5e',
                        systemVersion: systemInfo.version,
                        userId: 'CLI_USER'
                    }
                );
                
                // Insert into world
                const insertResult = await validator.worldManager.insertDocument(
                    'test-world',
                    'Item', 
                    documentData,
                    { systemId: 'dnd5e', systemVersion: systemInfo.version, userId: 'CLI_USER' }
                );
            
                if (insertResult.success) {
                    console.log(`✅ Inserted: ${item.name} (ID: ${insertResult.documentId})`);
                } else {
                    console.log(`❌ Failed to insert: ${item.name} - ${insertResult.error}`);
                }
            } catch (error) {
                console.log(`❌ Validation failed for ${item.name}: ${error.message}`);
            }
        }
        
        console.log('\n2. Creating test actor...\n');
        
        console.log(`Creating: ${testActor.name} (${testActor.type})`);
        
        // Use FoundryVTT's document creation for validation
        const systemInfo = await validator.systemDiscovery.getSystemInfo('dnd5e');
        
        try {
            const documentData = await validator.createFoundryDocument(
                JSON.stringify(testActor),
                'Actor',
                {
                    systemId: 'dnd5e',
                    systemVersion: systemInfo.version,
                    userId: 'CLI_USER'
                }
            );
            
            const insertResult = await validator.worldManager.insertDocument(
                'test-world',
                'Actor',
                documentData, 
                { systemId: 'dnd5e', systemVersion: systemInfo.version, userId: 'CLI_USER' }
            );
            
            if (insertResult.success) {
                console.log(`✅ Inserted: ${testActor.name} (ID: ${insertResult.documentId})`);
            } else {
                console.log(`❌ Failed to insert: ${testActor.name} - ${insertResult.error}`);
            }
        } catch (error) {
            console.log(`❌ Validation failed for ${testActor.name}: ${error.message}`);
        }
        
        console.log('\n3. Searching for created documents...\n');
        
        // Search for items
        console.log('Items in world:');
        const itemResults = await validator.worldManager.searchDocuments('test-world', 'Item', {});
        const itemOutput = validator.worldManager.formatDocumentList(itemResults, { showDetails: true });
        console.log(itemOutput);
        
        console.log('\nActors in world:');
        const actorResults = await validator.worldManager.searchDocuments('test-world', 'Actor', {});
        const actorOutput = validator.worldManager.formatDocumentList(actorResults, { showDetails: true });
        console.log(actorOutput);
        
        console.log('\n4. Testing search filters...\n');
        
        // Search by name pattern
        const flameResults = await validator.worldManager.searchDocuments('test-world', 'Item', { name: 'Flaming*' });
        console.log('Items matching "Flaming*":');
        console.log(validator.worldManager.formatDocumentList(flameResults, { showDetails: false }));
        
        console.log('\n✅ All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testInsertion().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});