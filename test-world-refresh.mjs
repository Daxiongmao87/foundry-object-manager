#!/usr/bin/env node

/**
 * Test world activation with UI refresh mechanism
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FOUNDRY_PATH = path.join(__dirname, 'foundry-app/resources/app/main.mjs');
const DATA_PATH = path.join(process.env.HOME, '.local/share/FoundryVTT/Data');

async function testWorldWithRefresh() {
    console.log('🧪 Testing World Activation with UI Refresh\n');
    
    // Start server WITHOUT world parameter to see setup page
    console.log('Starting server...');
    const serverProcess = spawn('node', [
        FOUNDRY_PATH,
        '--dataPath=' + DATA_PATH,
        '--port=30026',
        '--headless'
    ], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverReady = false;
    
    serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[STDOUT]', output.trim());
        
        if (output.includes('Server started and listening')) {
            serverReady = true;
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
    
    // Give it time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
        // Launch browser and navigate to setup
        console.log('\nOpening browser...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('[Browser Error]', msg.text());
            }
        });
        
        // Navigate to setup page
        console.log('Navigating to setup page...');
        await page.goto('http://localhost:30026/setup', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // Wait for page to load
        await page.waitForSelector('body', { timeout: 10000 });
        
        // Check initial world count
        console.log('\nChecking initial world count...');
        let worldCount = await page.evaluate(() => {
            const worldElements = document.querySelectorAll('[data-package-id]');
            return worldElements.length;
        });
        console.log(`Initial world count: ${worldCount}`);
        
        // Look for and click refresh button
        console.log('\nLooking for refresh mechanism...');
        const refreshClicked = await page.evaluate(() => {
            // Try various selectors for refresh button
            const selectors = [
                'button[data-action="refresh"]',
                'button[data-action="resetPackages"]',
                'button.refresh',
                'a[data-action="refresh"]',
                '.control[data-action="refresh"]',
                'button[title*="Refresh"]',
                'button[title*="refresh"]',
                '*[data-tooltip*="Refresh"]'
            ];
            
            for (const selector of selectors) {
                const btn = document.querySelector(selector);
                if (btn) {
                    console.log(`Found refresh button: ${selector}`);
                    btn.click();
                    return true;
                }
            }
            
            // Also check for any refresh-related controls
            const allButtons = document.querySelectorAll('button, a.control');
            for (const btn of allButtons) {
                const text = btn.textContent.toLowerCase();
                const title = btn.getAttribute('title')?.toLowerCase() || '';
                if (text.includes('refresh') || title.includes('refresh')) {
                    console.log(`Found refresh button by text: ${text || title}`);
                    btn.click();
                    return true;
                }
            }
            
            return false;
        });
        
        if (refreshClicked) {
            console.log('✅ Clicked refresh button');
            
            // Wait for refresh to complete
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check world count again
            worldCount = await page.evaluate(() => {
                const worldElements = document.querySelectorAll('[data-package-id]');
                return worldElements.length;
            });
            console.log(`World count after refresh: ${worldCount}`);
        } else {
            console.log('❌ No refresh button found');
            
            // Try POST request to reset packages
            console.log('\nTrying API package reset...');
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
            
            // Reload page after reset
            await page.reload({ waitUntil: 'networkidle0' });
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check world count after reset
            worldCount = await page.evaluate(() => {
                const worldElements = document.querySelectorAll('[data-package-id]');
                return worldElements.length;
            });
            console.log(`World count after reset: ${worldCount}`);
        }
        
        // Get list of available worlds
        const worlds = await page.evaluate(() => {
            const worldElements = document.querySelectorAll('[data-package-id]');
            return Array.from(worldElements).map(el => ({
                id: el.getAttribute('data-package-id'),
                title: el.querySelector('.package-title')?.textContent || 'Unknown'
            }));
        });
        
        console.log('\nAvailable worlds:', worlds);
        
        if (worlds.length > 0) {
            console.log('\n✅ Worlds discovered! Attempting to launch test-world...');
            
            // Try to launch test-world
            const launchResult = await page.evaluate(async (worldId) => {
                // First try clicking the world's launch button
                const worldElement = document.querySelector(`[data-package-id="${worldId}"]`);
                if (worldElement) {
                    const launchBtn = worldElement.querySelector('button[data-action="launchWorld"], button.launch');
                    if (launchBtn) {
                        launchBtn.click();
                        return { method: 'click', success: true };
                    }
                }
                
                // Fallback to POST request
                try {
                    const response = await fetch('/setup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'launchWorld',
                            world: worldId
                        })
                    });
                    return {
                        method: 'post',
                        ok: response.ok,
                        status: response.status,
                        text: await response.text()
                    };
                } catch (error) {
                    return { method: 'post', error: error.message };
                }
            }, 'test-world');
            
            console.log('Launch result:', launchResult);
            
            // Wait for potential navigation
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check current URL
            const currentUrl = page.url();
            console.log(`Current URL: ${currentUrl}`);
            
            if (currentUrl.includes('/game') || currentUrl.includes('/join')) {
                console.log('✅ Successfully navigated to game!');
            }
        }
        
        await browser.close();
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
    
    // Cleanup
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('\n✅ Test complete');
}

testWorldWithRefresh().catch(console.error);