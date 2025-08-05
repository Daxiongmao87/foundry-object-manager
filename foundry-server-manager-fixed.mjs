#!/usr/bin/env node

import { FoundryServerManager, ServerState } from './foundry-server-manager.mjs';

/**
 * Fixed FoundryServerManager that uses a different activation approach
 */
export class FoundryServerManagerFixed extends FoundryServerManager {
    constructor(options = {}) {
        super(options);
    }

    /**
     * Override activateWorld to use a more reliable method
     */
    async activateWorld(worldId) {
        if (this.state !== ServerState.RUNNING) {
            throw new Error('Server must be running to activate a world');
        }

        if (!await this.ensureWorldExists(worldId)) {
            throw new Error(`World '${worldId}' does not exist`);
        }

        this.setState(ServerState.ACTIVATING);
        console.log(`🌍 Activating world: ${worldId}`);

        try {
            // Make sure browser is initialized
            if (!this.browser || !this.page) {
                await this.initializeBrowser();
            }

            // First, navigate to root to ensure clean state
            console.log('📋 Navigating to root page...');
            await this.page.goto(`http://${this.hostname}:${this.port}/`, {
                waitUntil: 'networkidle0',
                timeout: this.navigationTimeout
            });

            // Check current page
            let currentUrl = this.page.url();
            console.log(`   Current URL: ${currentUrl}`);

            // If we're at the setup page, we can try to activate from there
            if (currentUrl.includes('/setup') || currentUrl === `http://${this.hostname}:${this.port}/`) {
                console.log('📋 At setup page, attempting world activation...');
                
                // Navigate to setup if not already there
                if (!currentUrl.includes('/setup')) {
                    await this.page.goto(`http://${this.hostname}:${this.port}/setup`, {
                        waitUntil: 'networkidle0',
                        timeout: this.navigationTimeout
                    });
                }

                // Wait for page to be ready
                await this.page.waitForSelector('body', { timeout: 10000 });

                // Try clicking on the world directly in the UI
                console.log(`🖱️  Looking for world "${worldId}" in UI...`);
                
                const worldClicked = await this.page.evaluate((targetWorldId) => {
                    // Look for world elements
                    const worldElements = document.querySelectorAll('[data-package-id]');
                    for (const element of worldElements) {
                        if (element.getAttribute('data-package-id') === targetWorldId) {
                            // Try to find and click the launch button
                            const launchBtn = element.querySelector('button[data-action="launchWorld"], button.launch, .control[data-action="play"]');
                            if (launchBtn) {
                                launchBtn.click();
                                return true;
                            }
                        }
                    }
                    
                    // Alternative: Look for world in a select dropdown
                    const worldSelect = document.querySelector('select[name="world"]');
                    if (worldSelect) {
                        worldSelect.value = targetWorldId;
                        const launchBtn = document.querySelector('button[type="submit"], button.launch-world');
                        if (launchBtn) {
                            launchBtn.click();
                            return true;
                        }
                    }
                    
                    return false;
                }, worldId);

                if (worldClicked) {
                    console.log('✅ Clicked world launch button');
                    
                    // Wait for navigation to game
                    try {
                        await this.page.waitForNavigation({ 
                            waitUntil: 'networkidle0',
                            timeout: 30000 
                        });
                    } catch (e) {
                        console.log('   Navigation timeout, checking current state...');
                    }
                } else {
                    console.log('⚠️  Could not find world in UI, trying direct navigation...');
                    
                    // Try direct navigation to game
                    await this.page.goto(`http://${this.hostname}:${this.port}/game`, {
                        waitUntil: 'networkidle0',
                        timeout: this.navigationTimeout
                    });
                }
            }

            // Check if we need authentication
            currentUrl = this.page.url();
            if (currentUrl.includes('/join') || currentUrl.includes('/auth')) {
                console.log('🔐 Authentication required...');
                
                // Get credentials
                const credentials = this.credentialManager.getCredentials();
                
                // Try world password first if available
                if (credentials.hasWorldPassword) {
                    console.log('   Trying world password...');
                    const passwordField = await this.page.$('input[type="password"]');
                    if (passwordField) {
                        await passwordField.type(credentials.worldPassword);
                        await this.page.keyboard.press('Enter');
                        await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
                    }
                }
                
                // Check if we're now in the game
                currentUrl = this.page.url();
                if (currentUrl.includes('/game') && !currentUrl.includes('/join')) {
                    console.log('✅ Successfully authenticated and entered game');
                }
            }

            // Final check - are we in the game?
            currentUrl = this.page.url();
            if (currentUrl.includes('/game') && !currentUrl.includes('/join')) {
                // Wait for game to be ready
                console.log('⏳ Waiting for game to be ready...');
                
                const gameReady = await this.waitForGameReady();
                if (gameReady) {
                    const status = await this.getServerStatus();
                    this.activeWorld = status.world;
                    this.activeSystem = status.system;
                    this.setState(ServerState.READY);
                    console.log(`✅ World activated successfully: ${this.activeWorld}`);
                    return true;
                } else {
                    throw new Error('Game failed to become ready');
                }
            } else {
                throw new Error(`Failed to navigate to game. Current URL: ${currentUrl}`);
            }

        } catch (error) {
            this.setState(ServerState.ERROR);
            console.error('❌ World activation failed:', error.message);
            throw error;
        }
    }

    /**
     * Wait for game.ready to be true
     */
    async waitForGameReady(timeout = 30000) {
        console.log('   Waiting for game.ready...');
        
        try {
            await this.page.waitForFunction(
                () => window.game && window.game.ready === true,
                { timeout }
            );
            
            this.gameReady = true;
            console.log('   ✅ Game is ready!');
            return true;
            
        } catch (error) {
            console.error('   ❌ Timeout waiting for game.ready');
            
            // Get current game state for debugging
            const gameState = await this.page.evaluate(() => {
                if (!window.game) return { error: 'No game object' };
                return {
                    ready: window.game.ready,
                    world: window.game.world?.id,
                    system: window.game.system?.id,
                    user: window.game.user?.name,
                    userId: window.game.userId
                };
            });
            
            console.log('   Current game state:', gameState);
            return false;
        }
    }
}

// Export the fixed manager and ServerState
export { ServerState } from './foundry-server-manager.mjs';
export default FoundryServerManagerFixed;