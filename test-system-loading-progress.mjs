#!/usr/bin/env node

import FoundryEnvironment from './foundry-environment.mjs';
import { join } from 'path';

const missingDeps = new Set();

async function testSystemLoading() {
    const foundryEnv = new FoundryEnvironment();
    await foundryEnv.initialize();
    
    const systemPath = join('foundry-data', 'systems', 'dnd5e', 'dnd5e.mjs');
    
    // Override console.error to capture missing dependencies
    const originalError = console.error;
    console.error = (...args) => {
        const msg = args.join(' ');
        const match = msg.match(/(\w+) is not defined/);
        if (match) {
            missingDeps.add(match[1]);
        }
        originalError.apply(console, args);
    };
    
    console.log('Testing D&D 5e system loading...\n');
    
    try {
        await import(`file://${process.cwd()}/${systemPath}`);
        console.log('✅ SUCCESS! System loaded!');
    } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        
        if (error.message.includes('is not defined')) {
            const match = error.message.match(/(\w+) is not defined/);
            if (match) {
                missingDeps.add(match[1]);
            }
        }
    }
    
    console.log('\nMissing dependencies found:');
    for (const dep of missingDeps) {
        console.log(`  - ${dep}`);
    }
    
    console.log('\nTo fix, add these to add-missing-globals.mjs');
}

testSystemLoading().catch(console.error);