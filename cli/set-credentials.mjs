#!/usr/bin/env node

import CredentialManager from '../credential-manager.mjs';
import readline from 'readline/promises';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    try {
        const credManager = new CredentialManager();
        
        // Get current status
        const status = credManager.getStatus();
        console.log('\nCurrent Credential Status:');
        console.log('-------------------------');
        console.log(`Admin Password Set: ${status.hasAdminPassword ? '✅' : '❌'}`);
        console.log(`Last Updated: ${status.lastUpdated || 'Never'}`);
        console.log(`Credential File: ${status.credentialFile}`);
        console.log('-------------------------\n');

        // Prompt for new password
        const password = await rl.question('Enter FoundryVTT Admin Password: ');
        
        if (!password) {
            console.error('❌ Password cannot be empty');
            process.exit(1);
        }

        // Save the password
        await credManager.setAdminPassword(password);
        
        // Show updated status
        const newStatus = credManager.getStatus();
        console.log('\nUpdated Credential Status:');
        console.log('-------------------------');
        console.log(`Admin Password Set: ${newStatus.hasAdminPassword ? '✅' : '❌'}`);
        console.log(`Last Updated: ${newStatus.lastUpdated}`);
        console.log('-------------------------\n');

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();
