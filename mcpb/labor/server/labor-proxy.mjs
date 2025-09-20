#!/usr/bin/env node

/**
 * Labor MCP Proxy Server v28.0.0
 * Standalone MCP server for Labor analytics with authentication
 * 100% Architecture Compliance
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Import authentication functions
import {
  startLogin,
  checkLogin,
  whoami,
  getAuthStatus,
  refreshTokens,
  logout,
  getPowerBIToken
} from '../../../src/core/auth/msal-auth.mjs';

// Import Labor tools
import laborToolsModule from '../../../src/core/tools/labor-tools.mjs';

// Import schema validation
import { assertLaborDataset } from '../../../src/core/powerbi/connector-labor.mjs';

// Configuration
const LABOR_WORKSPACE_ID = process.env.LABOR_WORKSPACE_ID || '927b94af-e7ef-4b5a-8b8d-02b0c5450b75';

const CONFIG = {
  LABOR_DATASET_ID: 'ea5298a1-13f0-4629-91ab-14f98163532e',
  LABOR_WORKSPACE_ID: LABOR_WORKSPACE_ID,
  POWERBI_WORKSPACE_ID: LABOR_WORKSPACE_ID, // Keep legacy name for compatibility
  TENANT_ID: '18c250cf-2ef7-4eeb-b6fb-94660f7867e0',
  CLIENT_ID: '8b84dc3b-a9ff-43ed-9d35-571f757e9c19'
};

// Set environment variables for labor tools
process.env.LABOR_DATASET_ID = CONFIG.LABOR_DATASET_ID;
process.env.LABOR_WORKSPACE_ID = CONFIG.LABOR_WORKSPACE_ID;
process.env.POWERBI_WORKSPACE_ID = CONFIG.POWERBI_WORKSPACE_ID;
process.env.POWERBI_DATASET_ID = CONFIG.LABOR_DATASET_ID; // For compatibility
process.env.AZURE_TENANT_ID = CONFIG.TENANT_ID;
process.env.AZURE_CLIENT_ID = CONFIG.CLIENT_ID;

// Authentication tool definitions
const AUTH_TOOLS = [
  {
    name: 'start_login',
    description: 'Start Microsoft authentication using device code flow',
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
    name: 'get_auth_status',
    description: 'Get current authentication status',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'refresh_tokens',
    description: 'Refresh authentication tokens',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'logout',
    description: 'Clear all authentication tokens',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// Labor prompt definitions
const LABOR_PROMPTS = [
  {
    name: 'timecard_analysis',
    description: 'Analyze timecard entries for a specific person and month',
    arguments: []
  },
  {
    name: 'team_utilization',
    description: 'Show team utilization and capacity metrics',
    arguments: []
  },
  {
    name: 'project_health',
    description: 'Analyze project health and resource allocation',
    arguments: []
  },
  {
    name: 'revenue_analysis',
    description: 'Calculate revenue and margin metrics',
    arguments: []
  },
  {
    name: 'resource_planning',
    description: 'Help with resource planning and allocation',
    arguments: []
  }
];

// Initialize server
async function main() {
  console.error('[LABOR-MCP] Starting Labor MCP Server v28.0.0 - 100% Architecture Compliance');

  // Boot-time validation - MUST pass before registering tools
  // Skip validation if no token available (will validate on first query)
  const token = getPowerBIToken();
  if (token) {
    try {
      console.error('[LABOR-MCP] Validating Labor dataset schema...');
      const { assertLaborDataset } = await import('../../../src/core/powerbi/connector-labor.mjs');
      await assertLaborDataset(CONFIG.LABOR_DATASET_ID, LABOR_WORKSPACE_ID);
      console.error('[LABOR-MCP] ✅ Schema validation passed');
    } catch (error) {
      console.error('[LABOR-MCP] ❌ FATAL: Schema validation failed:', error.message);
      console.error('[LABOR-MCP] Cannot start server with invalid dataset/workspace');
      process.exit(1); // Hard fail - no recovery
    }
  } else {
    console.error('[LABOR-MCP] ⚠️ No token available - will validate on first authenticated query');
  }

  const server = new Server(
    {
      name: process.env.MCP_SERVER_NAME || 'usdm-labor-mcp',
      version: '28.0.0'
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {}
      }
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error('[LABOR-MCP] Listing tools');

    // Get Labor tool names from the module
    const laborToolNames = Object.keys(laborToolsModule).filter(name => typeof laborToolsModule[name] === 'function');
    const formattedLaborTools = laborToolNames.map(name => ({
      name: name,
      description: laborToolsModule[name].description || `Labor tool: ${name.replace(/_/g, ' ')}`,
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    }));

    return {
      tools: [...AUTH_TOOLS, ...formattedLaborTools]
    };
  });

  // Handle prompts listing
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    console.error('[LABOR-MCP] Listing prompts');
    return {
      prompts: LABOR_PROMPTS
    };
  });

  // Handle resources listing (empty for now)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    console.error('[LABOR-MCP] Listing resources');
    return {
      resources: []
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.error(`[LABOR-MCP] Executing tool: ${name}`);

    try {
      // Handle authentication tools
      switch (name) {
        case 'start_login': {
          const result = await startLogin();
          console.error('[LABOR-MCP] Authentication started');
          return {
            content: [{
              type: 'text',
              text: result.success ? result.message : `Error: ${result.error}`
            }]
          };
        }

        case 'check_login': {
          const result = await checkLogin();
          console.error('[LABOR-MCP] Authentication check complete');
          return {
            content: [{
              type: 'text',
              text: result.success ? result.message : `Error: ${result.error}`
            }]
          };
        }

        case 'whoami': {
          const result = await whoami();
          console.error('[LABOR-MCP] User profile retrieved');
          if (result.success) {
            return {
              content: [{
                type: 'text',
                text: `User: ${result.user.displayName}
Email: ${result.user.mail}
Department: ${result.user.department || 'N/A'}
Job Title: ${result.user.jobTitle || 'N/A'}

Tokens:
- Graph: ${result.tokens.graph ? '✅' : '❌'}
- USDM: ${result.tokens.usdm ? '✅' : '❌'}
- PowerBI: ${result.tokens.powerbi ? '✅' : '❌'}`
              }]
            };
          }
          return {
            content: [{
              type: 'text',
              text: `Error: ${result.error}`
            }]
          };
        }

        case 'get_auth_status': {
          const result = getAuthStatus();
          console.error('[LABOR-MCP] Auth status retrieved');
          return {
            content: [{
              type: 'text',
              text: `Authentication Status:
Authenticated: ${result.authenticated ? '✅' : '❌'}
Pending Auth: ${result.pendingAuth ? '⏳' : '❌'}
Username: ${result.account?.username || 'Not authenticated'}

Tokens:
- PowerBI: ${result.tokens.powerbi ? '✅' : '❌'}
- Graph: ${result.tokens.graph ? '✅' : '❌'}
- USDM: ${result.tokens.usdm ? '✅' : '❌'}`
            }]
          };
        }

        case 'refresh_tokens': {
          const result = await refreshTokens();
          console.error('[LABOR-MCP] Tokens refreshed');
          return {
            content: [{
              type: 'text',
              text: result.success ? result.message : `Error: ${result.error}`
            }]
          };
        }

        case 'logout': {
          const result = logout();
          console.error('[LABOR-MCP] User logged out');
          return {
            content: [{
              type: 'text',
              text: result.message
            }]
          };
        }

        default: {
          // Handle Labor tools
          const toolFunction = laborToolsModule[name];
          if (!toolFunction) {
            throw new Error(`Unknown tool: ${name}`);
          }

          // Pass PowerBI token if available
          const token = getPowerBIToken();
          const result = await toolFunction(args || {}, token);
          console.error(`[LABOR-MCP] Labor tool ${name} executed`);

          // Format result for MCP
          return {
            content: [{
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }]
          };
        }
      }
    } catch (error) {
      console.error(`[LABOR-MCP] Tool error: ${error.message}`);
      return {
        content: [{
          type: 'text',
          text: `Error executing ${name}: ${error.message}`
        }],
        isError: true
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[LABOR-MCP] Server running on stdio transport with authentication support');
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('[LABOR-MCP] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[LABOR-MCP] Uncaught Exception:', error);
  process.exit(1);
});

// Start
main().catch(error => {
  console.error('[LABOR-MCP] Fatal error:', error);
  process.exit(1);
});