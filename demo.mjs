#!/usr/bin/env node

/**
 * FoundryVTT Object Validator - Demonstration Script
 * Shows the validator working with various test cases
 */

import { spawn } from 'child_process';

class ValidatorDemo {
    constructor() {
        this.demos = [
            {
                title: 'List Available Systems',
                description: 'Show what FoundryVTT systems are installed and available for validation',
                command: ['node', 'foundry-validator.mjs', '-l']
            },
            {
                title: 'Validate Valid Actor Object',
                description: 'Validate a properly formatted D&D 5e character actor',
                command: ['node', 'foundry-validator.mjs', '-s', 'dnd5e', '-t', 'actor', JSON.stringify({
                    name: "Thorin Oakenshield",
                    type: "character",
                    img: "characters/thorin.png",
                    system: {
                        attributes: {
                            hp: {
                                value: 45,
                                max: 45
                            }
                        },
                        details: {
                            biography: {
                                value: "<p>A brave dwarf warrior seeking to reclaim his homeland.</p>"
                            }
                        }
                    },
                    items: [],
                    effects: []
                })]
            },
            {
                title: 'Validate Invalid Actor Object (Missing Required Field)',
                description: 'Show validation failure when required "name" field is missing',
                command: ['node', 'foundry-validator.mjs', '-s', 'dnd5e', '-t', 'actor', JSON.stringify({
                    type: "character",
                    system: {
                        attributes: {
                            hp: {
                                value: 25,
                                max: 25
                            }
                        }
                    }
                })]
            },
            {
                title: 'Validate Item Object',
                description: 'Validate a D&D 5e magical weapon item',
                command: ['node', 'foundry-validator.mjs', '-s', 'dnd5e', '-t', 'item', JSON.stringify({
                    name: "Orcrist",
                    type: "weapon",
                    img: "items/orcrist.png",
                    system: {
                        description: {
                            value: "An ancient elven blade that glows blue when orcs are near"
                        },
                        damage: {
                            parts: [["1d8 + @mod", "slashing"]]
                        },
                        properties: {
                            magic: true,
                            finesse: true
                        }
                    }
                })]
            },
            {
                title: 'List Available Worlds',
                description: 'Show what FoundryVTT worlds are available for insertion',
                command: ['node', 'foundry-validator.mjs', '-l', '--listWorlds']
            },
            {
                title: 'Validate and Insert Actor into World',
                description: 'Validate a character and insert it directly into a FoundryVTT world',
                command: ['node', 'foundry-validator.mjs', '-s', 'dnd5e', '-t', 'actor', '-w', 'test-world', '-i', JSON.stringify({
                    name: "Bilbo Baggins",
                    type: "character",
                    img: "characters/bilbo.png",
                    system: {
                        attributes: {
                            hp: {
                                value: 35,
                                max: 35
                            }
                        },
                        details: {
                            biography: {
                                value: "<p>A hobbit who went on an unexpected journey.</p>"
                            }
                        }
                    },
                    items: [],
                    effects: []
                })]
            },
            {
                title: 'Search for Actors in World',
                description: 'Search and retrieve all actor objects from a FoundryVTT world',
                command: ['node', 'foundry-validator.mjs', '-s', 'dnd5e', '-t', 'actor', '-w', 'test-world', '-r']
            },
            {
                title: 'Search with Wildcard Pattern',
                description: 'Search for actors with names matching a wildcard pattern',
                command: ['node', 'foundry-validator.mjs', '-s', 'dnd5e', '-t', 'actor', '-w', 'test-world', '-r', '--name', 'Test*']
            },
            {
                title: 'Search Items with Details and JSON',
                description: 'Search for items with detailed information and JSON output',
                command: ['node', 'foundry-validator.mjs', '-s', 'dnd5e', '-t', 'item', '-w', 'test-world', '-r', '--details', '--json', '300']
            },
            {
                title: 'Show Help Message',
                description: 'Display the complete usage information',
                command: ['node', 'foundry-validator.mjs', '--help']
            }
        ];
    }

    async runCommand(command) {
        return new Promise((resolve, reject) => {
            const child = spawn(command[0], command.slice(1), {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({
                    exitCode: code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                });
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    async runDemo() {
        console.log('🎯 FoundryVTT Object Validator - Live Demonstration');
        console.log('=' .repeat(60));
        console.log('');

        for (let i = 0; i < this.demos.length; i++) {
            const demo = this.demos[i];
            console.log(`Demo ${i + 1}: ${demo.title}`);
            console.log(`📝 ${demo.description}`);
            console.log('');
            console.log(`🔧 Command: ${demo.command.join(' ')}`);
            console.log('');
            console.log('🚀 Output:');
            console.log('-'.repeat(40));

            try {
                const result = await this.runCommand(demo.command);
                
                if (result.stdout) {
                    console.log(result.stdout);
                }
                if (result.stderr) {
                    console.log('Error Output:', result.stderr);
                }
                
                console.log('');
                console.log(`Exit Code: ${result.exitCode} ${result.exitCode === 0 ? '✅' : '❌'}`);
                
            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
            }
            
            console.log('');
            console.log('=' .repeat(60));
            console.log('');
        }

        console.log('🎉 Demonstration Complete!');
        console.log('');
        console.log('📖 Usage Summary:');
        console.log('  • Use -l to list systems or object types');
        console.log('  • Use -l --listWorlds to list available worlds');
        console.log('  • Use -s <system> -t <type> <json> to validate objects');
        console.log('  • Use -s <system> -t <type> -w <world> -i <json> to insert into world');
        console.log('  • Use -s <system> -t <type> -w <world> -r to search world objects');
        console.log('  • Use --name "pattern*" --id "pattern?" for wildcard searches');
        console.log('  • Use --details --json <chars> for detailed output');
        console.log('  • Exit code 0 = success, 1 = validation failure');
        console.log('  • Detailed error messages show exactly what went wrong');
    }
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const demo = new ValidatorDemo();
    demo.runDemo().catch(error => {
        console.error('Demo failed:', error);
        process.exit(1);
    });
}

export default ValidatorDemo;