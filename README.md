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
3.  Create symbolic links to your FoundryVTT installation:
    ```bash
    # Link to FoundryVTT application files
    ln -s /path/to/FoundryVTT/resources foundry-app
    
    # Mount FoundryVTT data directory (use ./mount_foundry.sh for Venoure project)
    ```
    Note: Adjust the paths according to your FoundryVTT installation location.

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

- **FoundryVTT Validation**: This tool uses FoundryVTT's actual validation system. It does not create mock schemas or fallback validation.
- **System Module Loading**: Some systems (like D&D 5e) have complex dependencies that may prevent full system-specific validation from loading. However, core document validation always works.
- **Database Access**: Make sure FoundryVTT is not running when using this tool to avoid database conflicts.

## Development

The project is structured into several modules:

-   `foundry-manager.mjs`: The main CLI entry point.
-   `foundry-environment.mjs`: Sets up a minimal FoundryVTT environment.
-   `system-discovery.mjs`: Discovers installed systems and their data models.
-   `world-manager.mjs`: Handles interactions with FoundryVTT worlds.
-   `demo.mjs`: A demonstration script that shows various use cases.
