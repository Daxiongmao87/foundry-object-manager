# EPIC PLAN 3: Complete Feature Restoration and Puppeteer Integration

## Epic Title: Restore Full foundry-object-manager Functionality with Puppeteer Architecture

## Description
After successfully implementing Puppeteer-based authentication and basic validation in EPIC PLAN 2, we need to restore all original CLI features and CRUD operations that were lost during the migration. The original system had comprehensive functionality that must be rebuilt using our new Puppeteer architecture.

## Current State Analysis

### ✅ WORKING FEATURES (Post-Migration)
- **Authentication & Setup**: Fully functional Puppeteer-based authentication
- **World Activation**: Working world discovery and activation via Puppeteer UI
- **Basic Validation**: Object validation working (with proper error reporting)
- **Type Discovery**: `listTypes()` successfully returns available document types

### ❌ BROKEN FEATURES (Need Fixing)
- **Schema Retrieval**: `getSchema()` fails with "Unknown type" despite `listTypes()` working
- **Document Validation**: `validateDocument()` fails with "Unknown type" despite types being discoverable
- **World Listing**: `listWorlds()` returns non-array causing `.join()` errors

### ❌ MISSING FEATURES (Need Implementation)
All CRUD operations were lost during Puppeteer migration:
- **List Objects**: `listObjects(worldId, type)` - List documents via FoundryVTT frontend APIs
- **Search Objects**: `searchObjects(worldId, type, filters)` - Search using FoundryVTT's search capabilities
- **Create Objects**: `createObject(worldId, type, data)` - Create documents via FoundryVTT's document creation APIs
- **Update Objects**: `updateObject(worldId, type, id, data)` - Update documents via FoundryVTT's update APIs
- **Delete Objects**: `deleteObject(worldId, type, id)` - Delete documents via FoundryVTT's delete APIs

## Original Feature Set (Pre-Migration)

### CLI Interface Commands
```bash
# Discovery Operations
foundry-manager.mjs --list-systems           # List available game systems
foundry-manager.mjs --list-worlds            # List available worlds
foundry-manager.mjs --list-types -s dnd5e    # List object types for system
foundry-manager.mjs --list-images            # List available images

# Schema Operations
foundry-manager.mjs -s dnd5e -t character --schema        # Get object schema
foundry-manager.mjs -w my-world -t weapon --schema        # Auto-detect system from world

# Validation Operations
foundry-manager.mjs -s dnd5e -t character '{"name":"Test"}'  # Validate only

# CRUD Operations
foundry-manager.mjs -w world -t character -i '{"name":"Hero"}'           # CREATE
foundry-manager.mjs -w world -t character -r                            # READ (list all)
foundry-manager.mjs -w world -t character -r --name "Hero*"             # SEARCH by name
foundry-manager.mjs -w world -t character -u --id "123" '{"hp":50}'     # UPDATE by ID
foundry-manager.mjs -w world -t character -u --name "Hero" '{"hp":50}'  # UPDATE by name
```

### Core Classes and Methods

#### SystemDiscovery Class (Lost)
- `getAllSystems()` - Get all available game systems
- `getSystemInfo(systemId)` - Get detailed system information
- `getSystemObjectTypes(systemId)` - Get object types for system
- `listSystems()` - Format system list for CLI
- `listSystemObjectTypes(systemId)` - Format object types for CLI
- `validateSystemObjectType(system, type)` - Validate system/type combination

#### WorldManager Class (Lost)
- `getAvailableWorlds()` - Get all available worlds via Puppeteer
- `getWorldInfo(worldId)` - Get world details via FoundryVTT APIs
- `searchDocuments(worldId, type, options)` - Search documents via FoundryVTT's game.collections
- `insertDocument(worldId, type, data)` - Create documents via FoundryVTT's Document.create()
- `updateDocument(worldId, type, id, data)` - Update documents via FoundryVTT's Document.update()
- `getDocument(worldId, type, id)` - Get documents via FoundryVTT's game.collections
- `getAllDocuments(type)` - Get all documents via FoundryVTT's game.collections
- `formatDocumentList(results)` - Format search results for CLI

## Acceptance Criteria

### Phase 1: Fix Broken Features
- [ ] Fix type mapping between `listTypes()` and `getSchema()`/`validateDocument()`
- [ ] Fix `listWorlds()` to return proper array for CLI display
- [ ] Ensure all existing validation features work with Puppeteer context

### Phase 2: Restore SystemDiscovery
- [ ] Implement SystemDiscovery class with Puppeteer integration
- [ ] Restore `--list-systems` command functionality
- [ ] Restore `--list-types -s <system>` command functionality
- [ ] Restore schema extraction with `--schema` flag

### Phase 3: Restore WorldManager CRUD Operations
- [ ] Implement WorldManager class with Puppeteer/FoundryVTT API integration
- [ ] Restore `--list-worlds` with proper world discovery via Puppeteer
- [ ] Restore document search: `-r` flag using FoundryVTT's game.collections APIs
- [ ] Restore document creation: `-i` flag using FoundryVTT's Document.create() APIs
- [ ] Restore document updates: `-u` flag using FoundryVTT's Document.update() APIs
- [ ] Restore proper CLI argument parsing and routing

### Phase 4: Complete CLI Interface
- [ ] Restore full CLI help system and argument parsing
- [ ] Restore all CLI examples and usage patterns
- [ ] Restore image validation and `--list-images` functionality
- [ ] Restore verbose logging and error handling
- [ ] Restore auto-detection of system from world

### Phase 5: Integration and Testing
- [ ] Ensure all CLI commands work with Puppeteer authentication
- [ ] Test complete workflow: discovery → schema → create → update → search
- [ ] Verify FoundryVTT API operations work with active Puppeteer sessions
- [ ] Test error handling and user guidance for invalid operations

## User Stories

### Story 18: Fix Type System Integration
**Description**: Fix the disconnect between type discovery and type usage in schema/validation operations.
**Acceptance Criteria**: 
- `getSchema('Scene')` works after `listTypes()` shows Scene is available
- `validateDocument('Scene', data)` works with proper type resolution
- All document types returned by `listTypes()` are usable in other operations

### Story 19: Restore SystemDiscovery CLI Commands
**Description**: Rebuild SystemDiscovery class and integrate with Puppeteer for system information.
**Acceptance Criteria**:
- `--list-systems` shows all available game systems
- `--list-types -s dnd5e` shows all object types for D&D 5e system
- Schema extraction works with `--schema` flag
- System/type validation prevents invalid combinations

### Story 20: Restore WorldManager CRUD Operations
**Description**: Rebuild WorldManager using FoundryVTT's frontend APIs via Puppeteer for full document CRUD operations.
**Acceptance Criteria**:
- Document search works: `-r` using FoundryVTT's game.collections with filters (name, ID, type, limit)
- Document creation works: `-i` using FoundryVTT's Document.create() with proper validation
- Document updates work: `-u` using FoundryVTT's Document.update() with ID/name targeting
- All operations integrate properly with Puppeteer authentication and leverage FoundryVTT's native APIs

### Story 21: Complete CLI Interface Restoration
**Description**: Restore full CLI argument parsing, help system, and user guidance.
**Acceptance Criteria**:
- All original CLI commands and flags work correctly
- Help system provides proper usage examples
- Error messages guide users to correct usage
- Auto-detection features work (system from world, etc.)

### Story 22: End-to-End Integration Testing
**Description**: Comprehensive testing of complete workflow with Puppeteer integration.
**Acceptance Criteria**:
- Complete workflow works: discovery → schema → create → update → search
- All operations work with authenticated Puppeteer sessions
- Performance is acceptable for typical use cases
- Error handling provides helpful guidance to users

## Technical Architecture

### Integration Points
- **Puppeteer Authentication**: All operations must work with authenticated FoundryVTT sessions
- **FoundryVTT APIs**: Use native FoundryVTT frontend APIs for all CRUD operations
- **Type System**: Consistent type resolution across all operations
- **CLI Interface**: Comprehensive argument parsing and help system

### Dependencies
- Existing Puppeteer authentication system (EPIC PLAN 2)
- FoundryVTT frontend API integration via Puppeteer
- FoundryVTT system manifest parsing
- Robust error handling and user guidance

## Success Metrics
- All original CLI commands functional
- Complete CRUD operations working
- Proper integration with Puppeteer authentication
- Performance comparable to original implementation
- Comprehensive error handling and user guidance

This epic will restore foundry-object-manager to full functionality while maintaining the robust Puppeteer-based authentication architecture established in EPIC PLAN 2.