# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a FoundryVTT Object Validator project designed to validate JSON objects against FoundryVTT system schemas. The project includes a complete FoundryVTT v12.331 installation in the `foundry-files/` directory and aims to create a command-line validation tool.

## CRITICAL IMPLEMENTATION REQUIREMENT

**NEVER CREATE MOCK/FALLBACK SYSTEMS**. This application MUST use FoundryVTT's actual validation and document creation system. Any deviation from this requirement is wrong.

## FoundryVTT Data Validation Architecture

FoundryVTT uses a sophisticated DataModel-based validation system rather than traditional JSON schema files:

- **Use FoundryVTT's Actual Server Code**: Import from `foundry-files/resources/app/common/server.mjs`
- **DataModel System**: Located in `foundry-files/resources/app/common/abstract/data.mjs` and `foundry-files/resources/app/common/data/fields.mjs`
- **Document Types**: Core document classes in `foundry-files/resources/app/common/documents/`
- **Validation Fields**: Various field types (BooleanField, NumberField, StringField, etc.) in `foundry-files/resources/app/common/data/fields.mjs`
- **System Data**: Systems define their own TypeDataModel classes for custom validation

## Required Implementation Approach

1. **Initialize FoundryVTT Environment**: 
   - Import actual FoundryVTT common modules from `foundry-files/resources/app/common/server.mjs`
   - Set up required global objects (`foundry`, `CONFIG`, `game`, `logger`)
   - DO NOT mock these - use the real FoundryVTT code

2. **Use FoundryVTT's Document Classes**:
   - Import actual document classes (e.g., `BaseItem` from `foundry-files/resources/app/common/documents/item.mjs`)
   - Use their `defineSchema()` methods to get real validation schemas
   - Use their constructors to create properly validated documents

3. **No Fallbacks or Mocks**:
   - If FoundryVTT's system doesn't work, the application doesn't work
   - No manual schema creation
   - No hardcoded field structures
   - No fallback validation systems

4. **Real Database Operations**:
   - Use actual LevelDB with `classic-level` package
   - Write to real FoundryVTT world databases
   - No mock database operations

## Key FoundryVTT Directories

- `foundry-files/resources/app/` - Main application code (USE THIS)
- `foundry-files/resources/app/common/data/` - Core data models and validation (USE THIS)
- `foundry-files/resources/app/common/documents/` - Document type definitions (USE THIS)
- `foundry-files/resources/app/common/server.mjs` - Server entry point (IMPORT THIS)
- Data folder (external): `~/.local/share/FoundryVTT/Data` on Linux

## Command Structure

Target command format: `./foundry-manager.mjs -s '<system_name>' -t '<object_type>' '<json_string>'`

- `-s`: System name (e.g., 'dnd5e', 'pf2e')
- `-t`: Object type (e.g., 'actor', 'item', 'weapon', 'spell')
- `-l`: List available systems or object types within a system

## Technology Stack

- **FoundryVTT**: Node.js application (v18+) - USE THE ACTUAL APPLICATION
- **Data Models**: ES6 modules with field-based validation - USE FOUNDRY'S ACTUAL MODELS
- **Document Types**: Actor, Item, Scene, etc. - USE FOUNDRY'S ACTUAL DOCUMENT CLASSES
- **Systems**: Third-party extensions - USE FOUNDRY'S ACTUAL SYSTEM LOADING

## Validation Process

1. Initialize FoundryVTT environment with real modules
2. Load the actual document class (e.g., BaseItem)
3. Use the document's `defineSchema()` to get validation rules
4. Create document instance using FoundryVTT's constructor
5. Let FoundryVTT handle all validation and default value assignment
6. Use the resulting document data for database insertion

**REMEMBER: Use FoundryVTT's actual validation process. No mocks, no fallbacks, no custom implementations.**

## Development Guidelines

- **Stop Creating Mock Classes**: 
  - Stop creating mock/fallback classes for FoundryVTT systems
  - Stop duplicating code
  - Stop ignoring using FoundryVTT source code
  - Doing this is against the fundamental purpose of this project

## D&D 5e System Object Creation Guidelines

When creating or updating items in the D&D 5e system, be aware of these critical structural requirements:

### Weapon Activities
Weapons in D&D 5e v4+ require an `activities` object within the `system` object to function properly. Without this, weapons cannot be rolled for attacks.

**Required Structure:**
```json
{
  "system": {
    "activities": {
      "[RANDOM_16_CHAR_ID]": {
        "_id": "[SAME_RANDOM_16_CHAR_ID]",
        "type": "attack",
        "activation": {
          "type": "action",
          "value": 1,
          "condition": "",
          "override": false
        },
        "consumption": {
          "scaling": { "allowed": false },
          "spellSlot": true,
          "targets": []
        },
        "description": {},
        "duration": {
          "units": "inst",
          "concentration": false,
          "override": false
        },
        "effects": [],
        "range": { "override": false },
        "target": {
          "template": { "contiguous": false, "units": "ft" },
          "affects": { "choice": false },
          "override": false,
          "prompt": true
        },
        "uses": { "spent": 0, "recovery": [] },
        "attack": {
          "critical": { "threshold": null },
          "flat": false,
          "type": {
            "value": "melee",  // or "ranged"
            "classification": "weapon"
          },
          "bonus": ""
        },
        "damage": {
          "critical": { "bonus": "" },
          "includeBase": true,
          "parts": []
        },
        "sort": 0
      }
    }
  }
}
```

### Key Points:
1. **Activities must be inside `system`**: The activities object must be at `system.activities`, not at the root level
2. **Generate proper IDs**: Use `FoundryValidator.generateRandomId()` to create 16-character alphanumeric IDs
3. **Activity ID appears twice**: The ID is both the key and the `_id` property within the activity
4. **Study existing items**: Use the search functionality to examine working items (like Blackrazor) as templates

### Different Data Formats
Be aware that items may use different data formats depending on when they were created:
- **Newer format** (like Blackrazor): Uses structured `type` object, `damage.base` with types array
- **Older format** (like Demon Howl): Uses simple strings for `weaponType`, `damage.parts` array

Both formats can coexist, but activities structure remains consistent.