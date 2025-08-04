# STORY: Unify World Discovery to Use Puppeteer Exclusively

## Description
Remove all filesystem-based world discovery logic from `foundry-server-manager.mjs`. All world discovery must go through the Puppeteer interface that queries the live FoundryVTT server. This ensures a single source of truth and eliminates discrepancies like the phantom `test-world` appearing from old filesystem scans.

## Acceptance Criteria
- [ ] The `discoverWorlds` function in `foundry-server-manager.mjs` is completely removed.
- [ ] The `_getAvailableWorldsFilesystem` function in `foundry-server-manager.mjs` is completely removed.
- [ ] The `getAvailableWorlds` function is refactored to be exclusively Puppeteer-based, removing the filesystem fallback.
- [ ] The `ensureWorldExists` function is updated to use the pure Puppeteer-based discovery.
- [ ] The application no longer logs `test-world` unless it is a real world visible in the FoundryVTT UI.
- [ ] The `--list-worlds` command and all tests run successfully using only the Puppeteer discovery method.

## Tasks
1.  Open `foundry-server-manager.mjs`.
2.  Delete the `discoverWorlds` function.
3.  Delete the `_getAvailableWorldsFilesystem` function.
4.  Refactor `getAvailableWorlds` to remove the filesystem fallback logic. It should now require the browser to be initialized.
5.  Update `ensureWorldExists` to rely only on the refactored `getAvailableWorlds`.
6.  Search for and remove any remaining calls to the deleted functions.
7.  Run `test-basic-functionality.mjs` to ensure the application still works and the phantom `test-world` is gone.
