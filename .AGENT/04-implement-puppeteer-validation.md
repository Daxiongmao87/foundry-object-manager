# STORY: Implement FoundryPuppeteer validation interface
## Description
Create a class that uses Puppeteer to launch a headless browser, connect to the FoundryVTT server, and execute validation logic in the browser context. Provide methods for validating documents, querying available systems, and extracting object types.

### Acceptance Criteria
- [ ] Can launch browser, authenticate using the secure credential store, and connect to FoundryVTT game page
- [ ] Can execute validation (e.g., Item.create(data, {validateOnly: true}))
- [ ] Can query available systems and object types
- [ ] Handles browser cleanup and error cases

### Tasks
1. Implement FoundryPuppeteer class
2. Add methods for initialize, validateDocument, getAvailableSystems, getSystemObjectTypes, cleanup
3. Implement authentication flow (using the credential store) within the `initialize` method
4. Test browser automation and validation, including login
5. Document API and limitations
