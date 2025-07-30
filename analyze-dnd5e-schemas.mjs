#!/usr/bin/env node

/**
 * Analyze D&D 5e system schemas to understand extraction possibilities
 */

import { readFileSync } from 'fs';
import { join } from 'path';

async function analyzeSchemas() {
    console.log('=== D&D 5e Data Model Schema Analysis Report ===\n');
    
    const systemPath = join('foundry-data', 'systems', 'dnd5e', 'dnd5e.mjs');
    const systemCode = readFileSync(systemPath, 'utf8');
    
    // 1. Find all defineSchema methods
    const schemaMatches = systemCode.matchAll(/class\s+(\w+)\s+extends[^{]+\{[^}]*static\s+defineSchema\(\)/g);
    const schemaClasses = [];
    
    for (const match of schemaMatches) {
        schemaClasses.push(match[1]);
    }
    
    console.log(`1. Found ${schemaClasses.length} classes with defineSchema methods:\n`);
    schemaClasses.forEach(cls => console.log(`   - ${cls}`));
    
    // 2. Analyze field type patterns
    console.log('\n2. Field Type Patterns:\n');
    
    // The system uses minified field names like StringField$b, NumberField$5, etc.
    const fieldPatterns = {
        'StringField\\$[0-9a-zA-Z]+': 'StringField (minified)',
        'NumberField\\$[0-9a-zA-Z]+': 'NumberField (minified)',
        'BooleanField\\$[0-9a-zA-Z]+': 'BooleanField (minified)',
        'SchemaField\\$[0-9a-zA-Z]+': 'SchemaField (minified)',
        'SetField\\$[0-9a-zA-Z]+': 'SetField (minified)',
        'ArrayField\\$[0-9a-zA-Z]+': 'ArrayField (minified)',
        'HTMLField\\$[0-9a-zA-Z]+': 'HTMLField (minified)'
    };
    
    for (const [pattern, description] of Object.entries(fieldPatterns)) {
        const regex = new RegExp(pattern, 'g');
        const matches = systemCode.match(regex) || [];
        const unique = [...new Set(matches)];
        console.log(`   ${description}: ${unique.length} variants found`);
        if (unique.length <= 3) {
            console.log(`     Examples: ${unique.join(', ')}`);
        }
    }
    
    // 3. Extract sample schema structure
    console.log('\n3. Sample Schema Structures:\n');
    
    // Extract WeaponData schema
    const weaponSchemaMatch = systemCode.match(/class WeaponData[\s\S]*?static defineSchema\(\) \{[\s\S]*?return[\s\S]*?\{([\s\S]*?)\}\s*;[\s\S]*?\}/);
    if (weaponSchemaMatch) {
        console.log('   WeaponData Schema Structure:');
        const schemaBody = weaponSchemaMatch[1];
        // Extract field definitions
        const fieldDefs = schemaBody.match(/(\w+):\s*new\s+\w+\$[0-9a-zA-Z]+/g) || [];
        fieldDefs.forEach(field => {
            console.log(`     - ${field}`);
        });
    }
    
    // 4. Analyze schema inheritance
    console.log('\n4. Schema Inheritance Patterns:\n');
    
    const inheritancePatterns = systemCode.matchAll(/class\s+(\w+)\s+extends\s+([^{]+?)\s*\{/g);
    const inheritance = {};
    
    for (const match of inheritancePatterns) {
        const [, className, extendsClause] = match;
        if (schemaClasses.includes(className)) {
            inheritance[className] = extendsClause.trim();
        }
    }
    
    console.log('   Classes with complex inheritance:');
    for (const [cls, extends_] of Object.entries(inheritance)) {
        if (extends_.includes('mixin')) {
            console.log(`     - ${cls}: ${extends_}`);
        }
    }
    
    // 5. Extraction challenges
    console.log('\n5. Schema Extraction Challenges:\n');
    console.log('   a) Minified field names - Field constructors are minified (e.g., StringField$b)');
    console.log('   b) Complex inheritance - Many classes use mixins and multiple inheritance');
    console.log('   c) Dynamic references - Some schemas reference other classes dynamically');
    console.log('   d) Custom field types - System defines custom fields like DamageField, FormulaField');
    console.log('   e) Runtime dependencies - Schema definitions may depend on runtime state');
    
    // 6. Possible extraction approaches
    console.log('\n6. Possible Extraction Approaches:\n');
    console.log('   a) Static Analysis (Current Approach):');
    console.log('      - Parse defineSchema methods using regex/AST');
    console.log('      - Map minified names to actual field types');
    console.log('      - Build schema structure from parsed code');
    console.log('      - Challenges: Minification, dynamic references\n');
    
    console.log('   b) Runtime Extraction (Recommended):');
    console.log('      - Load system module in controlled environment');
    console.log('      - Mock all required browser/client APIs');
    console.log('      - Access schema via DataModel.defineSchema()');
    console.log('      - Benefits: Gets actual schema objects\n');
    
    console.log('   c) Hybrid Approach:');
    console.log('      - Use static analysis to identify classes');
    console.log('      - Create minimal mocks for just schema extraction');
    console.log('      - Execute only defineSchema methods in isolation');
    console.log('      - Less complex than full system loading\n');
    
    // 7. Recommendations
    console.log('7. Recommendations:\n');
    console.log('   Given the project requirements to use FoundryVTT\'s actual validation:');
    console.log('   - Continue efforts to load the actual system module');
    console.log('   - Focus on mocking only the specific APIs the system needs');
    console.log('   - Consider extracting and running just the DataModel classes');
    console.log('   - Avoid any static schema reconstruction (violates requirements)');
}

analyzeSchemas().catch(console.error);