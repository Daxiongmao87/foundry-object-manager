#!/usr/bin/env node

import FoundryEnvironment from './foundry-environment.mjs';
import { join } from 'path';

async function debugSystemLoading() {
    const foundryEnv = new FoundryEnvironment();
    await foundryEnv.initialize();
    
    console.log('Attempting to load D&D 5e system...\n');
    
    const systemPath = join('foundry-data', 'systems', 'dnd5e', 'dnd5e.mjs');
    
    try {
        console.log('1. Direct import attempt...');
        const module = await import(`file://${process.cwd()}/${systemPath}`);
        console.log('✅ Import successful!');
        console.log('Module exports:', Object.keys(module));
    } catch (error) {
        console.log('❌ Import failed:', error.message);
        console.log('\n2. Analyzing error...');
        
        // The error message tells us what's missing
        if (error.message.includes('is not a constructor')) {
            console.log('   - Trying to extend a non-class object');
            console.log('   - Current error:', error.message);
        } else if (error.message.includes('is not defined')) {
            console.log('   - Missing global:', error.message);
        } else if (error.message.includes('Cannot read properties')) {
            console.log('   - Accessing property of undefined object');
            console.log('   - Details:', error.message);
        }
        
        console.log('\n3. Let me trace the exact failure point...');
        
        // Check what specific line is failing
        if (error.stack) {
            const stackLines = error.stack.split('\n');
            const systemLine = stackLines.find(line => line.includes('dnd5e.mjs'));
            if (systemLine) {
                const match = systemLine.match(/:(\d+):(\d+)/);
                if (match) {
                    console.log(`   - Error at line ${match[1]}, column ${match[2]}`);
                }
            }
        }
    }
}

debugSystemLoading().catch(console.error);