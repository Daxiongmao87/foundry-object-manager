#!/usr/bin/env node

/**
 * Fix world compatibility to allow auto-launch
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const worldPath = path.join(process.env.HOME, '.local/share/FoundryVTT/Data/worlds/test-world/world.json');

console.log('🔧 Fixing world compatibility for auto-launch...\n');

// Read current world.json
const worldData = JSON.parse(readFileSync(worldPath, 'utf8'));
console.log('Current world data:');
console.log(JSON.stringify(worldData, null, 2));

// Update compatibility to match current version exactly
worldData.compatibility = {
    minimum: "12",
    verified: "12.331",  // Match exact FoundryVTT version
    maximum: null
};

// Ensure all required fields are present
worldData.version = worldData.version || "1.0.0";
worldData.availability = 0;  // AVAILABLE
worldData.unavailable = false;

// Write updated world.json
writeFileSync(worldPath, JSON.stringify(worldData, null, 2));

console.log('\n✅ Updated world.json with proper compatibility settings');
console.log('\nNew world data:');
console.log(JSON.stringify(worldData, null, 2));