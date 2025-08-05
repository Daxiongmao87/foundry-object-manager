# STORY: Rewrite README with Current CLI Interface

## Description
Completely rewrite the README.md to accurately reflect the current CLI interface, removing all outdated examples and replacing them with working commands that match the current implementation.

### Acceptance Criteria
- [ ] All CLI examples work exactly as documented without modification
- [ ] Command syntax matches `foundry-manager.mjs --help` output perfectly
- [ ] Outdated flags (-l, --listWorlds) completely removed
- [ ] Current flags (--list-systems, --list-worlds, --list-types) properly documented
- [ ] CRUD operations (create, read, update, delete) included with examples
- [ ] World selection (-w) usage clearly explained
- [ ] Type selection (-t) usage with system discovery documented

### Tasks
1. Replace all outdated CLI examples with current working commands
2. Document the complete CRUD workflow with practical examples
3. Update system and world discovery documentation
4. Fix all flag references to match current implementation
5. Add proper command structure and syntax documentation
6. Include exit codes and error handling information

### Definition of Done
- Every command example in README can be copy-pasted and works immediately
- CLI interface section matches --help output exactly
- No references to non-existent flags or outdated syntax remain