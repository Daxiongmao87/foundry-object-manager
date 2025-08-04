# Epic Plan
## Epic Title
Refactor foundry-object-manager to use Puppeteer for Real FoundryVTT Validation

### Description
Replace all Node.js-based FoundryVTT environment mocking with a Puppeteer-driven approach that connects to a real FoundryVTT server in a headless browser. This will ensure all validation, schema extraction, and document operations use the actual FoundryVTT codebase, eliminating maintenance overhead and ensuring compliance with the "NEVER CREATE MOCK/FALLBACK SYSTEMS" requirement.

### Acceptance Criteria
- [ ] All validation and schema extraction uses Puppeteer to interact with a real FoundryVTT server/browser
- [ ] All mocking code and fallback systems are removed from the codebase
- [ ] CLI and test functionality remain identical for end users
- [ ] All tests pass using the new Puppeteer approach
- [ ] Documentation is updated to reflect the new architecture and usage

### User Stories
1. [SPIKE: Evaluate Puppeteer integration with FoundryVTT server](./01-spike-evaluate-puppeteer-integration.md) - **DONE**
2. [STORY: Implement FoundryServerManager for server lifecycle](./02-implement-server-manager.md) - **DONE**
3. [STORY: Implement FoundryPuppeteer validation interface](./03-implement-puppeteer-validation.md) - **DONE**
4. [STORY: Refactor foundry-manager.mjs to use Puppeteer validation](./04-refactor-foundry-manager.md) - **DONE**
5. [STORY: Refactor system-discovery.mjs for browser-based system queries](./05-refactor-system-discovery.md) - **DONE**
6. [STORY: Integrate Puppeteer with world-manager.mjs for world operations](./06-integrate-puppeteer-world-manager.md) - **DONE**
7. [STORY: Update and validate all test-*.mjs files for Puppeteer](./07-update-tests-for-puppeteer.md) - **DONE**
8. [STORY: Remove obsolete mocking and debug files](./08-remove-obsolete-mocks.md) - **DONE**
9. [STORY: Update documentation for new architecture](./09-update-documentation.md) - **DONE**
10. [STORY: Final Epic Validation and Cleanup](./10-final-validation.md) - **DONE**
11. [STORY: Investigate and Resolve World Activation Blocker](./11-resolve-activation-blocker.md) - **DONE**
12. [STORY: Unify World Discovery to Use Puppeteer Exclusively](./12-unify-world-discovery.md) - **DONE**
13. [STORY: Update Documentation](./13-update-documentation.md) - **BLOCKED**
14. [STORY: Fix Validator Initialization Failure](./14-fix-validator-initialization.md) - **BLOCKED**
15. [STORY: Fix Validator Authentication Failure](./15-fix-validator-authentication.md) - **BLOCKED**
16. [STORY: Fix Credential Manager](./16-fix-credential-manager.md)