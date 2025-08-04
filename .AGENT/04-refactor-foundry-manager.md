# STORY: Refactor foundry-manager.mjs to use Puppeteer Validation

## Description
Now that we have both reliable server management and proper validation through Puppeteer, update the main foundry-manager.mjs interface to use our new validation system. This change will remove all Node.js-based FoundryVTT environment mocking and ensure that all document validation uses the real game engine.

### Acceptance Criteria
- [x] Remove all Node.js-based environment mocking code
- [x] Update foundry-manager.mjs to use FoundryPuppeteerValidator
- [x] Maintain existing CLI interface and parameters
- [x] Handle all document types (Item, Actor, etc.)
- [x] Add proper progress reporting for long operations
- [x] Support both file and command-line input
- [x] Update error handling to use new validation errors
- [x] Update documentation and examples

Status: ✅ COMPLETE
World activation issue moved to separate story (#5)

### Tasks
1. Update foundry-manager.mjs core:
   ```javascript
   export class FoundryManager {
     constructor(options = {}) {
       this.serverManager = new FoundryServerManager(options);
       this.validator = null;
       this.initialized = false;
     }

     async initialize() {
       // Start server and activate world
       await this.serverManager.startServer();
       await this.serverManager.activateWorld(world);
       
       // Create and init validator
       this.validator = new FoundryPuppeteerValidator(this.serverManager);
       await this.validator.initialize();
     }

     async validateDocument(type, data) {
       await this._ensureInitialized();
       return this.validator.validateDocument(type, data);
     }

     async cleanup() {
       await this.serverManager.cleanup();
     }
   }
   ```

2. Update CLI interface:
   - Keep existing parameter format
   - Add progress reporting
   - Handle cleanup on exit

3. Remove old mocking code:
   - Delete foundry-environment.mjs
   - Remove mock validation systems
   - Update imports and dependencies

4. Add new features:
   - World selection/configuration
   - System-specific validation
   - Schema extraction
   - Batch processing

5. Update error handling:
   - Map validation errors to CLI output
   - Proper error codes and messages
   - Stack traces in debug mode

6. Update documentation:
   - README.md changes
   - CLI documentation
   - Example updates
   - Migration guide

### Implementation Details

#### 1. CLI Format
```bash
# Validate from file
./foundry-manager.mjs -s 'dnd5e' -t 'weapon' weapon.json

# Validate from command line
./foundry-manager.mjs -s 'dnd5e' -t 'npc' '{"name": "Test NPC"}'

# Get schema
./foundry-manager.mjs --schema -t 'weapon'

# List available types
./foundry-manager.mjs --list-types
```

#### 2. Progress Output
```bash
🚀 Initializing validation system...
   ↳ Starting FoundryVTT server...
   ↳ Activating world...
   ↳ Initializing validator...
📋 Validating document...
   ↳ Type: weapon
   ↳ System: dnd5e
✅ Validation successful!
```

#### 3. Error Output
```bash
❌ Validation failed:
   → Error: Invalid weapon type
   → Field: system.type.value
   → Code: INVALID_WEAPON_TYPE
   → Allowed values: simpleM, martialM
```

### Technical Dependencies
1. FoundryServerManager for process control
2. FoundryPuppeteerValidator for validation
3. Command-line argument parser
4. JSON file handling

### Testing Requirements
1. Unit Tests
   - Core functionality
   - Error handling
   - Progress reporting

2. Integration Tests
   - CLI interface
   - File handling
   - Cleanup behavior

3. Edge Cases
   - Invalid files
   - Network issues
   - Server failures

### Migration Impact
1. Scripts must wait for initialization
2. Longer startup time (server + browser)
3. More detailed error messages
4. New configuration options

### Documentation Updates
1. CLI Reference
   - Updated parameters
   - New commands
   - Example usage

2. API Documentation
   - New class methods
   - Error handling
   - Configuration

3. Examples
   - Basic validation
   - System-specific
   - Schema usage

4. Troubleshooting Guide
   - Common errors
   - Solutions
   - Debug steps
