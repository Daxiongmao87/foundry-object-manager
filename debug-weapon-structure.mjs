#!/usr/bin/env node

import { ClassicLevel } from 'classic-level';

const dbPath = '/home/patrick/.local/share/FoundryVTT/Data/systems/dnd5e/packs/items';
const db = new ClassicLevel(dbPath, { valueEncoding: 'json' });

await db.open();
let weaponFound = false;

for await (const [key, value] of db.iterator()) {
    if (!key.startsWith('!folders!') && value.type === 'weapon') {
        console.log('=== WEAPON FOUND ===');
        console.log('Name:', value.name);
        console.log('Full weapon data:');
        console.log(JSON.stringify(value, null, 2));
        weaponFound = true;
        break;
    }
}

if (!weaponFound) {
    console.log('No weapons found, looking for any item...');
    for await (const [key, value] of db.iterator()) {
        if (!key.startsWith('!folders!')) {
            console.log('=== ITEM FOUND ===');
            console.log('Name:', value.name);
            console.log('Type:', value.type);
            break;
        }
    }
}

await db.close();