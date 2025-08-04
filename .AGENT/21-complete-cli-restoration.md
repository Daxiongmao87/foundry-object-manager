# STORY: Complete CLI Interface Restoration

## Description
The original foundry-object-manager had a sophisticated CLI interface with comprehensive argument parsing, help system, and user guidance. During the Puppeteer migration, most CLI functionality was lost. This story focuses on restoring the complete CLI experience with all commands, flags, help text, and user guidance.

## Lost CLI Functionality
### Argument Parsing
- Complete command-line argument parsing with all flags
- Proper positional argument handling
- Validation of argument combinations
- Auto-detection and intelligent defaults

### Help System
- Comprehensive `--help` output with examples
- Context-sensitive error messages
- Usage guidance for complex workflows
- CLI examples for common operations

### User Guidance Features
- Auto-detection of system from world
- Helpful error messages with suggested commands
- Validation of argument combinations
- Progress indicators for long operations

## Original CLI Interface
```bash
foundry-manager.mjs [options] [json-data]

OPTIONS:
  -s, --system <name>     System name (e.g., dnd5e, pf2e)
  -t, --type <type>       Object type (e.g., character, weapon, spell, npc)
  -w, --world <name>      Target world
  -i, --insert            Insert mode - create new document
  -u, --update            Update mode - modify existing document
  -r, --search            Search mode - find documents
  --list-systems          List available systems
  --list-worlds           List available worlds
  --list-types            List available object types for a system
  --list-images           List available images
  --schema                Extract and display object schema
  --name <pattern>        Search by name pattern
  --id <pattern>          Search by ID pattern
  --limit <number>        Limit number of results
  --details               Show detailed information
  --json                  Show full JSON data
  --no-image              Bypass image requirement
  -v, --verbose           Enable verbose output
  -h, --help              Show help message
```

## Current State
- Basic CLI structure exists but limited functionality
- No comprehensive argument parsing
- No help system or examples
- No user guidance or error handling
- Limited flag support

## Acceptance Criteria
- [ ] All original CLI flags and options work correctly
- [ ] `--help` shows comprehensive help with examples
- [ ] Argument validation prevents invalid combinations
- [ ] Auto-detection of system from world works
- [ ] Context-sensitive error messages guide users
- [ ] All CLI examples from original work correctly
- [ ] Verbose logging provides helpful debugging info
- [ ] Progress indicators for long operations
- [ ] Proper exit codes for scripting
- [ ] Integration with all restored functionality

## Tasks
1. Restore complete argument parsing with all flags
2. Implement comprehensive help system with examples
3. Add argument validation and combination checking
4. Restore auto-detection features (system from world)
5. Implement context-sensitive error handling
6. Add progress indicators and verbose logging
7. Restore all CLI examples and ensure they work
8. Add proper exit codes for scripting support
9. Integrate with all restored CRUD and discovery features
10. Add comprehensive testing of CLI interface

## Technical Implementation
- **Argument Parser**: Complete parseArgs configuration with all flags
- **Help System**: Rich help text with examples and usage patterns
- **Validation**: Argument combination validation and error reporting
- **Auto-detection**: Smart defaults and system detection
- **Error Handling**: Context-aware error messages with guidance
- **Integration**: Route commands to appropriate functionality

## CLI Command Categories
### Discovery Commands
- `--list-systems` - System enumeration
- `--list-worlds` - World enumeration  
- `--list-types -s <system>` - Type enumeration
- `--list-images` - Image enumeration

### Schema Commands
- `--schema -s <system> -t <type>` - Schema extraction
- `--schema -w <world> -t <type>` - Schema with auto-detection

### Validation Commands
- `-s <system> -t <type> <json>` - Validation only

### CRUD Commands
- `-i -w <world> -t <type> <json>` - Create document
- `-r -w <world> -t <type>` - List documents
- `-r -w <world> -t <type> --name <pattern>` - Search documents
- `-u -w <world> -t <type> --id <id> <json>` - Update document

## Files to Create/Modify
- Modify `foundry-manager.mjs` - Complete CLI argument parsing
- Update help text and examples
- Add argument validation logic
- Integrate with all restored functionality
- Add comprehensive error handling

## Help Text Structure
- Overview and description
- Complete options list with descriptions
- Usage patterns for different operations
- Comprehensive examples for all workflows
- Common error scenarios and solutions
- References to additional documentation

## Testing
- Test all CLI flags and options
- Test help system completeness
- Test argument validation catches invalid combinations
- Test auto-detection features
- Test error messages provide helpful guidance
- Test all CLI examples work correctly
- Test integration with all functionality
- Test exit codes for scripting support