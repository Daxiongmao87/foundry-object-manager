#!/usr/bin/env node

import pkg from 'classic-level';
const { ClassicLevel } = pkg;
import { join } from 'path';

async function debugDatabase() {
    const dbPath = '/home/patrick/.local/share/FoundryVTT/Data/worlds/test-world/data/items';
    
    console.log('Opening database at:', dbPath);
    
    const db = new ClassicLevel(dbPath, { valueEncoding: 'json' });
    
    try {
        console.log('Database opened successfully');
        
        // Try to read all keys
        console.log('\nReading all keys:');
        let count = 0;
        
        const iterator = db.iterator();
        try {
            for await (const [key, value] of iterator) {
                console.log(`Key: ${key}`);
                console.log(`Value:`, JSON.stringify(value, null, 2));
                count++;
            }
        } finally {
            await iterator.close();
        }
        
        console.log(`\nTotal documents found: ${count}`);
        
    } catch (error) {
        console.error('Error reading database:', error);
    } finally {
        await db.close();
        console.log('Database closed');
    }
}

debugDatabase().catch(console.error);