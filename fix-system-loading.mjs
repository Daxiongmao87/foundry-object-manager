#!/usr/bin/env node

import FoundryEnvironment from './foundry-environment.mjs';
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

async function fixSystemLoading() {
    const foundryEnv = new FoundryEnvironment();
    await foundryEnv.initialize();
    
    let attempts = 0;
    const maxAttempts = 20;
    const systemPath = join('foundry-data', 'systems', 'dnd5e', 'dnd5e.mjs');
    
    console.log('Iteratively fixing D&D 5e system loading...\n');
    
    while (attempts < maxAttempts) {
        attempts++;
        console.log(`Attempt ${attempts}:`);
        
        try {
            const module = await import(`file://${process.cwd()}/${systemPath}?t=${Date.now()}`);
            console.log('✅ SUCCESS! System loaded successfully!');
            console.log('Module exports:', Object.keys(module).slice(0, 10), '...');
            break;
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            
            // Identify what's missing
            if (error.message.includes('is not defined')) {
                const match = error.message.match(/(\w+) is not defined/);
                if (match) {
                    const missingGlobal = match[1];
                    console.log(`   Adding missing global: ${missingGlobal}`);
                    
                    // Add common missing globals
                    switch (missingGlobal) {
                        case 'DocumentSheet':
                            globalThis.DocumentSheet = class DocumentSheet extends globalThis.FormApplication {};
                            break;
                        case 'TextEditor':
                            globalThis.TextEditor = {
                                enrichHTML: (html) => html,
                                decodeHTML: (html) => html
                            };
                            break;
                        case 'Hooks':
                            globalThis.Hooks = {
                                on: () => {},
                                once: () => {},
                                call: () => {},
                                callAll: () => {}
                            };
                            break;
                        case 'ChatMessage':
                            globalThis.ChatMessage = class ChatMessage {
                                static create() { return Promise.resolve(); }
                            };
                            break;
                        case 'Dialog':
                            globalThis.Dialog = class Dialog {
                                static confirm() { return Promise.resolve(true); }
                                static prompt() { return Promise.resolve(''); }
                            };
                            break;
                        case 'renderTemplate':
                            globalThis.renderTemplate = () => Promise.resolve('<div></div>');
                            break;
                        case 'canvas':
                            globalThis.canvas = {
                                ready: true,
                                scene: null,
                                dimensions: { width: 1000, height: 1000 }
                            };
                            break;
                        case 'ui':
                            globalThis.ui = {
                                notifications: {
                                    info: () => {},
                                    warn: () => {},
                                    error: () => {}
                                }
                            };
                            break;
                        default:
                            console.log(`   Unknown global: ${missingGlobal}, adding empty class`);
                            globalThis[missingGlobal] = class {};
                    }
                }
            } else if (error.message.includes('Cannot read properties')) {
                console.log('   Property access error - may need more complex fix');
                
                // Check for specific property issues
                if (error.message.includes("reading 'ready'") && !globalThis.canvas) {
                    globalThis.canvas = { ready: false };
                }
            }
            
            console.log('');
        }
    }
    
    if (attempts >= maxAttempts) {
        console.log('❌ Failed to load system after maximum attempts');
    }
}

fixSystemLoading().catch(console.error);