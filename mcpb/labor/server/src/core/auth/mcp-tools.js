#!/usr/bin/env node
// MCP Tool Definitions for Authentication
// Provides the exact tools from V26.7 golden source

const auth = require('./msal-auth.js');

/**
 * MCP tool definitions for authentication
 * These match the V26.7 golden source exactly
 */
const authTools = [
  {
    name: 'start_login',
    description: 'Start Microsoft authentication - shows device code',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'check_login',
    description: 'Check if authentication is complete',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'whoami',
    description: 'Get authenticated user profile',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'auth_status',
    description: 'Check detailed authentication status',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'refresh_tokens',
    description: 'Refresh all authentication tokens',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'logout',
    description: 'Clear all tokens and logout',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

/**
 * Handle MCP tool calls for authentication
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} args - Tool arguments (unused for auth tools)
 * @returns {Object} MCP response format
 */
async function handleAuthTool(toolName, args = {}) {
  try {
    switch (toolName) {
      case 'start_login': {
        const result = await auth.startLogin();

        if (result.success) {
          return {
            content: [{
              type: 'text',
              text: `**🔐 Authentication Started**

**Device Code:** ${result.deviceCode}

**Steps:**
1. Go to: ${result.verificationUri}
2. Enter code: **${result.deviceCode}**
3. Sign in with your Microsoft account
4. Run \`check_login\` to verify

Code expires in 15 minutes.`
            }]
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: `❌ ${result.error}`
            }],
            isError: true
          };
        }
      }

      case 'check_login': {
        const result = await auth.checkLogin();

        if (result.success && result.authenticated) {
          return {
            content: [{
              type: 'text',
              text: `✅ **Authentication Complete!**

Signed in as: ${result.username}

Token Status:
- Microsoft Graph: ${result.tokens.graph ? '✅ Ready' : '❌ Failed'}
- USDM API: ${result.tokens.usdm ? '✅ Ready' : '❌ Failed'}
- PowerBI: ${result.tokens.powerbi ? '✅ Ready' : '❌ Failed'}

You can now use all analytics tools.`
            }]
          };
        } else if (result.pending) {
          return {
            content: [{
              type: 'text',
              text: `⏳ Authentication still in progress...

Device Code: **${result.deviceCode}**
URL: ${result.verificationUri}

Please complete the sign-in process and try again.`
            }]
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: `❌ ${result.error || result.message}`
            }],
            isError: !result.pending
          };
        }
      }

      case 'whoami': {
        const result = await auth.whoami();

        if (result.success) {
          return {
            content: [{
              type: 'text',
              text: `**👤 User Profile**

**Display Name:** ${result.user.displayName}
**Email:** ${result.user.mail}
**Job Title:** ${result.user.jobTitle || 'Not specified'}
**Department:** ${result.user.department || 'Not specified'}
**Office:** ${result.user.officeLocation || 'Not specified'}

**Account Details:**
- Username: ${result.account?.username || 'Unknown'}
- Tenant ID: ${result.account?.tenantId || 'Unknown'}

**Token Status:**
- Graph: ${result.tokens.graph ? '✅' : '❌'}
- USDM: ${result.tokens.usdm ? '✅' : '❌'}
- PowerBI: ${result.tokens.powerbi ? '✅' : '❌'}`
            }]
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: `❌ ${result.error}`
            }],
            isError: true
          };
        }
      }

      case 'auth_status': {
        const status = auth.getAuthStatus();
        return {
          content: [{
            type: 'text',
            text: `**🔐 Auth Status**
• PowerBI Token: ${status.tokens.powerbi ? '✅' : '❌'}
• Graph Token: ${status.tokens.graph ? '✅' : '❌'}
• API Token: ${status.tokens.usdm ? '✅' : '❌'}
• Auth Complete: ${status.authenticated ? '✅' : '❌'}
• Pending Auth: ${status.pendingAuth ? '⏳' : '❌'}
${status.account ? `• Account: ${status.account.username}` : ''}`
          }]
        };
      }

      case 'refresh_tokens': {
        const result = await auth.refreshTokens();

        if (result.success) {
          return {
            content: [{
              type: 'text',
              text: `✅ **Tokens Refreshed**

${result.message}`
            }]
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: `❌ ${result.error}`
            }],
            isError: true
          };
        }
      }

      case 'logout': {
        const result = auth.logout();
        return {
          content: [{
            type: 'text',
            text: `✅ **Logged Out**

${result.message}`
          }]
        };
      }

      default:
        return {
          content: [{
            type: 'text',
            text: `❌ Unknown authentication tool: ${toolName}`
          }],
          isError: true
        };
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error executing ${toolName}: ${error.message}`
      }],
      isError: true
    };
  }
}

/**
 * Check if a tool name is an authentication tool
 * @param {string} toolName - Tool name to check
 * @returns {boolean} True if it's an auth tool
 */
function isAuthTool(toolName) {
  return authTools.some(tool => tool.name === toolName);
}

// Export for use in MCP servers
module.exports = {
  authTools,
  handleAuthTool,
  isAuthTool,

  // Direct access to auth module functions
  auth,

  // Helper to get PowerBI token for DAX queries
  getPowerBIToken: auth.getPowerBIToken,

  // Helper to check authentication before other operations
  requireAuth: () => {
    const status = auth.getAuthStatus();
    if (!status.authenticated) {
      throw new Error('Not authenticated. Please run start_login first.');
    }
    if (!auth.getPowerBIToken()) {
      throw new Error('PowerBI token not available. User may not have PowerBI license.');
    }
    return true;
  }
};