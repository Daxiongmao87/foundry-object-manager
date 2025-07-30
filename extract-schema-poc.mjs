#!/usr/bin/env node

/**
 * Proof of concept for extracting D&D 5e schemas dynamically
 */

import { readFileSync } from 'fs';
import { join } from 'path';

async function analyzeMinifiedNames() {
    console.log('=== Analyzing Minified Field Names ===\n');
    
    const systemPath = join('foundry-data', 'systems', 'dnd5e', 'dnd5e.mjs');
    const systemCode = readFileSync(systemPath, 'utf8');
    
    // Extract the minified variable declarations
    console.log('1. Looking for field type imports/declarations...\n');
    
    // Pattern to find const declarations
    const constPattern = /const\s+\{([^}]+)\}\s*=\s*foundry\.(data\.fields|abstract)/g;
    const matches = [...systemCode.matchAll(constPattern)];
    
    for (const match of matches) {
        console.log(`Found imports from foundry.${match[2]}:`);
        const fields = match[1].split(',').map(f => f.trim());
        fields.forEach(field => {
            if (field.includes(':')) {
                const [original, minified] = field.split(':').map(s => s.trim());
                console.log(`  ${original} -> ${minified}`);
            } else {
                console.log(`  ${field}`);
            }
        });
        console.log();
    }
    
    // Look for minified field assignments
    console.log('2. Searching for minified field assignments...\n');
    
    const fieldAssignments = systemCode.matchAll(/const\s+(\w+\$[0-9a-zA-Z]+)\s*=\s*foundry\.([\w.]+);/g);
    const minifiedMap = {};
    
    for (const match of fieldAssignments) {
        const [, minifiedName, foundryPath] = match;
        minifiedMap[minifiedName] = foundryPath;
    }
    
    console.log('Found minified mappings:');
    for (const [minified, original] of Object.entries(minifiedMap).slice(0, 10)) {
        console.log(`  ${minified} = ${original}`);
    }
    
    // Extract a sample schema with minified names resolved
    console.log('\n3. Extracting DamageData schema with resolved names...\n');
    
    const damageSchemaPattern = /class DamageData[\s\S]*?static defineSchema\(\) \{[\s\S]*?return \{([\s\S]*?)\};[\s\S]*?\}/;
    const damageMatch = systemCode.match(damageSchemaPattern);
    
    if (damageMatch) {
        const schemaBody = damageMatch[1];
        console.log('DamageData schema (raw):');
        console.log(schemaBody.trim());
        
        console.log('\n4. Attempting to resolve minified names...\n');
        
        // Extract field definitions
        const fieldPattern = /(\w+):\s*new\s+(\w+\$[0-9a-zA-Z]+)(\([^)]*\))?/g;
        const fields = [...schemaBody.matchAll(fieldPattern)];
        
        console.log('Resolved schema structure:');
        for (const [, fieldName, minifiedType, args] of fields) {
            const resolvedType = minifiedMap[minifiedType] || minifiedType;
            console.log(`  ${fieldName}: new ${resolvedType}${args || '()'}`);
        }
    }
    
    console.log('\n5. Key Findings:\n');
    console.log('- The D&D 5e system is heavily minified');
    console.log('- Field types are imported and assigned to minified variables');
    console.log('- Schemas use these minified variable names');
    console.log('- We can partially map minified names to original types');
    console.log('- Full resolution requires executing the import statements');
    
    console.log('\n6. Extraction Strategy:\n');
    console.log('To properly extract schemas, we need to:');
    console.log('1. Execute the system module to resolve all minified names');
    console.log('2. Access the DataModel classes after they\'re defined');
    console.log('3. Call defineSchema() on each class to get actual schemas');
    console.log('4. This requires mocking the FoundryVTT environment more completely');
}

analyzeMinifiedNames().catch(console.error);