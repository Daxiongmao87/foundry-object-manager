#!/usr/bin/env node

import { FoundryManager } from './foundry-manager.mjs';

async function testWorldDiscovery() {
    console.log('🧪 Final Test: World Discovery Fix');
    
    const manager = new FoundryManager();
    
    try {
        console.log('Testing world discovery...');
        const worlds = await manager.listWorlds();
        console.log(`✅ SUCCESS: Found ${worlds.length} worlds:`, worlds);
        
        await manager.cleanup();
        
        if (worlds.length > 0) {
            console.log('✅ WORLD DISCOVERY FIX IS WORKING');
            process.exit(0);
        } else {
            console.log('❌ NO WORLDS FOUND');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        await manager.cleanup();
        process.exit(1);
    }
}

testWorldDiscovery();