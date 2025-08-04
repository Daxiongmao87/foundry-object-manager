# STORY: Implement FoundryServerManager for server lifecycle

## Description
Based on SPIKE investigation findings, implement a Node.js class to properly manage FoundryVTT server lifecycle using the setup API for world activation. This includes starting the server without a world parameter, handling world activation through the proper API endpoints, and managing server state transitions.

### Acceptance Criteria
- [x] Create server lifecycle management with proper state tracking
- [x] Implement world activation through setup API instead of command line
- [x] Add status polling with configurable timeouts
- [x] Handle all state transitions (starting, running, activating, ready)
- [x] Implement proper cleanup and error handling
- [x] Create comprehensive test suite for all scenarios

### Tasks
1. Implement FoundryServerManager class core functionality:
   ```typescript
   class FoundryServerManager {
     // Server states
     private state: ServerState;
     private process: ChildProcess;
     private activationTimeout: number;

     // Core methods
     async startServer(): Promise<void>
     async stopServer(): Promise<void>
     async activateWorld(worldId: string): Promise<boolean>
     async getServerStatus(): Promise<ServerStatus>
     async waitForActivation(timeout?: number): Promise<boolean>
   }
   ```

2. Add state management:
   - Enum for server states (STOPPED, STARTING, RUNNING, etc.)
   - State transition validation
   - Event emitters for state changes

3. Implement API-based activation:
   - Setup page navigation
   - API endpoint calls
   - Status polling
   - Timeout handling

4. Create cleanup and monitoring:
   - Process tracking
   - Resource cleanup
   - State reset
   - Error recovery

5. Write test suite:
   - Unit tests for each method
   - Integration tests for full lifecycle
   - Error scenario tests
   - Cleanup verification

6. Update documentation:
   - API reference
   - Usage examples
   - Error handling
   - Migration guide

### Implementation Notes

#### State Machine
```typescript
enum ServerState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  ACTIVATING = 'activating',
  READY = 'ready',
  ERROR = 'error'
}
```

#### Status Interface
```typescript
interface ServerStatus {
  active: boolean;
  world?: string;
  system?: string;
  error?: string;
}
```

### Key Changes from Previous Design
1. Remove world parameter from server startup
2. Add proper API-based world activation
3. Implement status polling
4. Add state management
5. Improve error handling

### Testing Requirements
1. Unit Tests
   - State transitions
   - API interactions
   - Error handling

2. Integration Tests
   - Full server lifecycle
   - World activation
   - Cleanup behavior

3. Edge Cases
   - Network issues
   - Process crashes
   - Failed activation

### Documentation Updates
1. Updated README with new approach
2. API reference documentation
3. Migration guide for existing code
4. Example code snippets
