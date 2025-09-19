#!/usr/bin/env node

/**
 * Quick test of token cache functionality
 */

import * as auth from './msal-auth.mjs';

console.log('🧪 Quick Token Cache Test\n');

async function test() {
  try {
    // Test 1: Check cache stats
    console.log('1. Cache Statistics:');
    const stats = await auth.getCacheStats();
    console.log('   Directory:', stats.cacheDir);
    console.log('   Entries:', stats.totalEntries);

    // Test 2: Check current auth status
    console.log('\n2. Current Auth Status:');
    const status = auth.getAuthStatus();
    console.log('   Authenticated:', status.authenticated);
    console.log('   Has tokens:', status.tokens);
    console.log('   Account:', status.account?.username || 'None');

    // Test 3: Try to start login (will use cache if available)
    console.log('\n3. Starting Login:');
    const loginResult = await auth.startLogin();

    if (loginResult.cached) {
      console.log('   ✅ Using cached tokens!');
      console.log('   User:', loginResult.username);
      console.log('   Tokens:', JSON.stringify(loginResult.tokens, null, 2));
    } else if (loginResult.success) {
      console.log('   🔐 New authentication needed');
      console.log('   Device Code:', loginResult.deviceCode);
      console.log('   URL:', loginResult.verificationUri);
      console.log('\n   To complete authentication:');
      console.log('   1. Go to:', loginResult.verificationUri);
      console.log('   2. Enter code:', loginResult.deviceCode);
      console.log('   3. Sign in with your Microsoft account');
      console.log('\n   Then run this test again to use cached tokens.');
    } else {
      console.log('   ❌ Failed:', loginResult.error);
    }

    console.log('\n✅ Test completed successfully');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

test().then(() => process.exit(0));