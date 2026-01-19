#!/usr/bin/env node

/**
 * Wrapper script to run integration tests with API key as CLI argument
 * Usage: npm run integration -- --api-key YOUR_KEY
 */

import { spawn } from 'child_process';

// Parse command line arguments
const args = process.argv.slice(2);
let apiKey = null;
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
  console.error('Usage: npm run integration -- --api-key YOUR_API_KEY');
  process.exit(1);
}

// Set environment variables
const env = {
  ...process.env,
  MCP_SERVER_URL: 'https://iterable-mcp-server.nodemaker.workers.dev',
  ITERABLE_API_KEY: apiKey,
};

// Run vitest with the environment variables
const vitest = spawn('vitest', ['run', '--config', 'vitest.integration.config.ts', ...vitestArgs], {
  env,
  stdio: 'inherit',
  shell: true,
});

vitest.on('exit', (code) => {
  process.exit(code || 0);
});
