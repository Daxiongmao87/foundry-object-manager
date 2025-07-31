# Implementation Plan: Auto-Detect World System and Enhanced Error Handling

## Overview
When using `-w` (world parameter), automatically detect the world's system instead of requiring `-s`. Enhance error messages to provide actionable guidance by showing schemas and available object types.

## Current State Analysis

### What Works
- `WorldManager.getWorldInfo(worldId)` already reads `world.json` and returns system info including `system` field
- Error handling shows FoundryVTT validation errors but lacks actionable guidance
- Schema extraction (`--schema`) works correctly using FoundryVTT's actual document system

### Current Problems
1. **Requires `-s` even when `-w` is provided** - user must specify system when world already knows its system
2. **Validation errors aren't helpful** - shows cryptic FoundryVTT errors without guidance on expected structure
3. **Invalid object type errors could be better** - shows available types but could be enhanced with schema access info

## Implementation Plan

### Phase 1: Auto-Detect System from World
**Modify argument validation logic in `foundry-manager.mjs`:**

1. **Update argument validation** in `run()` method:
   - Make `-s` optional when `-w` is provided
   - When `-w` is provided without `-s`, auto-detect system using `worldManager.getWorldInfo(world).system`
   - Only require `-s` for operations without world context (validation-only, schema extraction)

2. **Update operations to use auto-detected system:**
   - `performValidationAndInsertion()` - use detected system
   - `performUpdate()` - use detected system  
   - `performSearch()` - use detected system

### Phase 2: Enhanced Error Handling for Validation Failures
**Enhance error messages in insertion/update operations:**

1. **Identify error types in `createFoundryDocument()` catch block:**
   - Parse FoundryVTT validation errors to distinguish between:
     - Invalid object type errors
     - Field validation errors (missing fields, wrong types, invalid values)

2. **For invalid object type errors:**
   - Auto-detect world system if not already done
   - Show available object types for that system
   - Provide command to list types: `foundry-manager.mjs -s <detected-system> -l`

3. **For field validation errors:**
   - Auto-detect world system if not already done
   - Show the complete expected schema for the object type
   - Provide command to get schema: `foundry-manager.mjs -s <detected-system> -t <object-type> --schema`
   - Format the original FoundryVTT error alongside the schema

### Phase 3: Update Help and Examples
**Update CLI help text and examples:**
- Update examples to show world-only usage: `foundry-manager.mjs -w test-world -t weapon -i '...'`
- Update help text to clarify when `-s` is required vs optional
- Add examples of enhanced error scenarios

## Technical Implementation Details

### Auto-Detection Logic
```javascript
// In run() method - modify argument validation
if (!args.system && args.world) {
    // Auto-detect system from world
    const worldInfo = await this.worldManager.getWorldInfo(args.world);
    args.system = worldInfo.system;
    if (args.verbose) {
        console.log(`Auto-detected system: ${args.system} from world: ${args.world}`);
    }
}
```

### Enhanced Error Handling
```javascript
// In createFoundryDocument() catch block
catch (error) {
    if (worldId && !systemWasProvided) {
        const worldInfo = await this.worldManager.getWorldInfo(worldId);
        const detectedSystem = worldInfo.system;
        
        if (error.message.includes('not found in system')) {
            // Invalid object type - show available types
            return enhancedInvalidTypeError(detectedSystem, objectType);
        } else {
            // Validation errors - show schema
            return enhancedValidationError(detectedSystem, objectType, error);
        }
    }
    throw error;
}
```

## Testing Plan

### Test Cases to Implement
1. **Auto-detection works**: `./foundry-manager.mjs -w new-beginnings -t weapon -i --no-image '{"name":"Test","type":"weapon"}'`
2. **Invalid object type error**: `./foundry-manager.mjs -w new-beginnings -t invalidtype -i --no-image '{"name":"Test","type":"invalidtype"}'`
3. **Validation error with schema**: `./foundry-manager.mjs -w new-beginnings -t weapon -i --no-image '{"name":"Test"}'` (missing type field)
4. **System still required for schema-only**: `./foundry-manager.mjs -s dnd5e -t weapon --schema`
5. **System still required for validation-only**: `./foundry-manager.mjs -s dnd5e -t weapon '{"name":"Test","type":"weapon"}'`

### Success Criteria
- No `-s` needed when `-w` is provided for insert/update/search operations
- Validation errors show both the error AND the expected schema
- Invalid object type errors show available types AND how to get schema
- Schema extraction and validation-only still require `-s`
- All existing functionality continues to work

## Notes
- This leverages existing `getWorldInfo()` functionality - no new world parsing needed
- Uses existing schema extraction functionality - no new schema generation needed  
- Maintains backward compatibility - `-s` parameter still works when provided
- Follows project requirement to use FoundryVTT's actual systems, not hardcoded mappings