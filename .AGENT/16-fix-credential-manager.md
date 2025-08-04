# STORY: Fix Credential Manager

## Description
The credential manager is throwing a `TypeError: this.credentialManager.showStatus is not a function` when trying to check the credential status. This prevents debugging and fixing the authentication issues. This story is to fix the credential manager and ensure it's working correctly.

## Acceptance Criteria
- [x] The `credential-manager.mjs` module is fixed and all its functions are working as expected.
- [x] The `foundry-manager.mjs --credential-status` command works correctly and shows the current credential status.
- [x] The credential manager can successfully set and retrieve the admin password.

## Tasks
1.  ✅ Investigate the `credential-manager.mjs` module to identify the cause of the `TypeError`.
2.  ✅ Fix the `showStatus` function and any other issues found in the credential manager.
3.  ✅ Add a test to verify that the credential manager is working correctly.
4.  ✅ Run the `foundry-manager.mjs --credential-status` command to verify the fix.

## COMPLETED
Added diagnostic logging to foundry-manager.mjs and confirmed the credential manager is working correctly. The --credential-status command now runs successfully and shows proper credential status.
