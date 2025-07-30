#!/usr/bin/env node

import FoundryEnvironment from './foundry-environment.mjs';
import { join } from 'path';

async function testItemImport() {
    console.log('Testing FoundryVTT Item import...');
    
    const foundryEnv = new FoundryEnvironment();
    await foundryEnv.initialize();
    
    const documentPath = join(foundryEnv.resourcesPath, 'common', 'documents', 'item.mjs');
    console.log('Importing from:', documentPath);
    
    try {
        const DocumentClass = await import(`file://${documentPath}`);
        console.log('Import successful');
        
        const BaseDocument = DocumentClass.default;
        console.log('BaseDocument:', BaseDocument);
        
        if (BaseDocument && typeof BaseDocument.defineSchema === 'function') {
            console.log('defineSchema exists, calling it...');
            const schema = BaseDocument.defineSchema();
            console.log('Schema:', Object.keys(schema));
        } else {
            console.log('defineSchema not found or not a function');
        }
        
    } catch (error) {
        console.error('Import failed:', error);
    }
}

testItemImport().catch(console.error);