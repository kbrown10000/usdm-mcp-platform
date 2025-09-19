#!/usr/bin/env node
// Test script for MSAL authentication module
// Verifies the V26.7 authentication patterns are preserved

const auth = require('./msal-auth.js');

async function testAuth() {
  console.log('🔬 Testing MSAL Authentication Module');
  console.log('=====================================\n');

  // Test 1: Check initial status
  console.log('1. Checking initial auth status...');
  const initialStatus = auth.getAuthStatus();
  console.log('   Authenticated:', initialStatus.authenticated);
  console.log('   Tokens:', initialStatus.tokens);
  console.log('');

  // Test 2: Start login
  console.log('2. Starting device code login...');
  const loginResult = await auth.startLogin();

  if (loginResult.success) {
    console.log('   ✅ Device code received:', loginResult.deviceCode);
    console.log('   Verification URI:', loginResult.verificationUri);
    console.log('\n' + loginResult.message);
  } else {
    console.log('   ❌ Login failed:', loginResult.error);
    process.exit(1);
  }

  // Test 3: Check login status (will be pending)
  console.log('\n3. Checking login status...');
  const checkResult = await auth.checkLogin();

  if (checkResult.pending) {
    console.log('   ⏳ Authentication pending');
    console.log('   Device code:', checkResult.deviceCode);
  } else if (checkResult.success) {
    console.log('   ✅ Authentication complete');
    console.log('   Username:', checkResult.username);
    console.log('   Tokens:', checkResult.tokens);
  } else {
    console.log('   ❌ Error:', checkResult.error);
  }

  // Wait for user to complete authentication
  console.log('\n⏳ Waiting for authentication to complete...');
  console.log('   Please complete the sign-in process in your browser');
  console.log('   This script will check every 5 seconds...\n');

  let authenticated = false;
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes total

  while (!authenticated && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;

    const status = await auth.checkLogin();

    if (status.success && status.authenticated) {
      authenticated = true;
      console.log('\n✅ Authentication successful!');
      console.log('   Username:', status.username);
      console.log('   Tokens:', status.tokens);

      // Test 4: Get user profile with whoami
      console.log('\n4. Getting user profile with whoami...');
      const whoamiResult = await auth.whoami();

      if (whoamiResult.success) {
        console.log('   ✅ User profile retrieved');
        console.log('   Display Name:', whoamiResult.user.displayName);
        console.log('   Email:', whoamiResult.user.mail);
        console.log('   Job Title:', whoamiResult.user.jobTitle);
        console.log('   Department:', whoamiResult.user.department);
      } else {
        console.log('   ❌ Failed:', whoamiResult.error);
      }

      // Test 5: Get tokens
      console.log('\n5. Checking token availability...');
      console.log('   PowerBI Token:', auth.getPowerBIToken() ? '✅ Available' : '❌ Not available');
      console.log('   Graph Token:', auth.getGraphToken() ? '✅ Available' : '❌ Not available');
      console.log('   USDM Token:', auth.getUSDMToken() ? '✅ Available' : '❌ Not available');

      // Test 6: Refresh tokens
      console.log('\n6. Testing token refresh...');
      const refreshResult = await auth.refreshTokens();
      if (refreshResult.success) {
        console.log('   ✅', refreshResult.message);
      } else {
        console.log('   ❌ Failed:', refreshResult.error);
      }

      // Test 7: Logout
      console.log('\n7. Testing logout...');
      const logoutResult = auth.logout();
      console.log('   ✅', logoutResult.message);

      // Verify logout
      const finalStatus = auth.getAuthStatus();
      console.log('   Final auth status:', finalStatus.authenticated ? '❌ Still authenticated' : '✅ Logged out');

    } else if (status.pending) {
      process.stdout.write(`   Attempt ${attempts}/${maxAttempts} - Still waiting...\r`);
    } else if (status.error) {
      console.log('\n❌ Authentication error:', status.error);
      break;
    }
  }

  if (!authenticated) {
    console.log('\n⏱️ Authentication timed out after 5 minutes');
  }

  console.log('\n=====================================');
  console.log('🔬 Authentication Module Test Complete');
}

// Run the test
testAuth().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});