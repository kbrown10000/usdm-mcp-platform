// Tools Module Index - V26.7 Labor Tools Export
// Exports all 11 critical tools extracted from V26.7 golden source

import laborTools from './labor-tools.mjs';

// Tool definitions for MCP server registration
// These follow the EXACT schema from V26.7 golden source (lines 204-325)
const toolDefinitions = [
  {
    name: 'start_login',
    description: 'Start Microsoft authentication - shows device code',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'check_login',
    description: 'Check if authentication is complete',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'whoami',
    description: 'Get authenticated user profile',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_auth_status',
    description: 'Check detailed authentication status',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'refresh_tokens',
    description: 'Refresh authentication tokens',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'person_resolver',
    description: 'V26.7 OPTIMIZED: Find person with exact match first, then fuzzy search',
    inputSchema: {
      type: 'object',
      properties: {
        search_term: { type: 'string', description: 'Person name or partial name' },
        fuzzy: { type: 'boolean', description: 'Enable fuzzy matching (default: true)' }
      },
      required: ['search_term']
    }
  },
  {
    name: 'activity_for_person_month',
    description: 'V26.7: Get monthly activity with improved caching',
    inputSchema: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Exact person name' },
        year: { type: 'number', description: 'Year (e.g., 2025)' },
        month: { type: 'number', description: 'Month (1-12)' }
      },
      required: ['person_name', 'year', 'month']
    }
  },
  {
    name: 'person_revenue_analysis',
    description: 'V26.7: Enhanced with null handling and better performance',
    inputSchema: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Exact person name' },
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD' }
      },
      required: ['person_name', 'start_date', 'end_date']
    }
  },
  {
    name: 'person_utilization',
    description: 'Calculate person utilization metrics for date range',
    inputSchema: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Exact person name' },
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        target_hours_per_week: { type: 'number', description: 'Target hours per week (default: 40)' }
      },
      required: ['person_name', 'start_date', 'end_date']
    }
  },
  {
    name: 'get_timecard_details',
    description: 'V26.7: Get detailed timecard entries with work descriptions and notes',
    inputSchema: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Full name of person' },
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        include_empty_notes: { type: 'boolean', description: 'Include entries without notes (default: false)' }
      },
      required: ['person_name', 'start_date', 'end_date']
    }
  },
  {
    name: 'run_dax',
    description: 'Run DAX query against PowerBI dataset',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'DAX query to execute' } },
      required: ['query']
    }
  },
  // Helper tools
  {
    name: 'get_cache_stats',
    description: 'V26.7: View cache statistics and performance metrics',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'clear_cache',
    description: 'V26.7: Clear cache for a specific type or all',
    inputSchema: {
      type: 'object',
      properties: { cache_type: { type: 'string', description: 'Cache type to clear (optional)' } }
    }
  }
];

// Tool handler mapping
const toolHandlers = {
  'start_login': laborTools.start_login,
  'check_login': laborTools.check_login,
  'whoami': laborTools.whoami,
  'get_auth_status': laborTools.get_auth_status,
  'refresh_tokens': laborTools.refresh_tokens,
  'person_resolver': laborTools.person_resolver,
  'activity_for_person_month': laborTools.activity_for_person_month,
  'person_revenue_analysis': laborTools.person_revenue_analysis,
  'person_utilization': laborTools.person_utilization,
  'get_timecard_details': laborTools.get_timecard_details,
  'run_dax': laborTools.run_dax,
  'get_cache_stats': laborTools.get_cache_stats,
  'clear_cache': laborTools.clear_cache
};

/**
 * Handle tool call with proper error handling and MCP response format
 * @param {string} toolName - Name of the tool to call
 * @param {Object} args - Arguments for the tool
 * @returns {Promise<Object>} - MCP-formatted response
 */
async function handleToolCall(toolName, args = {}) {
  const handler = toolHandlers[toolName];

  if (!handler) {
    return {
      content: [{ type: 'text', text: `❌ Unknown tool: ${toolName}` }],
      isError: true
    };
  }

  try {
    return await handler(args);
  } catch (error) {
    console.error(`Tool ${toolName} error:`, error);
    return {
      content: [{
        type: 'text',
        text: `❌ Tool ${toolName} failed: ${error.message}`
      }],
      isError: true
    };
  }
}

/**
 * Get all tool definitions for MCP server registration
 * @returns {Array} - Array of tool definitions
 */
function getToolDefinitions() {
  return toolDefinitions;
}

/**
 * Get tool handler function by name
 * @param {string} toolName - Name of the tool
 * @returns {Function|null} - Tool handler function or null
 */
function getToolHandler(toolName) {
  return toolHandlers[toolName] || null;
}

/**
 * Check if a tool exists
 * @param {string} toolName - Name of the tool
 * @returns {boolean} - True if tool exists
 */
function hasToolHandler(toolName) {
  return toolName in toolHandlers;
}

// Export everything needed for integration
export {
  // Main interface
  handleToolCall,
  getToolDefinitions,
  getToolHandler,
  hasToolHandler,

  // Direct access to implementations
  toolHandlers,
  toolDefinitions
};

// Default export for easier importing
export default {
  handleToolCall,
  getToolDefinitions,
  getToolHandler,
  hasToolHandler,
  toolHandlers,
  toolDefinitions,
  // Utility exports from labor tools
  getCached: laborTools.getCached,
  setCached: laborTools.setCached,
  fuzzyMatchScore: laborTools.fuzzyMatchScore,
  categorizeWork: laborTools.categorizeWork,
  CACHE_CONFIGS: laborTools.CACHE_CONFIGS
};