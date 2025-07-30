# AGENT.md

## Build/Test Commands
- **Start application**: `node foundry-manager.mjs`
- **Run test**: `node test.mjs` (test files: test-*.mjs)
- **Run demo**: `node demo.mjs`
- **Debug database**: `node debug-db.mjs`
- **Single test**: `node <test-file>.mjs` (e.g., `node test-document-creation.mjs`)

## Architecture
- **ES6 modules** (.mjs) with Node.js 18+
- **Core modules**: foundry-environment.mjs (FoundryVTT setup), system-discovery.mjs (system loading), world-manager.mjs (database ops)
- **FoundryVTT integration**: Uses actual FoundryVTT code from `foundry-files/resources/app/`
- **Database**: LevelDB with classic-level for FoundryVTT worlds
- **Data validation**: FoundryVTT's DataModel system (NO mocks/fallbacks)

## Code Style
- **CRITICAL**: Use FoundryVTT's actual validation system - never create mock/fallback systems
- **Imports**: ES6 modules, absolute paths from foundry-files/resources/app/
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Error handling**: Throw descriptive errors, use try/catch blocks
- **CLI format**: `./foundry-manager.mjs -s '<system>' -t '<type>' '<json>'`
- **Types**: Use FoundryVTT's actual document classes (BaseItem, BaseActor, etc.)

## Key Requirements
- Import from `foundry-files/resources/app/common/server.mjs`
- Use actual document `defineSchema()` methods
- Initialize real FoundryVTT globals (CONFIG, foundry, game)
