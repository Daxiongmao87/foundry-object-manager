#!/usr/bin/env node

/**
 * Start a persistent headless FoundryVTT server
 */

import { FoundryServerManagerPatched as FoundryServerManager } from './foundry-server-manager-patched.mjs';

async function startPersistentServer() {
    const serverManager = new FoundryServerManager();
    
    console.log('🚀 Starting persistent FoundryVTT server...');
    
    try {
        // Start server
        await serverManager.startServer();
        console.log(`✅ FoundryVTT server running at: ${serverManager.getServerUrl()}`);
        console.log('📋 Available worlds can be viewed at: http://localhost:30000/setup');
        console.log('\n📝 Server will run until you press Ctrl+C');
        
        // Keep process alive
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down server...');
            await serverManager.cleanup();
            process.exit(0);
        });
        
        // Keep the process running
        setInterval(() => {
            // Just keep alive
        }, 1000);
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        await serverManager.cleanup();
        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    startPersistentServer();
}