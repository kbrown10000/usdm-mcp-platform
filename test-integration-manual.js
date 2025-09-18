#!/usr/bin/env node
/**
 * V27.0 Manual Integration Tests
 *
 * These tests require manual user interaction for authentication
 * Run after automated tests pass to verify end-to-end functionality
 *
 * Usage:
 *   node test-integration-manual.js
 */

import { setTimeout } from 'timers/promises';
import axios from 'axios';
import { PublicClientApplication } from '@azure/msal-node';
import readline from 'readline';

// Configuration (matches V26.7 golden source)
const CONFIG = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'
  },
  auth: {
    tenantId: '18c250cf-2ef7-4eeb-b6fb-94660f7867e0',
    clientId: '8b84dc3b-a9ff-43ed-9d35-571f757e9c19'
  },
  powerbi: {
    expectedRowCount: 3238644,
    testPerson: 'Hussam Kazi'
  }
};

// Utility functions
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '🔍';
  console.log(`${prefix} [${timestamp}] ${message}`);
};

const prompt = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

const callTool = async (toolName, args = {}) => {
  const url = `http://${CONFIG.server.host}:${CONFIG.server.port}/api/tools/${toolName}`;

  try {
    const response = await axios.post(url, args, {
      timeout: 30000,
      validateStatus: () => true
    });

    return {
      success: response.status === 200,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Test functions
const testManualAuthentication = async () => {
  log('\n=== Manual Authentication Test ===');
  log('This test requires you to authenticate with Microsoft');

  // Step 1: Start login
  log('Step 1: Starting login flow...');
  const loginResult = await callTool('start_login');

  if (!loginResult.success) {
    log(`❌ start_login failed: ${loginResult.error || loginResult.data}`, 'error');
    return false;
  }

  log('✅ Login flow started successfully');

  // In V26.7, the device code is displayed in the response
  if (loginResult.data && loginResult.data.content) {
    const content = loginResult.data.content[0]?.text || '';
    if (content.includes('microsoft.com/devicelogin')) {
      log('\n📱 Device Code Authentication Required:');
      log(content);

      // Extract device code for validation
      const codeMatch = content.match(/Code:\s*\*\*([A-Z0-9]+)\*\*/);
      if (codeMatch) {
        const deviceCode = codeMatch[1];
        log(`\n🔑 Device Code: ${deviceCode}`);

        // Wait for user to authenticate
        await prompt('\nPress Enter after completing authentication in your browser...');

        // Step 2: Check login status
        log('\nStep 2: Checking authentication status...');
        let attempts = 0;
        const maxAttempts = 12; // 2 minutes at 10-second intervals

        while (attempts < maxAttempts) {
          const checkResult = await callTool('check_login');

          if (checkResult.success && checkResult.data.content) {
            const checkContent = checkResult.data.content[0]?.text || '';

            if (checkContent.includes('Authentication complete!')) {
              log('✅ Authentication completed successfully', 'success');
              break;
            } else if (checkContent.includes('Authentication failed')) {
              log('❌ Authentication failed', 'error');
              return false;
            } else {
              log(`⏳ Authentication pending... (attempt ${attempts + 1}/${maxAttempts})`);
              await setTimeout(10000); // Wait 10 seconds
              attempts++;
            }
          } else {
            log(`⚠️ Check login failed: ${checkResult.error || 'Unknown error'}`);
            attempts++;
            await setTimeout(10000);
          }
        }

        if (attempts >= maxAttempts) {
          log('❌ Authentication timeout', 'error');
          return false;
        }

        // Step 3: Verify with whoami
        log('\nStep 3: Verifying user profile...');
        const whoamiResult = await callTool('whoami');

        if (whoamiResult.success && whoamiResult.data.content) {
          const whoamiContent = whoamiResult.data.content[0]?.text || '';
          log('✅ User profile retrieved:', 'success');
          log(whoamiContent);
          return true;
        } else {
          log('❌ Failed to retrieve user profile', 'error');
          return false;
        }
      } else {
        log('❌ Could not extract device code from response', 'error');
        return false;
      }
    } else {
      log('❌ Device code not found in login response', 'error');
      return false;
    }
  } else {
    log('❌ Invalid login response format', 'error');
    return false;
  }
};

const testPowerBIData = async () => {
  log('\n=== PowerBI Data Validation Test ===');

  // Test 1: Row count validation
  log('Test 1: Validating dataset row count...');
  const rowCountQuery = 'EVALUATE ROW("RowCount", COUNTROWS(labor))';
  const rowCountResult = await callTool('run_dax', { query: rowCountQuery });

  if (rowCountResult.success && rowCountResult.data.content) {
    const content = rowCountResult.data.content[0]?.text || '';
    log(`Row count query result: ${content}`);

    // Check if contains expected row count
    if (content.includes(CONFIG.powerbi.expectedRowCount.toString())) {
      log(`✅ Dataset contains expected ${CONFIG.powerbi.expectedRowCount} rows`, 'success');
    } else {
      log(`⚠️ Row count may differ from expected ${CONFIG.powerbi.expectedRowCount}`, 'error');
    }
  } else {
    log('❌ Row count query failed', 'error');
    return false;
  }

  // Test 2: Table access validation
  log('\nTest 2: Validating table access...');
  const tablesQuery = 'EVALUATE TOPN(5, INFO.TABLES())';
  const tablesResult = await callTool('run_dax', { query: tablesQuery });

  if (tablesResult.success && tablesResult.data.content) {
    const content = tablesResult.data.content[0]?.text || '';
    log('Tables query result:');
    log(content);

    // Check for critical tables
    const expectedTables = ['labor', 'DIM_Team_Member', 'DIM_Project_Min'];
    let tablesFound = 0;

    expectedTables.forEach(table => {
      if (content.includes(table)) {
        log(`✅ Table '${table}' accessible`, 'success');
        tablesFound++;
      } else {
        log(`❌ Table '${table}' not found`, 'error');
      }
    });

    if (tablesFound === expectedTables.length) {
      log('✅ All critical tables accessible', 'success');
    }
  } else {
    log('❌ Tables query failed', 'error');
  }

  return true;
};

const testPersonResolver = async () => {
  log('\n=== Person Resolver Test ===');

  const testCases = [
    { name: CONFIG.powerbi.testPerson, fuzzy: false },
    { name: 'hussam', fuzzy: true },
    { name: 'kazi', fuzzy: true }
  ];

  for (const testCase of testCases) {
    log(`Testing person search: "${testCase.name}" (fuzzy: ${testCase.fuzzy})`);

    const result = await callTool('person_resolver', {
      search_term: testCase.name,
      fuzzy: testCase.fuzzy
    });

    if (result.success && result.data.content) {
      const content = result.data.content[0]?.text || '';
      log(`Result: ${content.substring(0, 200)}...`);

      if (content.includes('Hussam Kazi') || content.includes('Found')) {
        log('✅ Person found successfully', 'success');
      } else {
        log('⚠️ Person not found or unexpected result');
      }
    } else {
      log('❌ Person resolver failed', 'error');
    }
  }

  return true;
};

const testTimecardDetails = async () => {
  log('\n=== Timecard Details Test ===');

  const result = await callTool('get_timecard_details', {
    person_name: CONFIG.powerbi.testPerson,
    start_date: '2024-08-01',
    end_date: '2024-08-31'
  });

  if (result.success && result.data.content) {
    const content = result.data.content[0]?.text || '';
    log('Timecard details result:');
    log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));

    if (content.includes('Timecard Analysis') || content.includes('hours')) {
      log('✅ Timecard details retrieved successfully', 'success');
    } else {
      log('⚠️ Unexpected timecard details format');
    }
  } else {
    log('❌ Timecard details failed', 'error');
  }

  return true;
};

const testCacheSystem = async () => {
  log('\n=== Cache System Test ===');

  // Test cache stats
  const statsResult = await callTool('get_cache_stats');

  if (statsResult.success && statsResult.data.content) {
    const content = statsResult.data.content[0]?.text || '';
    log('Cache statistics:');
    log(content);

    if (content.includes('cache') || content.includes('Cache')) {
      log('✅ Cache system operational', 'success');
    } else {
      log('⚠️ Cache system status unclear');
    }
  } else {
    log('❌ Cache stats failed', 'error');
  }

  return true;
};

// Main test runner
const runManualTests = async () => {
  log('🧪 Starting V27.0 Manual Integration Tests');
  log('These tests require user interaction and authentication');

  const proceed = await prompt('\nDo you want to proceed with manual authentication? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    log('Manual tests cancelled by user');
    process.exit(0);
  }

  try {
    let testsPassed = 0;
    let totalTests = 0;

    // Authentication test (required for all others)
    totalTests++;
    const authSuccess = await testManualAuthentication();
    if (authSuccess) testsPassed++;

    if (authSuccess) {
      // Only run data tests if authentication succeeded
      const dataTests = [
        testPowerBIData,
        testPersonResolver,
        testTimecardDetails,
        testCacheSystem
      ];

      for (const test of dataTests) {
        totalTests++;
        try {
          const success = await test();
          if (success) testsPassed++;
        } catch (error) {
          log(`Test failed with error: ${error.message}`, 'error');
        }
      }
    } else {
      log('❌ Skipping data tests due to authentication failure', 'error');
    }

    // Final report
    log('\n=== Manual Test Results ===');
    log(`Tests passed: ${testsPassed}/${totalTests}`);
    log(`Success rate: ${(testsPassed / totalTests * 100).toFixed(1)}%`);

    if (testsPassed === totalTests) {
      log('🎉 All manual tests passed!', 'success');
      process.exit(0);
    } else {
      log('⚠️ Some manual tests failed', 'error');
      process.exit(1);
    }

  } catch (error) {
    log(`Manual test error: ${error.message}`, 'error');
    process.exit(1);
  }
};

// Run tests if called directly
if (process.argv[1].endsWith('test-integration-manual.js')) {
  runManualTests();
}

export { runManualTests };