# FoundryVTT Object Manager - Venoure Integration

This directory contains the [foundry-object-manager](https://github.com/Daxiongmao87/foundry-object-manager) as a git submodule.

## Setup

1. **Initialize the submodule** (if not already done):
   ```bash
   git submodule update --init --recursive
   ```

2. **Mount FoundryVTT directories**:
   ```bash
   # From the project root
   ./mount_foundry.sh
   ```
   This creates the required `foundry-app` and `foundry-data` mount points via sshfs.

3. **Install dependencies**:
   ```bash
   cd Campaign/Foundry
   npm install
   ```

## Usage in Venoure Campaign

The foundry-manager.mjs tool is used for all FoundryVTT data operations:

```bash
# Navigate to the Foundry directory
cd Campaign/Foundry

# List available worlds
node foundry-manager.mjs -l --listWorlds

# Search for Venoure campaign objects
node foundry-manager.mjs -s dnd5e -t actor -w venoure -r --name "Asher"

# Insert new objects from campaign data
node foundry-manager.mjs -s dnd5e -t actor -w venoure -i '{"name":"New NPC","type":"npc"}'
```

## Updating the Submodule

To get the latest version of foundry-object-manager:

```bash
cd Campaign/Foundry
git pull origin main
cd ../..
git add Campaign/Foundry
git commit -m "Update foundry-object-manager submodule"
```

## Documentation

- Main tool documentation: See the [README.md](./README.md) in this directory
- Venoure-specific guidelines: See [Guidelines/vtt_data_management_guidelines.md](../../Guidelines/vtt_data_management_guidelines.md)
- Campaign integration workflows: See the main [CLAUDE.md](../../CLAUDE.md)