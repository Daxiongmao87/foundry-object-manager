#!/usr/bin/env node

/**
 * Comprehensive test script to validate all original foundry-object-manager features
 * through the new Puppeteer-based system.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { FoundryServerManager } from './foundry-server-manager.mjs';
import CredentialManager from './credential-manager.mjs';
import FoundryPuppeteerValidator from './foundry-puppeteer-validator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const FOUNDRY_PATH = process.env.FOUNDRY_PATH || path.join(__dirname, 'foundry-app/resources/app/main.mjs');
const DATA_PATH = process.env.FOUNDRY_DATA_PATH || path.join(process.env.HOME, '.local/share/FoundryVTT/Data');
const SERVER_URL = process.env.FOUNDRY_SERVER_URL || 'http://localhost:30000'; // Default URL

const foundryEnv = {
    foundryPath: FOUNDRY_PATH,
    dataPath: DATA_PATH,
    resourcesPath: path.join(FOUNDRY_PATH, '..', '..', 'resources'),
    serverUrl: SERVER_URL
};

const testWorldId = 'testania'; // The world to use for testing

let serverManager;
let validator;
let testResults = [];
let createdObjectId = null; // To store the ID of the object created during tests for deletion
let createdJournalEntryId = null;
let createdRollTableId = null;

// --- Helper Functions ---
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function runTest(testName, testFunction) {
    log(`Starting test: ${testName}`);
    try {
        await testFunction();
        log(`✅ Test passed: ${testName}`, 'success');
        testResults.push({ name: testName, status: 'PASS' });
    } catch (error) {
        log(`❌ Test failed: ${testName} - ${error.message}`, 'error');
        testResults.push({ name: testName, status: 'FAIL', error: error.message });
    }
}

async function setup() {
    log('🚀 Setting up test environment...');
    try {
        const credentialManager = new CredentialManager();
        serverManager = new FoundryServerManager(foundryEnv, credentialManager);
        validator = new FoundryPuppeteerValidator(serverManager);

        // Start server
        if (!serverManager.isServerRunning()) {
            log('Starting FoundryVTT server...');
            await serverManager.startServer(testWorldId);
            log('Server started.');
        } else {
            log('FoundryVTT server already running.');
        }

        // Initialize browser
        if (!serverManager.browser) {
            log('Initializing browser...');
            const browserInitialized = await serverManager.initializeBrowser();
            if (!browserInitialized) {
                throw new Error('Failed to initialize browser.');
            }
            log('Browser initialized.');
        } else {
            log('Browser already initialized.');
        }

        // Authenticate
        if (!serverManager.authenticated) {
            log('Authenticating with FoundryVTT...');
            const authenticated = await serverManager.authenticateWithFoundry();
            if (!authenticated) {
                throw new Error('Authentication failed. Please check your credentials.');
            }
            log('Authentication successful.');
        } else {
            log('Already authenticated.');
        }

        // Activate world
        if (!serverManager.gameReady || serverManager.activeWorldId !== testWorldId) {
            log(`Activating world: ${testWorldId}...`);
            const worldActivated = await serverManager.activateWorld(testWorldId);
            if (!worldActivated) {
                throw new Error(`Failed to activate world: ${testWorldId}.`);
            }
            log(`World '${testWorldId}' activated.`);
        } else {
            log(`World '${testWorldId}' already active.`);
        }

        log('✅ Test environment setup complete.');
    } catch (error) {
        log(`❌ Setup failed: ${error.message}`, 'error');
        await teardown(); // Attempt cleanup on setup failure
        process.exit(1);
    }
}

async function teardown() {
    log('🧹 Cleaning up test environment...');
    if (serverManager) {
        // Delete created objects
        if (createdObjectId) {
            log(`Deleting created Actor with ID: ${createdObjectId}`);
            await serverManager.worldManager.deleteObject(testWorldId, 'Actor', createdObjectId).catch(e => log(`Failed to delete Actor ${createdObjectId}: ${e.message}`, 'error'));
        }
        if (createdJournalEntryId) {
            log(`Deleting created JournalEntry with ID: ${createdJournalEntryId}`);
            await serverManager.worldManager.deleteObject(testWorldId, 'JournalEntry', createdJournalEntryId).catch(e => log(`Failed to delete JournalEntry ${createdJournalEntryId}: ${e.message}`, 'error'));
        }
        if (createdRollTableId) {
            log(`Deleting created RollTable with ID: ${createdRollTableId}`);
            await serverManager.worldManager.deleteObject(testWorldId, 'RollTable', createdRollTableId).catch(e => log(`Failed to delete RollTable ${createdRollTableId}: ${e.message}`, 'error'));
        }

        await serverManager.cleanup();
    }
    // Clean up temporary JSON files
    if (existsSync(path.join(__dirname, 'create-object-data.json'))) {
        rmSync(path.join(__dirname, 'create-object-data.json'));
        log('Removed create-object-data.json');
    }
    if (existsSync(path.join(__dirname, 'update-object-data.json'))) {
        rmSync(path.join(__dirname, 'update-object-data.json'));
        log('Removed update-object-data.json');
    }
    log('Cleanup complete.');
}

function generateReport() {
    console.log('='.repeat(60));
    console.log('COMPREHENSIVE FEATURE TEST REPORT');
    console.log('='.repeat(60));
    
    console.log('📊 TEST RESULTS:');
    testResults.forEach((result, index) => {
        const status = result.status === 'PASS' ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${result.name}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    const passedTests = testResults.filter(r => r.status === 'PASS').length;
    const failedTests = testResults.filter(r.status === 'FAIL').length;
    
    console.log(`📈 SUMMARY: ${passedTests} passed, ${failedTests} failed`);
    
    if (failedTests === 0) {
        console.log('🎉 All comprehensive feature tests passed!');
    } else {
        console.log('⚠️  FAILED TESTS:');
        testResults.filter(r => r.status === 'FAIL').forEach(test => console.log(`   - ${test.name}`));
    }
    
    console.log('='.repeat(60));
}

// --- Feature Test Functions ---

async function testListSystemObjectTypes() {
    const result = await validator.getSystemObjectTypes();
    if (!result || !Object.keys(result).length) {
        throw new Error(`Expected to list object types, but got: ${JSON.stringify(result)}`);
    }
    log(`Found ${Object.keys(result).length} object types. Example: ${Object.keys(result)[0]}`);
}

async function testGetObjectSchema() {
    const objectType = 'Actor';
    const result = await validator.getSchema(objectType);
    if (!result.success || !result.fields) {
        throw new Error(`Expected to get schema for ${objectType}, but got: ${JSON.stringify(result)}`);
    }
    log(`Retrieved schema for ${objectType}. Field count: ${Object.keys(result.fields).length}`);
}

async function testListObjects() {
    const objectType = 'Actor'; // Assuming 'Actor' is a common type
    const result = await validator.listObjects(testWorldId, objectType, { limit: 2 });
    if (!result.success || !Array.isArray(result.documents)) {
        throw new Error(`Expected to list ${objectType}s, but got: ${JSON.stringify(result)}`);
    }
    log(`Listed ${result.totalFound} ${objectType}s. Showing first ${result.documents.length}.`);
}

async function testSearchObjects() {
    const objectType = 'Item'; // Assuming 'Item' is a common type
    const searchName = 'Test*'; // Search for items starting with 'Test'
    const result = await validator.searchObjects(testWorldId, objectType, { name: searchName, limit: 1 });
    if (!result.success || !Array.isArray(result.documents)) {
        throw new Error(`Expected to search ${objectType}s by name "${searchName}", but got: ${JSON.stringify(result)}`);
    }
    log(`Searched ${objectType}s by name "${searchName}". Found ${result.totalFound}.`);
}

async function testCreateObject() {
    const objectType = 'Actor';
    const objectData = {
        name: 'Test Actor CLI',
        type: 'character',
        img: 'icons/svg/mystery-man.svg',
        system: {
            attributes: {
                hp: { value: 10, max: 10 }
            }
        }
    };
    const dataFilePath = path.join(__dirname, 'create-object-data.json');
    writeFileSync(dataFilePath, JSON.stringify(objectData, null, 2));
    log(`Created temporary data file: ${dataFilePath}`);

    const result = await validator.createObject(testWorldId, objectType, objectData);
    if (!result.success || !result.documentId) {
        throw new Error(`Expected to create ${objectType}, but got: ${JSON.stringify(result)}`);
    }
    createdObjectId = result.documentId;
    log(`Successfully created ${objectType} with ID: ${createdObjectId}`);

    // Verify creation by attempting to retrieve it
    const retrieveResult = await validator.searchObjects(testWorldId, objectType, { id: createdObjectId });
    if (!retrieveResult.success || retrieveResult.totalFound !== 1 || retrieveResult.documents[0]._id !== createdObjectId) {
        throw new Error(`Failed to verify creation of object with ID ${createdObjectId}`);
    }
    log(`Verified creation of object with ID: ${createdObjectId}`);
}

async function testUpdateObject() {
    if (!createdObjectId) {
        throw new Error('Cannot test update: no object was created in previous step.');
    }

    const objectType = 'Actor';
    const updateData = {
        name: 'Test Actor CLI Updated',
        system: {
            attributes: {
                hp: { value: 15 }
            }
        }
    };
    const dataFilePath = path.join(__dirname, 'update-object-data.json');
    writeFileSync(dataFilePath, JSON.stringify(updateData, null, 2));
    log(`Created temporary update data file: ${dataFilePath}`);

    const result = await validator.updateObject(testWorldId, objectType, createdObjectId, updateData);
    if (!result.success || result.documentId !== createdObjectId) {
        throw new Error(`Expected to update ${objectType} ${createdObjectId}, but got: ${JSON.stringify(result)}`);
    }
    log(`Successfully updated ${objectType} with ID: ${createdObjectId}`);

    // Verify update by retrieving and checking name/hp
    const retrieveResult = await validator.searchObjects(testWorldId, objectType, { id: createdObjectId });
    if (!retrieveResult.success || retrieveResult.totalFound !== 1 || retrieveResult.documents[0].name !== updateData.name || retrieveResult.documents[0].system.attributes.hp.value !== updateData.system.attributes.hp.value) {
        throw new Error(`Failed to verify update of object with ID ${createdObjectId}`);
    }
    log(`Verified update of object with ID: ${createdObjectId}`);
}

async function testDeleteObject() {
    if (!createdObjectId) {
        throw new Error('Cannot test delete: no object was created in previous step.');
    }

    const objectType = 'Actor';
    const result = await validator.deleteObject(testWorldId, objectType, createdObjectId);
    if (!result.success || result.documentId !== createdObjectId) {
        throw new Error(`Expected to delete ${objectType} ${createdObjectId}, but got: ${JSON.stringify(result)}`);
    }
    log(`Successfully deleted ${objectType} with ID: ${createdObjectId}`);

    // Verify deletion by attempting to retrieve it (should not be found)
    const retrieveResult = await validator.searchObjects(testWorldId, objectType, { id: createdObjectId });
    if (retrieveResult.success && retrieveResult.totalFound > 0) {
        throw new Error(`Failed to verify deletion: object with ID ${createdObjectId} still found.`);
    }
    log(`Verified deletion of object with ID: ${createdObjectId}`);
}

async function testCreateJournalEntry() {
    const objectType = 'JournalEntry';
    const objectData = {
        name: 'Test Journal Entry CLI',
        content: 'This is a test journal entry created by the CLI.',
        img: 'icons/svg/book.svg' // A common default image for JournalEntry
    };

    const result = await validator.createObject(testWorldId, objectType, objectData);
    if (!result.success || !result.documentId) {
        throw new Error(`Expected to create ${objectType}, but got: ${JSON.stringify(result)}`);
    }
    createdJournalEntryId = result.documentId;
    log(`Successfully created ${objectType} with ID: ${createdJournalEntryId}`);

    // Verify creation by attempting to retrieve it
    const retrieveResult = await validator.searchObjects(testWorldId, objectType, { id: createdJournalEntryId });
    if (!retrieveResult.success || retrieveResult.totalFound !== 1 || retrieveResult.documents[0]._id !== createdJournalEntryId) {
        throw new Error(`Failed to verify creation of JournalEntry with ID ${createdJournalEntryId}`);
    }
    log(`Verified creation of JournalEntry with ID: ${createdJournalEntryId}`);
}

async function testCreateRollTable() {
    const objectType = 'RollTable';
    const objectData = {
        name: 'Test Roll Table CLI',
        img: 'icons/svg/dice-target.svg', // A common default image for RollTable
        results: [
            { text: 'Result 1', weight: 1 },
            { text: 'Result 2', weight: 1 }
        ]
    };

    const result = await validator.createObject(testWorldId, objectType, objectData);
    if (!result.success || !result.documentId) {
        throw new Error(`Expected to create ${objectType}, but got: ${JSON.stringify(result)}`);
    }
    createdRollTableId = result.documentId;
    log(`Successfully created ${objectType} with ID: ${createdRollTableId}`);

    // Verify creation by attempting to retrieve it
    const retrieveResult = await validator.searchObjects(testWorldId, objectType, { id: createdRollTableId });
    if (!retrieveResult.success || retrieveResult.totalFound !== 1 || retrieveResult.documents[0]._id !== createdRollTableId) {
        throw new Error(`Failed to verify creation of RollTable with ID ${createdRollTableId}`);
    }
    log(`Verified creation of RollTable with ID: ${createdRollTableId}`);
}

// --- Main Execution ---
(async () => {
    await setup();
    
    await runTest('1. List system object types', testListSystemObjectTypes);
    await runTest('2. Get object schema for specific types', testGetObjectSchema);
    await runTest('3. List objects of specific type from world', testListObjects);
    await runTest('4. Search objects from world', testSearchObjects);
    await runTest('5. Create new Actor object', testCreateObject);
    await runTest('6. Update existing Actor object', testUpdateObject);
    await runTest('7. Delete Actor object', testDeleteObject);
    await runTest('8. Create new JournalEntry object', testCreateJournalEntry);
    await runTest('9. Create new RollTable object', testCreateRollTable);

    await teardown();
    generateReport();
})();