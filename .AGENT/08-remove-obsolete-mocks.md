# STORY: Remove obsolete mocking and debug files
## Description
Delete all Node.js-based FoundryVTT environment mocking, fallback code, and debug scripts that are no longer needed after the Puppeteer refactor.

### Acceptance Criteria
- [ ] All mocking and fallback code is removed
- [ ] No obsolete debug scripts remain
- [ ] Codebase is clean and maintainable

### Tasks
1. Identify all obsolete files (e.g., foundry-environment.mjs, add-missing-globals.mjs)
2. Remove files and update imports
3. Validate project runs without removed code
4. Document cleanup
