# STORY: Fix World Activation in Puppeteer Validation

## Description

When using the new Puppeteer-based validation system, the FoundryVTT server reports that worlds do not exist even though they are present in the foundry-data directory. This needs to be investigated and fixed to ensure reliable world activation.

### Acceptance Criteria
- [x] Investigate why world activation is failing
- [x] Verify foundry-data directory structure and permissions
- [ ] Fix world activation in FoundryServerManager
- [x] Add additional logging for world activation steps
- [ ] Add tests to verify world activation works correctly
- [ ] Update documentation with any configuration requirements

### Investigation Findings

1. **Root Cause**: FoundryVTT is not detecting worlds in the data directory even though:
   - The world exists at `/home/patrick/.local/share/FoundryVTT/Data/worlds/test-world`
   - The world.json file is valid
   - Permissions are correct (drwxrwxr-x)
   - The data path is correctly resolved from symlink

2. **Symptoms**:
   - FoundryVTT UI shows 0 worlds in the setup page
   - API call to activate world returns "The requested world test-world does not exist!"
   - No world elements found in HTML (`[data-package-id]` selectors return empty)

3. **Debugging Results**:
   - Server starts correctly with resolved data path
   - Our world discovery method finds the world
   - But FoundryVTT's internal world discovery is not working
   - The `/api/setup/worlds` endpoint returns 404
   - The "Backups Overview" dialog blocks the UI

### Implemented Fixes

1. **Hardcoded world ID in test-auth-only.mjs**: Changed `test-auth-only.mjs` to use "testania" as the world ID for activation, addressing the mismatch between server discovery and webpage display.
2. **Added server startup delay**: Give FoundryVTT 3 seconds to scan worlds after startup
3. **Improved dialog handling**: Better logic to close all dialogs including Backups Overview
4. **Added world list refresh attempt**: Try to trigger package refresh if available
5. **Resolved symlink paths**: Ensure FoundryVTT gets the real data path
6. **Improved button selectors in world-activator.mjs**: Added "button.default", "button:contains(Continue)", and "button:contains(Setup)" selectors for more robust setup page navigation.
7. **Added debug screenshot**: A screenshot `debug-setup-page.png` is now taken before attempting to click any buttons on the setup page for debugging purposes.

### Status
The issue persists despite these fixes. The button selectors have been improved, but the core world discovery issue remains. FoundryVTT appears to have an internal issue with world discovery when started programmatically.

### Additional Investigation Results

1. **World Parameter**: Starting FoundryVTT with `--world=test-world` results in "CRITICAL FAILURE!" error
2. **Package Cache**: No package cache system found in the data directory
3. **Internal API**:
   - `window.setup` object exists but has no methods or data
   - `/api/packages/get` returns 404
   - No internal methods to trigger world discovery
   - The setup page runs in "auth" mode which may affect world visibility
4. **Options.json**: Contains `"world": null` setting but changing it doesn't help

### Root Cause Analysis
The issue appears to be that FoundryVTT's package discovery system is not functioning when started in headless mode or when the data path is specified via command line. The setup page loads in a minimal "auth" mode without proper package scanning capabilities.

### Possible Solutions
1. Use a different startup sequence (non-headless mode)
2. Investigate if FoundryVTT requires specific initialization files
3. Check if there's a licensing or configuration issue preventing world discovery
4. Consider using FoundryVTT's electron app directly instead of node

### Non-Headless Mode Results

1. **Implementation**: Added `headless` option to `startServer()` method
2. **Testing**: Ran FoundryVTT without `--headless` flag
3. **Result**: Same issue - worlds are not discovered
4. **Electron App**: Attempted to use electron binary but encountered sandbox permission errors

### Conclusion
The world discovery issue is not related to headless mode. FoundryVTT's package scanning mechanism appears to be fundamentally broken when started programmatically via node, regardless of headless setting. The issue may be:
- A licensing restriction
- Missing initialization sequence
- Required GUI interaction for first-time setup
- Internal caching that prevents world discovery

### Deep Investigation Results (2025-08-02)

1. **Package Discovery Investigation**:
   - Created `investigate-package-discovery.mjs` script
   - Found that socket.io messages show `"systems":[],"worlds":[]` 
   - Worlds exist on disk but FoundryVTT returns empty arrays
   - The issue occurs during server startup, not in browser

2. **Startup Methods Testing**:
   - Created `test-startup-methods.mjs` to test 5 different startup approaches
   - All methods failed to discover worlds:
     - Direct Node Execution
     - With Environment Variables
     - FoundryVTT Executable
     - With Resolved Path
     - Shell Execution
   - Confirms the issue is systemic, not method-specific

3. **Initialization Timing Analysis**:
   - Created `debug-package-initialization.mjs` script
   - Found initialization timeouts during startup
   - Package scanning may not be happening at all
   - No package-related log messages detected

### Critical Finding
The socket.io output explicitly shows that FoundryVTT is returning empty arrays for worlds and systems even though they exist on disk. This is happening at the server level, not in the browser or due to startup method.

### Tasks
1. Investigation:
   - Verify foundry-data directory structure
   - Check world.json files
   - Review FoundryVTT server logs during activation
   - Test with clean world install

2. Server Manager Updates:
   - Add detailed logging for world discovery
   - Add validation for world data structure
   - Improve error messages for activation failures
   - Add retry logic if needed

3. Testing:
   - Create test worlds with different configurations
   - Verify activation works with dnd5e system
   - Test error handling for missing/invalid worlds
   - Add integration tests for world activation

4. Documentation:
   - Update README with world setup requirements
   - Document world activation troubleshooting steps
   - Add example world configuration

### Implementation Details

#### 1. World Discovery
```javascript
async discoverWorlds() {
  console.log('🔍 Discovering worlds...');
  const worldsPath = path.join(this.dataPath, 'worlds');
  const worlds = [];
  
  for (const entry of await fs.readdir(worldsPath)) {
    const worldPath = path.join(worldsPath, entry);
    const worldJsonPath = path.join(worldPath, 'world.json');
    
    if (await fs.exists(worldJsonPath)) {
      const worldData = JSON.parse(await fs.readFile(worldJsonPath));
      worlds.push({
        id: entry,
        title: worldData.title,
        system: worldData.system,
        path: worldPath
      });
    }
  }
  
  return worlds;
}
```

#### 2. World Validation
```javascript
async validateWorld(worldId) {
  console.log(`🔍 Validating world: ${worldId}`);
  const world = await this.getWorldInfo(worldId);
  
  if (!world) {
    throw new Error(`World not found: ${worldId}`);
  }
  
  // Check required files
  const requiredFiles = [
    'world.json',
    'data/actors.db',
    'data/items.db'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(world.path, file);
    if (!await fs.exists(filePath)) {
      throw new Error(`Missing required file: ${file}`);
    }
  }
  
  return world;
}
```

#### 3. Activation Flow
```javascript
async activateWorld(worldId) {
  console.log(`🌎 Activating world: ${worldId}`);
  
  // 1. Validate world
  const world = await this.validateWorld(worldId);
  
  // 2. Wait for server ready
  await this.waitForServerReady();
  
  // 3. POST setup completion
  await this.postSetup({
    adminKey: this.adminKey,
    worldName: world.title
  });
  
  // 4. POST world activation
  await this.postWorldActivation(world.id);
  
  // 5. Wait for world active
  await this.waitForWorldActive();
  
  return world;
}
```

### Technical Dependencies
1. FoundryServerManager
2. Puppeteer for browser interaction
3. World configuration files
4. foundry-data directory structure

### Testing Requirements
1. Unit Tests:
   - World discovery
   - World validation
   - Error handling

2. Integration Tests:
   - Full activation flow
   - System detection
   - Data persistence

3. Edge Cases:
   - Missing files
   - Invalid configurations
   - Permission issues

### Migration Impact
1. May require world data structure cleanup
2. Could affect CI/CD pipeline setup
3. May need documentation updates

### Documentation Updates
1. World Setup Guide:
   - Required structure
   - Configuration files
   - Permissions

2. Troubleshooting Guide:
   - Common issues
   - Required checks
   - Error messages

### Deep Investigation Findings

**Critical Discovery from socket.io debug output**: FoundryVTT's server returns `"worlds":[]` in its socket.io response even though worlds exist in the filesystem. This confirms that the package discovery mechanism is completely broken when starting programmatically.

### Investigation Scripts Created

Created three comprehensive investigation scripts to diagnose the package discovery issue:

1. **investigate-package-discovery.mjs** - Deep investigation into package discovery mechanism:
   - Checks what packages exist on disk
   - Starts server with verbose logging to capture package-related messages
   - Connects with Puppeteer to analyze client-side state
   - Attempts multiple methods to trigger package refresh
   - Generates detailed comparison report

2. **test-startup-methods.mjs** - Tests different startup approaches:
   - Direct node execution
   - With environment variables
   - Using FoundryVTT executable (if exists)
   - With resolved symlink paths
   - Shell execution
   - Compares which methods successfully discover worlds

3. **debug-package-initialization.mjs** - Monitors initialization phases:
   - Pre-flight checks of data directory structure
   - Creates wrapper script to inject debugging
   - Tracks initialization phases and timing
   - Monitors package-related events
   - Generates timing analysis report

### Usage
Run these scripts to diagnose the issue:
```bash
./investigate-package-discovery.mjs  # Detailed package discovery analysis
./test-startup-methods.mjs          # Compare different startup methods
./debug-package-initialization.mjs   # Monitor initialization timing
```

### Next Steps
Based on socket.io finding showing `"worlds":[]`, investigate why FoundryVTT's internal package scanner is not detecting worlds when started programmatically. Run the investigation scripts to gather detailed diagnostic information.
