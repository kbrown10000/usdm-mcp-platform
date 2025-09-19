#!/usr/bin/env node
/**
 * Test the railway-proxy-standalone.mjs server
 */

import { spawn } from 'child_process';
import readline from 'readline';

console.log('Starting MCPB Labor Server test...\n');

// Start the server
const server = spawn('node', ['server/railway-proxy-standalone.mjs'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: process.cwd()
});

// Create readline interface for stdin/stdout
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Handle server stderr (debug output)
server.stderr.on('data', (data) => {
  console.error(`[DEBUG] ${data.toString().trim()}`);
});

// Handle server stdout (MCP responses)
server.stdout.on('data', (data) => {
  try {
    const lines = data.toString().split('\n').filter(line => line.trim());
    for (const line of lines) {
      if (line.startsWith('{')) {
        const response = JSON.parse(line);
        console.log('\n📥 Response:', JSON.stringify(response, null, 2));
      }
    }
  } catch (e) {
    console.log('[RAW]', data.toString());
  }
});

// Send MCP requests
async function sendRequest(request) {
  return new Promise((resolve) => {
    console.log('\n📤 Sending:', JSON.stringify(request, null, 2));
    server.stdin.write(JSON.stringify(request) + '\n');
    setTimeout(resolve, 1000); // Wait for response
  });
}

async function runTests() {
  // Initialize
  await sendRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {}
    }
  });

  // List tools
  await sendRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  });

  // Test cache stats (should work without auth)
  await sendRequest({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'get_cache_stats',
      arguments: {}
    }
  });

  console.log('\n✅ Test complete! Check the responses above for:');
  console.log('1. No double-encoded JSON (should see clean text)');
  console.log('2. Proper error messages');
  console.log('3. Clean formatting');

  server.kill();
  process.exit(0);
}

// Error handling
server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Run tests
runTests();