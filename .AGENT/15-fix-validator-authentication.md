# STORY: Fix Validator Authentication Failure

## Description
The validator is failing to authenticate when accessing the `/game` page, even after a world has been activated. This prevents the game context from being initialized and blocks all validation. This story is to fix the authentication flow within the validator.

## Acceptance Criteria
- [ ] The validator successfully authenticates and accesses the `/game` page after world activation.
- [ ] The `test-basic-functionality.mjs` test runs to completion and successfully validates a sample object without any authentication errors.
- [ ] The end-to-end validation workflow is fully functional.

## Tasks
1.  Analyze the authentication flow in `FoundryPuppeteerValidator.mjs` to identify why it's failing.
2.  Update the authentication logic to correctly handle the join page and log in as the admin user.
3.  Ensure that after authentication, the validator correctly waits for the game to be ready.
4.  Run `test-basic-functionality.mjs` to verify the fix.
5.  **Completed**: Fixed button selectors in `world-activator.mjs` to improve robustness on the FoundryVTT setup page. Updated selectors to include `button.default`, `button[type="button"]`, and expanded text content search for "Continue" and "Setup" on various button and input elements.