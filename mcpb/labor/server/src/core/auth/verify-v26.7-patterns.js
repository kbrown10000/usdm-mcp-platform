#!/usr/bin/env node
// Verification script to ensure V26.7 patterns are preserved
// This checks that the critical authentication patterns match the golden source

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying V26.7 Authentication Patterns');
console.log('==========================================\n');

// Read the msal-auth.js file
const authFile = fs.readFileSync(path.join(__dirname, 'msal-auth.js'), 'utf-8');

// Critical patterns to verify
const criticalPatterns = [
  {
    name: 'CamelCase userCode',
    pattern: /response\.userCode/g,
    required: true,
    found: false
  },
  {
    name: 'CamelCase verificationUri',
    pattern: /response\.verificationUri/g,
    required: true,
    found: false
  },
  {
    name: 'Snake_case user_code (SHOULD NOT EXIST)',
    pattern: /response\.user_code/g,
    required: false,
    found: false
  },
  {
    name: 'Snake_case verification_uri (SHOULD NOT EXIST)',
    pattern: /response\.verification_uri/g,
    required: false,
    found: false
  },
  {
    name: 'Correct TENANT_ID',
    pattern: /18c250cf-2ef7-4eeb-b6fb-94660f7867e0/g,
    required: true,
    found: false
  },
  {
    name: 'Correct CLIENT_ID',
    pattern: /8b84dc3b-a9ff-43ed-9d35-571f757e9c19/g,
    required: true,
    found: false
  },
  {
    name: 'USDM API Scope',
    pattern: /api:\/\/8b84dc3b-a9ff-43ed-9d35-571f757e9c19\/user_impersonation/g,
    required: true,
    found: false
  },
  {
    name: 'Graph User.Read Scope',
    pattern: /User\.Read/g,
    required: true,
    found: false
  },
  {
    name: 'PowerBI .default Scope',
    pattern: /https:\/\/analysis\.windows\.net\/powerbi\/api\/\.default/g,
    required: true,
    found: false
  },
  {
    name: 'Three Token Storage',
    pattern: /let\s+(powerbiToken|graphToken|apiToken)\s*=\s*null/g,
    required: true,
    found: false,
    count: 3
  }
];

// Token acquisition order check
const tokenOrderPatterns = [
  {
    name: 'Graph token acquired first',
    pattern: /Graph token acquired/,
    order: 1
  },
  {
    name: 'USDM API token acquired second',
    pattern: /USDM API token acquired/,
    order: 2
  },
  {
    name: 'PowerBI token acquired third',
    pattern: /PowerBI token acquired/,
    order: 3
  }
];

// Check each pattern
console.log('Checking Critical Patterns:');
console.log('---------------------------\n');

let allPassed = true;

criticalPatterns.forEach(check => {
  const matches = authFile.match(check.pattern);
  check.found = matches ? matches.length > 0 : false;

  if (check.required) {
    if (check.found) {
      const matchCount = matches ? matches.length : 0;
      const countCheck = check.count ? matchCount >= check.count : true;
      if (countCheck) {
        console.log(`✅ ${check.name} - Found ${matchCount} occurrence(s)`);
      } else {
        console.log(`❌ ${check.name} - Found only ${matchCount}, expected at least ${check.count}`);
        allPassed = false;
      }
    } else {
      console.log(`❌ ${check.name} - NOT FOUND (Required!)`);
      allPassed = false;
    }
  } else {
    // These patterns should NOT exist
    if (check.found) {
      console.log(`❌ ${check.name} - FOUND (Should not exist!)`);
      allPassed = false;
    } else {
      console.log(`✅ ${check.name} - Correctly absent`);
    }
  }
});

// Check token acquisition order
console.log('\nChecking Token Acquisition Order:');
console.log('----------------------------------\n');

const tokenPositions = [];
tokenOrderPatterns.forEach(check => {
  const match = authFile.match(check.pattern);
  if (match) {
    const position = authFile.indexOf(match[0]);
    tokenPositions.push({
      name: check.name,
      position: position,
      expectedOrder: check.order
    });
  }
});

// Sort by position and verify order
tokenPositions.sort((a, b) => a.position - b.position);
let orderCorrect = true;

tokenPositions.forEach((token, index) => {
  const expectedOrder = index + 1;
  if (token.expectedOrder === expectedOrder) {
    console.log(`✅ ${token.name} - Correct position`);
  } else {
    console.log(`❌ ${token.name} - Wrong order (expected position ${token.expectedOrder}, found at ${expectedOrder})`);
    orderCorrect = false;
    allPassed = false;
  }
});

// Check for required functions
console.log('\nChecking Required Functions:');
console.log('----------------------------\n');

const requiredFunctions = [
  'startLogin',
  'checkLogin',
  'whoami',
  'getAuthStatus',
  'getPowerBIToken',
  'getGraphToken',
  'getUSDMToken',
  'logout',
  'refreshTokens'
];

requiredFunctions.forEach(func => {
  const pattern = new RegExp(`(async\\s+)?function\\s+${func}|${func}\\s*[=:]\\s*(async\\s*)?\\(`);
  if (authFile.match(pattern)) {
    console.log(`✅ ${func} function exists`);
  } else {
    console.log(`❌ ${func} function missing`);
    allPassed = false;
  }
});

// Final result
console.log('\n==========================================');
if (allPassed) {
  console.log('✅ ALL V26.7 PATTERNS VERIFIED SUCCESSFULLY');
  console.log('The authentication module preserves all critical patterns from the golden source.');
} else {
  console.log('❌ VERIFICATION FAILED');
  console.log('Some critical patterns from V26.7 are missing or incorrect.');
  console.log('DO NOT use this module until all patterns are fixed!');
  process.exit(1);
}

console.log('\nAuthentication module location:');
console.log(`  ${path.join(__dirname, 'msal-auth.js')}`);
console.log('\nGolden source reference:');
console.log('  enterprise-extension/server/railway-proxy-v26.7-timecard-analysis.mjs');
console.log('  Lines 27-469');