#!/usr/bin/env node

import { FoundryServerManager, ServerState } from './foundry-server-manager.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Patched FoundryServerManager that intercepts socket.io responses
 * to inject world data when package discovery fails
 */
export class FoundryServerManagerPatched extends FoundryServerManager {
    constructor(options = {}) {
        super(options);
        this.worldsCache = null;
    }

    /**
     * Initialize browser with socket.io interception
     */
    async initializeBrowser() {
        const result = await super.initializeBrowser();
        
        if (result && this.page) {
            // Inject our socket interceptor
            await this.injectSocketInterceptor();
        }
        
        return result;
    }

    /**
     * Load world data from filesystem
     */
    async loadWorldsFromFilesystem() {
        if (this.worldsCache) {
            return this.worldsCache;
        }

        const worlds = [];
        const worldsPath = join(this.dataPath, 'worlds');
        
        if (!existsSync(worldsPath)) {
            return worlds;
        }

        // Get available worlds from filesystem
        const worldDirs = await this.getAvailableWorlds();
        
        for (const worldId of worldDirs) {
            const worldJsonPath = join(worldsPath, worldId, 'world.json');
            
            if (existsSync(worldJsonPath)) {
                try {
                    const worldData = JSON.parse(readFileSync(worldJsonPath, 'utf8'));
                    
                    // Construct world object similar to FoundryVTT's format
                    worlds.push({
                        id: worldId,
                        title: worldData.title || worldId,
                        system: worldData.system || 'unknown',
                        version: worldData.version || '1.0.0',
                        coreVersion: worldData.coreVersion || '12.331',
                        systemVersion: worldData.systemVersion || '1.0.0',
                        description: worldData.description || '',
                        nextSession: worldData.nextSession || null,
                        resetKeys: worldData.resetKeys || false,
                        safeMode: worldData.safeMode || false,
                        background: worldData.background || null,
                        joinTheme: worldData.joinTheme || null,
                        availability: worldData.availability || 0,
                        unavailable: false,
                        locked: false,
                        compatibility: worldData.compatibility || {
                            minimum: '12',
                            verified: '12.331',
                            maximum: null
                        }
                    });
                } catch (error) {
                    console.error(`Failed to load world ${worldId}:`, error.message);
                }
            }
        }
        
        this.worldsCache = worlds;
        return worlds;
    }

    /**
     * Inject socket interceptor to modify responses
     */
    async injectSocketInterceptor() {
        const worlds = await this.loadWorldsFromFilesystem();
        
        await this.page.evaluateOnNewDocument((worldsData) => {
            console.log('[Interceptor] Installing socket.io interceptor...');
            
            // Store original socket methods
            let originalEmit = null;
            let socketInterceptorInstalled = false;
            
            // Function to install interceptor
            const installInterceptor = () => {
                if (socketInterceptorInstalled || !window.game || !window.game.socket) {
                    return;
                }
                
                const socket = window.game.socket;
                originalEmit = socket.emit.bind(socket);
                
                // Override emit to intercept getSetupData
                socket.emit = function(event, ...args) {
                    console.log(`[Interceptor] Socket emit: ${event}`);
                    
                    if (event === 'getSetupData' && args.length > 0 && typeof args[0] === 'function') {
                        const originalCallback = args[0];
                        
                        // Wrap the callback to inject our data
                        args[0] = function(data) {
                            console.log('[Interceptor] Intercepting getSetupData response');
                            
                            // Inject worlds if empty
                            if (!data.worlds || data.worlds.length === 0) {
                                console.log(`[Interceptor] Injecting ${worldsData.length} worlds`);
                                data.worlds = worldsData;
                            }
                            
                            // Also ensure we have at least one system
                            if (!data.systems || data.systems.length === 0) {
                                console.log('[Interceptor] Injecting default system');
                                data.systems = [{
                                    id: 'dnd5e',
                                    title: 'Dungeons & Dragons 5th Edition',
                                    version: '4.1.1',
                                    compatibility: {
                                        minimum: '12',
                                        verified: '12.331',
                                        maximum: null
                                    },
                                    availability: 0,
                                    unavailable: false,
                                    locked: false
                                }];
                            }
                            
                            return originalCallback(data);
                        };
                    }
                    
                    return originalEmit.apply(this, [event, ...args]);
                };
                
                socketInterceptorInstalled = true;
                console.log('[Interceptor] Socket interceptor installed successfully');
            };
            
            // Try to install immediately
            installInterceptor();
            
            // Also set up an interval to catch late socket initialization
            const checkInterval = setInterval(() => {
                if (window.game && window.game.socket && !socketInterceptorInstalled) {
                    installInterceptor();
                    clearInterval(checkInterval);
                }
            }, 100);
            
            // Clear interval after 10 seconds
            setTimeout(() => clearInterval(checkInterval), 10000);
            
        }, worlds);
        
        console.log(`✅ Socket interceptor injected with ${worlds.length} worlds`);
    }

    /**
     * Navigate to page with interceptor
     */
    async navigateWithInterceptor(url, options = {}) {
        // Ensure interceptor is installed
        await this.injectSocketInterceptor();
        
        // Navigate
        return await this.page.goto(url, options);
    }

    /**
     * Override activateWorld to ensure interceptor is active
     */
    async activateWorld(worldId) {
        // Ensure interceptor is installed before calling parent
        if (this.page) {
            await this.injectSocketInterceptor();
        }
        
        // Call parent implementation
        return await super.activateWorld(worldId);
    }
}

// Export both the patched class and the original
export { FoundryServerManager, ServerState };
export default FoundryServerManagerPatched;