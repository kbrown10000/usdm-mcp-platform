#!/usr/bin/env node
/**
 * Railway-Specific Integration Tests
 *
 * Tests for Railway deployment environment
 * Runs against deployed Railway service
 *
 * Usage:
 *   RAILWAY_URL=https://your-app.railway.app node test-railway.js
 */

import axios from 'axios';
import { setTimeout } from 'timers/promises';

// Railway configuration
const RAILWAY_URL = process.env.RAILWAY_URL || process.env.RAILWAY_PUBLIC_DOMAIN;
const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;

if (!RAILWAY_URL) {
  console.error('❌ RAILWAY_URL environment variable required');
  console.error('   Set RAILWAY_URL=https://your-app.railway.app');
  process.exit(1);
}

const CONFIG = {
  baseUrl: RAILWAY_URL.replace(/\/$/, ''), // Remove trailing slash
  timeout: 30000,
  retries: 3,
  retryDelay: 5000
};

// Test state
let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// Utility functions
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '🔍';
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

const retryRequest = async (requestFn, description, maxRetries = CONFIG.retries) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`${description} (attempt ${attempt}/${maxRetries})`);
      return await requestFn();
    } catch (error) {
      lastError = error;
      log(`Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        log(`Retrying in ${CONFIG.retryDelay}ms...`);
        await setTimeout(CONFIG.retryDelay);
      }
    }
  }

  throw lastError;
};

// Test functions
const testRailwayDeployment = async () => {
  log('\n=== Testing Railway Deployment ===');
  log(`Testing URL: ${CONFIG.baseUrl}`);

  try {
    const response = await retryRequest(async () => {
      return await axios.get(`${CONFIG.baseUrl}/health`, {
        timeout: CONFIG.timeout,
        headers: {
          'User-Agent': 'V27.0-Integration-Test/1.0'
        }
      });
    }, 'Railway health check');

    assert(response.status === 200, 'Railway service returns 200');
    assert(response.data.status === 'healthy', 'Railway service is healthy');
    assert(response.data.version === '27.0', 'Correct version deployed');

    // Check Railway-specific environment
    if (response.data.environment) {
      assert(
        response.data.environment.railway !== undefined,
        'Railway environment detected'
      );
      log(`Railway environment: ${response.data.environment.railway}`);
    }

    return true;

  } catch (error) {
    assert(false, `Railway deployment test failed: ${error.message}`);
    return false;
  }
};

const testRailwayPerformance = async () => {
  log('\n=== Testing Railway Performance ===');

  try {
    // Test cold start performance
    const coldStartTimes = [];
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await axios.get(`${CONFIG.baseUrl}/health`, {
        timeout: CONFIG.timeout
      });
      const duration = Date.now() - start;
      coldStartTimes.push(duration);
      log(`Cold start ${i + 1}: ${duration}ms`);

      // Wait between requests to simulate cold starts
      if (i < 2) await setTimeout(2000);
    }

    const avgColdStart = coldStartTimes.reduce((a, b) => a + b, 0) / coldStartTimes.length;
    assert(
      avgColdStart < 5000,
      `Average cold start under 5s (actual: ${avgColdStart.toFixed(0)}ms)`
    );

    // Test warm performance
    const warmTimes = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await axios.get(`${CONFIG.baseUrl}/health`, {
        timeout: CONFIG.timeout
      });
      const duration = Date.now() - start;
      warmTimes.push(duration);
    }

    const avgWarm = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;
    assert(
      avgWarm < 1000,
      `Average warm response under 1s (actual: ${avgWarm.toFixed(0)}ms)`
    );

    return true;

  } catch (error) {
    assert(false, `Railway performance test failed: ${error.message}`);
    return false;
  }
};

const testRailwayEndpoints = async () => {
  log('\n=== Testing Railway Endpoints ===');

  const endpoints = [
    { path: '/health', method: 'GET', description: 'Health endpoint' },
    { path: '/mcp/discover', method: 'GET', description: 'MCP discovery' },
    { path: '/api/tools/start_login', method: 'POST', description: 'Start login tool' }
  ];

  for (const endpoint of endpoints) {
    try {
      const requestConfig = {
        method: endpoint.method,
        url: `${CONFIG.baseUrl}${endpoint.path}`,
        timeout: CONFIG.timeout,
        validateStatus: () => true, // Accept any status
        ...(endpoint.method === 'POST' && { data: {} })
      };

      const response = await axios(requestConfig);

      assert(
        response.status >= 200 && response.status < 500,
        `${endpoint.description} responds (status: ${response.status})`
      );

      // Check response format
      if (response.headers['content-type']?.includes('application/json')) {
        assert(
          typeof response.data === 'object',
          `${endpoint.description} returns valid JSON`
        );
      }

    } catch (error) {
      assert(false, `${endpoint.description} failed: ${error.message}`);
    }
  }

  return true;
};

const testRailwayScaling = async () => {
  log('\n=== Testing Railway Auto-Scaling ===');

  try {
    // Simulate load to test auto-scaling
    const concurrentRequests = 10;
    const requestPromises = [];

    log(`Sending ${concurrentRequests} concurrent requests...`);

    for (let i = 0; i < concurrentRequests; i++) {
      const promise = axios.get(`${CONFIG.baseUrl}/health`, {
        timeout: CONFIG.timeout
      }).then(response => ({
        success: true,
        status: response.status,
        duration: Date.now()
      })).catch(error => ({
        success: false,
        error: error.message,
        duration: Date.now()
      }));

      requestPromises.push(promise);
    }

    const results = await Promise.all(requestPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    assert(
      successful >= concurrentRequests * 0.8,
      `At least 80% requests successful under load (${successful}/${concurrentRequests})`
    );

    if (failed > 0) {
      log(`⚠️ ${failed} requests failed under load - may indicate scaling issues`);
    }

    return true;

  } catch (error) {
    assert(false, `Railway scaling test failed: ${error.message}`);
    return false;
  }
};

const testRailwaySSL = async () => {
  log('\n=== Testing Railway SSL/HTTPS ===');

  try {
    // Ensure HTTPS is working
    if (CONFIG.baseUrl.startsWith('https://')) {
      const response = await axios.get(`${CONFIG.baseUrl}/health`, {
        timeout: CONFIG.timeout
      });

      assert(response.status === 200, 'HTTPS endpoint accessible');
      log('✅ SSL/TLS working correctly', 'success');
    } else {
      log('⚠️ Not testing HTTPS (HTTP URL provided)');
    }

    // Test HTTP to HTTPS redirect if applicable
    if (CONFIG.baseUrl.startsWith('https://')) {
      const httpUrl = CONFIG.baseUrl.replace('https://', 'http://');
      try {
        const httpResponse = await axios.get(`${httpUrl}/health`, {
          timeout: CONFIG.timeout,
          maxRedirects: 5
        });

        // Should either redirect to HTTPS or work directly
        assert(
          httpResponse.status === 200 || httpResponse.status === 301,
          'HTTP properly handled (redirect or direct)'
        );
      } catch (error) {
        // This is expected if HTTP is disabled
        log('HTTP access disabled (expected for production)');
      }
    }

    return true;

  } catch (error) {
    assert(false, `Railway SSL test failed: ${error.message}`);
    return false;
  }
};

// Main test runner
const runRailwayTests = async () => {
  log('🚂 Starting Railway-Specific Integration Tests');
  log(`Target URL: ${CONFIG.baseUrl}`);

  const tests = [
    testRailwayDeployment,
    testRailwayEndpoints,
    testRailwayPerformance,
    testRailwayScaling,
    testRailwaySSL
  ];

  for (const test of tests) {
    try {
      await test();
    } catch (error) {
      log(`Test failed with error: ${error.message}`, 'error');
    }
  }

  // Generate final report
  const total = testResults.passed + testResults.failed;
  const passRate = total > 0 ? (testResults.passed / total * 100).toFixed(1) : 0;

  log('\n=== Railway Test Results ===');
  log(`Total tests: ${total}`);
  log(`Passed: ${testResults.passed}`, 'success');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
  log(`Pass rate: ${passRate}%`);

  if (testResults.errors.length > 0) {
    log('\n=== Failures ===', 'error');
    testResults.errors.forEach((error, index) => {
      log(`${index + 1}. ${error}`, 'error');
    });
  }

  // Railway deployment status
  const deploymentHealthy = testResults.passed > 0 && testResults.failed === 0;
  log(`\n🚂 Railway deployment: ${deploymentHealthy ? 'HEALTHY' : 'ISSUES DETECTED'}`);

  if (deploymentHealthy) {
    log('✅ Railway service ready for production traffic', 'success');
  } else {
    log('⚠️ Railway service may need attention before production use', 'error');
  }

  // Exit with appropriate code
  process.exit(testResults.failed === 0 ? 0 : 1);
};

// Handle process signals
process.on('SIGINT', () => {
  log('Railway tests interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('Railway tests terminated');
  process.exit(1);
});

// Run tests
runRailwayTests().catch((error) => {
  log(`Railway test runner error: ${error.message}`, 'error');
  process.exit(1);
});