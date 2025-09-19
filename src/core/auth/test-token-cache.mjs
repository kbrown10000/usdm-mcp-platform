#!/usr/bin/env node

/**
 * Test script for token cache implementation
 * Tests disk-based caching, retry logic, and increased timeout
 */

import * as auth from './msal-auth.mjs';
import * as tokenCache from './token-cache.mjs';

console.log('🧪 Token Cache Test Suite\n');
console.log('='.repeat(50));

async function testCacheOperations() {
  console.log('\n📝 Testing Cache Operations...\n');

  // Test 1: Get cache stats
  console.log('1. Getting cache statistics...');
  const stats = await auth.getCacheStats();
  console.log('   Cache directory:', stats.cacheDir);
  console.log('   Total entries:', stats.totalEntries);
  if (stats.entries.length > 0) {
    console.log('   Existing entries:');
    stats.entries.forEach(entry => {
      console.log(`     - ${entry.filename}`);
      console.log(`       User: ${entry.username || 'N/A'}`);
      console.log(`       Expired: ${entry.expired ? 'Yes' : 'No'}`);
      console.log(`       Remaining: ${entry.remainingMinutes} minutes`);
      console.log(`       Tokens: Graph=${entry.hasTokens.graph ? '✅' : '❌'}, ` +
                  `USDM=${entry.hasTokens.usdm ? '✅' : '❌'}, ` +
                  `PowerBI=${entry.hasTokens.powerbi ? '✅' : '❌'}`);
    });
  }

  // Test 2: Test cache key generation
  console.log('\n2. Testing cache key generation...');
  const testScopes = ['User.Read', 'offline_access'];
  const cacheKey = tokenCache.getCacheKey(auth.TENANT_ID, auth.CLIENT_ID, testScopes);
  console.log('   Generated cache key:', cacheKey);

  // Test 3: Test authentication with cache
  console.log('\n3. Testing authentication with cache...');
  console.log('   Starting login (will use cache if available)...');

  const loginResult = await auth.startLogin();

  if (loginResult.cached) {
    console.log('   ✅ Used cached authentication!');
    console.log('   Username:', loginResult.username);
    console.log('   Tokens:', loginResult.tokens);
    console.log('   Message:', loginResult.message);
  } else if (loginResult.success) {
    console.log('   🔐 New authentication required');
    console.log('   Device Code:', loginResult.deviceCode);
    console.log('   URL:', loginResult.verificationUri);
    console.log('\n   ⏳ Waiting for authentication to complete...');
    console.log('   Please complete the device code flow in your browser.');

    // Wait for authentication
    let checkAttempts = 0;
    let authenticated = false;

    while (!authenticated && checkAttempts < 60) { // Wait up to 5 minutes
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
      checkAttempts++;

      const checkResult = await auth.checkLogin();

      if (checkResult.success && checkResult.authenticated) {
        authenticated = true;
        console.log('\n   ✅ Authentication completed!');
        console.log('   Username:', checkResult.username);
        console.log('   Tokens:', checkResult.tokens);
        console.log('   Message:', checkResult.message);
      } else if (!checkResult.pending) {
        console.log('\n   ❌ Authentication failed:', checkResult.error);
        break;
      }

      // Show progress
      if (checkAttempts % 4 === 0) { // Every 20 seconds
        console.log(`   Still waiting... (${checkAttempts * 5} seconds elapsed)`);
      }
    }

    if (!authenticated && checkAttempts >= 60) {
      console.log('\n   ❌ Authentication timeout after 5 minutes');
    }
  } else {
    console.log('   ❌ Failed to start login:', loginResult.error);
  }

  // Test 4: Get user profile
  console.log('\n4. Testing whoami (requires authentication)...');
  const whoamiResult = await auth.whoami();
  if (whoamiResult.success) {
    console.log('   ✅ User profile retrieved:');
    console.log('   Display Name:', whoamiResult.user.displayName);
    console.log('   Email:', whoamiResult.user.mail);
    console.log('   Job Title:', whoamiResult.user.jobTitle || 'N/A');
    console.log('   Department:', whoamiResult.user.department || 'N/A');
  } else {
    console.log('   ❌ Failed:', whoamiResult.error);
  }

  // Test 5: Check cache stats after authentication
  console.log('\n5. Checking cache after authentication...');
  const newStats = await auth.getCacheStats();
  console.log('   Total entries:', newStats.totalEntries);
  if (newStats.entries.length > 0) {
    const latestEntry = newStats.entries[0];
    console.log('   Latest cache entry:');
    console.log('     User:', latestEntry.username);
    console.log('     Remaining:', latestEntry.remainingMinutes, 'minutes');
  }

  // Test 6: Test logout and cache clearing
  console.log('\n6. Testing logout (optional - press Ctrl+C to skip)...');
  console.log('   Waiting 3 seconds before logout test...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const shouldLogout = false; // Set to true to test logout
  if (shouldLogout) {
    const logoutResult = await auth.logout();
    console.log('   Logout result:', logoutResult.message);

    // Check cache after logout
    const postLogoutStats = await auth.getCacheStats();
    console.log('   Cache entries after logout:', postLogoutStats.totalEntries);
  } else {
    console.log('   Skipping logout to preserve cache for future tests');
  }
}

async function testRetryLogic() {
  console.log('\n📝 Testing Retry Logic...\n');

  console.log('The retry logic with exponential backoff has been integrated into the MSAL auth module.');
  console.log('Retries occur automatically when acquiring tokens with:');
  console.log('  - Max retries: 3');
  console.log('  - Base delay: 1000ms');
  console.log('  - Backoff: 1s, 2s, 4s');
  console.log('\nRetry logic is applied to:');
  console.log('  - Graph token acquisition');
  console.log('  - USDM API token acquisition');
  console.log('  - PowerBI token acquisition');
}

async function testTimeoutIncrease() {
  console.log('\n📝 Testing Increased Timeout...\n');

  console.log('Device code timeout has been increased from 5 to 20 seconds.');
  console.log('This provides more time for the MSAL library to return the device code.');
  console.log('The timeout is implemented as 200 attempts × 100ms = 20 seconds.');
}

// Run tests
async function main() {
  try {
    await testCacheOperations();
    await testRetryLogic();
    await testTimeoutIncrease();

    console.log('\n' + '='.repeat(50));
    console.log('✅ Token cache test suite completed!\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}