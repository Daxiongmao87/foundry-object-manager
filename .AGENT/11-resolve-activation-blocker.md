# STORY: Investigate and Resolve World Activation Blocker

## Description
This story is to investigate the root cause of the world activation failure when FoundryVTT is started programmatically. The goal is to find a reliable method to activate a world, enabling full end-to-end testing of the application.

## Acceptance Criteria
- [ ] The root cause of the "world does not exist" error is identified.
- [ ] A reliable workaround or solution is implemented to activate a world programmatically.
- [ ] The `test-basic-functionality.mjs` test can run to completion without hanging on world activation.
- [ ] Full end-to-end validation of a sample object (e.g., a weapon) is successful.

## Tasks
1.  Review the `EPIC_VALIDATION_REPORT.md` to understand the current findings.
2.  Investigate alternative methods for starting the FoundryVTT server that might allow for proper package discovery (e.g., using the official Docker image, different command-line flags, or interacting with the Electron app).
3.  Experiment with different configurations and startup sequences to bypass the activation error.
4.  Implement the most promising solution.
5.  Update the `test-basic-functionality.mjs` test to use the new solution and verify that it passes.

## Progress Update - 2025-08-03

### Created world-activator.mjs Module
- Created a dedicated WorldActivator class to programmatically activate worlds
- Uses Puppeteer to navigate to setup page and click on world
- Waits for game.ready state to ensure full activation

### Implementation Details
The module provides:
- `activateWorld(page, worldId)` method that:
  1. Navigates to /setup page
  2. Waits for and clicks the world element by data-package-id
  3. Waits for navigation to /game
  4. Waits for window.game.ready to be true
  5. Returns success status

### Next Steps
- Integrate WorldActivator with foundry-server-manager.mjs
- Update test-basic-functionality.mjs to use the new activation method
- Test full unassisted execution
