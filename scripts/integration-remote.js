#!/usr/bin/env node

/**
 * Run integration tests against deployed Cloudflare Worker
 *
 * Usage: npm run integration:remote -- --api-key YOUR_API_KEY
 */

import { spawn } from 'child_process';

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
  console.error('Usage: npm run integration:remote -- --api-key YOUR_API_KEY');
  console.error('   or: export ITERABLE_API_KEY=YOUR_API_KEY && npm run integration:remote');
  process.exit(1);
}

// Deployed worker URL
const DEPLOYED_URL = 'https://iterable-mcp-server.nodemaker.workers.dev';

/**
 * Check if server is reachable
 */
async function checkServer(url) {
  console.log(`🏥 Checking server at ${url}...`);
  try {
    const response = await fetch(url);
    if (response.ok) {
      console.log('✅ Server is reachable!');
      return true;
    }
  } catch (error) {
    console.error('❌ Server is not reachable:', error.message);
    return false;
  }
  return false;
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
  try {
    console.log('🌍 Starting remote integration test');
    console.log(`   URL: ${DEPLOYED_URL}`);
    console.log('='.repeat(60));

    // Check if server is reachable
    const isReachable = await checkServer(DEPLOYED_URL);
    if (!isReachable) {
      console.error('\n❌ Server is not reachable. Make sure your worker is deployed.');
      process.exit(1);
    }

    // Run tests
    const exitCode = await runTests(DEPLOYED_URL, apiKey, vitestArgs);

    console.log('\n' + '='.repeat(60));
    if (exitCode === 0) {
      console.log('✅ All tests passed!');
    } else {
      console.log('❌ Tests failed');
    }

    process.exit(exitCode);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
