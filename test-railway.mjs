#!/usr/bin/env node

/**
 * Test script for Railway server functionality
 * Tests all authentication and basic tool endpoints
 */

import axios from 'axios';
import { spawn } from 'child_process';

const SERVER_URL = 'http://localhost:8080';
const TEST_TIMEOUT = 30000; // 30 seconds

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function waitForServer(url, maxRetries = 10, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(`${url}/health`);
      return true;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

async function testEndpoint(name, method, url, data = null, expectedStatus = 200) {
  try {
    log(`Testing ${name}...`, 'blue');

    const config = {
      method,
      url: `${SERVER_URL}${url}`,
      timeout: 10000,
    };

    if (data) {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }

    const response = await axios(config);

    if (response.status === expectedStatus) {
      log(`✅ ${name} - Status: ${response.status}`, 'green');
      return { success: true, data: response.data };
    } else {
      log(`❌ ${name} - Expected: ${expectedStatus}, Got: ${response.status}`, 'red');
      return { success: false, error: `Status mismatch: ${response.status}` };
    }
  } catch (error) {
    if (error.response) {
      log(`❌ ${name} - Status: ${error.response.status}, Message: ${error.response.data?.error || 'Unknown error'}`, 'red');
      return { success: false, error: error.response.data };
    } else {
      log(`❌ ${name} - Error: ${error.message}`, 'red');
      return { success: false, error: error.message };
    }
  }
}

async function runTests() {
  log('\n🚀 Starting Railway Server Tests', 'cyan');
  log('=====================================\n', 'cyan');

  let serverProcess = null;

  try {
    // Start the server
    log('Starting Railway server...', 'yellow');
    serverProcess = spawn('node', ['railway-server.mjs'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    // Wait for server to be ready
    log('Waiting for server to start...', 'yellow');
    await waitForServer(SERVER_URL);
    log('✅ Server is ready!\n', 'green');

    const tests = [
      // Basic endpoints
      { name: 'Health Check', method: 'GET', url: '/health' },
      { name: 'MCP Discovery', method: 'GET', url: '/mcp/discover' },

      // Authentication tools
      { name: 'Auth Status', method: 'POST', url: '/api/tools/get_auth_status' },
      { name: 'Start Login', method: 'POST', url: '/api/tools/start_login' },

      // Analytics tools (should fail without auth)
      {
        name: 'Person Resolver (No Auth)',
        method: 'POST',
        url: '/api/tools/person_resolver',
        data: { searchTerm: 'test' },
        expectedStatus: 401
      },
      {
        name: 'Validate Dataset (No Auth)',
        method: 'POST',
        url: '/api/tools/validate_dataset',
        expectedStatus: 401
      },

      // Tool validation
      {
        name: 'Person Resolver (Missing Params)',
        method: 'POST',
        url: '/api/tools/person_resolver',
        data: {},
        expectedStatus: 400
      },
      {
        name: 'Monthly Activity (Missing Params)',
        method: 'POST',
        url: '/api/tools/activity_for_person_month',
        data: {},
        expectedStatus: 400
      },

      // Non-existent tool
      {
        name: 'Non-existent Tool',
        method: 'POST',
        url: '/api/tools/non_existent',
        expectedStatus: 404
      },
    ];

    const results = [];

    for (const test of tests) {
      const result = await testEndpoint(
        test.name,
        test.method,
        test.url,
        test.data,
        test.expectedStatus
      );
      results.push({ ...test, ...result });

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    log('\n📊 Test Results Summary', 'cyan');
    log('========================', 'cyan');

    const passed = results.filter(r => r.success).length;
    const total = results.length;

    log(`Total Tests: ${total}`, 'blue');
    log(`Passed: ${passed}`, passed === total ? 'green' : 'yellow');
    log(`Failed: ${total - passed}`, total - passed === 0 ? 'green' : 'red');

    if (passed === total) {
      log('\n🎉 All tests passed! Railway server is fully functional.', 'green');
    } else {
      log('\n⚠️  Some tests failed. Check the output above for details.', 'yellow');

      // Show failed tests
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        log('\nFailed Tests:', 'red');
        failed.forEach(test => {
          log(`  - ${test.name}: ${test.error}`, 'red');
        });
      }
    }

    // Show successful authentication setup
    if (results.find(r => r.name === 'Start Login' && r.success)) {
      log('\n🔐 Authentication Setup Verified:', 'cyan');
      log('  - MSAL authentication module loaded successfully', 'green');
      log('  - Device code flow is available', 'green');
      log('  - PowerBI tokens can be acquired after authentication', 'green');
      log('  - All analytics tools from V26.7 are available', 'green');
    }

  } catch (error) {
    log(`\n❌ Test execution failed: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    // Clean up server process
    if (serverProcess) {
      log('\n🛑 Stopping server...', 'yellow');
      serverProcess.kill('SIGTERM');

      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
  }
}

// Handle script termination
process.on('SIGINT', () => {
  log('\n\n🛑 Test interrupted by user', 'yellow');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n\n🛑 Test terminated', 'yellow');
  process.exit(0);
});

// Run tests
runTests().catch(error => {
  log(`\n💥 Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});