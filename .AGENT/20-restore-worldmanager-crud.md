## Story 20 - Restore WorldManager CRUD Operations

### Progress Notes

**2025-08-04**

**Objective:** Implement comprehensive CRUD operations using FoundryVTT's frontend APIs through Puppeteer.

**Current Status:**
- Created `world-manager.mjs` with the basic `WorldManager` class structure.
- Implemented the `search` method within `WorldManager` to perform document searches using `game.collections` and `page.evaluate()` with optional name pattern filtering.
- Modified `foundry-manager.mjs` to:
    - Import `WorldManager`.
    - Added `--read` (`-r`) and `--name` options to the CLI argument parsing.
    - Updated the help message to include the new options.
    - Integrated `WorldManager` initialization into the `FoundryManager` constructor, ensuring it receives the `FoundryPuppeteerValidator` instance.
    - Added CLI routing logic in `foundry-manager.mjs` to handle the `--read` command, calling `worldManager.search` and displaying the results.

**Next Steps:**
- Implement `create` method in `WorldManager`.
- Implement `update` method in `WorldManager`.
- Add CLI argument parsing and routing for `create` and `update` operations in `foundry-manager.mjs`.
