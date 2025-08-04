import puppeteer from 'puppeteer';
import CredentialManager from './credential-manager.mjs';

export default class WorldActivator {
    constructor(options = {}) {
        this.serverUrl = options.serverUrl || 'http://localhost:30000';
        this.verbose = options.verbose || false;
        this.browser = null;
        this.page = null;
        this.credentialManager = new CredentialManager();
    }

    log(message) {
        if (this.verbose) {
            console.log(`[WorldActivator] ${message}`);
        }
    }

    async initialize() {
        this.log('Initializing Puppeteer browser...');
        this.browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1280, height: 800 });
        this.log('Browser initialized.');
    }

    async navigateToSetup() {
        const url = `${this.serverUrl}/setup`;
        this.log(`Navigating to ${url}`);
        await this.page.goto(url, { waitUntil: 'networkidle0' });
        this.log('Navigated to setup page.');
    }

    async handleAdminLogin() {
        this.log('Checking for admin login...');
        const password = await this.credentialManager.getAdminPassword();
        
        const passwordField = await this.page.$('input[name="adminPassword"]');
        if (passwordField) {
            if (password) {
                this.log('Admin password field found. Logging in...');
                await passwordField.type(password);
                await this.page.click('button[name="join"]');
                await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
                this.log('Login submitted.');
            } else {
                this.log('Admin password field found, but no password configured. Attempting to proceed without password.');
                // Try to click the join button even if no password is entered
                const joinButton = await this.page.$('button[name="join"]');
                if (joinButton) {
                    await joinButton.click();
                    await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
                    this.log('Proceeded without password.');
                } else {
                    this.log('No join button found after admin password field.');
                }
            }
        } else {
            this.log('No admin password field found.');
            if (!password) {
                this.log('No admin password configured, trying to join without password...');
                // Try to join without password by clicking a generic submit button
                // Take a screenshot before trying to click any buttons for debugging
                await this.page.screenshot({ path: 'debug-setup-page.png' });

                // Try to join without password by clicking a generic submit/continue button
                let joinButton = await this.page.$('button[type="submit"], input[type="submit"], button[name="join"], button.default');

                if (!joinButton) {
                    // If direct selectors don't work, try finding by text content using page.evaluate
                    const buttonHandle = await this.page.evaluateHandle(() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        return buttons.find(button => 
                            button.textContent.includes('Continue') || 
                            button.textContent.includes('Setup') || 
                            button.textContent.includes('Enter Setup')
                        );
                    });
                    if (buttonHandle && buttonHandle.asElement()) {
                        joinButton = buttonHandle.asElement();
                    }
                }

                if (joinButton) {
                    await joinButton.click();
                    await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
                    this.log('Proceeded without password.');
                } else {
                    this.log('No generic join/submit/continue button found. Taking screenshot for debugging.');
                    await this.page.screenshot({ path: 'debug-setup-page-no-button.png' });
                }
            }
        }
    }

    async closeDialogs() {
        this.log('Checking for and closing dialogs...');
        
        // Wait for a moment to let popups appear
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Close the tour if it appears
        const tourNextButton = await this.page.$('button[data-action="next"]');
        if (tourNextButton) {
            this.log('Closing tour dialog by clicking through it...');
            await this.page.click('button[data-action="next"]');
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.page.click('button[data-action="next"]');
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.page.click('button[data-action="close"]');
            this.log('Tour closed.');
        }
        
        // Close resolution warning
        const resolutionWarning = await this.page.$('a.close[data-action="dismiss"]');
        if(resolutionWarning) {
            this.log('Closing resolution warning...');
            await resolutionWarning.click();
        }
    }

    async activate(worldId) {
        if (!this.browser) {
            await this.initialize();
        }

        try {
            await this.navigateToSetup();
            await this.handleAdminLogin();
            await this.closeDialogs();

            this.log(`Attempting to activate world: ${worldId}`);
            
            // Ensure the worlds list section is loaded
            this.log('Waiting for worlds list to be visible...');
            await this.page.waitForSelector('section#worlds', { timeout: 30000 }); // Increased timeout for initial load
            this.log('Worlds list section is visible.');

            // Take a screenshot of the worlds list page for debugging
            await this.page.screenshot({ path: 'debug-world-discovery.png' });
            this.log('Screenshot of worlds list saved to debug-world-discovery.png');

            this.log('Searching for world elements on the page...');
            const worldElements = await this.page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('section#worlds .world-entry, section#worlds [data-package-id], section#worlds [data-world-id]'));
                return elements.map(el => ({
                    id: el.id,
                    className: el.className,
                    textContent: el.textContent.trim(),
                    dataset: el.dataset ? Object.fromEntries(Object.entries(el.dataset)) : {}
                }));
            });

            if (worldElements.length === 0) {
                this.log('No world elements found using common selectors.');
                throw new Error('No world elements found on the page.');
            }

            this.log(`Found ${worldElements.length} potential world elements:`);
            worldElements.forEach((el, index) => {
                this.log(`  [${index}] ID: ${el.id}, Class: ${el.className}, Text: "${el.textContent}", Dataset: ${JSON.stringify(el.dataset)}`);
            });

            let foundWorldElement = null;
            let worldSelectorUsed = null;

            // Try by data-package-id
            this.log(`Attempting to find world by data-package-id: ${worldId}`);
            foundWorldElement = await this.page.$(`[data-package-id="${worldId}"]`);
            if (foundWorldElement) {
                worldSelectorUsed = `[data-package-id="${worldId}"]`;
            }

            // Try by data-world-id if not found
            if (!foundWorldElement) {
                this.log(`Attempting to find world by data-world-id: ${worldId}`);
                foundWorldElement = await this.page.$(`[data-world-id="${worldId}"]`);
                if (foundWorldElement) {
                    worldSelectorUsed = `[data-world-id="${worldId}"]`;
                }
            }

            // Try by .world-entry and text content if not found
            if (!foundWorldElement) {
                this.log(`Attempting to find world by .world-entry and title text: ${worldId}`);
                const worldHandle = await this.page.evaluateHandle((id) => {
                    const entries = Array.from(document.querySelectorAll('.world-entry'));
                    return entries.find(entry => entry.textContent.includes(id));
                }, worldId);

                if (worldHandle && worldHandle.asElement()) {
                    foundWorldElement = worldHandle.asElement();
                    worldSelectorUsed = `.world-entry (text match: ${worldId})`;
                }
            }

            if (!foundWorldElement) {
                throw new Error(`World with ID "${worldId}" not found using any selector.`);
            }

            this.log(`World found using selector: ${worldSelectorUsed}`);
            await foundWorldElement.click();

            this.log('Waiting for world to launch...');
            await new Promise(resolve => setTimeout(resolve, 5000)); // Add a 5 second delay

            this.log(`World ${worldId} activated successfully.`);
            return true;
        } catch (error) {
            console.error(`[WorldActivator] Activation failed: ${error.message}`);
            await this.page.screenshot({ path: 'world-activation-failed.png' });
            this.log('Failure screenshot saved to world-activation-failed.png');
            return false;
        }
    }

    async cleanup() {
        if (this.browser) {
            this.log('Closing browser.');
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}