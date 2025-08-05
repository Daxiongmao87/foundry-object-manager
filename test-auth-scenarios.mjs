#!/usr/bin/env node

/**
 * Authentication Scenario Tests for FoundryServerManager
 * Tests authentication failure recovery and cleanup scenarios
 */

import { FoundryServerManager } from './foundry-server-manager.mjs';
import CredentialManager from './credential-manager.mjs';

class AuthenticationScenarioTester {
    constructor() {
        this.serverManager = null;
        this.credentialManager = new CredentialManager();
        this.testResults = [];
        this.failedTests = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    async runTest(testName, testFunction) {
        try {
            this.log(`Starting test: ${testName}`);
            await testFunction();
            this.log(`✅ Test passed: ${testName}`, 'success');
            this.testResults.push({ name: testName, status: 'PASS' });
        } catch (error) {
            this.log(`❌ Test failed: ${testName} - ${error.message}`, 'error');
            this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
            this.failedTests.push(testName);
        }
    }

    async setupTestCredentials() {
        // Store test credentials temporarily
        this.originalCredentials = this.credentialManager.getCredentials();
        
        // Set known test credentials
        await this.credentialManager.setAdminPassword('test-admin-pass');
        await this.credentialManager.setWorldPassword('test-world-pass');
        
        this.log('Test credentials configured');
    }

    async restoreOriginalCredentials() {
        // Clear test credentials
        await this.credentialManager.clearCredentials();
        
        // Restore original if they existed
        if (this.originalCredentials.hasAdminPassword) {
            await this.credentialManager.setAdminPassword(this.originalCredentials.adminPassword);
        }
        if (this.originalCredentials.hasWorldPassword) {
            await this.credentialManager.setWorldPassword(this.originalCredentials.worldPassword);
        }
        
        this.log('Original credentials restored');
    }

    async testAuthenticationFailureRecovery() {
        this.serverManager = new FoundryServerManager();
        
        // Initialize browser
        const browserSuccess = await this.serverManager.initializeBrowser();
        if (!browserSuccess) {
            throw new Error('Failed to initialize browser');
        }
        
        // Start server
        await this.serverManager.startServer(worlds[0]);

        // Get available worlds (after server is started)
        const worlds = this.serverManager.getAvailableWorlds();
        if (worlds.length === 0) {
            throw new Error('No worlds available for testing');
        }
        
        // Clear credentials to simulate auth failure
        await this.credentialManager.clearCredentials();
        
        // Try authentication (should fail gracefully)
        const authResult = await this.serverManager.authenticateWithFoundry();
        
        if (authResult) {
            // No auth required - that's OK
            this.log('No authentication required for this world');
        } else {
            // Auth failed as expected
            this.log('Authentication failed gracefully as expected');
            
            // Verify browser is still functional
            if (!this.serverManager.browser || !this.serverManager.page) {
                throw new Error('Browser should still be available after auth failure');
            }
            
            // Verify server is still running
            if (!this.serverManager.isServerRunning()) {
                throw new Error('Server should still be running after auth failure');
            }
        }
        
        // Cleanup should work properly
        await this.serverManager.cleanup();
        
        // Verify everything is cleaned up
        if (this.serverManager.browser || this.serverManager.page) {
            throw new Error('Browser should be closed after cleanup');
        }
        
        if (this.serverManager.isServerRunning()) {
            throw new Error('Server should be stopped after cleanup');
        }
        
        this.log('Authentication failure recovery successful');
    }

    async testCleanupDuringAuthentication() {
        this.serverManager = new FoundryServerManager();
        
        // Initialize browser
        await this.serverManager.initializeBrowser();

        const worlds = this.serverManager.getAvailableWorlds();
        if (worlds.length === 0) {
            throw new Error('No worlds available for testing');
        }
        
        // Start server
        await this.serverManager.startServer(worlds[0]);
        
        // Start authentication but don't wait for it
        const authPromise = this.serverManager.authenticateWithFoundry();
        
        // Immediately start cleanup
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        await this.serverManager.cleanup();
        
        // Wait for auth to complete (or fail)
        try {
            await authPromise;
        } catch (error) {
            // Expected - auth might fail due to cleanup
            this.log('Authentication interrupted by cleanup as expected');
        }
        
        // Verify everything is cleaned up
        if (this.serverManager.browser || this.serverManager.page) {
            throw new Error('Browser should be closed after cleanup');
        }
        
        if (this.serverManager.isServerRunning()) {
            throw new Error('Server should be stopped after cleanup');
        }
        
        this.log('Cleanup during authentication handled properly');
    }

    async testIncorrectCredentialsRecovery() {
        this.serverManager = new FoundryServerManager();
        
        // Initialize browser
        await this.serverManager.initializeBrowser();

        const worlds = this.serverManager.getAvailableWorlds();
        if (worlds.length === 0) {
            throw new Error('No worlds available for testing');
        }
        
        // Set definitely wrong credentials
        await this.credentialManager.setAdminPassword('wrong-admin-password-12345');
        await this.credentialManager.setWorldPassword('wrong-world-password-12345');
        
        // Start server
        await this.serverManager.startServer(worlds[0]);
        
        // Try authentication with wrong credentials
        const authResult = await this.serverManager.authenticateWithFoundry();
        
        if (authResult) {
            // No auth required or credentials somehow worked
            this.log('Authentication succeeded (no auth required or test credentials worked)');
        } else {
            // Auth failed as expected with wrong credentials
            this.log('Authentication with incorrect credentials failed as expected');
            
            // System should still be stable
            if (!this.serverManager.browser || !this.serverManager.page) {
                throw new Error('Browser should still be available after failed auth');
            }
            
            if (!this.serverManager.isServerRunning()) {
                throw new Error('Server should still be running after failed auth');
            }
        }
        
        // Should be able to clean up normally
        await this.serverManager.cleanup();
        
        this.log('Incorrect credentials handled gracefully');
    }

    async testAuthStateConsistency() {
        this.serverManager = new FoundryServerManager();
        
        // Initialize browser
        await this.serverManager.initializeBrowser();

        const worlds = this.serverManager.getAvailableWorlds();
        if (worlds.length === 0) {
            throw new Error('No worlds available for testing');
        }
        
        // Start server
        await this.serverManager.startServer(worlds[0]);
        
        // Check initial state
        if (this.serverManager.authenticated) {
            throw new Error('Should not be authenticated before authenticateWithFoundry()');
        }
        
        // Authenticate
        const authResult = await this.serverManager.authenticateWithFoundry();
        
        // Check state consistency
        if (authResult && !this.serverManager.authenticated) {
            throw new Error('authenticated flag should be true after successful auth');
        }
        
        if (!authResult && this.serverManager.authenticated) {
            throw new Error('authenticated flag should be false after failed auth');
        }
        
        // Close browser and check state reset
        await this.serverManager.closeBrowser();
        
        if (this.serverManager.authenticated || this.serverManager.gameReady) {
            throw new Error('Auth state should be reset after closing browser');
        }
        
        // Full cleanup
        await this.serverManager.cleanup();
        
        this.log('Authentication state consistency verified');
    }

    async testMultipleAuthAttempts() {
        this.serverManager = new FoundryServerManager();
        
        // Initialize browser
        await this.serverManager.initializeBrowser();

        const worlds = this.serverManager.getAvailableWorlds();
        if (worlds.length === 0) {
            throw new Error('No worlds available for testing');
        }
        
        await this.serverManager.startServer(worlds[0]);
        
        // First auth attempt
        const firstAuth = await this.serverManager.authenticateWithFoundry();
        this.log(`First auth attempt: ${firstAuth ? 'success' : 'failed'}`);
        
        // Second auth attempt (should return cached result)
        const secondAuth = await this.serverManager.authenticateWithFoundry();
        
        if (secondAuth !== firstAuth) {
            throw new Error('Second auth attempt should return same result as first');
        }
        
        if (firstAuth) {
            this.log('Multiple auth attempts handled correctly (already authenticated)');
        } else {
            this.log('Multiple auth attempts handled correctly (consistently failed)');
        }
        
        await this.serverManager.cleanup();
    }

    async cleanup() {
        if (this.serverManager) {
            await this.serverManager.cleanup({ force: true, killProcess: true });
            this.serverManager = null;
        }
    }

    async generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('AUTHENTICATION SCENARIO TEST REPORT');
        console.log('='.repeat(60));
        
        console.log('\n📊 TEST RESULTS:');
        this.testResults.forEach((result, index) => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${index + 1}. ${status} ${result.name}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
        const failedTests = this.testResults.filter(r => r.status === 'FAIL').length;
        
        console.log(`\n📈 SUMMARY: ${passedTests} passed, ${failedTests} failed`);
        
        if (failedTests === 0) {
            console.log('🎉 All tests passed! Authentication scenarios handled correctly.');
        } else {
            console.log('\n⚠️  FAILED TESTS:');
            this.failedTests.forEach(test => console.log(`   - ${test}`));
        }
        
        console.log('\n' + '='.repeat(60));
    }

    async run() {
        console.log('🚀 Starting Authentication Scenario Tests...\n');
        
        try {
            // Store original credentials
            await this.setupTestCredentials();
            
            await this.runTest('Authentication Failure Recovery', () => this.testAuthenticationFailureRecovery());
            await this.runTest('Cleanup During Authentication', () => this.testCleanupDuringAuthentication());
            await this.runTest('Incorrect Credentials Recovery', () => this.testIncorrectCredentialsRecovery());
            await this.runTest('Auth State Consistency', () => this.testAuthStateConsistency());
            await this.runTest('Multiple Auth Attempts', () => this.testMultipleAuthAttempts());
            
        } catch (error) {
            this.log(`Unexpected test error: ${error.message}`, 'error');
        } finally {
            await this.cleanup();
            await this.restoreOriginalCredentials();
            await this.generateReport();
        }
    }
}

// Run tests when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new AuthenticationScenarioTester();
    tester.run().catch(console.error);
}

export default AuthenticationScenarioTester;