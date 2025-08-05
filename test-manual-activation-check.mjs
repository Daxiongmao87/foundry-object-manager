#!/usr/bin/env node

/**
 * Quick test to verify manual activation detection works
 */

import { FoundryServerManagerPatched as FoundryServerManager } from './foundry-server-manager-patched.mjs';

async function testManualActivationCheck() {
    console.log('🔍 Testing manual activation check...\n');
    
    const serverManager = new FoundryServerManager();
    
    try {
        // Start server
        console.log('Starting FoundryVTT server...');
        await serverManager.startServer();
        
        // Check status
        console.log('\nChecking server status...');
        const status = await serverManager.getServerStatus();
        
        console.log('\nServer Status:');
        console.log(`  Active: ${status.active}`);
        console.log(`  World: ${status.world || 'None'}`);
        console.log(`  System: ${status.system || 'None'}`);
        console.log(`  Version: ${status.version || 'Unknown'}`);
        
        if (!status.active || !status.world) {
            console.log('\n⚠️  No world is currently active.');
            console.log('Please activate a world manually through the UI at http://localhost:30000');
        } else {
            console.log('\n✅ World is active and ready for use!');
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    } finally {
        console.log('\nCleaning up...');
        await serverManager.cleanup();
    }
}

testManualActivationCheck().catch(console.error);