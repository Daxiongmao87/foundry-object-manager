# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a FoundryVTT Object Validator project designed to validate JSON objects against FoundryVTT system schemas. The project includes a complete FoundryVTT v12.331 installation in the `foundry/` directory and aims to create a command-line validation tool.

## FoundryVTT Data Validation Architecture

FoundryVTT uses a sophisticated DataModel-based validation system rather than traditional JSON schema files:

- **DataModel System**: Located in `foundry/resources/app/common/abstract/data.mjs` and `foundry/resources/app/common/data/fields.mjs`
- **Document Types**: Core document classes in `foundry/resources/app/common/documents/`
- **Validation Fields**: Various field types (BooleanField, NumberField, StringField, etc.) in `foundry/resources/app/common/data/fields.mjs`
- **System Data**: Systems define their own TypeDataModel classes for custom validation

## Key FoundryVTT Directories

- `foundry/resources/app/` - Main application code
- `foundry/resources/app/common/data/` - Core data models and validation
- `foundry/resources/app/common/documents/` - Document type definitions
- `foundry/resources/app/client/data/` - Client-side data handling
- Data folder (external): Typically `~/.local/share/FoundryVTT/` on Linux

## Development Architecture

The validator tool needs to:

1. **Parse FoundryVTT systems**: Read system manifests and TypeDataModel definitions
2. **Extract validation rules**: Convert DataModel field definitions to validation logic
3. **Validate JSON objects**: Apply validation rules to input JSON
4. **Report errors**: Provide detailed validation failure information

## Command Structure

Target command format: `./script.py -s '<system_name>' -t '<object_type>' '<json_string>'`

- `-s`: System name (e.g., 'dnd5e', 'pf2e')
- `-t`: Object type (e.g., 'actor', 'item', 'weapon', 'spell')
- `-l`: List available systems or object types within a system

## Critical Implementation Notes

- FoundryVTT doesn't use JSON schema files - validation is code-based
- Systems define custom data models extending base document types
- Field validation includes type checking, required fields, min/max values, regex patterns
- Import Data functionality uses the same validation system
- System manifest files (`system.json`) define supported document types

## Technology Stack

- **FoundryVTT**: Node.js application (v18+)
- **Data Models**: ES6 modules with field-based validation
- **Document Types**: Actor, Item, Scene, etc. with extensible schemas
- **Systems**: Third-party extensions with custom TypeDataModel classes