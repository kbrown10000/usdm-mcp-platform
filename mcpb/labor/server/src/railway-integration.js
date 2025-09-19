/**
 * Railway Integration Module - Connects V26.7 functionality to Railway server
 * This module bridges the authentication, PowerBI, and tools modules
 */

// Dynamic imports for ES modules
let msalAuth, powerbiConnector, laborTools, daxBuilder;
let modulesLoaded = false;

/**
 * Load ES modules dynamically
 */
async function loadModules() {
  if (modulesLoaded) return;

  console.log('[MODULES] Loading V26.7 modules...');

  try {
    // Dynamic imports for ES modules
    msalAuth = await import('./core/auth/msal-auth.mjs');
    powerbiConnector = await import('./core/powerbi/connector.mjs');
    laborTools = await import('./core/tools/labor-tools.mjs');
    // DAX builder with V26.7 optimized patterns
    daxBuilder = await import('./core/dax/builder.mjs');

    modulesLoaded = true;
    console.log('[MODULES] V26.7 modules loaded successfully');
  } catch (error) {
    console.error('[MODULES] Failed to load modules:', error);
    throw error;
  }
}

/**
 * Get tool handlers after modules are loaded
 */
function getToolHandlers() {
  if (!modulesLoaded || !laborTools) {
    throw new Error('Modules not loaded. Call loadModules() first.');
  }

  // When using dynamic imports, we get both named exports and default export
  // The functions are available directly on the module object
  return {
    // Authentication tools
    'start_login': laborTools.start_login,
    'check_login': laborTools.check_login,
    'whoami': laborTools.whoami,
    'get_auth_status': laborTools.get_auth_status,
    'refresh_tokens': laborTools.refresh_tokens,

    // Person analytics tools
    'person_resolver': laborTools.person_resolver,
    'activity_for_person_month': laborTools.activity_for_person_month,
    'person_revenue_analysis': laborTools.person_revenue_analysis,
    'person_utilization': laborTools.person_utilization,

    // Timecard tool
    'get_timecard_details': laborTools.get_timecard_details,

    // DAX query tool
    'run_dax': laborTools.run_dax,

    // Cache management
    'get_cache_stats': laborTools.get_cache_stats,
    'clear_cache': laborTools.clear_cache
  };
}

/**
 * Execute a tool by name
 */
async function executeTool(toolName, args = {}) {
  await loadModules();
  const toolHandlers = getToolHandlers();
  const handler = toolHandlers[toolName];

  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    console.log(`[TOOL] Executing ${toolName}`, args);
    const result = await handler(args);
    console.log(`[TOOL] ${toolName} completed successfully`);
    return result;
  } catch (error) {
    console.error(`[TOOL] ${toolName} error:`, error.message);
    throw error;
  }
}

/**
 * Handle MCP/RPC requests
 */
async function handleMcpRpc(method, params) {
  console.log(`[MCP/RPC] Method: ${method}`);

  await loadModules();
  const toolHandlers = getToolHandlers();

  if (method === 'tools/list') {
    return {
      tools: Object.keys(toolHandlers).map(name => ({
        name,
        description: `Execute ${name} tool`
      }))
    };
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};

    if (!name) {
      throw new Error('Tool name is required');
    }

    const result = await executeTool(name, args || {});

    // Format result for MCP protocol
    return {
      content: [{
        type: 'text',
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      }]
    };
  }

  throw new Error(`Unknown method: ${method}`);
}

/**
 * Initialize all modules
 */
async function initialize() {
  console.log('[INIT] Initializing Railway integration...');

  // Load ES modules
  await loadModules();
  const toolHandlers = getToolHandlers();

  // Initialize auth if needed
  if (process.env.ENABLE_AUTH === 'true') {
    console.log('[INIT] Authentication enabled');
    // Auth will initialize on first use
  }

  // Initialize PowerBI connection
  if (process.env.POWERBI_WORKSPACE_ID && process.env.POWERBI_DATASET_ID) {
    console.log('[INIT] PowerBI configuration detected');
    console.log(`[INIT] Workspace: ${process.env.POWERBI_WORKSPACE_ID}`);
    console.log(`[INIT] Dataset: ${process.env.POWERBI_DATASET_ID}`);
  }

  console.log('[INIT] Railway integration ready');
  console.log(`[INIT] ${Object.keys(toolHandlers).length} tools available`);

  return true;
}

/**
 * Get service status
 */
async function getStatus() {
  await loadModules();
  const toolHandlers = getToolHandlers();

  return {
    name: 'USDM MCP Platform',
    version: '27.0',
    description: 'Enterprise labor analytics platform with V26.7 functionality',
    status: 'operational',
    tools: Object.keys(toolHandlers),
    transport: ['http', 'websocket'],
    endpoints: {
      health: '/health',
      discover: '/mcp/discover',
      rpc: '/mcp/rpc',
      tools: '/api/tools/:toolName'
    },
    authentication: {
      type: 'MSAL',
      flow: 'device_code',
      provider: 'Microsoft',
      configured: !!process.env.AZURE_CLIENT_ID
    },
    powerbi: {
      workspace_id: process.env.POWERBI_WORKSPACE_ID,
      dataset_id: process.env.POWERBI_DATASET_ID,
      configured: !!(process.env.POWERBI_WORKSPACE_ID && process.env.POWERBI_DATASET_ID)
    }
  };
}

module.exports = {
  initialize,
  executeTool,
  handleMcpRpc,
  getStatus
};