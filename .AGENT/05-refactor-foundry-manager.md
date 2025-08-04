# STORY: Refactor foundry-manager.mjs to use Puppeteer validation
## Description
Replace all direct document class imports and Node.js-based validation in foundry-manager.mjs with calls to the new Puppeteer validation interface. Ensure all validation, schema extraction, and document creation use the browser-based approach.

### Acceptance Criteria
- [ ] All validation and schema extraction uses Puppeteer
- [ ] No direct imports of FoundryVTT document classes in Node.js
- [ ] CLI behavior and output remain unchanged
- [ ] All tests pass

### Tasks
1. Replace createFoundryDocument and related methods
2. Update CLI flows for validation, insertion, update, and schema extraction
3. Test all CLI operations
4. Remove obsolete code paths
