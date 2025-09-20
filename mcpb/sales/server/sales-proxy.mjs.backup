#!/usr/bin/env node

/**
 * Sales MCP Proxy Server v27.3.1
 * Standalone MCP server for Sales analytics with authentication
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
  logout
} from '../../../src/core/auth/msal-auth.mjs';

// Import Sales tools
import salesToolsModule from '../../../src/core/tools/sales-tools.mjs';

// Import schema validation
import { assertSalesDataset } from '../../../src/core/powerbi/connector.mjs';

// Configuration
const SALES_WORKSPACE_ID = process.env.SALES_WORKSPACE_ID || '927b94af-e7ef-4b5a-8b8d-02b0c5450b75';

const CONFIG = {
  SALES_DATASET_ID: 'ef5c8f43-19c5-44d4-b57e-71b788933b88',
  SALES_WORKSPACE_ID: SALES_WORKSPACE_ID,
  POWERBI_WORKSPACE_ID: SALES_WORKSPACE_ID, // Keep legacy name for compatibility
  TENANT_ID: '18c250cf-2ef7-4eeb-b6fb-94660f7867e0',
  CLIENT_ID: '8b84dc3b-a9ff-43ed-9d35-571f757e9c19'
};

// Set environment variables for sales tools
process.env.SALES_DATASET_ID = CONFIG.SALES_DATASET_ID;
process.env.SALES_WORKSPACE_ID = CONFIG.SALES_WORKSPACE_ID;
process.env.POWERBI_WORKSPACE_ID = CONFIG.POWERBI_WORKSPACE_ID;
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

// Sales prompt definitions
const SALES_PROMPTS = [
  {
    name: 'sales_pipeline_review',
    description: 'Show me the current sales pipeline with stage breakdown and top opportunities',
    arguments: []
  },
  {
    name: 'account_analysis',
    description: 'Analyze our top accounts by revenue and health',
    arguments: []
  },
  {
    name: 'team_performance',
    description: 'How is the sales team performing? Show rep metrics and conversion rates',
    arguments: []
  },
  {
    name: 'forecast_review',
    description: 'What\'s our weighted revenue forecast for the next 90 days?',
    arguments: []
  },
  {
    name: 'deal_analysis',
    description: 'Which deals need attention? Show aging opportunities and stuck deals',
    arguments: []
  }
];

// Initialize server
async function main() {
  console.error('[SALES-MCP] Starting Sales MCP Server v28.0.0 - 100% Architecture Compliance');

  // Boot-time validation - MUST pass before registering tools
  try {
    console.error('[SALES-MCP] Validating Sales dataset schema...');
    await assertSalesDataset(CONFIG.SALES_DATASET_ID, SALES_WORKSPACE_ID);
    console.error('[SALES-MCP] ✅ Schema validation passed');
  } catch (error) {
    console.error('[SALES-MCP] ❌ FATAL: Schema validation failed:', error.message);
    console.error('[SALES-MCP] Cannot start server with invalid dataset/workspace');
    process.exit(1); // Hard fail - no recovery
  }

  const server = new Server(
    {
      name: process.env.MCP_SERVER_NAME || 'usdm-sales-mcp',
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

  // Handle tool listing - combine auth and sales tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error('[SALES-MCP] Listing tools');

    // Format sales tools for MCP protocol
    const salesToolNames = Object.keys(salesToolsModule);
    const formattedSalesTools = salesToolNames.map(name => ({
      name: name,
      description: `Sales tool: ${name.replace(/_/g, ' ')}`,
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    }));

    return {
      tools: [...AUTH_TOOLS, ...formattedSalesTools]
    };
  });

  // Handle prompts listing
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    console.error('[SALES-MCP] Listing prompts');
    return {
      prompts: SALES_PROMPTS
    };
  });

  // Handle resources listing (empty for now)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    console.error('[SALES-MCP] Listing resources');
    return {
      resources: []
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.error(`[SALES-MCP] Executing tool: ${name}`);

    try {
      // Handle authentication tools
      switch (name) {
        case 'start_login': {
          const result = await startLogin();
          console.error('[SALES-MCP] Authentication started');
          return {
            content: [{
              type: 'text',
              text: result.success ? result.message : `Error: ${result.error}`
            }]
          };
        }

        case 'check_login': {
          const result = await checkLogin();
          console.error('[SALES-MCP] Authentication check complete');
          return {
            content: [{
              type: 'text',
              text: result.success ? result.message : `Error: ${result.error}`
            }]
          };
        }

        case 'whoami': {
          const result = await whoami();
          console.error('[SALES-MCP] User profile retrieved');
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
          console.error('[SALES-MCP] Auth status retrieved');
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
          console.error('[SALES-MCP] Tokens refreshed');
          return {
            content: [{
              type: 'text',
              text: result.success ? result.message : `Error: ${result.error}`
            }]
          };
        }

        case 'logout': {
          const result = logout();
          console.error('[SALES-MCP] User logged out');
          return {
            content: [{
              type: 'text',
              text: result.message
            }]
          };
        }

        default: {
          // Handle Sales tools
          const toolFunction = salesToolsModule[name];
          if (!toolFunction) {
            throw new Error(`Unknown tool: ${name}`);
          }

          const result = await toolFunction(args || {});
          console.error(`[SALES-MCP] Sales tool ${name} executed`);

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
      console.error(`[SALES-MCP] Tool error: ${error.message}`);
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
  console.error('[SALES-MCP] Server running on stdio transport with authentication support');
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SALES-MCP] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[SALES-MCP] Uncaught Exception:', error);
  process.exit(1);
});

// Start
main().catch(error => {
  console.error('[SALES-MCP] Fatal error:', error);
  process.exit(1);
});