# Foundry Object Manager

This is a command-line tool for managing FoundryVTT objects, such as actors and items, from outside the FoundryVTT application. It allows you to validate, insert, and search for objects in your worlds.

## Features

- **Validate Objects:** Validate JSON objects against your installed system's data models.
- **Insert Objects:** Insert validated objects directly into your FoundryVTT worlds.
- **Search Objects:** Search for objects in your worlds by name, ID, or type.
- **List Systems and Worlds:** List all available systems and worlds in your FoundryVTT installation.

## Installation

1.  Clone this repository.
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Ensure you have a complete FoundryVTT installation in the `foundry-files/` directory.
    Note: This project now uses Puppeteer to interact with FoundryVTT directly, eliminating system import issues.

## One-Time Setup: Manual World Activation

Due to FoundryVTT's architecture, package discovery (worlds, systems, modules) doesn't work properly in headless mode. Therefore, you need to manually activate a world once per FoundryVTT session:

1. Start the validation tool (it will launch FoundryVTT):
   ```bash
   node test-basic-functionality.mjs
   ```

2. If no world is active, you'll see instructions. Follow them:
   - Open your browser and navigate to: http://localhost:30000
   - If prompted, enter your admin password
   - On the setup page, click on any world to activate it
   - Wait for the world to fully load (you'll see the game interface)

3. Return to the terminal and run the command again. The tool will now work with the active world.

**Note:** The world remains active until you stop FoundryVTT. You only need to do this once per session.

## Usage

The main script is `foundry-manager.mjs`. You can run it with `node`.

### List Available Systems

```bash
node foundry-manager.mjs -l
```

### List Available Worlds

```bash
node foundry-manager.mjs -l --listWorlds
```

### List Object Types for a System

```bash
node foundry-manager.mjs -s dnd5e -l
```

### Validate an Object

```bash
node foundry-manager.mjs -s dnd5e -t actor '{"name":"Test Character","type":"character"}'
```

You can also validate an object from a file:

```bash
node foundry-manager.mjs -s dnd5e -t item < my-item.json
```

### Insert an Object into a World

```bash
node foundry-manager.mjs -s dnd5e -t actor -w my-world -i '{"name":"Hero","type":"character"}'
```

### Search for Objects in a World

```bash
node foundry-manager.mjs -s dnd5e -t actor -w my-world -r
```

You can also search with more specific criteria:

```bash
# Search by name (with wildcard)
node foundry-manager.mjs -s dnd5e -t actor -w my-world -r --name "Test*"

# Search with detailed output
node foundry-manager.mjs -s dnd5e -t actor -w my-world -r --details --limit 5

# Search and show JSON data
node foundry-manager.mjs -s dnd5e -t item -w my-world -r --json 500
```

## Important Notes

- **FoundryVTT Validation**: This tool uses FoundryVTT's actual validation system through Puppeteer browser automation. It does not create mock schemas or fallback validation.
- **Manual World Activation**: Due to FoundryVTT limitations in headless mode, you must manually activate a world through the UI once per session (see One-Time Setup above).
- **Concurrent Usage**: The tool launches its own FoundryVTT instance on port 30000. Make sure no other FoundryVTT instance is using this port.
- **Real Validation**: All validation is performed using the actual FoundryVTT engine, ensuring 100% compatibility with your systems and modules.

## Development

The project is structured into several modules:

-   `foundry-manager.mjs`: The main CLI entry point.
-   `foundry-server-manager.mjs`: Manages the FoundryVTT server lifecycle.
-   `foundry-puppeteer-validator.mjs`: Handles validation through Puppeteer browser automation.
-   `world-manager.mjs`: Handles direct database interactions with FoundryVTT worlds.
-   `credential-manager.mjs`: Manages admin credentials securely.
-   `test-basic-functionality.mjs`: Test script that demonstrates all functionality.
