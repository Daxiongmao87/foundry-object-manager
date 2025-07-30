#!/usr/bin/env node

import { spawn } from 'child_process';

function runTest(description, args, expectSuccess = true) {
    return new Promise((resolve) => {
        console.log(`\n${description}`);
        console.log(`Command: node foundry-manager.mjs ${args.join(' ')}`);
        
        const proc = spawn('node', ['foundry-manager.mjs', ...args], { 
            cwd: process.cwd(),
            stdio: ['inherit', 'pipe', 'pipe'] 
        });
        
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data) => {
            stdout += data.toString();
            process.stdout.write(data);
        });
        
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
            process.stderr.write(data);
        });
        
        proc.on('close', (code) => {
            const success = expectSuccess ? code === 0 : code !== 0;
            console.log(`\nResult: ${success ? '✓ PASS' : '✗ FAIL'} (exit code: ${code})`);
            console.log('---'.repeat(30));
            resolve({ success, stdout, stderr, code });
        });
    });
}

async function runAllTests() {
    console.log('Testing Image Validation Requirements');
    console.log('==='.repeat(30));
    
    const tests = [
        {
            description: "Test 1: No image field - should fail",
            args: ['-s', 'dnd5e', '-t', 'actor', '{"name":"Test Actor","type":"npc"}'],
            expectSuccess: false
        },
        {
            description: "Test 2: Empty image string - should fail (defaults to mystery-man)",
            args: ['-s', 'dnd5e', '-t', 'actor', '{"name":"Test Actor","type":"npc","img":""}'],
            expectSuccess: false
        },
        {
            description: "Test 3: Valid custom image - should pass",
            args: ['-s', 'dnd5e', '-t', 'actor', '{"name":"Test Actor","type":"npc","img":"images/my-actor.png"}'],
            expectSuccess: true
        },
        {
            description: "Test 4: No image with --no-image flag - should pass",
            args: ['-s', 'dnd5e', '-t', 'actor', '--no-image', '{"name":"Test Actor","type":"npc"}'],
            expectSuccess: true
        },
        {
            description: "Test 5: Empty image with --no-image flag - should pass",
            args: ['-s', 'dnd5e', '-t', 'actor', '--no-image', '{"name":"Test Actor","type":"npc","img":""}'],
            expectSuccess: true
        },
        {
            description: "Test 6: Item without image - should fail",
            args: ['-s', 'dnd5e', '-t', 'item', '{"name":"Test Sword","type":"weapon"}'],
            expectSuccess: false
        },
        {
            description: "Test 7: Item with image - should pass",
            args: ['-s', 'dnd5e', '-t', 'item', '{"name":"Test Sword","type":"weapon","img":"icons/weapons/sword.png"}'],
            expectSuccess: true
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        const result = await runTest(test.description, test.args, test.expectSuccess);
        if (result.success) {
            passed++;
        } else {
            failed++;
        }
    }
    
    console.log('\n\nSummary:');
    console.log(`Total tests: ${tests.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed === 0) {
        console.log('\n✓ All tests passed!');
    } else {
        console.log(`\n✗ ${failed} test(s) failed!`);
        process.exit(1);
    }
}

runAllTests().catch(console.error);