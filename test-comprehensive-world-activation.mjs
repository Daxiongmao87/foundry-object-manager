#!/usr/bin/env node

/**
 * Comprehensive test for world activation
 * Tries multiple approaches to get a world activated
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import WorldActivator from './world-activator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FOUNDRY_PATH = path.join(__dirname, 'foundry-app/resources/app/main.mjs');
const DATA_PATH = path.join(process.env.HOME, '.local/share/FoundryVTT/Data');

async function comprehensiveWorldTest() {
    console.log('🧪 Comprehensive World Activation Test\n');
    
    
    
    // Approach 2: Try starting without world parameter first
    console.log('\n📋 Approach 2: Starting server without world parameter...');
    let serverProcess = spawn('node', [
        FOUNDRY_PATH,
        `--dataPath=${DATA_PATH}`,
        '--port=30029',
        '--headless'
    ], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverReady = false;
    
    serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server started and listening')) {
            serverReady = true;
        }
        console.log('[STDOUT]', output.trim());
    });
    
    serverProcess.stderr.on('data', (data) => {
        console.error('[STDERR]', data.toString().trim());
    });
    
    // Wait for server
    let timeout = 0;
    while (!serverReady && timeout < 20000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        timeout += 100;
    }
    
    if (!serverReady) {
        console.error('❌ Server failed to start');
        serverProcess.kill();
        return;
    }
    
    console.log('✅ Server started');
    
    // Wait a bit for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
        // Import WorldActivator
        const { default: WorldActivator } = await import('./world-activator.mjs');
        const worldActivator = new WorldActivator({ serverUrl: 'http://localhost:30029', verbose: true });
        
        console.log('\nAttempting to activate "testania" world...');
        const activated = await worldActivator.activate('testania');
        
        if (activated) {
            console.log('✅ World "testania" activated successfully.');
        } else {
            console.error('❌ Failed to activate world "testania".');
        }
        
        await worldActivator.cleanup();
        
    } catch (error) {
        console.error('Browser test failed:', error.message);
    }
    
    // Cleanup
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n✅ Test complete');
}

comprehensiveWorldTest().catch(console.error);