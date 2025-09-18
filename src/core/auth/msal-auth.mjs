// 🔒 MSAL Authentication Module - Extracted from V26.7 Golden Source
// ⚠️ CRITICAL: DO NOT MODIFY authentication patterns
// This module preserves the EXACT working authentication from:
// railway-proxy-v26.7-timecard-analysis.mjs (lines 27-469)
//
// CRITICAL PATTERNS PRESERVED:
// 1. response.userCode (camelCase - MSAL standard)
// 2. response.verificationUri (camelCase - MSAL standard)
// 3. Three-token sequence: Graph → USDM API → PowerBI
// 4. Device code timeout and storage patterns

import { PublicClientApplication } from '@azure/msal-node';
import axios from 'axios';

// ⚠️ DO NOT MODIFY: Production IDs from V26.7 golden source
const TENANT_ID = process.env.AZURE_TENANT_ID || '18c250cf-2ef7-4eeb-b6fb-94660f7867e0';
const CLIENT_ID = process.env.AZURE_CLIENT_ID || '8b84dc3b-a9ff-43ed-9d35-571f757e9c19';

// ⚠️ DO NOT MODIFY: MSAL configuration working with enterprise app
// This is the ONLY working configuration after 30+ attempts
const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
  }
};

const pca = new PublicClientApplication(msalConfig);

// Token storage (V26.7 multi-token architecture)
let powerbiToken = null;
let graphToken = null;
let apiToken = null;
let authenticationComplete = false;

// V26.7 Auth state management
let pendingAuth = null;
let cachedAccount = null;  // Store the MSAL account object

/**
 * Start Microsoft authentication using device code flow
 * @returns {Object} Device code and instructions
 */
async function startLogin() {
  // V26.7: Initialize auth state properly
  pendingAuth = {
    deviceCode: null,
    verificationUri: null,
    promise: null,
    complete: false
  };

  console.error('🔐 Starting device code flow...');

  // V26.7 HARDENED: Use exact scopes from working implementation
  const deviceFlowScopes = [
    'openid',
    'profile',
    'offline_access',
    'api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation',  // USDM API scope
    'User.Read'  // Graph scope
  ];

  // Start device code flow with V26.7 scopes
  pendingAuth.promise = pca.acquireTokenByDeviceCode({
    scopes: deviceFlowScopes,
    // ⚠️ DO NOT MODIFY: CRITICAL AUTHENTICATION PATTERN
    // MSAL uses camelCase fields, NOT snake_case!
    // ✅ CORRECT: response.userCode, response.verificationUri
    // ❌ WRONG: snake_case versions (not used by MSAL)
    // This was the #1 cause of authentication failures in v1-v25
    deviceCodeCallback: (response) => {
      // V26.7 FIX: Store immediately when received
      console.error(`🔑 Device code received: ${response.userCode}`);
      pendingAuth.deviceCode = response.userCode;  // MUST be camelCase!
      pendingAuth.verificationUri = response.verificationUri;  // MUST be camelCase!
    }
  });

  // Wait for device code with proper timeout
  let attempts = 0;
  while (!pendingAuth.deviceCode && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  console.error(`⏱️ Waited ${attempts * 100}ms for device code`);

  if (!pendingAuth.deviceCode) {
    return {
      success: false,
      error: 'Failed to get device code after 5 seconds'
    };
  }

  // Store promise completion handler
  pendingAuth.promise.then(async (result) => {
    console.error('✅ Device auth completed');
    pendingAuth.complete = true;

    if (result && result.account) {
      // V26.7 PATTERN: Store account and acquire tokens separately
      cachedAccount = result.account;

      // ⚠️ DO NOT MODIFY: THREE-TOKEN SEQUENCE IS CRITICAL
      // Tokens MUST be acquired in this exact order:
      // 1. Graph token FIRST (for user profile)
      // 2. USDM API token SECOND (for backend)
      // 3. PowerBI token THIRD (for DAX queries)
      // Changing this order or combining scopes causes authentication failures

      // STEP 1: Get Graph token - DO NOT CHANGE ORDER
      try {
        const graphRes = await pca.acquireTokenSilent({
          account: result.account,
          scopes: ['User.Read']
        });
        graphToken = graphRes.accessToken;
        console.error('✅ Graph token acquired');
      } catch (e) {
        console.error('Graph token error:', e.message);
      }

      // STEP 2: Get USDM API token - DO NOT CHANGE ORDER
      try {
        const usdmRes = await pca.acquireTokenSilent({
          account: result.account,
          scopes: ['api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation']
        });
        apiToken = usdmRes.accessToken;
        console.error('✅ USDM API token acquired');
      } catch (e) {
        console.error('USDM token error:', e.message);
      }

      // STEP 3: Get PowerBI token - CRITICAL: Use .default scope
      // MUST use .default scope for PowerBI - individual scopes don't work!
      try {
        const pbRes = await pca.acquireTokenSilent({
          account: result.account,
          scopes: ['https://analysis.windows.net/powerbi/api/.default']
        });
        powerbiToken = pbRes.accessToken;
        console.error('✅ PowerBI token acquired');
      } catch (e) {
        console.error('PowerBI token error (expected for users without license):', e.message);
      }

      authenticationComplete = true;
    }
  }).catch(error => {
    console.error('❌ Auth failed:', error.message);
    pendingAuth.complete = true;
    pendingAuth.error = error.message;
  });

  // V26.7: Return actual device code and instructions
  return {
    success: true,
    deviceCode: pendingAuth.deviceCode,
    verificationUri: pendingAuth.verificationUri,
    message: `Device Code: ${pendingAuth.deviceCode}\n\n` +
             `Steps:\n` +
             `1. Go to: ${pendingAuth.verificationUri}\n` +
             `2. Enter code: ${pendingAuth.deviceCode}\n` +
             `3. Sign in with your Microsoft account\n` +
             `4. Run check_login to verify\n\n` +
             `Code expires in 15 minutes.`
  };
}

/**
 * Check if authentication is complete
 * @returns {Object} Authentication status
 */
async function checkLogin() {
  if (!pendingAuth) {
    return {
      success: false,
      error: 'No authentication in progress. Run start_login first.'
    };
  }

  if (pendingAuth.error) {
    return {
      success: false,
      error: `Authentication failed: ${pendingAuth.error}`
    };
  }

  if (!pendingAuth.complete) {
    return {
      success: false,
      pending: true,
      deviceCode: pendingAuth.deviceCode,
      verificationUri: pendingAuth.verificationUri,
      message: 'Authentication still in progress. Please complete the sign-in process.'
    };
  }

  // V26.7 pattern: Show detailed status
  const status = {
    username: cachedAccount?.username || 'Unknown',
    graph: !!graphToken,
    usdm: !!apiToken,
    powerbi: !!powerbiToken
  };

  pendingAuth = null;  // Clear pending auth

  return {
    success: true,
    authenticated: true,
    username: status.username,
    tokens: {
      graph: status.graph,
      usdm: status.usdm,
      powerbi: status.powerbi
    },
    message: `Signed in as: ${status.username}\n` +
             `Graph: ${status.graph ? '✅' : '❌'} | ` +
             `USDM: ${status.usdm ? '✅' : '❌'} | ` +
             `PowerBI: ${status.powerbi ? '✅' : '❌'}`
  };
}

/**
 * Get authenticated user profile using Graph API
 * @returns {Object} User profile information
 */
async function whoami() {
  if (!graphToken) {
    return {
      success: false,
      error: 'Not authenticated. Please run start_login first.'
    };
  }

  try {
    // Call Microsoft Graph API to get user profile
    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${graphToken}`,
        'Content-Type': 'application/json'
      }
    });

    const user = response.data;

    return {
      success: true,
      user: {
        displayName: user.displayName,
        mail: user.mail || user.userPrincipalName,
        jobTitle: user.jobTitle,
        department: user.department,
        officeLocation: user.officeLocation,
        id: user.id
      },
      account: cachedAccount ? {
        username: cachedAccount.username,
        tenantId: cachedAccount.tenantId,
        homeAccountId: cachedAccount.homeAccountId
      } : null,
      tokens: {
        graph: !!graphToken,
        usdm: !!apiToken,
        powerbi: !!powerbiToken
      }
    };
  } catch (error) {
    if (error.response?.status === 401) {
      graphToken = null;
      return {
        success: false,
        error: 'Graph token expired. Please run start_login again.'
      };
    }

    return {
      success: false,
      error: `Failed to get user profile: ${error.message}`
    };
  }
}

/**
 * Get current authentication status
 * @returns {Object} Detailed auth status
 */
function getAuthStatus() {
  return {
    authenticated: authenticationComplete,
    pendingAuth: !!pendingAuth && !pendingAuth.complete,
    tokens: {
      powerbi: !!powerbiToken,
      graph: !!graphToken,
      usdm: !!apiToken
    },
    account: cachedAccount ? {
      username: cachedAccount.username,
      tenantId: cachedAccount.tenantId
    } : null
  };
}

/**
 * Get PowerBI access token
 * @returns {string|null} PowerBI token or null
 */
function getPowerBIToken() {
  return powerbiToken;
}

/**
 * Get Graph access token
 * @returns {string|null} Graph token or null
 */
function getGraphToken() {
  return graphToken;
}

/**
 * Get USDM API access token
 * @returns {string|null} USDM API token or null
 */
function getUSDMToken() {
  return apiToken;
}

/**
 * Clear all tokens and authentication state
 */
function logout() {
  powerbiToken = null;
  graphToken = null;
  apiToken = null;
  authenticationComplete = false;
  pendingAuth = null;
  cachedAccount = null;

  return {
    success: true,
    message: 'Successfully logged out. All tokens cleared.'
  };
}

/**
 * Refresh tokens if needed
 * @returns {Object} Refresh status
 */
async function refreshTokens() {
  if (!cachedAccount) {
    return {
      success: false,
      error: 'No cached account. Please run start_login first.'
    };
  }

  const results = {
    graph: false,
    usdm: false,
    powerbi: false
  };

  try {
    // Refresh Graph token
    try {
      const graphRes = await pca.acquireTokenSilent({
        account: cachedAccount,
        scopes: ['User.Read'],
        forceRefresh: true
      });
      graphToken = graphRes.accessToken;
      results.graph = true;
    } catch (e) {
      console.error('Graph refresh error:', e.message);
    }

    // Refresh USDM API token
    try {
      const usdmRes = await pca.acquireTokenSilent({
        account: cachedAccount,
        scopes: ['api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation'],
        forceRefresh: true
      });
      apiToken = usdmRes.accessToken;
      results.usdm = true;
    } catch (e) {
      console.error('USDM refresh error:', e.message);
    }

    // Refresh PowerBI token
    try {
      const pbRes = await pca.acquireTokenSilent({
        account: cachedAccount,
        scopes: ['https://analysis.windows.net/powerbi/api/.default'],
        forceRefresh: true
      });
      powerbiToken = pbRes.accessToken;
      results.powerbi = true;
    } catch (e) {
      console.error('PowerBI refresh error:', e.message);
    }

    return {
      success: true,
      refreshed: results,
      message: `Tokens refreshed - Graph: ${results.graph ? '✅' : '❌'} | ` +
               `USDM: ${results.usdm ? '✅' : '❌'} | ` +
               `PowerBI: ${results.powerbi ? '✅' : '❌'}`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to refresh tokens: ${error.message}`
    };
  }
}

// Export all functions and getters
export {
  // Core authentication functions
  startLogin,
  checkLogin,
  whoami,
  logout,
  refreshTokens,

  // Status and token getters
  getAuthStatus,
  getPowerBIToken,
  getGraphToken,
  getUSDMToken,

  // Constants (for reference)
  TENANT_ID,
  CLIENT_ID
};

// Export additional utility functions
export const getTokens = () => ({
  powerbi: powerbiToken,
  graph: graphToken,
  usdm: apiToken
});