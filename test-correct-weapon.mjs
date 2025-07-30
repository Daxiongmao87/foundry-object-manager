#!/usr/bin/env node

/**
 * Test correct weapon format based on actual FoundryVTT data structure
 */

import FoundryValidator from './foundry-manager.mjs';

async function testCorrectWeapon() {
    const validator = new FoundryValidator();
    
    // Based on the actual weapon structure from the database
    const correctWeapon = {
        name: "Test Longsword",
        type: "weapon",
        img: "icons/weapons/swords/sword-guard.webp",
        system: {
            description: {
                value: "A standard longsword for testing."
            },
            quantity: 1,
            weight: {
                value: 3,
                units: "lb"
            },
            price: {
                value: 15,
                denomination: "gp"
            },
            damage: {
                base: {
                    number: 1,
                    denomination: 8,  // This MUST be a number!
                    bonus: "",
                    types: ["slashing"],
                    custom: {
                        enabled: false,
                        formula: ""
                    }
                },
                versatile: {
                    number: 1,
                    denomination: 10,
                    bonus: "",
                    types: [],
                    custom: {
                        enabled: false,
                        formula: ""
                    }
                }
            },
            range: {
                value: null,
                long: null,
                units: "ft"
            },
            properties: ["ver"],  // versatile
            type: {
                value: "martialM",
                baseItem: "longsword"
            }
        }
    };
    
    console.log('Testing correct weapon format...');
    console.log('JSON input:', JSON.stringify(correctWeapon, null, 2));
    
    try {
        await validator.foundryEnv.initialize();
        
        const systemInfo = await validator.systemDiscovery.getSystemInfo('dnd5e');
        
        const documentData = await validator.createFoundryDocument(
            JSON.stringify(correctWeapon),
            'Item',
            {
                systemId: 'dnd5e',
                systemVersion: systemInfo.version,
                userId: 'TESTUSER16CHARS0'  // Must be exactly 16 alphanumeric chars
            }
        );
        
        console.log('\n✅ Validation successful!');
        console.log('Document ID:', documentData._id);
        console.log('Damage structure:', JSON.stringify(documentData.system.damage, null, 2));
        
    } catch (error) {
        console.error('\n❌ Validation failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testCorrectWeapon().catch(console.error);