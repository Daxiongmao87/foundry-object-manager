# Epic Plan: End-to-End Validation and Authentication Fix

## Epic Title
Fix End-to-End Validation and Authentication

### Description
This epic is to fix the remaining issues that are preventing the `foundry-object-manager` from performing its core function of validating FoundryVTT objects. This includes fixing the credential manager, implementing a robust authentication flow, and ensuring the entire system works end-to-end.

### Acceptance Criteria
- [ ] The credential manager is fully functional and can set, store, and retrieve admin passwords.
- [ ] The validator can successfully authenticate with a password-protected FoundryVTT instance.
- [ ] The end-to-end validation workflow is fully functional, from starting the server to validating an object.
- [ ] All tests pass, including new tests for the credential manager and authentication flow.
- [ ] The project is delivered in a fully working state.

### User Stories
1. [STORY: Fix Credential Manager](./16-fix-credential-manager.md)
2. [STORY: Fix Validator Authentication Failure](./15-fix-validator-authentication.md)
3. [STORY: Final End-to-End Validation](./17-final-e2e-validation.md)
