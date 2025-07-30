#!/usr/bin/env node

/**
 * Debug script to examine and compare database entries
 */

import { ClassicLevel } from 'classic-level';
import { join } from 'path';

async function examineDatabase() {
    const worldItemsPath = './foundry-data/worlds/test-world/data/items';
    const worldActorsPath = './foundry-data/worlds/test-world/data/actors';
    
    console.log('=== EXAMINING WORLD ITEMS DATABASE ===');
    await examineDbContents(worldItemsPath, 'Items');
    
    console.log('\n=== EXAMINING WORLD ACTORS DATABASE ===');
    await examineDbContents(worldActorsPath, 'Actors');
}

async function examineDbContents(dbPath, type) {
    console.log(`\nOpening ${type} database at: ${dbPath}`);
    
    const db = new ClassicLevel(dbPath, { valueEncoding: 'json' });
    
    try {
        await db.open();
        console.log('Database opened successfully');
        
        let count = 0;
        const entries = [];
        
        for await (const [key, value] of db.iterator()) {
            entries.push({ key, value });
            count++;
            if (count >= 10) break; // Just get first 10 entries
        }
        
        console.log(`\nFound ${count} ${type.toLowerCase()}:`);
        
        for (const { key, value } of entries) {
            console.log(`\n--- KEY: ${key} ---`);
            console.log(`Name: ${value.name}`);
            console.log(`Type: ${value.type}`);
            console.log(`ID: ${value._id}`);
            
            // Show key structural differences
            console.log(`Has system: ${!!value.system}`);
            console.log(`System keys: ${Object.keys(value.system || {})}`);
            console.log(`Has img: ${!!value.img}`);
            console.log(`Has effects: ${!!value.effects}`);
            console.log(`Has flags: ${!!value.flags}`);
            console.log(`Has folder: ${value.folder !== undefined}`);
            console.log(`Has sort: ${value.sort !== undefined}`);
            console.log(`Has ownership: ${!!value.ownership}`);
            
            // Show _stats structure
            if (value._stats) {
                console.log(`Stats keys: ${Object.keys(value._stats)}`);
                console.log(`Created: ${new Date(value._stats.createdTime)}`);
                console.log(`Modified: ${new Date(value._stats.modifiedTime)}`);
                console.log(`ModifiedBy: ${value._stats.lastModifiedBy}`);
            }
            
            // For staff specifically, show full structure
            if (value.name && value.name.toLowerCase().includes('staff')) {
                console.log(`\n*** STAFF FOUND - FULL STRUCTURE ***`);
                console.log(JSON.stringify(value, null, 2));
            }
            
            // Show one working item's full structure as reference
            if (entries.indexOf({ key, value }) === 0) {
                console.log(`\n*** FIRST ${type} - FULL STRUCTURE ***`);
                console.log(JSON.stringify(value, null, 2));
            }
        }
        
        await db.close();
        console.log(`\n${type} database closed`);
        
    } catch (error) {
        console.error(`Error reading ${type} database:`, error);
        try {
            await db.close();
        } catch (closeError) {
            console.error(`Error closing ${type} database:`, closeError);
        }
    }
}

examineDatabase().catch(console.error);
