# STORY: Refactor system-discovery.mjs for browser-based system queries
## Description
Update system-discovery.mjs to use Puppeteer/browser queries for listing available systems and object types, instead of file system scanning and Node.js mocks.

### Acceptance Criteria
- [ ] System and object type discovery uses Puppeteer/browser queries
- [ ] No file system scanning for system info
- [ ] All dependent features work as before

### Tasks
1. Update getAllSystems and related methods
2. Integrate with FoundryPuppeteer
3. Test system discovery and type listing
4. Remove obsolete code
