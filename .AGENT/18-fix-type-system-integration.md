# STORY: Fix Type System Integration

## Description
The type discovery system is disconnected from type usage. While `listTypes()` successfully returns available document types, `getSchema()` and `validateDocument()` fail with "Unknown type" errors when trying to use those same types. This indicates a mapping or resolution issue in the type system.

## Current Problem
- `listTypes()` returns: `Item, Actor, Scene, JournalEntry, Macro, RollTable, Playlist`
- `getSchema('Scene')` fails with: "Unknown type: Scene. Use --list-types to see available types"
- `validateDocument('Scene', data)` fails with same error

## Root Cause Analysis
The issue appears to be in the type resolution logic where:
1. Type discovery works correctly via Puppeteer
2. Type usage fails due to different type mapping or validation logic
3. There may be case sensitivity or format differences between discovery and usage

## Acceptance Criteria
- [ ] `getSchema('Scene')` works after `listTypes()` shows Scene is available
- [ ] `validateDocument('Scene', data)` works with proper type resolution  
- [ ] All document types returned by `listTypes()` are usable in schema operations
- [ ] All document types returned by `listTypes()` are usable in validation operations
- [ ] Type names are consistent between discovery and usage
- [ ] Proper error messages when types are genuinely invalid

## Tasks
1. Investigate the type resolution logic in `getSchema()` and `validateDocument()`
2. Compare type discovery code with type usage code to find discrepancies
3. Fix type mapping/resolution to ensure consistency
4. Test all discovered types work in schema and validation operations
5. Add proper error handling for genuinely invalid types
6. Verify case sensitivity and format matching

## Technical Notes
- Check how types are stored/retrieved in validator vs how they're discovered
- Look for hardcoded type lists vs dynamic discovery
- Ensure Puppeteer context types match validation context types
- May need to update type normalization logic

## Testing
- Test each type returned by `listTypes()` in both `getSchema()` and `validateDocument()`
- Test invalid types still return proper error messages
- Test mixed case and format variations
- Verify error messages guide users correctly