#!/usr/bin/env node

/**
 * MINIMAL Sales MCP Server - For Testing Only
 * This server ONLY echoes the protocol version to test basic connectivity
 */

console.error('[SALES-MCP-MINIMAL] Starting minimal test server...');

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

console.error('[SALES-MCP-MINIMAL] Imports successful');

// Create server
const server = new Server(
  {
    name: 'usdm-sales-mcp',
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

console.error('[SALES-MCP-MINIMAL] Server created');

// CRITICAL: Handle Initialize to echo protocol version
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  console.error('[SALES-MCP-MINIMAL] Initialize request received');
  console.error('[SALES-MCP-MINIMAL] Client protocol:', request.params.protocolVersion);

  const response = {
    protocolVersion: request.params.protocolVersion,
    capabilities: {
      tools: {},
      prompts: {},
      resources: {}
    },
    serverInfo: {
      name: 'usdm-sales-mcp',
      version: '28.0.0'
    }
  };

  console.error('[SALES-MCP-MINIMAL] Sending response:', JSON.stringify(response));
  return response;
});

console.error('[SALES-MCP-MINIMAL] Initialize handler registered');

// Minimal tool list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('[SALES-MCP-MINIMAL] Listing tools');
  return {
    tools: [
      {
        name: 'test_connection',
        description: 'Test that the Sales MCP is working'
      }
    ]
  };
});

// Minimal tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error('[SALES-MCP-MINIMAL] Executing tool:', request.params.name);
  return {
    content: [{
      type: 'text',
      text: 'Minimal server working!'
    }]
  };
});

// Start server
async function main() {
  console.error('[SALES-MCP-MINIMAL] Starting main()');
  try {
    const transport = new StdioServerTransport();
    console.error('[SALES-MCP-MINIMAL] Transport created');

    await server.connect(transport);
    console.error('[SALES-MCP-MINIMAL] Server connected successfully');
  } catch (error) {
    console.error('[SALES-MCP-MINIMAL] Fatal error:', error);
    process.exit(1);
  }
}

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('[SALES-MCP-MINIMAL] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[SALES-MCP-MINIMAL] Unhandled rejection:', reason);
  process.exit(1);
});

console.error('[SALES-MCP-MINIMAL] Calling main()');
main().catch(error => {
  console.error('[SALES-MCP-MINIMAL] Main error:', error);
  process.exit(1);
});