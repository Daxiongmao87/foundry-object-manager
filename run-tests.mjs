
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runTests() {
  try {
    const testFiles = await glob('test-*.mjs');
    for (const file of testFiles) {
      console.log(`Running test: ${file}`);
      try {
        const { stdout, stderr } = await execAsync(`node ${file}`);
        console.log(stdout);
        if (stderr) {
          console.error(stderr);
        }
      } catch (error) {
        console.error(`Error running test ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error finding test files:', error);
  }
}

runTests();
