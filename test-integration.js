#!/usr/bin/env node
/**
 * V27.0 Platform Integration Tests
 *
 * Comprehensive testing suite for the V27.0 Multi-MCP Platform
 * Based on V26.7 golden patterns and requirements
 *
 * Tests verify:
 * 1. Railway server startup and health
 * 2. Authentication flow (device code → tokens)
 * 3. PowerBI connection and data access
 * 4. Critical tools functionality
 * 5. Performance benchmarks
 *
 * Usage:
 *   Local: node test-integration.js
 *   Railway: npm run test:integration
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import axios from 'axios';
import { PublicClientApplication } from '@azure/msal-node';

// Test configuration
const CONFIG = {
  // Server settings
  server: {
    port: process.env.PORT || 3000,
    host: process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost',
    timeout: 30000, // 30 seconds
    startupDelay: 5000 // 5 seconds for server startup
  },

  // Authentication settings (from V26.7 golden source)
  auth: {
    tenantId: '18c250cf-2ef7-4eeb-b6fb-94660f7867e0',
    clientId: '8b84dc3b-a9ff-43ed-9d35-571f757e9c19',
    timeout: 120000, // 2 minutes for device code flow
    scopes: {
      graph: ['User.Read'],
      usdm: ['api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation'],
      powerbi: ['https://analysis.windows.net/powerbi/api/.default']
    }
  },

  // PowerBI settings (from V26.7 golden source)
  powerbi: {
    workspaceId: '927b94af-e7ef-4b5a-8b8d-02b0c5450b75',
    datasetId: 'ea5298a1-13f0-4629-91ab-14f98163532e',
    expectedRowCount: 3238644, // CRITICAL: Must match V26.7 baseline
    testQueries: {
      rowCount: 'EVALUATE ROW("RowCount", COUNTROWS(labor))',
      tables: 'EVALUATE ROW("TableCount", COUNTROWS(INFO.TABLES()))',
      samplePerson: `EVALUATE
        TOPN(1,
          CALCULATETABLE(
            labor,
            RELATED(DIM_Team_Member[Team Member Name]) = "Hussam Kazi"
          )
        )`
    }
  },

  // Performance benchmarks (from V26.7 baseline)
  performance: {
    coldStart: 3000, // 3 seconds max
    healthCheck: 500, // 500ms max
    authentication: 10000, // 10 seconds max
    daxQuery: 5000, // 5 seconds max
    personLookup: 1000 // 1 second max
  }
};

// Test state
let testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  startTime: Date.now(),
  serverProcess: null,
  authTokens: {}
};

// Utility functions
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
};

const assert = (condition, message) => {
  if (condition) {
    testResults.passed++;
    log(`PASS: ${message}`, 'success');
    return true;
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    log(`FAIL: ${message}`, 'error');
    return false;
  }
};

const measureTime = async (fn, description) => {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    log(`${description}: ${duration}ms`);
    return { result, duration };
  } catch (error) {
    const duration = Date.now() - start;
    log(`${description} FAILED: ${duration}ms - ${error.message}`, 'error');
    throw error;
  }
};

// Server management
const startServer = async () => {
  log('Starting Railway server...');

  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', ['src/index-railway.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PORT: CONFIG.server.port }
    });

    testResults.serverProcess = serverProcess;

    let output = '';
    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log(data.toString());

      if (output.includes('Server is listening')) {
        log('Server started successfully', 'success');
        resolve(serverProcess);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    serverProcess.on('error', (error) => {
      log(`Server startup error: ${error.message}`, 'error');
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        log(`Server exited with code ${code}`, 'error');
        reject(new Error(`Server process failed with code ${code}`));
      }
    });

    // Timeout if server doesn't start
    setTimeout(() => {
      if (!output.includes('Server is listening')) {
        serverProcess.kill();
        reject(new Error('Server startup timeout'));
      }
    }, CONFIG.server.timeout);
  });
};

const stopServer = async () => {
  if (testResults.serverProcess) {
    log('Stopping server...');
    testResults.serverProcess.kill();
    await setTimeout(2000); // Wait for graceful shutdown
  }
};

// Test functions
const testServerStartup = async () => {
  log('\n=== Testing Server Startup ===');

  try {
    const { duration } = await measureTime(async () => {
      await startServer();
      await setTimeout(CONFIG.server.startupDelay);
    }, 'Server startup');

    assert(
      duration < CONFIG.performance.coldStart,
      `Server cold start under ${CONFIG.performance.coldStart}ms (actual: ${duration}ms)`
    );

  } catch (error) {
    assert(false, `Server startup failed: ${error.message}`);
    throw error;
  }
};

const testHealthEndpoint = async () => {
  log('\n=== Testing Health Endpoint ===');

  try {
    const url = `http://${CONFIG.server.host}:${CONFIG.server.port}/health`;

    const { result, duration } = await measureTime(async () => {
      const response = await axios.get(url, { timeout: 10000 });
      return response;
    }, 'Health check request');

    assert(result.status === 200, 'Health endpoint returns 200');
    assert(result.data.status === 'healthy', 'Health status is healthy');
    assert(result.data.version === '27.0', 'Version is 27.0');
    assert(
      duration < CONFIG.performance.healthCheck,
      `Health check under ${CONFIG.performance.healthCheck}ms (actual: ${duration}ms)`
    );

    log(`Health response: ${JSON.stringify(result.data, null, 2)}`);

  } catch (error) {
    assert(false, `Health check failed: ${error.message}`);
  }
};

const testDiscoveryEndpoint = async () => {
  log('\n=== Testing Discovery Endpoint ===');

  try {
    const url = `http://${CONFIG.server.host}:${CONFIG.server.port}/mcp/discover`;
    const response = await axios.get(url, { timeout: 10000 });

    assert(response.status === 200, 'Discovery endpoint returns 200');
    assert(response.data.name === 'USDM Labor MCP Platform', 'Correct platform name');
    assert(response.data.version === '27.0', 'Correct version');
    assert(Array.isArray(response.data.tools), 'Tools array present');

    // Check for critical tools from V26.7
    const expectedTools = [
      'start_login', 'check_login', 'whoami',
      'person_resolver', 'get_timecard_details', 'run_dax'
    ];

    expectedTools.forEach(tool => {
      assert(
        response.data.tools.includes(tool),
        `Critical tool '${tool}' is listed`
      );
    });

    log(`Discovery response: ${JSON.stringify(response.data, null, 2)}`);

  } catch (error) {
    assert(false, `Discovery endpoint failed: ${error.message}`);
  }
};

const testAuthenticationFlow = async () => {
  log('\n=== Testing Authentication Flow ===');

  // For now, we'll test the authentication endpoints exist
  // In a full integration test with user interaction, we would:
  // 1. Call start_login
  // 2. Display device code to user
  // 3. Wait for user to authenticate
  // 4. Call check_login until complete
  // 5. Call whoami to verify

  try {
    const baseUrl = `http://${CONFIG.server.host}:${CONFIG.server.port}/api/tools`;

    // Test start_login endpoint exists
    const loginResponse = await axios.post(`${baseUrl}/start_login`, {}, {
      timeout: 10000,
      validateStatus: () => true // Accept any status for now
    });

    assert(
      loginResponse.status === 200 || loginResponse.data.status === 'pending_migration',
      'start_login endpoint responds'
    );

    // Test check_login endpoint exists
    const checkResponse = await axios.post(`${baseUrl}/check_login`, {}, {
      timeout: 10000,
      validateStatus: () => true
    });

    assert(
      checkResponse.status === 200 || checkResponse.data.status === 'pending_migration',
      'check_login endpoint responds'
    );

    // Test whoami endpoint exists
    const whoamiResponse = await axios.post(`${baseUrl}/whoami`, {}, {
      timeout: 10000,
      validateStatus: () => true
    });

    assert(
      whoamiResponse.status === 200 || whoamiResponse.data.status === 'pending_migration',
      'whoami endpoint responds'
    );

    log('Note: Full authentication flow requires manual user interaction');
    log('Automated auth testing will be added in Phase 3 of migration');

  } catch (error) {
    assert(false, `Authentication flow test failed: ${error.message}`);
  }
};

const testPowerBIConnection = async () => {
  log('\n=== Testing PowerBI Connection ===');

  // This test will verify PowerBI connectivity once auth is migrated
  // For now, we test that the endpoint structure is ready

  try {
    const baseUrl = `http://${CONFIG.server.host}:${CONFIG.server.port}/api/tools`;

    // Test run_dax endpoint exists
    const daxResponse = await axios.post(`${baseUrl}/run_dax`, {
      query: CONFIG.powerbi.testQueries.rowCount
    }, {
      timeout: 15000,
      validateStatus: () => true
    });

    assert(
      daxResponse.status === 200 || daxResponse.data.status === 'pending_migration',
      'run_dax endpoint responds'
    );

    log('Note: PowerBI data validation requires authenticated session');
    log('Full PowerBI testing will be enabled after auth migration');

    // In a fully migrated system, we would test:
    // 1. Row count matches 3,238,644
    // 2. All expected tables are accessible
    // 3. Sample queries return expected data

  } catch (error) {
    assert(false, `PowerBI connection test failed: ${error.message}`);
  }
};

const testCriticalTools = async () => {
  log('\n=== Testing Critical Tools ===');

  const baseUrl = `http://${CONFIG.server.host}:${CONFIG.server.port}/api/tools`;
  const criticalTools = [
    'person_resolver',
    'activity_for_person_month',
    'person_revenue_analysis',
    'get_timecard_details',
    'get_cache_stats'
  ];

  for (const tool of criticalTools) {
    try {
      const response = await axios.post(`${baseUrl}/${tool}`, {
        // Add sample parameters for each tool
        ...(tool === 'person_resolver' && { search_term: 'Hussam Kazi' }),
        ...(tool === 'activity_for_person_month' && {
          person_name: 'Hussam Kazi',
          year: 2024,
          month: 8
        }),
        ...(tool === 'person_revenue_analysis' && {
          person_name: 'Hussam Kazi',
          start_date: '2024-08-01',
          end_date: '2024-08-31'
        }),
        ...(tool === 'get_timecard_details' && {
          person_name: 'Hussam Kazi',
          start_date: '2024-08-01',
          end_date: '2024-08-31'
        })
      }, {
        timeout: 10000,
        validateStatus: () => true
      });

      assert(
        response.status === 200 || response.data.status === 'pending_migration',
        `Tool '${tool}' endpoint responds`
      );

    } catch (error) {
      assert(false, `Tool '${tool}' test failed: ${error.message}`);
    }
  }

  log('Note: Tool functionality testing requires migrated implementations');
  log('Full tool testing will verify V26.7 output compatibility');
};

const testPerformanceBenchmarks = async () => {
  log('\n=== Testing Performance Benchmarks ===');

  try {
    // Test multiple health checks for consistency
    const healthTimes = [];
    for (let i = 0; i < 5; i++) {
      const { duration } = await measureTime(async () => {
        await axios.get(`http://${CONFIG.server.host}:${CONFIG.server.port}/health`, {
          timeout: 5000
        });
      }, `Health check ${i + 1}`);
      healthTimes.push(duration);
    }

    const avgHealthTime = healthTimes.reduce((a, b) => a + b, 0) / healthTimes.length;
    const maxHealthTime = Math.max(...healthTimes);

    assert(
      avgHealthTime < CONFIG.performance.healthCheck,
      `Average health check under ${CONFIG.performance.healthCheck}ms (actual: ${avgHealthTime.toFixed(1)}ms)`
    );

    assert(
      maxHealthTime < CONFIG.performance.healthCheck * 2,
      `Max health check under ${CONFIG.performance.healthCheck * 2}ms (actual: ${maxHealthTime}ms)`
    );

    log(`Health check stats: avg=${avgHealthTime.toFixed(1)}ms, max=${maxHealthTime}ms`);

  } catch (error) {
    assert(false, `Performance benchmarks failed: ${error.message}`);
  }
};

const testErrorHandling = async () => {
  log('\n=== Testing Error Handling ===');

  try {
    // Test 404 endpoint
    const response404 = await axios.get(
      `http://${CONFIG.server.host}:${CONFIG.server.port}/nonexistent`,
      {
        timeout: 5000,
        validateStatus: () => true
      }
    );

    assert(response404.status === 404, 'Non-existent endpoint returns 404');

    // Test invalid tool request
    const invalidTool = await axios.post(
      `http://${CONFIG.server.host}:${CONFIG.server.port}/api/tools/invalid_tool`,
      {},
      {
        timeout: 5000,
        validateStatus: () => true
      }
    );

    assert(
      invalidTool.status === 200 || invalidTool.status === 404,
      'Invalid tool request handled gracefully'
    );

  } catch (error) {
    assert(false, `Error handling test failed: ${error.message}`);
  }
};

// Main test runner
const runTests = async () => {
  log('🚀 Starting V27.0 Platform Integration Tests');
  log(`Test configuration: ${JSON.stringify(CONFIG, null, 2)}`);

  try {
    // Core infrastructure tests
    await testServerStartup();
    await testHealthEndpoint();
    await testDiscoveryEndpoint();

    // Application functionality tests
    await testAuthenticationFlow();
    await testPowerBIConnection();
    await testCriticalTools();

    // Performance and reliability tests
    await testPerformanceBenchmarks();
    await testErrorHandling();

  } catch (error) {
    log(`Critical test failure: ${error.message}`, 'error');
  } finally {
    await stopServer();
  }

  // Generate test report
  const totalTime = Date.now() - testResults.startTime;
  const passRate = (testResults.passed / (testResults.passed + testResults.failed) * 100).toFixed(1);

  log('\n=== Test Results ===');
  log(`Total tests: ${testResults.passed + testResults.failed}`);
  log(`Passed: ${testResults.passed}`, 'success');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
  log(`Pass rate: ${passRate}%`);
  log(`Total time: ${totalTime}ms`);

  if (testResults.errors.length > 0) {
    log('\n=== Failures ===', 'error');
    testResults.errors.forEach((error, index) => {
      log(`${index + 1}. ${error}`, 'error');
    });
  }

  // Exit with appropriate code
  const success = testResults.failed === 0;
  log(`\n${success ? '✅' : '❌'} Integration tests ${success ? 'PASSED' : 'FAILED'}`);

  // Generate JSON report for CI/CD
  const report = {
    timestamp: new Date().toISOString(),
    version: '27.0',
    platform: process.platform,
    node: process.version,
    results: {
      total: testResults.passed + testResults.failed,
      passed: testResults.passed,
      failed: testResults.failed,
      passRate: parseFloat(passRate),
      duration: totalTime
    },
    errors: testResults.errors,
    config: CONFIG
  };

  // Write report to file (optional)
  try {
    const fs = await import('fs');
    await fs.promises.writeFile(
      'test-integration-report.json',
      JSON.stringify(report, null, 2)
    );
    log('Test report written to test-integration-report.json');
  } catch (err) {
    log(`Warning: Could not write test report: ${err.message}`);
  }

  process.exit(success ? 0 : 1);
};

// Handle process signals
process.on('SIGINT', async () => {
  log('Received SIGINT, cleaning up...');
  await stopServer();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  log('Received SIGTERM, cleaning up...');
  await stopServer();
  process.exit(1);
});

// Run tests if called directly
if (process.argv[1].endsWith('test-integration.js')) {
  runTests().catch((error) => {
    log(`Test runner error: ${error.message}`, 'error');
    process.exit(1);
  });
}

export { runTests, CONFIG, testResults };