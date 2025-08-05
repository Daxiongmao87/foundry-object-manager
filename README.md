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
3.  This tool automatically launches and manages its own FoundryVTT instance using Puppeteer. No manual FoundryVTT installation is required in a specific directory.

## One-Time Setup: Initial World Activation

Due to FoundryVTT's architecture, package discovery (worlds, systems, modules) doesn't work properly in headless mode without an initial world activation. You need to manually activate a world once per FoundryVTT session:

1.  Start the tool with any command that requires world interaction (e.g., listing worlds):
    ```bash
    node foundry-manager.mjs --list-worlds
    ```

2.  If no world is active, the tool will launch FoundryVTT and provide instructions. Follow them:
    *   Open your browser and navigate to: `http://localhost:30000`
    *   If prompted, enter your admin password (you can set it using `--set-admin-password`)
    *   On the setup page, click on any world to activate it.
    *   Wait for the world to fully load (you'll see the game interface).

3.  Return to the terminal and run your `foundry-manager.mjs` command again. The tool will now work with the active world.

**Note:** The world remains active until you stop the `foundry-manager.mjs` process. You only need to perform this manual activation once per session.

## Usage

The main script is `foundry-manager.mjs`. You can run it with `node`.

### List Available Systems

```bash
node foundry-manager.mjs --list-systems
```

### List Available Worlds

```bash
node foundry-manager.mjs --list-worlds
```

### List Object Types for a System

```bash
node foundry-manager.mjs --list-types -s dnd5e
```

### Validate an Object

```bash
node foundry-manager.mjs -s dnd5e -t actor '{"name":"Test Character","type":"character"}'
```

You can also validate an object from a file:

```bash
node foundry-manager.mjs -s dnd5e -t item -f my-item.json
```

### Insert an Object into a World

```bash
node foundry-manager.mjs -s dnd5e -t actor -w my-world -i '{"name":"Hero","type":"character"}'
```

### CRUD Operations

The tool supports Create, Read, Update, and Delete (CRUD) operations on objects within a world.

**READ: List/Search Objects**

```bash
# List all characters in 'my-world'
node foundry-manager.mjs -w my-world -t character -r

# Search for characters by name pattern (e.g., starting with "Hero")
node foundry-manager.mjs -w my-world -t character -r --name "Hero*"
```

**CREATE: Insert a New Object**

```bash
# Insert a new character into 'my-world'
node foundry-manager.mjs -w my-world -t character -i '{"name":"New Hero","type":"character"}'
```

**UPDATE: Modify an Existing Object**

```bash
# Update a character by its ID in 'my-world' (replace "abc123" with actual ID)
node foundry-manager.mjs -w my-world -t character -u --id "abc123" '{"system.attributes.hp.value":50}'
```

**DELETE: Remove an Object**

```bash
# Delete a character by its ID from 'my-world' (replace "abc123" with actual ID)
node foundry-manager.mjs -w my-world -t character -d --id "abc123"
```

### Image Validation

You can manage and validate images used by FoundryVTT.

```bash
# List all available images from core and system folders
node foundry-manager.mjs --list-images

# Filter images by a pattern (e.g., all .webp images)
node foundry-manager.mjs --list-images --image-pattern "*.webp"

# Skip image validation when inserting/updating objects (allow creation without images)
node foundry-manager.mjs -t actor -i '{"name":"No Image Actor"}' --no-image
```

### Schema Extraction

You can extract and display the expected JSON schema for a given object type.

```bash
# Get schema for 'weapon' type from the currently active world
node foundry-manager.mjs -t weapon --schema

# Get schema for 'weapon' type from a specific system (e.g., dnd5e)
node foundry-manager.mjs -s dnd5e -t weapon --schema
```

### Credential Management

Manage the administrator and world passwords for your FoundryVTT instance.

```bash
# Set the administrator password (you will be prompted securely)
node foundry-manager.mjs --set-admin-password

# Set a specific world's password (you will be prompted securely)
node foundry-manager.mjs --set-world-password

# Check the current status of stored credentials
node foundry-manager.mjs --credential-status

# Clear all stored credentials
node foundry-manager.mjs --clear-credentials
```

### Verbose Output

Enable verbose output for more detailed information during operations.

```bash
# Run any command with verbose output
node foundry-manager.mjs --list-systems -v
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
