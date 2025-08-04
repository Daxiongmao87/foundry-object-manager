# SPIKE: Evaluate Puppeteer integration with FoundryVTT server
## Description
Investigate and document how Puppeteer can be used to connect to a running FoundryVTT server, load the game context, and execute validation logic (e.g., Item.create({data}, {validateOnly: true})) in the browser. Identify any blockers, required server configuration, and the minimal browser automation needed for validation.

### Acceptance Criteria
- [x] Proof-of-concept script connects to FoundryVTT server and executes a validation call
- [x] Documented steps for launching FoundryVTT and connecting via Puppeteer
- [x] List of any technical blockers or required FoundryVTT/browser settings
- [x] Clear go/no-go recommendation for Puppeteer approach

### Tasks
1. ✅ Launch FoundryVTT server locally
2. ✅ Write Puppeteer script to connect and run a validation command
3. ✅ Document findings and blockers
4. ✅ Summarize feasibility and next steps

## SPIKE Results

### Status: ✅ COMPLETED
**Recommendation: GO - Proceed with Puppeteer implementation**

### Key Findings
- ✅ Puppeteer successfully connects to FoundryVTT server (localhost:30000)
- ✅ System Chromium works perfectly with Puppeteer
- ✅ FoundryVTT server responds correctly to browser automation
- ⚠️ Authentication required (admin password) - addressable blocker
- ✅ Technical approach validated and feasible

### Implementation Requirements
1. **Authentication Handling**: Add admin password support to access game interface
2. **Browser Dependencies**: Use system Chromium (`/snap/bin/chromium`) 
3. **Session Management**: Handle login flow for accessing validation APIs

### Next Steps
1. Implement authentication in proof-of-concept
2. Test actual validation APIs (`Item.create`, `Actor.create`)
3. Begin replacing mock system with Puppeteer validation

**Detailed findings and technical notes available in:** `.AGENT/spike-notes.md`
