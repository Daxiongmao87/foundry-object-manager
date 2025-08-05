#!/usr/bin/env node

/**
 * Test world discovery with permissions check
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { statSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FOUNDRY_PATH = path.join(__dirname, 'foundry-app/resources/app/main.mjs');
const DATA_PATH = path.join(process.env.HOME, '.local/share/FoundryVTT/Data');

async function testPermissionsAndDiscovery() {
    console.log('🧪 Testing World Discovery with Permissions Check\n');
    
    // Check permissions on data directory
    console.log('Checking permissions...');
    try {
        const dataStats = statSync(DATA_PATH);
        console.log(`Data directory permissions: ${(dataStats.mode & parseInt('777', 8)).toString(8)}`);
        
        const worldsPath = path.join(DATA_PATH, 'worlds');
        const worldsStats = statSync(worldsPath);
        console.log(`Worlds directory permissions: ${(worldsStats.mode & parseInt('777', 8)).toString(8)}`);
        
        const worlds = readdirSync(worldsPath);
        console.log(`Worlds found in filesystem: ${worlds.join(', ')}`);
        
        for (const world of worlds) {
            const worldPath = path.join(worldsPath, world);
            const worldStats = statSync(worldPath);
            console.log(`  ${world} permissions: ${(worldStats.mode & parseInt('777', 8)).toString(8)}`);
        }
    } catch (e) {
        console.error('Permission check failed:', e.message);
    }
    
    // Try starting with different user/permissions
    console.log('\nStarting server with explicit environment...');
    const serverProcess = spawn('node', [
        FOUNDRY_PATH,
        '--dataPath=' + DATA_PATH,
        '--port=30028',
        '--headless',
        '--noupdate',  // Disable update checks
        '--world=test-world'  // Try specifying world directly again
    ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
            ...process.env,
            NODE_ENV: 'production',
            FOUNDRY_VTT_DATA_PATH: DATA_PATH
        }
    });
    
    let serverReady = false;
    let worldMessages = [];
    
    serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[STDOUT]', output.trim());
        
        if (output.includes('Server started and listening')) {
            serverReady = true;
        }
        if (output.includes('world') || output.includes('World') || output.includes('package')) {
            worldMessages.push(output.trim());
        }
    });
    
    serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.error('[STDERR]', output.trim());
        if (output.includes('world') || output.includes('World')) {
            worldMessages.push('[ERROR] ' + output.trim());
        }
    });
    
    // Wait for server to start
    let timeout = 0;
    while (!serverReady && timeout < 30000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        timeout += 100;
    }
    
    if (!serverReady) {
        console.error('❌ Server failed to start within 30 seconds');
        serverProcess.kill();
        return;
    }
    
    console.log('\n✅ Server started');
    
    // Give it time to process world
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\nWorld-related messages:');
    worldMessages.forEach(msg => console.log('  ', msg));
    
    // Check if server is running on the expected port
    try {
        console.log('\nChecking server accessibility...');
        const curlResult = execSync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:30028/`).toString();
        console.log(`Server HTTP response code: ${curlResult}`);
        
        // Check API status
        const apiResult = execSync(`curl -s http://localhost:30028/api/status`).toString();
        console.log(`API Status: ${apiResult}`);
    } catch (e) {
        console.error('Server check failed:', e.message);
    }
    
    // Cleanup
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('\n✅ Test complete');
}

testPermissionsAndDiscovery().catch(console.error);