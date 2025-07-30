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