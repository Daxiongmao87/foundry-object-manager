#!/usr/bin/env node

/**
 * Test world discovery with longer delays
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FOUNDRY_PATH = path.join(__dirname, 'foundry-app/resources/app/main.mjs');
const DATA_PATH = path.join(process.env.HOME, '.local/share/FoundryVTT/Data');

async function testWorldDiscoveryWithDelay() {
    console.log('🧪 Testing World Discovery with Extended Delays\n');
    
    // First, verify the world actually exists
    console.log('Verifying world existence...');
    try {
        const worldJson = readFileSync(path.join(DATA_PATH, 'worlds/test-world/world.json'), 'utf8');
        const worldData = JSON.parse(worldJson);
        console.log('✅ World exists:', worldData.id, worldData.title);
    } catch (e) {
        console.error('❌ World does not exist at expected location');
        return;
    }
    
    // Start server
    console.log('\nStarting server...');
    const serverProcess = spawn('node', [
        FOUNDRY_PATH,
        '--dataPath=' + DATA_PATH,
        '--port=30027',
        '--headless'
    ], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverReady = false;
    let packagesScanned = false;
    
    serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[STDOUT]', output.trim());
        
        if (output.includes('Server started and listening')) {
            serverReady = true;
        }
        if (output.includes('Prepared data for') || output.includes('packages')) {
            packagesScanned = true;
        }
    });
    
    serverProcess.stderr.on('data', (data) => {
        console.error('[STDERR]', data.toString().trim());
    });
    
    // Wait for server to start
    while (!serverReady) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n✅ Server started');
    
    // Give it MUCH more time to scan packages
    console.log('Waiting 10 seconds for package scanning...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    try {
        // Check API status first
        console.log('\nChecking API status...');
        const statusResponse = await fetch('http://localhost:30027/api/status');
        const status = await statusResponse.json();
        console.log('API Status:', status);
        
        // Launch browser
        console.log('\nOpening browser...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Navigate to setup page
        console.log('Navigating to setup page...');
        await page.goto('http://localhost:30027/setup', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // Wait for page to fully load
        await page.waitForSelector('body', { timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get page content for debugging
        const pageTitle = await page.title();
        console.log(`Page title: ${pageTitle}`);
        
        // Check for worlds multiple times with delays
        for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(`\nAttempt ${attempt}: Checking for worlds...`);
            
            const worldInfo = await page.evaluate(() => {
                // Get all world elements
                const worldElements = document.querySelectorAll('[data-package-id]');
                const worlds = Array.from(worldElements).map(el => ({
                    id: el.getAttribute('data-package-id'),
                    title: el.querySelector('.package-title')?.textContent || 'Unknown'
                }));
                
                // Also check if there's a "no worlds" message
                const noWorldsMsg = document.querySelector('.notification.warning')?.textContent || 
                                   document.body.textContent.includes('No game worlds') ||
                                   document.body.textContent.includes('0 Worlds');
                
                return {
                    count: worldElements.length,
                    worlds: worlds,
                    noWorldsMessage: noWorldsMsg
                };
            });
            
            console.log(`Found ${worldInfo.count} worlds:`, worldInfo.worlds);
            if (worldInfo.noWorldsMessage) {
                console.log('No worlds message detected');
            }
            
            if (worldInfo.count > 0) {
                console.log('✅ Worlds discovered!');
                break;
            }
            
            if (attempt < 3) {
                // Try package reset
                console.log('Attempting package reset...');
                const resetResult = await page.evaluate(async () => {
                    try {
                        const response = await fetch('/setup', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'resetPackages' })
                        });
                        return {
                            ok: response.ok,
                            status: response.status,
                            text: await response.text()
                        };
                    } catch (error) {
                        return { error: error.message };
                    }
                });
                console.log('Reset result:', resetResult);
                
                // Wait and reload
                await new Promise(resolve => setTimeout(resolve, 3000));
                await page.reload({ waitUntil: 'networkidle0' });
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Check if we can access worlds via API
        console.log('\nChecking worlds via API...');
        const apiWorlds = await page.evaluate(async () => {
            try {
                const response = await fetch('/api/packages/world');
                if (response.ok) {
                    return await response.json();
                }
                return { error: `API returned ${response.status}` };
            } catch (error) {
                return { error: error.message };
            }
        });
        console.log('API worlds response:', apiWorlds);
        
        await browser.close();
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
    
    // Cleanup
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('\n✅ Test complete');
}

testWorldDiscoveryWithDelay().catch(console.error);