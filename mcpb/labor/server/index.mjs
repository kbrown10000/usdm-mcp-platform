#!/usr/bin/env node
/**
 * MCPB Labor Server Entry Point - Phase 9
 * Stdio transport for Claude Desktop integration
 * Preserves V26.7 functionality with V27.0 architecture
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LaborServer } from './src/domains/labor/server.mjs';

// Initialize MCP server
const server = new Server(
  {
    name: 'usdm-labor-mcp',
    version: '27.0.0'
  },
  {
    capabilities: {
      tools: {},
      prompts: {}
    }
  }
);

// Initialize labor domain server
const laborServer = new LaborServer();

// Tool handlers mapping
const toolHandlers = new Map();

/**
 * Register all labor tools with MCP server
 */
async function registerTools() {
  console.error('[MCPB] Registering labor tools...');

  // Initialize labor server first
  await laborServer.initialize();

  // Get all available tools
  const tools = laborServer.getTools();

  // Register each tool with MCP server
  for (const toolName of tools) {
    server.setRequestHandler({
      method: `tools/call`,
      handler: async (request) => {
        if (request.params.name === toolName) {
          try {
            const result = await laborServer.executeTool(
              toolName,
              request.params.arguments || {}
            );

            // Format response for MCP protocol
            if (result.content) {
              return {
                content: result.content
              };
            } else {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }]
              };
            }
          } catch (error) {
            return {
              content: [{
                type: 'text',
                text: `❌ Error: ${error.message}`
              }],
              isError: true
            };
          }
        }
      }
    });

    console.error(`[MCPB] Registered tool: ${toolName}`);
  }

  console.error(`[MCPB] ✅ ${tools.length} tools registered`);
}

/**
 * Handle tools/list request
 */
server.setRequestHandler({
  method: 'tools/list',
  handler: async () => {
    const tools = laborServer.getTools();

    return {
      tools: tools.map(name => {
        // Get tool description from manifest
        const manifestTools = [
          { name: 'start_login', description: 'Start device code authentication flow with Microsoft' },
          { name: 'check_login', description: 'Check authentication status and complete login' },
          { name: 'whoami', description: 'Get current authenticated user information' },
          { name: 'get_auth_status', description: 'Get detailed authentication status and token validity' },
          { name: 'refresh_tokens', description: 'Refresh authentication tokens' },
          { name: 'person_resolver', description: 'Find and resolve team member names with fuzzy matching' },
          { name: 'activity_for_person_month', description: 'Get monthly activity summary for a specific person' },
          { name: 'person_revenue_analysis', description: 'Analyze revenue metrics and utilization for a person' },
          { name: 'person_utilization', description: 'Calculate utilization rates and billable hours for a person' },
          { name: 'get_timecard_details', description: 'Get detailed timecard entries with notes for a person and date range' },
          { name: 'run_dax', description: 'Execute custom DAX queries against the PowerBI dataset' },
          { name: 'get_cache_stats', description: 'Get cache performance statistics and hit rates' },
          { name: 'clear_cache', description: 'Clear the cache for all or specific entries' },
          { name: 'validate_schema', description: 'Validate PowerBI schema integrity' },
          { name: 'execute_dax_query', description: 'Execute custom DAX queries' }
        ];

        const toolInfo = manifestTools.find(t => t.name === name);
        return {
          name: name,
          description: toolInfo?.description || `Execute ${name} tool`
        };
      })
    };
  }
});

/**
 * Handle prompts/list request
 */
server.setRequestHandler({
  method: 'prompts/list',
  handler: async () => {
    return {
      prompts: [
        {
          name: 'person_analysis',
          description: 'Analyze work patterns and productivity for a person',
          arguments: [
            { name: 'person_name', required: true },
            { name: 'time_period', required: true }
          ]
        },
        {
          name: 'timecard_review',
          description: 'Review timecard entries with notes',
          arguments: [
            { name: 'person_name', required: true },
            { name: 'month', required: true },
            { name: 'year', required: true }
          ]
        },
        {
          name: 'utilization_report',
          description: 'Generate utilization report',
          arguments: [
            { name: 'person_name', required: true }
          ]
        }
      ]
    };
  }
});

/**
 * Handle prompts/get request
 */
server.setRequestHandler({
  method: 'prompts/get',
  handler: async (request) => {
    const promptName = request.params.name;
    const args = request.params.arguments || {};

    const prompts = {
      person_analysis: `Analyze the work patterns and productivity for ${args.person_name || '{person_name}'} during ${args.time_period || '{time_period}'}`,
      timecard_review: `Review timecard entries with notes for ${args.person_name || '{person_name}'} in ${args.month || '{month}'} ${args.year || '{year}'}`,
      utilization_report: `Generate a utilization report showing billable vs non-billable hours for ${args.person_name || '{person_name}'}`
    };

    const promptText = prompts[promptName];
    if (!promptText) {
      throw new Error(`Unknown prompt: ${promptName}`);
    }

    return {
      prompt: {
        name: promptName,
        text: promptText
      }
    };
  }
});

/**
 * Main startup function
 */
async function main() {
  console.error('[MCPB] Starting USDM Labor MCP Server v27.0...');

  try {
    // Register all tools
    await registerTools();

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
  if (laborServer) {
    await laborServer.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[MCPB] Shutting down...');
  if (laborServer) {
    await laborServer.shutdown();
  }
  process.exit(0);
});

// Start the server
main().catch(error => {
  console.error('[MCPB] Fatal error:', error);
  process.exit(1);
});