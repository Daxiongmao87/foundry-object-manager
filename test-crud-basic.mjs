#!/usr/bin/env node

/**
 * Basic CRUD functionality test
 * Tests WorldManager operations without full server initialization timeout issues
 */

import { FoundryManager } from './foundry-manager.mjs';

async function testCRUDBasic() {
    console.log('🧪 Testing Basic CRUD Operations...\n');
    
    const manager = new FoundryManager({ verbose: true });
    
    try {
        console.log('1️⃣ Starting server and activating world...');
        
        // Start server (but expect timeout on validator)
        await manager.serverManager.startServer();
        console.log('✅ Server started');
        
        // Try to activate world (may timeout)
        try {
            await manager.serverManager.activateWorld('testania');
            console.log('✅ World activated');
        } catch (error) {
            console.log(`⚠️  World activation issue: ${error.message}`);
        }
        
        console.log('\n2️⃣ Checking manager state...');
        console.log(`   Server state: ${manager.serverManager.state}`);
        console.log(`   Has validator: ${!!manager.validator}`);
        console.log(`   Has worldManager: ${!!manager.worldManager}`);
        
        if (!manager.worldManager) {
            console.log('❌ WorldManager not initialized - this is the blocking issue');
            console.log('   The validator timeout prevents WorldManager creation');
            console.log('   CRUD operations require working validator initialization');
        } else {
            console.log('✅ WorldManager available - testing CRUD');
            
            // Test basic search
            const results = await manager.worldManager.search('character');
            console.log(`✅ Search completed: ${results.length} characters found`);
        }
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
    } finally {
        await manager.cleanup();
    }
}

testCRUDBasic().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});