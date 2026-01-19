#!/usr/bin/env node

/**
 * Run integration tests against local wrangler dev server
 * Starts wrangler dev on a random port, runs tests, then cleans up
 *
 * Usage: npm run integration:local -- --api-key YOUR_API_KEY
 */

import { spawn } from 'child_process';
import { createServer } from 'net';

// Parse command line arguments
const args = process.argv.slice(2);
let apiKey = process.env.ITERABLE_API_KEY || null;
const vitestArgs = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--api-key' && i + 1 < args.length) {
    apiKey = args[i + 1];
    i++; // Skip the next argument (the API key value)
  } else {
    vitestArgs.push(args[i]);
  }
}

// Check if API key is provided
if (!apiKey) {
  console.error('Error: API key is required');
  console.error('Usage: npm run integration:local -- --api-key YOUR_API_KEY');
  console.error('   or: export ITERABLE_API_KEY=YOUR_API_KEY && npm run integration:local');
  process.exit(1);
}

/**
 * Find a free port
 */
async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/**
 * Wait for server to be ready by checking health endpoint
 */
async function waitForServer(url, maxAttempts = 30) {
  console.log(`Waiting for server at ${url}...`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('✅ Server is ready!');
        return true;
      }
    } catch (error) {
      // Server not ready yet, wait and retry
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Server failed to start within timeout');
}

/**
 * Start wrangler dev server
 */
async function startWranglerDev(port) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Starting wrangler dev on port ${port}...`);

    const wrangler = spawn('wrangler', ['dev', '--port', port.toString()], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let output = '';

    wrangler.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);

      // Check if server is ready
      if (output.includes('Ready on') || output.includes('Listening on')) {
        resolve(wrangler);
      }
    });

    wrangler.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    wrangler.on('error', (error) => {
      reject(error);
    });

    wrangler.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Wrangler exited with code ${code}`));
      }
    });
  });
}

/**
 * Run integration tests
 */
async function runTests(serverUrl, apiKey, vitestArgs) {
  return new Promise((resolve, reject) => {
    console.log('\n🧪 Running integration tests...\n');

    const env = {
      ...process.env,
      MCP_SERVER_URL: serverUrl,
      ITERABLE_API_KEY: apiKey,
    };

    const vitest = spawn('vitest', ['run', '--config', 'vitest.integration.config.ts', ...vitestArgs], {
      env,
      stdio: 'inherit',
      shell: true,
    });

    vitest.on('exit', (code) => {
      resolve(code);
    });

    vitest.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main execution
 */
async function main() {
  let wranglerProcess = null;

  try {
    // Find a free port
    const port = await findFreePort();
    const serverUrl = `http://localhost:${port}`;

    console.log('📦 Starting local integration test');
    console.log(`   Port: ${port}`);
    console.log(`   URL: ${serverUrl}`);
    console.log('='.repeat(60));

    // Start wrangler dev
    wranglerProcess = await startWranglerDev(port);

    // Wait for server to be ready
    await waitForServer(serverUrl, 30);

    // Run tests
    const exitCode = await runTests(serverUrl, apiKey, vitestArgs);

    // Cleanup
    if (wranglerProcess) {
      console.log('\n🧹 Stopping wrangler dev...');
      wranglerProcess.kill('SIGTERM');

      // Give it a moment to clean up
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(60));
    if (exitCode === 0) {
      console.log('✅ All tests passed!');
    } else {
      console.log('❌ Tests failed');
    }

    process.exit(exitCode);

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    // Cleanup on error
    if (wranglerProcess) {
      wranglerProcess.kill('SIGTERM');
    }

    process.exit(1);
  }
}

main();
