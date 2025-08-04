# STORY: End-to-End Integration Testing

## Description
After restoring all foundry-object-manager functionality with Puppeteer integration, comprehensive end-to-end testing is needed to ensure the complete system works correctly. This includes testing the full workflow from discovery through CRUD operations, all with Puppeteer authentication.

## Scope of Testing
This story focuses on integration testing of the complete restored system, ensuring all components work together correctly with the Puppeteer authentication architecture.

## Complete Workflow Testing
### Discovery → Schema → Create → Update → Search
Test the complete user workflow:
1. **Discovery**: List systems, worlds, and types
2. **Schema**: Extract object schemas for validation
3. **Create**: Insert new documents with validation
4. **Update**: Modify existing documents
5. **Search**: Find and retrieve documents

### Example Workflow
```bash
# 1. Discovery
foundry-manager.mjs --list-systems                              # Find available systems
foundry-manager.mjs --list-worlds                               # Find available worlds  
foundry-manager.mjs --list-types -s dnd5e                       # Find object types

# 2. Schema
foundry-manager.mjs -s dnd5e -t character --schema              # Get expected structure

# 3. Create
foundry-manager.mjs -w my-world -t character -i '{"name":"Hero","type":"character"}'

# 4. Search  
foundry-manager.mjs -w my-world -t character -r --name "Hero*"  # Find the character

# 5. Update
foundry-manager.mjs -w my-world -t character -u --name "Hero" '{"hp":{"value":50}}'
```

## Acceptance Criteria
- [ ] Complete workflow works from discovery to CRUD operations
- [ ] All operations work with authenticated Puppeteer sessions
- [ ] Performance is acceptable for typical use cases (< 30s for most operations)
- [ ] Error handling provides helpful guidance throughout workflow
- [ ] System handles concurrent operations safely
- [ ] Memory usage remains stable during extended operations
- [ ] All CLI examples in help text work correctly
- [ ] Integration between components is seamless
- [ ] Database operations are transactional and safe
- [ ] Authentication persists correctly across operations

## Integration Points to Test
### Puppeteer Authentication Integration
- [ ] All operations work with active FoundryVTT sessions
- [ ] Authentication persists across multiple operations
- [ ] Session handling is robust and recovers from disconnections
- [ ] World activation state is maintained correctly

### Database Integration
- [ ] LevelDB operations work with active Puppeteer sessions
- [ ] Database transactions are safe and atomic
- [ ] Concurrent access is handled correctly
- [ ] Data integrity is maintained across operations

### Type System Integration
- [ ] Type discovery integrates with schema extraction
- [ ] Schema extraction integrates with validation
- [ ] Validation integrates with CRUD operations
- [ ] System/type combinations are validated consistently

### CLI Integration
- [ ] All CLI commands route to correct functionality
- [ ] Argument parsing handles all combinations correctly
- [ ] Error handling is consistent across all operations
- [ ] Help system accurately reflects functionality

## Performance Testing
### Response Time Targets
- Discovery operations: < 5 seconds
- Schema extraction: < 10 seconds
- Document validation: < 5 seconds
- CRUD operations: < 15 seconds
- Search operations: < 20 seconds

### Load Testing
- Test with large worlds (1000+ documents)
- Test concurrent operations
- Test memory usage during extended sessions
- Test database performance with complex queries

## Error Scenarios to Test
### Authentication Errors
- FoundryVTT server not running
- Authentication failure
- Session timeout/disconnection
- World activation failure

### Database Errors
- World not found
- Database corruption
- Permission issues
- Concurrent access conflicts

### Validation Errors
- Invalid system/type combinations
- Malformed JSON data
- Missing required fields
- Type mismatches

### CLI Errors
- Invalid argument combinations
- Missing required parameters
- File system access issues
- Network connectivity problems

## Tasks
1. Create comprehensive integration test suite
2. Test complete discovery → CRUD workflow
3. Test all CLI command combinations
4. Test Puppeteer authentication integration
5. Test database operations integration
6. Test error handling and recovery
7. Test performance under various conditions
8. Test concurrent operation handling
9. Test memory and resource usage
10. Document test results and any issues found

## Test Files to Create
- `test-complete-workflow.mjs` - End-to-end workflow testing
- `test-cli-integration.mjs` - All CLI commands and combinations
- `test-performance.mjs` - Performance and load testing
- `test-error-scenarios.mjs` - Error handling and recovery
- `test-concurrency.mjs` - Concurrent operation testing

## Success Metrics
- All integration tests pass consistently
- Performance meets target response times
- Error scenarios are handled gracefully
- System remains stable under load
- Memory usage is reasonable and stable
- User experience is smooth and intuitive

## Documentation Updates
- Update README with complete usage examples
- Document performance characteristics
- Document error recovery procedures
- Update troubleshooting guide
- Document known limitations or issues

## Testing Environment
- Multiple FoundryVTT worlds with different systems
- Various document types and sizes
- Different authentication scenarios
- Network connectivity variations
- Resource constraint scenarios