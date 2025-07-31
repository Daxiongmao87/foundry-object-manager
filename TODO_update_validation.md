# TODO: Fix Update Operation Validation

## Problem Statement
Currently, the update operation in `foundry-manager.mjs` performs validation on the merged document data but then ignores the validated result, passing the raw update data to `worldManager.updateDocument()`. This allows invalid data structures (like root-level activities) to be written to the database without proper validation.

## Current Issues
1. **Validation is performed but ignored**: Line 866 validates the merged data, but line 883 passes raw `updateData`
2. **No validation in WorldManager**: The `updateDocument` method directly writes to the database without validation
3. **Allows invalid structures**: This bypasses FoundryVTT's validation rules

## Proposed Solution

### Step 1: Check for Native FoundryVTT Update Validation
- Research if FoundryVTT has a native `Document.update()` or `Document.updateData()` method
- Check if there's a validation-only mode for updates in the FoundryVTT API
- Look in `foundry-app/resources/app/common/abstract/document.mjs` for update methods

### Step 2: Implement Validation Pipeline (if no native support)

#### 2.1 Validation Flow
```javascript
async performUpdate(args) {
    // ... existing code ...
    
    // 1. Retrieve original document (✓ already implemented)
    const getResult = await this.worldManager.getDocument(world, documentType, targetDocumentId);
    
    // 2. Merge update data with original (✓ already implemented)
    const mergedData = this.worldManager.mergeDocumentData(existingDocument, updateData);
    
    // 3. Validate merged document (✓ already implemented but result ignored)
    const validatedData = await this.createFoundryDocument(mergedData, documentType, {
        systemId: system,
        systemVersion: systemInfo.version,
        userId: gmUserId,
        noImage: noImage
    });
    
    // 4. Extract only the changed fields from validated data
    const validatedUpdateData = extractChangedFields(updateData, validatedData);
    
    // 5. Pass VALIDATED update data to worldManager
    const updateResult = await this.worldManager.updateDocument(
        world, 
        documentType, 
        targetDocumentId, 
        validatedUpdateData,  // <-- Use validated data, not raw updateData
        options
    );
}
```

#### 2.2 Helper Function Needed
```javascript
/**
 * Extract only the fields that were requested to be updated, but with validated values
 * This ensures we don't overwrite fields that weren't in the original update request
 */
function extractChangedFields(originalUpdate, validatedDocument) {
    // Implementation needed
}
```

### Step 3: Alternative Approach - Full Document Replacement
If field extraction proves complex:
1. Use the fully validated merged document
2. Replace the entire document in the database
3. This ensures data integrity but may have side effects on fields not intended to be updated

### Step 4: Update WorldManager (Optional)
Consider adding validation to `WorldManager.updateDocument()`:
```javascript
async updateDocument(worldId, documentType, documentId, updateData, options = {}) {
    // Option 1: Add validation parameter
    if (options.skipValidation !== true) {
        // Validate here
    }
    
    // Option 2: Expect pre-validated data (current approach)
    // Document in method comments that data must be pre-validated
}
```

## Implementation Tasks

- [x] Research FoundryVTT's native update validation capabilities
- [x] Implement `extractChangedFields` helper function
- [x] Update `performUpdate` to use validated data
- [x] Add comprehensive tests for update validation
- [x] Test edge cases:
  - [x] Partial updates (only some fields)
  - [x] Nested object updates (e.g., `system.activities`)
  - [x] Array field updates
  - [x] Invalid data rejection
- [x] Update documentation to clarify validation requirements

## Implementation Complete

The update validation fix has been successfully implemented and tested:

### Changes Made:
1. **Added `extractChangedFields` static method**: Extracts only the fields that were requested to be updated, but with validated values
2. **Updated `performUpdate` method**: Now validates the merged document and uses only validated update data
3. **Fixed the validation bypass**: Previously, validation was performed but the result was ignored

### Testing Results:
- ✅ **Invalid structures rejected**: Root-level activities are no longer written to the database
- ✅ **Valid updates succeed**: Name changes and nested field updates work correctly  
- ✅ **Field isolation works**: Only requested fields are updated, preventing unintended overwrites
- ✅ **Validation errors caught**: Invalid data types and structures are properly rejected

### Before vs After:
- **Before**: Line 883 passed raw `updateData` to `worldManager.updateDocument()`
- **After**: Line 940 passes `validatedUpdateData` extracted from the validated document

## Code Locations
- **Main update logic**: `foundry-manager.mjs` lines 752-920 (performUpdate method)
- **Validation call**: Line 866 (currently creates validatedData but doesn't use it)
- **Problem line**: Line 883 (passes raw updateData instead of validatedData)
- **WorldManager update**: `world-manager.mjs` lines 413-462 (updateDocument method)

## Testing Strategy
1. Create test weapon without activities
2. Attempt to add invalid activities at root level (should fail)
3. Attempt to add valid activities in system object (should succeed)
4. Verify partial updates don't overwrite unrelated fields
5. Test with various document types (Actor, Item, Scene, etc.)

## Success Criteria
- [ ] Invalid updates are rejected with clear error messages
- [ ] Valid updates pass through successfully
- [ ] Only requested fields are updated (no unintended side effects)
- [ ] All existing functionality remains intact
- [ ] Performance impact is minimal

## Notes
- Consider caching schemas for performance if validation adds significant overhead
- May need different validation strategies for different document types
- Ensure backward compatibility with existing update operations