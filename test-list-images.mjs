#!/usr/bin/env node

// Test using a system-provided image
console.log("Testing with D&D 5e system icon...\n");

const actorData = {
    name: "Test Character",
    type: "character",
    img: "systems/dnd5e/icons/classes/barbarian.webp"
};

import { spawn } from 'child_process';

const proc = spawn('node', [
    'foundry-manager.mjs',
    '-s', 'dnd5e',
    '-t', 'actor',
    JSON.stringify(actorData)
]);

proc.stdout.on('data', (data) => {
    process.stdout.write(data);
});

proc.stderr.on('data', (data) => {
    process.stderr.write(data);
});

proc.on('close', (code) => {
    console.log(`\nExit code: ${code}`);
    if (code === 0) {
        console.log('✓ Successfully validated actor with system image!');
    } else {
        console.log('✗ Validation failed');
    }
});