#!/usr/bin/env node
/**
 * Simple Railway Proxy for MCPB Labor Extension
 * This is a pure pass-through proxy that forwards ALL tools to Railway
 * Railway maintains the authentication state, not this proxy
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// Configuration
const RAILWAY_BACKEND_URL = process.env.RAILWAY_BACKEND_URL || 'https://usdm-mcp-platform-production.up.railway.app';

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

// Simple axios instance for Railway
const api = axios.create({
  baseURL: RAILWAY_BACKEND_URL,
  timeout: 30000,
  headers: {
    'User-Agent': 'USDM-Labor-MCP-MCPB/27.0.0',
    'Content-Type': 'application/json'
  }
});

// List tools - proxy to Railway but use proper descriptions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('[PROXY] Received tools/list request');

  // Always return our properly documented tools list
  // Railway's generic descriptions ("Execute X tool") are not helpful
  const tools = [
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
    { name: 'clear_cache', description: 'Clear the cache for all or specific entries' }
  ];

  console.error(`[PROXY] Returning ${tools.length} tools to Claude Desktop`);
  return { tools };
});

// List prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'person_analysis',
        description: 'Analyze work patterns and productivity',
        arguments: [
          { name: 'person_name', description: 'Name of the person', required: true },
          { name: 'time_period', description: 'Time period', required: true }
        ]
      },
      {
        name: 'timecard_review',
        description: 'Review timecard entries',
        arguments: [
          { name: 'person_name', description: 'Name of the person', required: true },
          { name: 'month', description: 'Month (1-12)', required: true },
          { name: 'year', description: 'Year', required: true }
        ]
      }
    ]
  };
});

// Get prompt
server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const prompts = {
    person_analysis: `Analyze work patterns for ${args.person_name || '{person}'} during ${args.time_period || '{period}'}`,
    timecard_review: `Review timecards for ${args.person_name || '{person}'} in ${args.month || '{month}'} ${args.year || '{year}'}`
  };

  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text: prompts[name] || 'Unknown prompt' }
    }]
  };
});

// Tool handler - PROXY EVERYTHING TO RAILWAY
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  console.error(`[PROXY] Tool call: ${name}`);

  try {
    // Send request to Railway's MCP/RPC endpoint
    const response = await api.post('/mcp/rpc', {
      method: 'tools/call',
      params: {
        name: name,
        arguments: args
      }
    }, {
      timeout: 60000  // 60 second timeout for long operations
    });

    // Handle Railway's response
    if (response.data.error) {
      console.error(`[PROXY] Railway error:`, response.data.error);
      return {
        content: [{
          type: 'text',
          text: `❌ Error: ${response.data.error.message || response.data.error}`
        }],
        isError: true
      };
    }

    // CRITICAL FIX: Railway is double-encoding ALL responses
    // The response.data.content[0].text contains a JSON string that needs to be parsed
    if (response.data.content && Array.isArray(response.data.content)) {
      const firstContent = response.data.content[0];
      if (firstContent?.type === 'text' && typeof firstContent.text === 'string') {
        // Railway ALWAYS returns JSON-encoded content in text field
        if (firstContent.text.startsWith('{')) {
          try {
            const decoded = JSON.parse(firstContent.text);
            if (decoded.content) {
              // This is the ACTUAL MCP response we need to return
              console.error('[PROXY] Decoded double-encoded response');
              return decoded;
            }
          } catch (e) {
            console.error('[PROXY] Failed to decode, returning raw text');
            // If it's not JSON, return as formatted text
            return {
              content: [{
                type: 'text',
                text: firstContent.text
              }]
            };
          }
        }
        // Not JSON, return the text directly
        return {
          content: [{
            type: 'text',
            text: firstContent.text
          }]
        };
      }
    }

    // Handle MCP/RPC result format
    if (response.data.result?.content) {
      return response.data.result;
    }

    // Handle other response formats
    if (response.data.result) {
      return {
        content: [{
          type: 'text',
          text: typeof response.data.result === 'string'
            ? response.data.result
            : JSON.stringify(response.data.result, null, 2)
        }]
      };
    }

    // Default fallback
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2)
      }]
    };

  } catch (error) {
    console.error(`[PROXY] Request failed:`, error.message);

    if (error.code === 'ECONNREFUSED') {
      return {
        content: [{
          type: 'text',
          text: `❌ Cannot connect to Railway backend at ${RAILWAY_BACKEND_URL}`
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

// Main startup
async function main() {
  console.error('[PROXY] ============================================');
  console.error('[PROXY] Starting USDM Labor MCP Railway Proxy v27.0');
  console.error('[PROXY] ============================================');
  console.error(`[PROXY] Process started at: ${new Date().toISOString()}`);
  console.error(`[PROXY] Node version: ${process.version}`);
  console.error(`[PROXY] Working directory: ${process.cwd()}`);
  console.error(`[PROXY] Railway backend: ${RAILWAY_BACKEND_URL}`);

  try {
    // Test Railway connection
    console.error('[PROXY] Testing Railway connection...');
    const health = await api.get('/health').catch(() => null);
    if (health?.data?.status === 'ok') {
      console.error('[PROXY] ✅ Railway backend connected successfully');
    } else {
      console.error('[PROXY] ⚠️ Railway backend may be down (continuing anyway)');
    }

    // Create stdio transport
    console.error('[PROXY] Creating stdio transport...');
    const transport = new StdioServerTransport();

    // Start server
    console.error('[PROXY] Connecting MCP server to transport...');
    await server.connect(transport);

    console.error('[PROXY] ✅ Server started successfully');
    console.error('[PROXY] Ready to receive MCP protocol requests');
    console.error('[PROXY] Waiting for initialize request from Claude Desktop...');

  } catch (error) {
    console.error('[PROXY] ❌ Fatal error during startup:', error);
    console.error('[PROXY] Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.error('[PROXY] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[PROXY] Shutting down...');
  process.exit(0);
});

// Start the server
main().catch(error => {
  console.error('[PROXY] Fatal error:', error);
  process.exit(1);
});