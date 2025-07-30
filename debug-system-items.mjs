#!/usr/bin/env node

/**
 * Debug script to read items from DND5e system pack
 */

import { ClassicLevel } from 'classic-level';
import { join } from 'path';

const dbPath = '/home/patrick/.local/share/FoundryVTT/Data/systems/dnd5e/packs/items';

async function readSystemItems() {
    console.log(`Opening system items database at: ${dbPath}`);
    
    const db = new ClassicLevel(dbPath, { valueEncoding: 'json' });
    
    try {
        await db.open();
        console.log('Database opened successfully');
        
        let count = 0;
        const items = [];
        
        for await (const [key, value] of db.iterator()) {
            items.push({ key, value });
            count++;
            if (count >= 5) break; // Just get first 5 items
        }
        
        console.log(`\nFound ${count} items:`);
        
        for (const { key, value } of items) {
            console.log(`\nKey: ${key}`);
            console.log(`Name: ${value.name}`);
            console.log(`Type: ${value.type}`);
            console.log(`System data keys:`, Object.keys(value.system || {}));
            
            // Look for weapon specifically
            if (value.type === 'weapon') {
                console.log(`\n=== WEAPON FOUND: ${value.name} ===`);
                console.log('Full data structure:');
                console.log(JSON.stringify(value, null, 2));
                break;
            }
        }
        
        await db.close();
        console.log('\nDatabase closed');
        
    } catch (error) {
        console.error('Error reading database:', error);
        try {
            await db.close();
        } catch (closeError) {
            console.error('Error closing database:', closeError);
        }
    }
}

readSystemItems().catch(console.error);
