#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { existsSync, readdirSync, unlinkSync, writeFileSync, readFileSync, realpathSync } from 'fs';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import CredentialManager from './credential-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Server state enum
export const ServerState = {
    STOPPED: 'stopped',
    STARTING: 'starting',
    RUNNING: 'running',
    ACTIVATING: 'activating',
    READY: 'ready',
    ERROR: 'error',
    STOPPING: 'stopping'
};

export class FoundryServerManager {
    constructor(options = {}) {
        this.foundryPath = options.foundryPath || join(__dirname, 'foundry-app');
        // Resolve symlinks for data path to ensure FoundryVTT can find worlds
        const defaultDataPath = join(__dirname, 'foundry-data');
        this.dataPath = options.dataPath || defaultDataPath;
        
        // Resolve the real path if it's a symlink
        try {
            const realPath = realpathSync(this.dataPath);
            if (realPath !== this.dataPath) {
                console.log(`📁 Resolving data path symlink:`);
                console.log(`   Original: ${this.dataPath}`);
                console.log(`   Resolved: ${realPath}`);
                this.dataPath = realPath;
            }
        } catch (error) {
            // If realpath fails, use the original path
            console.warn(`⚠️  Could not resolve data path: ${error.message}`);
        }
        
        this.port = options.port || 30000;
        this.hostname = options.hostname || 'localhost';
        this.process = null;
        this.readyPromise = null;
        this.credentialManager = new CredentialManager();
        
        // Configurable timeouts
        this.gameReadyTimeout = options.gameReadyTimeout || 60000; // Default 60s
        this.serverStartTimeout = options.serverStartTimeout || 60000; // Default 60s
        this.navigationTimeout = options.navigationTimeout || 30000; // Default 30s
        this.activationTimeout = options.activationTimeout || 30000; // Default 30s
        this.statusPollInterval = options.statusPollInterval || 1000; // Default 1s
        
        // Server state tracking
        this.state = ServerState.STOPPED;
        this.activeWorld = null;
        this.activeSystem = null;
        
        // Puppeteer state tracking
        this.browser = null;
        this.page = null;
        this.gameReady = false;
        this.authenticated = false;
        
        // Process management
        this.pidFile = join(this.dataPath, 'Config', 'foundry.pid');
        this.lockFile = join(this.dataPath, 'Config', 'app.lock');
    }

    /**
     * Set server state and log transitions
     * @private
     * @param {string} newState - New server state
     */
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        console.log(`📊 State transition: ${oldState} → ${newState}`);
    }

    /**
     * Get current server state
     * @returns {string} Current server state
     */
    getState() {
        return this.state;
    }

    /**
     * Start the FoundryVTT server process
     * @param {Object} options - Optional startup options
     * @param {string} options.world - World to launch directly
     * @param {boolean} options.headless - Run in headless mode (default: true)
     * @returns {Promise<void>} Resolves when server is ready
     */
    async startServer(options = {}) {
        if (this.state !== ServerState.STOPPED) {
            throw new Error(`Cannot start server in state: ${this.state}`);
        }

        this.setState(ServerState.STARTING);
        
        // Default to headless mode
        const headless = options.headless !== undefined ? options.headless : true;
        
        try {
            // Check for existing processes
            await this.checkAndCleanExistingProcesses();
            
            // Validate foundry installation
            const foundryMain = join(this.foundryPath, 'resources', 'app', 'main.mjs');
            if (!existsSync(foundryMain)) {
                throw new Error(`FoundryVTT installation not found at ${this.foundryPath}`);
            }

            // Validate data directory
            if (!existsSync(this.dataPath)) {
                throw new Error(`FoundryVTT data directory not found at ${this.dataPath}`);
            }

            // Build command arguments
            const args = [
                '--port=' + this.port.toString(),
                '--hostname=' + this.hostname,
                '--dataPath=' + this.dataPath
            ];
            
            // Add headless flag if requested
            if (headless) {
                args.unshift('--headless');
            }
            
            // Add world parameter if specified
            if (options.world) {
                args.push('--world=' + options.world);
                console.log(`🚀 Starting FoundryVTT server on ${this.hostname}:${this.port}`);
                console.log(`   Mode: Direct world launch (${options.world})`);
            } else {
                console.log(`🚀 Starting FoundryVTT server on ${this.hostname}:${this.port}`);
                console.log(`   Mode: Setup (no world activated)`);
            }
            console.log(`   Headless: ${headless}`);
            console.log(`   Data path: ${this.dataPath}`);
            console.log(`   Resolved data path: ${path.resolve(this.dataPath)}`)

            // Start the server process
            this.process = spawn('node', [foundryMain, ...args], {
                cwd: this.foundryPath,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    NODE_ENV: 'production'
                }
            });

            // Store PID for tracking
            this.storePID(this.process.pid);
            
            // Set up promise for server readiness
            this.readyPromise = this._waitForServerReady();

            // Handle process events
            this.process.on('error', (error) => {
                console.error('❌ FoundryVTT server process error:', error.message);
                this.setState(ServerState.ERROR);
                this.authenticated = false;
                this.gameReady = false;
                this.activeWorld = null;
                this.activeSystem = null;
            });

            this.process.on('exit', (code, signal) => {
                const wasExpected = this.state === ServerState.STOPPING;
                console.log(`🔴 FoundryVTT server stopped (code: ${code}, signal: ${signal})`);
                
                this.process = null;
                this.readyPromise = null;
                this.authenticated = false;
                this.gameReady = false;
                this.activeWorld = null;
                this.activeSystem = null;
                
                // Clean up PID file
                this.removePID();
                
                if (!wasExpected && code !== 0) {
                    console.error('⚠️  Server stopped unexpectedly. Check server logs for errors.');
                    this.setState(ServerState.ERROR);
                } else {
                    this.setState(ServerState.STOPPED);
                }
            });

            // Wait for server to be ready
            await this.readyPromise;
            this.setState(ServerState.RUNNING);
            
            console.log(`✅ FoundryVTT server is ready at http://${this.hostname}:${this.port}`);
            
            // Give FoundryVTT time to fully initialize and scan worlds
            console.log('⏳ Waiting for FoundryVTT to scan worlds...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Reset package cache if browser is initialized
            if (this.browser && this.page) {
                await this.resetPackageCache();
            }

        } catch (error) {
            console.error('❌ Server startup failed:', error.message);
            this.setState(ServerState.ERROR);
            if (this.process) {
                this.process.kill('SIGTERM');
                this.process = null;
            }
            throw new Error(`Failed to start FoundryVTT server: ${error.message}`);
        }
    }

    /**
     * Stop the FoundryVTT server process
     * @param {number} timeout - Maximum time to wait for graceful shutdown (ms)
     * @returns {Promise<void>} Resolves when server is stopped
     */
    async stopServer(timeout = 10000) {
        if (!this.process) {
            return;
        }

        if (this.state === ServerState.STOPPED || this.state === ServerState.STOPPING) {
            console.log('⚠️  Server is already stopped or stopping');
            return;
        }

        this.setState(ServerState.STOPPING);
        console.log('🛑 Stopping FoundryVTT server...');

        return new Promise((resolve, reject) => {
            const killTimer = setTimeout(() => {
                console.log('⚠️  Forcing server shutdown...');
                this.process.kill('SIGKILL');
            }, timeout);

            this.process.once('exit', () => {
                clearTimeout(killTimer);
                console.log('✅ FoundryVTT server stopped');
                resolve();
            });

            this.process.once('error', (error) => {
                clearTimeout(killTimer);
                this.setState(ServerState.ERROR);
                reject(error);
            });

            // Try graceful shutdown first
            this.process.kill('SIGTERM');
        });
    }

    /**
     * Activate a world using the setup API
     * @param {string} worldId - ID of the world to activate
     * @returns {Promise<boolean>} True if activation successful
     */
    async activateWorld(worldId) {
        // Validate state
        if (this.state !== ServerState.RUNNING) {
            throw new Error(`Cannot activate world in state: ${this.state}. Server must be running.`);
        }

        this.setState(ServerState.ACTIVATING);
        console.log(`🌍 Activating world: ${worldId}`);

        try {
            // Initialize browser FIRST - required for all world operations
            if (!this.browser || !this.page) {
                await this.initializeBrowser();
            }

            // Validate world exists (now that browser is available)
            await this.ensureWorldExists(worldId);
            
            // Discover all worlds for debugging  
            console.log('\n📋 Pre-activation world discovery:');
            const discoveredWorlds = await this.discoverWorlds();
            console.log(`   Available worlds: ${discoveredWorlds.map(w => w.id).join(', ')}\n`);

            // First check if authentication is needed
            console.log('📋 Checking authentication...');
            await this.page.goto(`http://${this.hostname}:${this.port}`, {
                waitUntil: 'networkidle0',
                timeout: this.navigationTimeout
            });
            
            // Check if redirected to auth page
            let currentUrl = this.page.url();
            if (currentUrl.includes('/auth') || currentUrl.includes('/join')) {
                console.log('   Authentication required, logging in as admin...');
                
                // Get admin password
                const adminPassword = await this.credentialManager.getAdminPassword();
                if (!adminPassword) {
                    throw new Error('Admin password not set. Run with --set-admin-password first.');
                }
                
                // Look for password field and submit
                await this.page.waitForSelector('input[type="password"]', { timeout: 5000 });
                await this.page.type('input[type="password"]', adminPassword);
                
                // Submit form
                await this.page.evaluate(() => {
                    const form = document.querySelector('form');
                    if (form) {
                        form.submit();
                    } else {
                        const submitBtn = document.querySelector('button[type="submit"]');
                        if (submitBtn) submitBtn.click();
                    }
                });
                
                await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
                console.log('   ✅ Authenticated as admin');
            }
            
            // Now navigate to setup page
            console.log('📋 Navigating to setup page...');
            await this.page.goto(`http://${this.hostname}:${this.port}/setup`, {
                waitUntil: 'networkidle0',
                timeout: this.navigationTimeout
            });
            
            // Reset package cache to ensure fresh world data
            await this.resetPackageCache();
            
            // Handle any popups (usage data consent, backups overview, etc.)
            await new Promise(resolve => setTimeout(resolve, 1000)); // Give popup time to appear
            
            // Handle usage data consent popup
            const hasUsagePopup = await this.page.evaluate(() => {
                return !!document.querySelector('.dialog-button.no[data-button="no"]');
            });
            
            if (hasUsagePopup) {
                console.log('   Handling usage data consent popup...');
                await this.page.evaluate(() => {
                    const declineBtn = document.querySelector('.dialog-button.no[data-button="no"]');
                    if (declineBtn) declineBtn.click();
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Handle all dialogs/popups
            console.log('   Checking for dialogs to close...');
            const dialogsClosed = await this.page.evaluate(() => {
                let closed = 0;
                
                // Method 1: Close all dialogs with close buttons
                const closeButtons = document.querySelectorAll('.dialog .close, .dialog [data-action="close"], .dialog-header .close, button.dialog-button.close');
                closeButtons.forEach(btn => {
                    btn.click();
                    closed++;
                });
                
                // Method 2: Close by clicking backdrop
                const dialogs = document.querySelectorAll('.dialog, .window-app.dialog');
                dialogs.forEach(dialog => {
                    // Try clicking the dialog backdrop
                    const backdrop = dialog.querySelector('.window-content') || dialog;
                    if (backdrop && dialog.style.display !== 'none') {
                        // Click outside the content area
                        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
                        dialog.dispatchEvent(event);
                        closed++;
                    }
                });
                
                // Method 3: Press Escape key
                if (document.querySelector('.dialog')) {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
                    closed++;
                }
                
                return closed;
            });
            
            if (dialogsClosed > 0) {
                console.log(`   Closed ${dialogsClosed} dialog(s)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Try to refresh the world list
            console.log('🔄 Attempting to refresh world list...');
            const refreshResult = await this.page.evaluate(() => {
                // Try clicking the refresh button if it exists
                const refreshBtn = document.querySelector('button[data-action="refreshPackages"], button.refresh-packages');
                if (refreshBtn) {
                    refreshBtn.click();
                    return { refreshed: true, method: 'button' };
                }
                
                // Try to trigger a package refresh through the setup object
                if (window.setup && typeof window.setup.refreshPackages === 'function') {
                    window.setup.refreshPackages();
                    return { refreshed: true, method: 'setup.refreshPackages' };
                }
                
                // Try reloading the setup data
                if (window.setup && typeof window.setup.getData === 'function') {
                    window.setup.getData();
                    return { refreshed: true, method: 'setup.getData' };
                }
                
                return { refreshed: false };
            });
            
            if (refreshResult.refreshed) {
                console.log(`   ✅ Triggered refresh via ${refreshResult.method}`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for refresh
            } else {
                console.log('   ⚠️  Could not find refresh mechanism');
            }
            
            // Check what worlds FoundryVTT sees in the UI
            console.log('\n🔍 Checking worlds visible in FoundryVTT UI...');
            const foundryWorlds = await this.page.evaluate(() => {
                const worldElements = document.querySelectorAll('[data-package-id]');
                const worlds = [];
                worldElements.forEach(el => {
                    const id = el.getAttribute('data-package-id');
                    const titleEl = el.querySelector('.package-title');
                    const systemEl = el.querySelector('.package-tags');
                    worlds.push({
                        id: id,
                        title: titleEl ? titleEl.textContent.trim() : id,
                        system: systemEl ? systemEl.textContent.trim() : 'unknown',
                        element: el.tagName,
                        classes: el.className
                    });
                });
                
                // Also check if there's any message about no worlds
                const noWorldsMessage = document.querySelector('.notification, .warning');
                
                return {
                    worlds: worlds,
                    worldCount: worlds.length,
                    noWorldsMessage: noWorldsMessage ? noWorldsMessage.textContent : null,
                    pageTitle: document.title,
                    currentUrl: window.location.href
                };
            });
            
            console.log(`   Page title: ${foundryWorlds.pageTitle}`);
            console.log(`   Current URL: ${foundryWorlds.currentUrl}`);
            console.log(`   Worlds found in UI: ${foundryWorlds.worldCount}`);
            if (foundryWorlds.noWorldsMessage) {
                console.log(`   Warning message: ${foundryWorlds.noWorldsMessage}`);
            }
            if (foundryWorlds.worlds.length > 0) {
                foundryWorlds.worlds.forEach(w => {
                    console.log(`   - ${w.id}: ${w.title} (${w.system})`);
                });
            }

            // Check for license/EULA page redirect
            currentUrl = this.page.url();
            if (currentUrl.includes('/license')) {
                console.log('⚠️  License/EULA page detected...');
                
                // Check if this is EULA agreement page
                const isEULA = await this.page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const hasAgreeButton = buttons.some(b => 
                        b.textContent.toUpperCase().includes('AGREE')
                    );
                    const hasAcknowledgeText = document.body.textContent.includes('Acknowledge Agreement');
                    return hasAgreeButton || hasAcknowledgeText;
                });
                
                if (isEULA) {
                    console.log('   Accepting EULA...');
                    
                    // Check the agreement checkbox if present
                    const checkbox = await this.page.$('input[type="checkbox"][name="agree"]');
                    if (checkbox) {
                        await checkbox.click();
                    }
                    
                    // Click the AGREE button
                    await this.page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const agreeBtn = buttons.find(b => 
                            b.textContent.toUpperCase().includes('AGREE')
                        );
                        if (agreeBtn) {
                            agreeBtn.click();
                        } else {
                            throw new Error('AGREE button not found on EULA page');
                        }
                    });
                    
                    // Wait for navigation
                    await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
                    console.log('✅ EULA accepted, continuing...');
                } else {
                    // This might be a license key page
                    console.log('   Checking for license key input...');
                    const hasLicenseInput = await this.page.$('input[name="license"], input[type="password"]').then(el => !!el);
                    
                    if (hasLicenseInput) {
                        // Read license key from config
                        const licenseData = JSON.parse(await fs.readFile(
                            path.join(process.env.HOME, '.local/share/FoundryVTT/Config/license.json'), 
                            'utf8'
                        ));
                        
                        // Submit license key
                        const licenseInput = await this.page.$('input[name="license"], input[type="password"]');
                        await licenseInput.type(licenseData.license);
                        
                        // Submit the form
                        await this.page.evaluate(() => {
                            const form = document.querySelector('form');
                            if (form) {
                                form.submit();
                            } else {
                                const submitBtn = document.querySelector('button[type="submit"]');
                                if (submitBtn) submitBtn.click();
                            }
                        });
                        
                        await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
                        console.log('✅ License key submitted...');
                    } else {
                        console.log('⚠️  Unknown license page type, trying to navigate back to setup...');
                        await this.page.goto(`http://${this.hostname}:${this.port}/setup`, {
                            waitUntil: 'networkidle0',
                            timeout: this.navigationTimeout
                        });
                    }
                }
            }

            // Activate world via setup API
            console.log('🚀 Sending world activation request...');
            const activationResult = await this.page.evaluate(async (worldId) => {
                try {
                    // Try window.setup.post first
                    if (window.setup && typeof window.setup.post === 'function') {
                        const result = await window.setup.post({
                            action: 'launchWorld',
                            world: worldId
                        });
                        return { success: true, method: 'setup.post', result };
                    }
                    
                    // Fallback to fetch API
                    const response = await fetch('/setup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'launchWorld',
                            world: worldId
                        })
                    });
                    
                    // Get the response body to check for errors
                    let result = null;
                    try {
                        result = await response.json();
                    } catch (e) {
                        result = await response.text();
                    }
                    
                    return {
                        success: response.ok && !result?.error,
                        method: 'fetch',
                        status: response.status,
                        statusText: response.statusText,
                        result
                    };
                    
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }, worldId);

            console.log('📨 Activation response:', activationResult);

            if (!activationResult.success) {
                // Take a screenshot to see what happened
                await this.page.screenshot({ path: 'activation-error.png' });
                console.log('   📸 Error screenshot saved as activation-error.png');
                
                // If the error is "world does not exist", it might be a UI issue
                if (activationResult.result && activationResult.result.error && 
                    activationResult.result.error.includes('does not exist')) {
                    console.log('   ⚠️  World not found via API, trying UI approach...');
                    
                    // Try to find and click the world in the UI
                    const worldClicked = await this.page.evaluate(async (worldId) => {
                        // Look for world element
                        const worldEl = document.querySelector(`[data-package-id="${worldId}"]`);
                        if (worldEl) {
                            // Look for launch button within the world element
                            const launchBtn = worldEl.querySelector('button');
                            if (launchBtn) {
                                launchBtn.click();
                                return { clicked: true, method: 'button' };
                            }
                            
                            // Try clicking the world element itself
                            worldEl.click();
                            return { clicked: true, method: 'element' };
                        }
                        
                        // Look for any element with the world name
                        const elements = Array.from(document.querySelectorAll('*'));
                        const worldNameEl = elements.find(el => 
                            el.textContent.includes('Test World') || 
                            el.textContent.includes('test-world')
                        );
                        
                        if (worldNameEl) {
                            worldNameEl.click();
                            return { clicked: true, method: 'text-search' };
                        }
                        
                        return { clicked: false };
                    }, worldId);
                    
                    if (worldClicked.clicked) {
                        console.log(`   Clicked world via ${worldClicked.method}`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } else {
                        throw new Error(`World activation failed: ${JSON.stringify(activationResult)}`);
                    }
                } else {
                    throw new Error(`World activation failed: ${JSON.stringify(activationResult)}`);
                }
            }

            // Wait for activation to complete
            console.log('⏳ Waiting for world activation...');
            const activated = await this.waitForActivation(worldId);
            
            if (!activated) {
                throw new Error('World activation timeout');
            }

            this.setState(ServerState.READY);
            console.log(`✅ World '${worldId}' activated successfully`);
            console.log(`   System: ${this.activeSystem}`);
            
            return true;

        } catch (error) {
            console.error('❌ World activation failed:', error.message);
            this.setState(ServerState.RUNNING); // Revert to running state
            throw error;
        }
    }

    /**
     * Wait for world activation to complete
     * @private
     * @param {string} worldId - Expected world ID
     * @param {number} maxAttempts - Maximum polling attempts
     * @returns {Promise<boolean>} True if activated successfully
     */
    async waitForActivation(worldId, maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const status = await this.getServerStatus();
                
                if (status.active && status.world === worldId) {
                    this.activeWorld = status.world;
                    this.activeSystem = status.system;
                    return true;
                }
                
                console.log(`   Attempt ${i + 1}/${maxAttempts}: Server active: ${status.active}, World: ${status.world}`);
                await new Promise(resolve => setTimeout(resolve, this.statusPollInterval));
                
            } catch (error) {
                console.error(`   Status check error: ${error.message}`);
            }
        }
        
        console.log(`⚠️  World activation timeout for '${worldId}'. Final status: active=${status?.active}, world=${status?.world}`);
        return false;
    }

    /**
     * Reset package caches to ensure fresh world discovery
     * @returns {Promise<boolean>} True if cache reset was successful
     */
    async resetPackageCache() {
        if (!this.browser || !this.page) {
            console.log('⚠️  Browser not initialized, skipping cache reset');
            return false;
        }

        try {
            console.log('🔄 Resetting package cache...');
            
            // Navigate to setup page if not already there
            const currentUrl = this.page.url();
            if (!currentUrl.includes('/setup')) {
                await this.page.goto(`http://${this.hostname}:${this.port}/setup`, {
                    waitUntil: 'networkidle0',
                    timeout: this.navigationTimeout
                });
            }

            // Send POST request to reset packages
            const resetResponse = await this.page.evaluate(async () => {
                try {
                    const response = await fetch('/setup', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            action: 'resetPackages'
                        })
                    });
                    return {
                        ok: response.ok,
                        status: response.status,
                        data: await response.json()
                    };
                } catch (error) {
                    return {
                        ok: false,
                        error: error.message
                    };
                }
            });

            if (resetResponse.ok) {
                console.log('✅ Package cache reset successfully');
                // Give server time to rescan after cache reset
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Force a page reload to ensure fresh data
                await this.page.reload({ waitUntil: 'networkidle0' });
                console.log('   Page reloaded after cache reset');
                
                return true;
            } else {
                console.error('❌ Failed to reset package cache:', resetResponse.error || resetResponse.data);
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error resetting package cache:', error.message);
            return false;
        }
    }

    /**
     * Wait for FoundryVTT to complete world discovery and package scanning
     * @param {number} maxAttempts - Maximum number of attempts (default: 10)
     * @param {number} delayMs - Delay between attempts in milliseconds (default: 2000)
     * @returns {Promise<boolean>} True if worlds were discovered
     */
    async waitForWorldsDiscovered(maxAttempts = 10, delayMs = 2000) {
        if (!this.browser || !this.page) {
            throw new Error('Browser not initialized for world discovery');
        }

        console.log('⏳ Waiting for FoundryVTT world discovery to complete...');

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Trigger package refresh if not first attempt
                if (attempt > 1) {
                    console.log(`   Attempt ${attempt}: Triggering package refresh...`);
                    await this.page.evaluate(async () => {
                        try {
                            // Try multiple refresh methods
                            if (window.setup && typeof window.setup.refreshPackages === 'function') {
                                await window.setup.refreshPackages();
                            } else {
                                // Fallback to API call
                                await fetch('/setup', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'resetPackages' })
                                });
                            }
                        } catch (e) {
                            // Ignore refresh errors
                        }
                    });
                    
                    // Wait for refresh to complete
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // Check if worlds are discovered
                const discoveryResult = await this.page.evaluate(() => {
                    const worldElements = document.querySelectorAll('[data-package-id]');
                    const worldCount = worldElements.length;
                    
                    // Also check for "loading" or "scanning" indicators
                    const isScanning = document.body.textContent.includes('Scanning') ||
                                     document.body.textContent.includes('Loading packages') ||
                                     document.querySelector('.loading, .spinner');
                    
                    // Check for "no worlds" message which indicates scanning is complete
                    const noWorldsComplete = document.body.textContent.includes('No game worlds') ||
                                           document.body.textContent.includes('0 Worlds');
                    
                    return {
                        worldCount,
                        isScanning: !!isScanning,
                        scanComplete: worldCount > 0 || noWorldsComplete,
                        pageTitle: document.title,
                        bodyText: document.body.textContent.substring(0, 200) // First 200 chars for debugging
                    };
                });

                console.log(`   Attempt ${attempt}/${maxAttempts}: Found ${discoveryResult.worldCount} worlds, ` +
                          `scanning: ${discoveryResult.isScanning}, complete: ${discoveryResult.scanComplete}`);

                if (discoveryResult.scanComplete && !discoveryResult.isScanning) {
                    console.log(`✅ World discovery completed after ${attempt} attempts`);
                    return true;
                }

                if (attempt < maxAttempts) {
                    console.log(`   Waiting ${delayMs}ms before next attempt...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }

            } catch (error) {
                console.error(`   Attempt ${attempt} failed:`, error.message);
                if (attempt === maxAttempts) {
                    throw error;
                }
            }
        }

        console.log('⚠️  World discovery timeout - proceeding anyway');
        return false;
    }

    /**
     * Get server status from API endpoint
     * @returns {Promise<Object>} Server status object
     */
    async getServerStatus() {
        try {
            const response = await fetch(`http://${this.hostname}:${this.port}/api/status`);
            
            if (!response.ok) {
                throw new Error(`Status request failed: ${response.status} ${response.statusText}`);
            }
            
            const status = await response.json();
            return {
                active: status.active || false,
                world: status.world || null,
                system: status.system || null,
                version: status.version || null
            };
            
        } catch (error) {
            console.error('❌ Failed to get server status:', error.message);
            return {
                active: false,
                world: null,
                system: null,
                error: error.message
            };
        }
    }

    /**
     * Ensure a world exists using both filesystem and FoundryVTT discovery
     * @param {string} worldName - Name of the world to check/create
     * @returns {Promise<boolean>} True if world exists or was created
     */
    async ensureWorldExists(worldName) {
        try {
            const worldsPath = join(this.dataPath, 'worlds');
            const worldPath = join(worldsPath, worldName);

            // Use Puppeteer discovery for accurate results
            let availableWorlds = [];
            try {
                if (!this.browser || !this.page) {
                    throw new Error('Browser not initialized for world discovery. Cannot ensure world exists.');
                }
                console.log('🔍 Checking world existence via FoundryVTT discovery...');
                availableWorlds = await this.getAvailableWorlds();
            } catch (discoveryError) {
                console.error('❌ World discovery failed:', discoveryError.message);
                throw new Error(`Failed to discover worlds: ${discoveryError.message}`);
            }

            // Check if the requested world is in discovered worlds
            if (availableWorlds.includes(worldName)) {
                console.log(`✅ World '${worldName}' found via discovery`);
                return true;
            }

            // World not found - provide helpful error message
            if (availableWorlds.length === 0) {
                throw new Error(`No worlds found in ${worldsPath}. Please create a world first.`);
            }

            throw new Error(
                `World '${worldName}' not found. Available worlds: ${availableWorlds.join(', ')}`
            );

        } catch (error) {
            console.error(`❌ World validation failed for '${worldName}':`, error.message);
            throw error;
        }
    }

    /**
     * Get list of available worlds using Puppeteer-based discovery
     * This method leverages FoundryVTT's own world discovery after server startup
     * @returns {Promise<string[]>} Array of world names
     */
    async getAvailableWorlds() {
        if (!this.browser || !this.page) {
            throw new Error('Browser not available for world discovery. Initialize browser first.');
        }

        try {
            console.log('🔍 Discovering worlds using FoundryVTT API...');
            
            // Ensure we're on setup page
            const currentUrl = this.page.url();
            if (!currentUrl.includes('/setup')) {
                await this.page.goto(`http://${this.hostname}:${this.port}/setup`, {
                    waitUntil: 'networkidle0',
                    timeout: this.navigationTimeout
                });
            }

            // Wait for FoundryVTT to complete world discovery
            await this.waitForWorldsDiscovered();

            // Get worlds from FoundryVTT UI/API using the correct selector
            const worlds = await this.page.evaluate(() => {
                // Target the worlds section specifically
                const worldsSection = document.querySelector('#worlds-list, section[data-package-type="world"]');
                if (!worldsSection) {
                    return { error: 'Worlds section not found in DOM' };
                }
                
                // Find world elements within the worlds section
                const worldElements = worldsSection.querySelectorAll('.world[data-package-id], [data-package-id]');
                const worldsList = [];
                
                worldElements.forEach(el => {
                    const worldId = el.getAttribute('data-package-id');
                    if (worldId) {
                        worldsList.push(worldId);
                    }
                });
                
                return { 
                    worlds: worldsList,
                    sectionFound: !!worldsSection,
                    elementsFound: worldElements.length,
                    debug: {
                        worldsSectionHTML: worldsSection.innerHTML.substring(0, 500) // First 500 chars for debugging
                    }
                };
            });

            if (worlds.error) {
                throw new Error(worlds.error);
            }

            console.log(`   Found ${worlds.elementsFound} world elements in DOM`);
            if (worlds.worlds.length === 0) {
                console.log('   Worlds section HTML preview:', worlds.debug.worldsSectionHTML);
            }

            console.log(`✅ Discovered ${worlds.worlds.length} worlds via FoundryVTT: ${worlds.worlds.join(', ')}`);
            return worlds.worlds;

        } catch (error) {
            console.error('❌ Puppeteer world discovery failed:', error.message);
            throw error;
        }
    }

    

    /**
     * Discover and validate all worlds in the data directory
     * @returns {Promise<Array>} Array of world information objects
     */
    async discoverWorlds() {
        console.log('🔍 Discovering worlds via Puppeteer...');
        
        if (!this.browser || !this.page) {
            throw new Error('Browser not initialized for world discovery. Cannot discover worlds.');
        }

        try {
            const worldIds = await this.getAvailableWorlds();
            const worlds = [];

            for (const worldId of worldIds) {
                // For now, we'll just return the ID. If more details are needed, 
                // we'd need to navigate to each world's config page or find another API.
                worlds.push({ id: worldId, title: worldId, system: 'unknown' }); 
            }
            
            console.log(`📊 Total valid worlds discovered via Puppeteer: ${worlds.length}`);
            return worlds;
            
        } catch (error) {
            console.error('❌ Error discovering worlds via Puppeteer:', error.message);
            throw error;
        }
    }

    /**
     * Check if server is currently running
     * @returns {boolean} True if server is running
     */
    isServerRunning() {
        return this.state === ServerState.RUNNING || 
               this.state === ServerState.ACTIVATING || 
               this.state === ServerState.READY;
    }

    /**
     * Get server URL
     * @returns {string} Full server URL
     */
    getServerUrl() {
        return `http://${this.hostname}:${this.port}`;
    }

    /**
     * Wait for server to be ready by monitoring output
     * @private
     * @returns {Promise<void>} Resolves when server is ready
     */
    _waitForServerReady() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Server startup timeout (${this.serverStartTimeout / 1000} seconds)`));
            }, this.serverStartTimeout);

            let stdoutBuffer = '';
            let stderrBuffer = '';

            this.process.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdoutBuffer += chunk;
                
                // Look for server ready indicators
                if (chunk.includes('Server started and listening on port') ||
                    chunk.includes('Server listening on port') ||
                    chunk.includes('listening on port')) {
                    console.log('✅ Server ready signal detected');
                    clearTimeout(timeout);
                    resolve();
                }
            });

            this.process.stderr.on('data', (data) => {
                const chunk = data.toString();
                stderrBuffer += chunk;
                
                // Log errors but don't fail immediately unless critical
                if (chunk.trim()) {
                    console.error('🛠️  FoundryVTT stderr:', chunk.trim());
                }
                
                // Look for fatal errors
                if (chunk.includes('EADDRINUSE')) {
                    clearTimeout(timeout);
                    reject(new Error(`Port ${this.port} is already in use. Stop existing FoundryVTT instance or use different port.`));
                } else if (chunk.includes('EACCES') && chunk.includes('permission denied')) {
                    clearTimeout(timeout);
                    reject(new Error('Permission denied. Check file permissions for FoundryVTT installation.'));
                } else if (chunk.includes('MODULE_NOT_FOUND')) {
                    clearTimeout(timeout);
                    reject(new Error('FoundryVTT installation appears corrupted. Missing required modules.'));
                }
            });

            this.process.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            this.process.on('exit', (code) => {
                clearTimeout(timeout);
                if (code !== 0) {
                    let errorMessage = `Server exited with code ${code}`;
                    if (stderrBuffer.trim()) {
                        errorMessage += `\nError details: ${stderrBuffer.trim()}`;
                    }
                    if (stdoutBuffer.trim()) {
                        errorMessage += `\nOutput: ${stdoutBuffer.trim()}`;
                    }
                    reject(new Error(errorMessage));
                }
            });
        });
    }

    /**
     * Initialize Puppeteer browser for FoundryVTT interaction
     * @returns {Promise<boolean>} True if browser initialized successfully
     */
    async initializeBrowser() {
        if (this.browser) {
            console.log('🌐 Browser already initialized');
            return true;
        }

        try {
            console.log('🚀 Initializing Puppeteer browser...');
            
            this.browser = await puppeteer.launch({
                headless: true,
                executablePath: '/snap/bin/chromium',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            });
            
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1280, height: 720 });
            await this.page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            console.log('✅ Puppeteer browser initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize browser:', error.message);
            return false;
        }
    }

    /**
     * Authenticate with FoundryVTT server using stored credentials
     * @returns {Promise<boolean>} True if authentication successful
     */
    async authenticateWithFoundry() {
        if (!this.browser || !this.page) {
            throw new Error('Browser not initialized. Call initializeBrowser() first.');
        }

        if (this.authenticated) {
            console.log('🔓 Already authenticated with FoundryVTT');
            return true;
        }

        try {
            const serverUrl = this.getServerUrl();
            console.log(`🔐 Attempting authentication with ${serverUrl}...`);
            
            // Navigate to the server
            await this.page.goto(`${serverUrl}/game`, {
                waitUntil: 'networkidle0',
                timeout: this.navigationTimeout
            });
            
            const currentUrl = this.page.url();
            console.log(`📍 Current URL: ${currentUrl}`);
            
            // Check if we're redirected to join page (authentication required)
            if (!currentUrl.includes('/join')) {
                console.log('✅ No authentication required');
                this.authenticated = true;
                return true;
            }
            
            // Get stored credentials
            const credentials = this.credentialManager.getCredentials();
            console.log(`🔑 Available credentials: admin=${credentials.hasAdminPassword}, world=${credentials.hasWorldPassword}`);
            
            // Try admin authentication first (required for GM access)
            if (credentials.hasAdminPassword) {
                console.log('🔐 Attempting admin authentication...');
                const success = await this._tryAdminAuthentication(credentials.adminPassword);
                if (success) {
                    this.authenticated = true;
                    return true;
                }
            }
            
            // Fall back to world authentication if available
            if (credentials.hasWorldPassword) {
                console.log('🔐 Attempting world authentication...');
                const success = await this._tryWorldAuthentication(credentials.worldPassword);
                if (success) {
                    this.authenticated = true;
                    return true;
                }
            }
            
            // No valid credentials available
            console.error('❌ No valid credentials available for authentication');
            console.error('   Use the credential manager to set admin or world passwords');
            return false;
            
        } catch (error) {
            console.error('❌ Authentication failed:', error.message);
            return false;
        }
    }

    /**
     * Try admin password authentication
     * @private
     * @param {string} adminPassword - Admin password to try
     * @returns {Promise<boolean>} True if successful
     */
    async _tryAdminAuthentication(adminPassword) {
        try {
            // Look for admin password field
            const adminPasswordField = await this.page.$('input[name="adminPassword"]');
            if (!adminPasswordField) {
                console.log('⚠️  Admin password field not found');
                return false;
            }
            
            // Fill admin password and submit
            await adminPasswordField.type(adminPassword);
            
            // Find and click join button
            const joinButton = await this.page.$('button[type="submit"], input[type="submit"]');
            if (!joinButton) {
                console.log('⚠️  Join button not found');
                return false;
            }
            
            console.log('🔐 Submitting admin credentials...');
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
                joinButton.click()
            ]);
            
            // Check if authentication was successful
            const newUrl = this.page.url();
            console.log(`📍 Post-auth URL: ${newUrl}`);
            
            if (newUrl.includes('/game') && !newUrl.includes('/join')) {
                console.log('✅ Admin authentication successful');
                return true;
            } else {
                console.log('❌ Admin authentication failed - still on join page');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Admin authentication error:', error.message);
            return false;
        }
    }

    /**
     * Try world password authentication
     * @private
     * @param {string} worldPassword - World password to try
     * @returns {Promise<boolean>} True if successful
     */
    async _tryWorldAuthentication(worldPassword) {
        try {
            // Look for world password field
            const worldPasswordField = await this.page.$('input[name="password"]');
            if (!worldPasswordField) {
                console.log('⚠️  World password field not found');
                return false;
            }
            
            // Clear any existing value and fill world password
            await worldPasswordField.click({ clickCount: 3 }); // Select all
            await worldPasswordField.type(worldPassword);
            
            // Find and click join button
            const joinButton = await this.page.$('button[type="submit"], input[type="submit"]');
            if (!joinButton) {
                console.log('⚠️  Join button not found');
                return false;
            }
            
            console.log('🔐 Submitting world credentials...');
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
                joinButton.click()
            ]);
            
            // Check if authentication was successful
            const newUrl = this.page.url();
            console.log(`📍 Post-auth URL: ${newUrl}`);
            
            if (newUrl.includes('/game') && !newUrl.includes('/join')) {
                console.log('✅ World authentication successful');
                return true;
            } else {
                console.log('❌ World authentication failed - still on join page');
                return false;
            }
            
        } catch (error) {
            console.error('❌ World authentication error:', error.message);
            return false;
        }
    }

    /**
     * Wait for FoundryVTT game to be ready for validation operations
     * @returns {Promise<boolean>} True if game is ready
     */
    async waitForGameReady() {
        if (!this.page) {
            throw new Error('Page not available. Ensure browser is initialized and authenticated.');
        }

        if (this.gameReady) {
            console.log('🎮 Game already ready');
            return true;
        }

        try {
            console.log('⏳ Waiting for FoundryVTT game to initialize...');
            
            // Wait for game object to be available and ready
            await this.page.waitForFunction(
                () => window.game && window.game.ready === true,
                { timeout: this.gameReadyTimeout }
            );
            
            // Get game context information
            const gameInfo = await this.page.evaluate(() => {
                return {
                    gameReady: window.game?.ready,
                    systemId: window.game?.system?.id,
                    systemTitle: window.game?.system?.title,
                    worldId: window.game?.world?.id,
                    worldTitle: window.game?.world?.title,
                    hasConfigItem: !!window.CONFIG?.Item,
                    hasFoundryDocuments: !!window.foundry?.documents,
                    itemDocumentClass: window.CONFIG?.Item?.documentClass?.name,
                    actorDocumentClass: window.CONFIG?.Actor?.documentClass?.name
                };
            });
            
            console.log('🎮 FoundryVTT game context ready:');
            console.log(`   System: ${gameInfo.systemTitle} (${gameInfo.systemId})`);
            console.log(`   World: ${gameInfo.worldTitle} (${gameInfo.worldId})`);
            console.log(`   Item Class: ${gameInfo.itemDocumentClass}`);
            console.log(`   Actor Class: ${gameInfo.actorDocumentClass}`);
            
            this.gameReady = true;
            return true;
            
        } catch (error) {
            console.error('❌ Game initialization failed:', error.message);
            return false;
        }
    }

    /**
     * Get current FoundryVTT game context information
     * @returns {Promise<Object>} Game context information
     */
    async getGameContext() {
        if (!this.page || !this.gameReady) {
            throw new Error('Game not ready. Ensure server is started, authenticated, and game is initialized.');
        }

        return await this.page.evaluate(() => {
            return {
                systemId: window.game?.system?.id,
                systemTitle: window.game?.system?.title,
                systemVersion: window.game?.system?.version,
                worldId: window.game?.world?.id,
                worldTitle: window.game?.world?.title,
                foundryVersion: window.game?.version,
                userId: window.game?.user?.id,
                userRole: window.game?.user?.role,
                isGM: window.game?.user?.isGM,
                availableDocumentTypes: {
                    actors: Object.keys(window.CONFIG?.Actor?.typeLabels || {}),
                    items: Object.keys(window.CONFIG?.Item?.typeLabels || {})
                }
            };
        });
    }

    /**
     * Execute a validation operation in the FoundryVTT context
     * @param {string} documentType - Type of document (item, actor, etc.)
     * @param {Object} documentData - Data to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateDocument(documentType, documentData) {
        if (!this.page || !this.gameReady) {
            throw new Error('Game not ready. Ensure server is started, authenticated, and game is initialized.');
        }

        return await this.page.evaluate((docType, docData) => {
            try {
                // Get the appropriate document class
                let DocumentClass;
                if (docType.toLowerCase() === 'item') {
                    DocumentClass = window.CONFIG?.Item?.documentClass;
                } else if (docType.toLowerCase() === 'actor') {
                    DocumentClass = window.CONFIG?.Actor?.documentClass;
                } else {
                    throw new Error(`Unsupported document type: ${docType}`);
                }
                
                if (!DocumentClass) {
                    throw new Error(`Document class not available for type: ${docType}`);
                }
                
                // Create document with validation
                const doc = new DocumentClass(docData, { validateOnly: true });
                
                return {
                    success: true,
                    valid: true,
                    data: doc.toObject ? doc.toObject() : doc,
                    method: `${DocumentClass.name} constructor with validateOnly`
                };
                
            } catch (error) {
                return {
                    success: false,
                    valid: false,
                    error: error.message,
                    stack: error.stack
                };
            }
        }, documentType, documentData);
    }

    /**
     * Cleanup browser resources
     */
    async closeBrowser() {
        if (this.browser) {
            console.log('🔒 Closing Puppeteer browser...');
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.gameReady = false;
            this.authenticated = false;
            console.log('✅ Browser closed successfully');
        }
    }

    /**
     * Check for and clean up existing processes
     * @private
     * @returns {Promise<void>}
     */
    async checkAndCleanExistingProcesses() {
        // Check for lock file
        if (existsSync(this.lockFile)) {
            console.log('🔒 Found existing lock file');
            
            // Check if process is actually running
            const pid = this.getStoredPID();
            if (pid && this.isProcessRunning(pid)) {
                throw new Error(`FoundryVTT is already running (PID: ${pid}). Stop it first or use force cleanup.`);
            } else {
                console.log('🧹 Cleaning up stale lock file');
                this.removeLockFile();
            }
        }
        
        // Check for orphaned processes
        const pid = this.getStoredPID();
        if (pid && this.isProcessRunning(pid)) {
            console.log(`⚠️  Found running FoundryVTT process (PID: ${pid})`);
            throw new Error('FoundryVTT process is already running. Use force cleanup to terminate.');
        } else if (pid) {
            // Clean up stale PID file
            this.removePID();
        }
    }

    /**
     * Store process PID for tracking
     * @private
     * @param {number} pid - Process ID to store
     */
    storePID(pid) {
        try {
            const configDir = dirname(this.pidFile);
            if (!existsSync(configDir)) {
                // Config directory doesn't exist yet, skip PID storage
                return;
            }
            writeFileSync(this.pidFile, pid.toString());
            console.log(`📝 Stored PID: ${pid}`);
        } catch (error) {
            console.warn(`⚠️  Failed to store PID: ${error.message}`);
        }
    }

    /**
     * Get stored PID from file
     * @private
     * @returns {number|null} Stored PID or null
     */
    getStoredPID() {
        try {
            if (existsSync(this.pidFile)) {
                const pid = parseInt(readFileSync(this.pidFile, 'utf8').trim());
                return isNaN(pid) ? null : pid;
            }
        } catch (error) {
            console.warn(`⚠️  Failed to read PID file: ${error.message}`);
        }
        return null;
    }

    /**
     * Remove stored PID file
     * @private
     */
    removePID() {
        try {
            if (existsSync(this.pidFile)) {
                unlinkSync(this.pidFile);
                console.log('🗑️  Removed PID file');
            }
        } catch (error) {
            console.warn(`⚠️  Failed to remove PID file: ${error.message}`);
        }
    }

    /**
     * Check if a process is running
     * @private
     * @param {number} pid - Process ID to check
     * @returns {boolean} True if process is running
     */
    isProcessRunning(pid) {
        try {
            // Send signal 0 to check if process exists
            process.kill(pid, 0);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Remove lock file
     * @private
     */
    removeLockFile() {
        try {
            if (existsSync(this.lockFile)) {
                unlinkSync(this.lockFile);
                console.log('🔓 Removed lock file');
            }
        } catch (error) {
            console.warn(`⚠️  Failed to remove lock file: ${error.message}`);
        }
    }

    /**
     * Force cleanup of processes and locks
     * @param {boolean} killProcess - Whether to force kill running processes
     * @returns {Promise<void>}
     */
    async forceCleanup(killProcess = false) {
        console.log('🧹 Starting force cleanup...');
        
        // Close browser if open
        await this.closeBrowser();
        
        // Check for running process
        const pid = this.getStoredPID();
        if (pid && this.isProcessRunning(pid)) {
            if (killProcess) {
                console.log(`⚡ Force killing process ${pid}...`);
                try {
                    process.kill(pid, 'SIGKILL');
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for process to die
                    console.log('✅ Process terminated');
                } catch (error) {
                    console.error(`❌ Failed to kill process: ${error.message}`);
                }
            } else {
                console.log(`⚠️  Process ${pid} is still running. Use killProcess=true to force kill.`);
            }
        }
        
        // Clean up files
        this.removePID();
        this.removeLockFile();
        
        // Reset state
        this.setState(ServerState.STOPPED);
        this.process = null;
        this.readyPromise = null;
        this.authenticated = false;
        this.gameReady = false;
        this.activeWorld = null;
        this.activeSystem = null;
        
        console.log('✅ Force cleanup completed');
    }

    /**
     * Cleanup resources and stop server if running
     * @param {Object} options - Cleanup options
     * @param {boolean} options.force - Force cleanup even if process is stuck
     * @param {boolean} options.killProcess - Force kill stuck processes
     */
    async cleanup(options = {}) {
        const { force = false, killProcess = false } = options;
        
        if (force) {
            await this.forceCleanup(killProcess);
            return;
        }
        
        await this.closeBrowser();
        if (this.isServerRunning() || this.process) {
            await this.stopServer();
        }
        
        // Clean up lock file after normal shutdown
        this.removeLockFile();
    }
}

// Handle process signals for cleanup
let serverManager = null;

process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    if (serverManager) {
        await serverManager.cleanup();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    if (serverManager) {
        await serverManager.cleanup();
    }
    process.exit(0);
});

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const command = args[0];

    serverManager = new FoundryServerManager();

    switch (command) {
        case 'start':
            const worldName = args[1];
            try {
                await serverManager.startServer();
                
                // If world specified, activate it
                if (worldName) {
                    console.log(`\n📋 Activating world: ${worldName}`);
                    await serverManager.activateWorld(worldName);
                }
                
                console.log('\nPress Ctrl+C to stop the server');
                // Keep process alive
                process.stdin.resume();
            } catch (error) {
                console.error('Failed to start server:', error.message);
                process.exit(1);
            }
            break;

        case 'worlds':
            try {
                await serverManager.startServer();
                await serverManager.initializeBrowser();
                console.log('Available worlds:');
                const worlds = await serverManager.getAvailableWorlds();
                if (worlds.length === 0) {
                    console.log('  No worlds found');
                } else {
                    worlds.forEach(world => console.log(`  - ${world}`));
                }
                await serverManager.cleanup();
            } catch (error) {
                console.error('Failed to get worlds:', error.message);
                process.exit(1);
            }
            break;

        case 'status':
            try {
                await serverManager.startServer();
                const status = await serverManager.getServerStatus();
                console.log('\nServer Status:');
                console.log(`  Active: ${status.active}`);
                console.log(`  World: ${status.world || 'None'}`);
                console.log(`  System: ${status.system || 'None'}`);
                console.log(`  Version: ${status.version || 'Unknown'}`);
                await serverManager.cleanup();
            } catch (error) {
                console.error('Failed to get status:', error.message);
                process.exit(1);
            }
            break;

        default:
            console.log('Usage:');
            console.log('  ./foundry-server-manager.mjs start [world-name]  - Start server (optionally with world)');
            console.log('  ./foundry-server-manager.mjs worlds             - List available worlds');
            console.log('  ./foundry-server-manager.mjs status             - Get server status');
            break;
    }
}