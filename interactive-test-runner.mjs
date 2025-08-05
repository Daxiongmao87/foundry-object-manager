import { FoundryServerManager } from './foundry-server-manager.mjs';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function runInteractiveTests() {
  const serverManager = new FoundryServerManager();

  try {
    console.log('Starting FoundryVTT server for manual world activation...');
    await serverManager.startServer();

    console.log('\n\n');
    console.log('********************************************************************');
    console.log('** Please manually activate a world in your browser.              **');
    console.log(`** URL: ${serverManager.getServerUrl()}                                     **`);
    console.log('** After activating the world, press Enter in this terminal.      **');
    console.log('********************************************************************');

    await promptUser('Press Enter to continue...');

    console.log('\nWorld activated. Running tests...');

    try {
      const { stdout, stderr } = await execAsync('node run-tests.mjs');
      console.log('--- TEST RUNNER STDOUT ---');
      console.log(stdout);
      if (stderr) {
        console.error('--- TEST RUNNER STDERR ---');
        console.error(stderr);
      }
      console.log('--- END OF TEST RUN ---');
    } catch (error) {
      console.error('Error running tests:', error);
    }

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    console.log('Stopping FoundryVTT server...');
    await serverManager.stopServer();
  }
}

runInteractiveTests();
