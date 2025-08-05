#!/usr/bin/env node

/**
 * Test world launch with fixed compatibility
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FOUNDRY_PATH = path.join(__dirname, 'foundry-app/resources/app/main.mjs');
const DATA_PATH = path.join(process.env.HOME, '.local/share/FoundryVTT/Data');

async function testWorldLaunchFixed() {
    console.log('🧪 Testing World Launch with Fixed Compatibility\n');
    
    // Start server with world parameter
    console.log('Starting server with --world=test-world...');
    const serverProcess = spawn('node', [
        FOUNDRY_PATH,
        '--dataPath=' + DATA_PATH,
        '--world=test-world',
        '--port=30025',
        '--headless'
    ], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverReady = false;
    let worldLoaded = false;
    
    serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[STDOUT]', output.trim());
        
        if (output.includes('Server started and listening')) {
            serverReady = true;
        }
        if (output.includes('World game ready') || output.includes('Launching World | Complete')) {
            worldLoaded = true;
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
    
    // Give it time to load the world
    console.log('Waiting for world to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check API status
    try {
        const response = await fetch('http://localhost:30025/api/status');
        const status = await response.json();
        console.log('\nAPI Status:', status);
        
        if (status.active) {
            console.log('✅ World is active!');
            
            // Now test with Puppeteer
            console.log('\nTesting with Puppeteer...');
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            const page = await browser.newPage();
            
            // Navigate to game
            await page.goto('http://localhost:30025/game', {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Check game state
            const gameState = await page.evaluate(() => {
                return {
                    hasGame: !!window.game,
                    gameReady: window.game?.ready || false,
                    worldId: window.game?.world?.id,
                    systemId: window.game?.system?.id,
                    currentUrl: window.location.href
                };
            });
            
            console.log('\nGame State:', gameState);
            
            // Test validation if game is ready
            if (gameState.gameReady) {
                console.log('\n✅ Game is ready! Testing validation...');
                
                const validationResult = await page.evaluate(() => {
                    try {
                        const weaponData = {
                            name: "Test Longsword",
                            type: "weapon"
                        };
                        
                        const doc = new CONFIG.Item.documentClass(weaponData);
                        return {
                            success: true,
                            name: doc.name,
                            type: doc.type
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: error.message
                        };
                    }
                });
                
                console.log('Validation Result:', validationResult);
            }
            
            await browser.close();
        } else {
            console.log('❌ World is not active');
        }
    } catch (error) {
        console.error('API check failed:', error.message);
    }
    
    // Cleanup
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('\n✅ Test complete');
}

testWorldLaunchFixed().catch(console.error);