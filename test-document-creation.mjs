#!/usr/bin/env node

import FoundryEnvironment from './foundry-environment.mjs';
import { join } from 'path';

async function testDocumentCreation() {
    console.log('Testing FoundryVTT document creation...');
    
    const foundryEnv = new FoundryEnvironment();
    await foundryEnv.initialize();
    
    const documentPath = join(foundryEnv.resourcesPath, 'common', 'documents', 'item.mjs');
    
    try {
        const DocumentClass = await import(`file://${documentPath}`);
        const BaseItem = DocumentClass.default;
        
        // Test creating a document with proper FoundryVTT data
        const minimalData = {
            name: "Test Item",
            type: "base",
            _stats: {
                coreVersion: "12.331"
            }
        };
        
        console.log('Creating document with minimal data:', minimalData);
        
        const doc = new BaseItem(minimalData, {});
        console.log('Document created successfully');
        console.log('Document data:', JSON.stringify(doc.toObject(), null, 2));
        
    } catch (error) {
        console.error('Document creation failed:', error);
    }
}

testDocumentCreation().catch(console.error);