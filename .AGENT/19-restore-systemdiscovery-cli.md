# STORY: Restore SystemDiscovery CLI Commands

## Description
The original foundry-object-manager had comprehensive system discovery features that were lost during Puppeteer migration. Users could list available game systems, discover object types per system, and extract schemas. These features need to be rebuilt using our new Puppeteer architecture.

## Lost Functionality
Original CLI commands that no longer work:
- `--list-systems` - List all available game systems (dnd5e, pf2e, etc.)
- `--list-types -s dnd5e` - List object types for specific system
- `--schema` flag - Extract object schemas with system context
- Auto-detection of system from world context

## Current State
- No SystemDiscovery class exists
- No system enumeration capability
- Schema extraction limited to current world context
- No system/type validation

## Acceptance Criteria
- [ ] `--list-systems` command shows all available game systems
- [ ] `--list-types -s dnd5e` shows all object types for D&D 5e system
- [ ] `--list-types -s pf2e` shows all object types for Pathfinder 2e system
- [ ] Schema extraction works with `--schema` flag for any system
- [ ] System/type validation prevents invalid combinations
- [ ] Auto-detection of system from world works correctly
- [ ] Proper error messages for invalid systems or types
- [ ] Integration with Puppeteer authentication system

## Tasks
1. Create new SystemDiscovery class with Puppeteer integration
2. Implement system enumeration via FoundryVTT system directories
3. Implement object type discovery per system
4. Add CLI argument parsing for system discovery commands
5. Integrate with existing Puppeteer authentication
6. Add schema extraction with system context
7. Implement system/type validation logic
8. Add auto-detection of system from world
9. Add comprehensive error handling and user guidance

## Technical Implementation
- **SystemDiscovery Class**: New class to handle system enumeration and analysis
- **System Manifest Parsing**: Read system.json files to extract object types
- **CLI Integration**: Add argument parsing for `--list-systems`, `--list-types`
- **Puppeteer Integration**: Ensure all operations work with authenticated sessions
- **Error Handling**: Provide helpful guidance for invalid operations

## Files to Create/Modify
- Create `system-discovery.mjs` - Main SystemDiscovery class
- Modify `foundry-manager.mjs` - Add CLI argument parsing and routing
- Update CLI help text and examples
- Add comprehensive error handling

## Testing
- Test `--list-systems` shows all available systems
- Test `--list-types` for multiple different systems
- Test invalid system names return helpful errors
- Test schema extraction with system context
- Test auto-detection from various world types
- Test integration with Puppeteer authentication