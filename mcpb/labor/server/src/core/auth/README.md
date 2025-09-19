# MSAL Authentication Module

## 🔒 CRITICAL: V26.7 Golden Source Authentication

This module contains the **EXACT** authentication implementation from the V26.7 golden source:
- Source: `railway-proxy-v26.7-timecard-analysis.mjs` (lines 27-469)
- Status: **WORKING - DO NOT MODIFY**

## ⚠️ Critical Patterns Preserved

### 1. CamelCase Field Names (MOST CRITICAL)
```javascript
// ✅ CORRECT - What MSAL provides
response.userCode           // MSAL standard camelCase
response.verificationUri    // MSAL standard camelCase

// Using snake_case was the #1 cause of authentication failures in v1-v25!
```

### 2. Three-Token Architecture (EXACT ORDER)
```javascript
// Tokens MUST be acquired in this order:
1. Graph token FIRST      // For user profile
2. USDM API token SECOND  // For backend services
3. PowerBI token THIRD    // For DAX queries

// DO NOT combine scopes or change order!
```

### 3. Environment Variables (DO NOT CHANGE)
```javascript
TENANT_ID = '18c250cf-2ef7-4eeb-b6fb-94660f7867e0'  // USDM tenant
CLIENT_ID = '8b84dc3b-a9ff-43ed-9d35-571f757e9c19'  // Railway app
```

## 📦 Module Structure

```
src/core/auth/
├── msal-auth.js      # Core authentication module (CommonJS)
├── mcp-tools.js      # MCP tool wrappers for auth
├── test-auth.js      # Test script for verification
├── package.json      # Dependencies
└── README.md         # This file
```

## 🔧 Usage

### Basic Authentication Flow

```javascript
const auth = require('./msal-auth.js');

// 1. Start login
const login = await auth.startLogin();
console.log('Device code:', login.deviceCode);

// 2. Wait for user to complete auth
let authenticated = false;
while (!authenticated) {
  const status = await auth.checkLogin();
  if (status.authenticated) {
    authenticated = true;
    console.log('Signed in as:', status.username);
  }
  await sleep(5000);
}

// 3. Get user profile
const profile = await auth.whoami();
console.log('User:', profile.user.displayName);

// 4. Use tokens for API calls
const powerbiToken = auth.getPowerBIToken();
// Use for PowerBI DAX queries
```

### MCP Tool Integration

```javascript
const { authTools, handleAuthTool } = require('./mcp-tools.js');

// Register auth tools in MCP server
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Handle auth tools
  if (isAuthTool(name)) {
    return await handleAuthTool(name, args);
  }

  // Handle other tools...
});
```

## 🛠️ Available Functions

### Core Functions
- `startLogin()` - Initiate device code flow
- `checkLogin()` - Check authentication status
- `whoami()` - Get user profile from Graph API
- `logout()` - Clear all tokens
- `refreshTokens()` - Refresh all tokens

### Token Getters
- `getPowerBIToken()` - Get PowerBI access token
- `getGraphToken()` - Get Graph API token
- `getUSDMToken()` - Get USDM API token

### Status Functions
- `getAuthStatus()` - Get detailed auth status
- `getTokens()` - Get all tokens (for debugging)

## 🧪 Testing

Run the test script to verify authentication:

```bash
cd C:\DevOpps\MCP-PLATFORM\src\core\auth
npm install
npm test
```

This will:
1. Start device code login
2. Display the device code
3. Wait for authentication
4. Test whoami functionality
5. Verify all tokens
6. Test token refresh
7. Test logout

## ⚠️ Common Issues

### Device Code Not Appearing
- **Cause**: Using snake_case field names (incorrect for MSAL)
- **Fix**: Use `response.userCode` (camelCase as MSAL provides)

### PowerBI Token Fails
- **Cause**: Wrong scope or order
- **Fix**: Use `.default` scope and acquire AFTER Graph token

### Authentication Hangs
- **Cause**: Not waiting for device code
- **Fix**: Wait up to 5 seconds for device code callback

## 📚 References

- V26.7 Golden Source: `enterprise-extension/server/railway-proxy-v26.7-timecard-analysis.mjs`
- Critical Docs: `CRITICAL_DOCS_WORKING_STATE/AUTHENTICATION_DO_NOT_MODIFY.md`
- V22 Hardened: `CRITICAL_DOCS_WORKING_STATE/V22_HARDENED_SOLUTION.md`

## 🚫 DO NOT MODIFY

This authentication has been debugged 15+ times and represents the ONLY working configuration. Any changes risk breaking:
- Device code display
- Token acquisition
- PowerBI access
- User authentication flow

If you need to make changes, create a new module and preserve this one as the reference implementation.