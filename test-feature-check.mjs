#!/usr/bin/env node

/**
 * Simple test to check what methods are available in FoundryManager
 */

import FoundryManager from './foundry-manager.mjs';

async function checkFeatures() {
    console.log('🔍 Checking available FoundryManager features...\n');
    
    const manager = new FoundryManager({ verbose: false });
    
    // Check what methods are available
    console.log('📋 FoundryManager methods:');
    const proto = Object.getPrototypeOf(manager);
    const methods = Object.getOwnPropertyNames(proto)
        .filter(name => typeof manager[name] === 'function' && !name.startsWith('_'))
        .sort();
    
    for (const method of methods) {
        const hasMethod = typeof manager[method] === 'function';
        console.log(`  ${hasMethod ? '✅' : '❌'} ${method}`);
    }
    
    console.log('\n🔍 Key features to verify:');
    const keyFeatures = [
        'listTypes',
        'getSchema', 
        'validateDocument',
        'listObjects',
        'searchObjects',
        'createObject',
        'updateObject',
        'deleteObject'
    ];
    
    for (const feature of keyFeatures) {
        const hasFeature = typeof manager[feature] === 'function';
        console.log(`  ${hasFeature ? '✅' : '❌'} ${feature}`);
    }
    
    console.log('\n📖 Usage patterns from CLI help:');
    // Check if manager has CLI-related methods
    const cliMethods = ['run', 'handleCommand', 'showHelp'];
    for (const method of cliMethods) {
        const hasMethod = typeof manager[method] === 'function';
        console.log(`  ${hasMethod ? '✅' : '❌'} ${method}`);
    }
}

checkFeatures().catch(console.error);