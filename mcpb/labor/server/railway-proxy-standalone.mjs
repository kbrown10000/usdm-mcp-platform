#!/usr/bin/env node
/**
 * MCPB Labor Server - Railway Proxy Standalone
 * Proxies all labor tools through Railway backend
 * Based on railway-proxy-diagnostic.mjs pattern
 *
 * CRITICAL: This is a standalone server for MCPB packaging
 * - Uses ${__dirname} for proper path resolution
 * - Connects to Railway backend for all operations
 * - Preserves V26.7 authentication patterns
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  InitializeRequestSchema,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { PublicClientApplication, LogLevel } from '@azure/msal-node';
import crypto from 'node:crypto';

// Configuration from environment or defaults
const RAILWAY_BACKEND_URL = process.env.RAILWAY_BACKEND_URL || 'https://usdm-mcp-platform-production.up.railway.app';
const POWERBI_WORKSPACE_ID = process.env.POWERBI_WORKSPACE_ID || '927b94af-e7ef-4b5a-8b8d-02b0c5450b75';
const POWERBI_DATASET_ID = process.env.POWERBI_DATASET_ID || 'ea5298a1-13f0-4629-91ab-14f98163532e';

// MSAL configuration - CRITICAL: These IDs must not change
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || '8b84dc3b-a9ff-43ed-9d35-571f757e9c19',
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || '18c250cf-2ef7-4eeb-b6fb-94660f7867e0'}`
  },
  system: { loggerOptions: { logLevel: LogLevel.Error } }
};

// Token cache - preserves three-token architecture
let cached = {
  account: null,
  usdmApi: { token: null, exp: 0 },
  graph: { token: null, exp: 0 },
  powerbi: { token: null, exp: 0 }
};

// Pending authentication tracking
let pendingAuth = null;

// Required scopes for device flow
const deviceFlowScopes = [
  'openid', 'profile', 'offline_access',
  'api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation',
  'User.Read'
];

const pca = new PublicClientApplication(msalConfig);

// Cookie jar for Railway backend sessions
const jar = new CookieJar();
const api = wrapper(axios.create({
  baseURL: RAILWAY_BACKEND_URL,
  timeout: 30000,
  headers: {
    'User-Agent': 'USDM-Labor-MCP-MCPB/27.0.0',
    'X-Client-Type': 'mcpb-standalone'
  }
}));
api.defaults.jar = jar;
api.defaults.withCredentials = true;

const CLIENT_INSTANCE = crypto.randomUUID();

// Helper function to decode JWT
function decodeJwt(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  } catch (e) {
    console.error('JWT decode error:', e.message);
    return null;
  }
}

// Initialize MCP server
const server = new Server(
  { name: 'usdm-labor-mcp', version: '27.0.0' },
  { capabilities: { tools: {}, prompts: {} } }
);

// Handle Initialize - CRITICAL: Echo the client's protocolVersion
server.setRequestHandler(InitializeRequestSchema, async (req) => {
  const pv = req?.params?.protocolVersion || '2025-06-18';
  console.error('[MCPB] Initialize received, echoing protocolVersion =', pv);
  return {
    protocolVersion: pv,
    capabilities: { tools: {}, prompts: {} },
    serverInfo: { name: 'usdm-labor-mcp', version: '27.0.0' },
  };
});

// Tools list - all 13 labor tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'start_login',
        description: 'Start device code authentication flow with Microsoft',
        inputSchema: { type: 'object', properties: {}, required: [] }
      },
      {
        name: 'check_login',
        description: 'Check authentication status and complete login',
        inputSchema: { type: 'object', properties: {}, required: [] }
      },
      {
        name: 'whoami',
        description: 'Get current authenticated user information',
        inputSchema: { type: 'object', properties: {}, required: [] }
      },
      {
        name: 'get_auth_status',
        description: 'Get detailed authentication status and token validity',
        inputSchema: { type: 'object', properties: {}, required: [] }
      },
      {
        name: 'refresh_tokens',
        description: 'Refresh authentication tokens',
        inputSchema: { type: 'object', properties: {}, required: [] }
      },
      {
        name: 'person_resolver',
        description: 'Find and resolve team member names with fuzzy matching',
        inputSchema: {
          type: 'object',
          properties: {
            search_term: { type: 'string', description: 'Name or partial name to search for' },
            limit: { type: 'integer', description: 'Maximum results to return', default: 10 }
          },
          required: ['search_term']
        }
      },
      {
        name: 'activity_for_person_month',
        description: 'Get monthly activity summary for a specific person',
        inputSchema: {
          type: 'object',
          properties: {
            person_name: { type: 'string', description: 'Full name of the person' },
            month: { type: 'integer', description: 'Month (1-12)' },
            year: { type: 'integer', description: 'Year (e.g., 2025)' }
          },
          required: ['person_name', 'month', 'year']
        }
      },
      {
        name: 'person_revenue_analysis',
        description: 'Analyze revenue metrics and utilization for a person',
        inputSchema: {
          type: 'object',
          properties: {
            person_name: { type: 'string', description: 'Full name of the person' },
            start_date: { type: 'string', format: 'date', description: 'Start date (YYYY-MM-DD)' },
            end_date: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD)' }
          },
          required: ['person_name']
        }
      },
      {
        name: 'person_utilization',
        description: 'Calculate utilization rates and billable hours for a person',
        inputSchema: {
          type: 'object',
          properties: {
            person_name: { type: 'string', description: 'Full name of the person' },
            period: { type: 'string', description: 'Time period (e.g., "last_month", "last_quarter", "YTD")' }
          },
          required: ['person_name']
        }
      },
      {
        name: 'get_timecard_details',
        description: 'Get detailed timecard entries with notes for a person and date range',
        inputSchema: {
          type: 'object',
          properties: {
            person_name: { type: 'string', description: 'Full name of the person' },
            start_date: { type: 'string', format: 'date', description: 'Start date (YYYY-MM-DD)' },
            end_date: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD)' }
          },
          required: ['person_name', 'start_date', 'end_date']
        }
      },
      {
        name: 'run_dax',
        description: 'Execute custom DAX queries against the PowerBI dataset',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'DAX query to execute' }
          },
          required: ['query']
        }
      },
      {
        name: 'get_cache_stats',
        description: 'Get cache performance statistics and hit rates',
        inputSchema: { type: 'object', properties: {}, required: [] }
      },
      {
        name: 'clear_cache',
        description: 'Clear the cache for all or specific entries',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Pattern to match cache keys (optional)' }
          },
          required: []
        }
      }
    ]
  };
});

// Prompts list
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'person_analysis',
        description: 'Analyze work patterns and productivity for a person',
        arguments: [
          { name: 'person_name', description: 'Name of the person', required: true },
          { name: 'time_period', description: 'Time period to analyze', required: true }
        ]
      },
      {
        name: 'timecard_review',
        description: 'Review timecard entries with notes',
        arguments: [
          { name: 'person_name', description: 'Name of the person', required: true },
          { name: 'month', description: 'Month number (1-12)', required: true },
          { name: 'year', description: 'Year (e.g., 2025)', required: true }
        ]
      },
      {
        name: 'utilization_report',
        description: 'Generate utilization report',
        arguments: [
          { name: 'person_name', description: 'Name of the person', required: true }
        ]
      }
    ]
  };
});

// Handle prompt get requests
server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  const prompts = {
    person_analysis: `Analyze the work patterns and productivity for ${args.person_name || '{person_name}'} during ${args.time_period || '{time_period}'}`,
    timecard_review: `Review timecard entries with notes for ${args.person_name || '{person_name}'} in ${args.month || '{month}'} ${args.year || '{year}'}`,
    utilization_report: `Generate a utilization report showing billable vs non-billable hours for ${args.person_name || '{person_name}'}`
  };

  const text = prompts[name];
  if (!text) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text }
      }
    ]
  };
});

// Tool handlers - main request handler
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  console.error(`[MCPB] Tool call: ${name}`);

  // Handle authentication tools locally
  if (name === 'start_login') {
    try {
      if (pendingAuth && pendingAuth.deviceCode) {
        return {
          content: [{
            type: 'text',
            text: `⏳ Authentication already in progress!

Device Code: **${pendingAuth.deviceCode}**
URL: ${pendingAuth.verificationUri}

Run 'check_login' to see if authentication is complete.`
          }]
        };
      }

      pendingAuth = {
        deviceCode: null,
        verificationUri: null,
        promise: null,
        complete: false
      };

      // CRITICAL: Use camelCase fields (response.userCode not response.user_code)
      pendingAuth.promise = pca.acquireTokenByDeviceCode({
        scopes: deviceFlowScopes,
        deviceCodeCallback: (response) => {
          console.error(`[MCPB] Device code: ${response.userCode}`);
          pendingAuth.deviceCode = response.userCode;  // CRITICAL: Use userCode
          pendingAuth.verificationUri = response.verificationUri;
        }
      });

      // Handle token acquisition in sequence
      pendingAuth.promise.then(async (result) => {
        console.error('[MCPB] Authentication completed');
        cached.account = result.account;
        pendingAuth.complete = true;

        // Three-token sequence: PowerBI first, then Graph, then USDM API
        try {
          const pbiRes = await pca.acquireTokenSilent({
            account: result.account,
            scopes: [
              'https://analysis.windows.net/powerbi/api/Dataset.Read.All',
              'https://analysis.windows.net/powerbi/api/Report.Read.All'
            ]
          });
          cached.powerbi.token = pbiRes.accessToken;
          cached.powerbi.exp = pbiRes.expiresOn?.getTime() ?? 0;
          console.error('[MCPB] ✅ PowerBI token acquired');
        } catch (e) {
          console.error('[MCPB] PowerBI token error:', e.message);
        }

        try {
          const graphRes = await pca.acquireTokenSilent({
            account: result.account,
            scopes: ['User.Read']
          });
          cached.graph.token = graphRes.accessToken;
          cached.graph.exp = graphRes.expiresOn?.getTime() ?? 0;
          console.error('[MCPB] ✅ Graph token acquired');
        } catch (e) {
          console.error('[MCPB] Graph token error:', e.message);
        }

        try {
          const usdmRes = await pca.acquireTokenSilent({
            account: result.account,
            scopes: ['api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation']
          });
          cached.usdmApi.token = usdmRes.accessToken;
          cached.usdmApi.exp = usdmRes.expiresOn?.getTime() ?? 0;
          console.error('[MCPB] ✅ USDM API token acquired');
        } catch (e) {
          console.error('[MCPB] USDM token error:', e.message);
        }
      }).catch(e => {
        console.error('[MCPB] ❌ Auth failed:', e.message);
        pendingAuth.complete = true;
        pendingAuth.error = e.message;
      });

      // Wait for device code with extended timeout
      let attempts = 0;
      while (!pendingAuth.deviceCode && attempts < 100) {  // 10 seconds
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (pendingAuth.deviceCode) {
        return {
          content: [{
            type: 'text',
            text: `🔐 **Microsoft Authentication Started**

Please complete these steps:

1. Open: **${pendingAuth.verificationUri}**
2. Enter code: **${pendingAuth.deviceCode}**
3. Sign in with your Microsoft account
4. Run 'check_login' to verify completion

**Device Code: ${pendingAuth.deviceCode}**`
          }]
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: '❌ Failed to generate device code. Please try again.'
          }]
        };
      }
    } catch (e) {
      return {
        content: [{ type: 'text', text: `❌ Error: ${e.message}` }],
        isError: true
      };
    }
  }

  if (name === 'check_login') {
    if (!pendingAuth) {
      return {
        content: [{
          type: 'text',
          text: '❌ No authentication in progress. Run "start_login" first.'
        }]
      };
    }

    if (pendingAuth.error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Authentication failed: ${pendingAuth.error}`
        }]
      };
    }

    if (!pendingAuth.complete) {
      return {
        content: [{
          type: 'text',
          text: `⏳ Authentication still in progress...

Device Code: **${pendingAuth.deviceCode}**
URL: ${pendingAuth.verificationUri}

Please complete the sign-in process and try again.`
        }]
      };
    }

    const now = Date.now();
    const status = {
      username: cached.account?.username || 'Unknown',
      name: cached.account?.name || 'Unknown',
      graph_token: cached.graph.token ?
        `Valid (expires ${new Date(cached.graph.exp).toISOString()})` : 'Not acquired',
      usdm_token: cached.usdmApi.token ?
        `Valid (expires ${new Date(cached.usdmApi.exp).toISOString()})` : 'Not acquired',
      powerbi_token: cached.powerbi.token ?
        `Valid (expires ${new Date(cached.powerbi.exp).toISOString()})` : 'Not acquired'
    };

    return {
      content: [{
        type: 'text',
        text: `✅ **Authentication Complete**

**User:** ${status.username}
**Name:** ${status.name}

**Token Status:**
- Graph API: ${status.graph_token}
- USDM API: ${status.usdm_token}
- PowerBI: ${status.powerbi_token}

You can now use all labor analytics tools.`
      }]
    };
  }

  if (name === 'whoami') {
    if (!cached.graph.token) {
      return {
        content: [{
          type: 'text',
          text: '❌ Not authenticated. Please run "start_login" first.'
        }]
      };
    }

    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${cached.graph.token}` }
      });

      return {
        content: [{
          type: 'text',
          text: `👤 **Current User**

**Name:** ${response.data.displayName}
**Email:** ${response.data.mail || response.data.userPrincipalName}
**Job Title:** ${response.data.jobTitle || 'N/A'}
**Department:** ${response.data.department || 'N/A'}
**Office:** ${response.data.officeLocation || 'N/A'}`
        }]
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `❌ Error: ${e.message}` }],
        isError: true
      };
    }
  }

  if (name === 'get_auth_status' || name === 'refresh_tokens') {
    // Proxy these to Railway backend
    try {
      const response = await api.post('/mcp/rpc', {
        method: 'tools/call',
        params: {
          name: name,
          arguments: args
        }
      }, {
        headers: {
          'Authorization': cached.powerbi.token ? `Bearer ${cached.powerbi.token}` : '',
          'X-Graph-Token': cached.graph.token || '',
          'X-USDM-Token': cached.usdmApi.token || '',
          'Content-Type': 'application/json'
        }
      });

      // Handle MCP/RPC response format
      if (response.data.result?.content) {
        return response.data.result;
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data.result || response.data, null, 2)
        }]
      };
    } catch (e) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error calling Railway backend: ${e.message}`
        }],
        isError: true
      };
    }
  }

  // For all other tools, proxy to Railway backend
  try {
    console.error(`[MCPB] Proxying ${name} to Railway backend`);

    // Ensure we have a PowerBI token for data operations
    if (!cached.powerbi.token && ['person_resolver', 'activity_for_person_month',
        'person_revenue_analysis', 'person_utilization', 'get_timecard_details',
        'run_dax'].includes(name)) {
      return {
        content: [{
          type: 'text',
          text: '❌ Not authenticated. Please run "start_login" and "check_login" first.'
        }]
      };
    }

    const response = await api.post('/mcp/rpc', {
      method: 'tools/call',
      params: {
        name: name,
        arguments: args
      }
    }, {
      headers: {
        'Authorization': `Bearer ${cached.powerbi.token}`,
        'X-Graph-Token': cached.graph.token,
        'X-USDM-Token': cached.usdmApi.token,
        'Content-Type': 'application/json'
      },
      timeout: 60000  // 60 second timeout for data operations
    });

    // Handle MCP/RPC response format
    if (response.data.error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error: ${response.data.error.message || response.data.error}`
        }],
        isError: true
      };
    }

    if (response.data.result?.content) {
      return response.data.result;  // Already in MCP format
    }

    if (response.data.result) {
      return {
        content: [{
          type: 'text',
          text: typeof response.data.result === 'string' ?
            response.data.result :
            JSON.stringify(response.data.result, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2)
      }]
    };
  } catch (error) {
    console.error(`[MCPB] Railway proxy error:`, error.message);

    // Provide helpful error messages
    if (error.response?.status === 401) {
      return {
        content: [{
          type: 'text',
          text: '❌ Authentication expired. Please run "refresh_tokens" or login again.'
        }],
        isError: true
      };
    }

    if (error.code === 'ECONNREFUSED') {
      return {
        content: [{
          type: 'text',
          text: `❌ Cannot connect to Railway backend at ${RAILWAY_BACKEND_URL}. Please check the service is running.`
        }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${error.message}`
      }],
      isError: true
    };
  }
});

// Main startup function
async function main() {
  console.error('[MCPB] Starting USDM Labor MCP Server (Railway Proxy) v27.0...');
  console.error(`[MCPB] Railway backend: ${RAILWAY_BACKEND_URL}`);
  console.error(`[MCPB] PowerBI Dataset: ${POWERBI_DATASET_ID}`);

  try {
    // Test Railway backend connection
    try {
      const healthCheck = await api.get('/health', { timeout: 5000 });
      console.error(`[MCPB] ✅ Railway backend connected: ${healthCheck.data.status || 'OK'}`);
    } catch (e) {
      console.error(`[MCPB] ⚠️ Railway backend health check failed: ${e.message}`);
      console.error('[MCPB] Continuing anyway - backend may be starting up');
    }

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Start server
    await server.connect(transport);

    console.error('[MCPB] ✅ Server started successfully');
    console.error('[MCPB] Listening on stdio transport...');

  } catch (error) {
    console.error('[MCPB] ❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('[MCPB] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[MCPB] Shutting down...');
  process.exit(0);
});

// Prevent unhandled promise rejections from crashing
process.on('unhandledRejection', (reason, promise) => {
  console.error('[MCPB] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
main().catch(error => {
  console.error('[MCPB] Fatal error:', error);
  process.exit(1);
});