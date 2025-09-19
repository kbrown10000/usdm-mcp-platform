/**
 * Railway Integration Module - Connects V26.7 functionality to Railway server
 * This module bridges the authentication, PowerBI, and tools modules
 * NOW WITH MULTI-DOMAIN SUPPORT (Labor + Sales)
 */

// Dynamic imports for ES modules
let msalAuth, powerbiConnector, laborTools, salesTools, daxBuilder;
let modulesLoaded = false;

// Domain Configuration - Maps tools to their respective datasets
const DOMAIN_CONFIG = {
  labor: {
    datasetId: process.env.LABOR_DATASET_ID || process.env.POWERBI_DATASET_ID || 'ea5298a1-13f0-4629-91ab-14f98163532e',
    tools: [
      // Authentication tools
      'start_login', 'check_login', 'whoami', 'get_auth_status', 'refresh_tokens', 'logout',
      // Person analytics
      'person_resolver', 'activity_for_person_month', 'person_revenue_analysis', 'person_utilization',
      // Timecard
      'get_timecard_details',
      // Discovery
      'list_team_members', 'list_projects', 'list_tables', 'list_columns', 'list_measures', 'list_relationships',
      // Project analytics
      'get_project_details', 'get_project_budget', 'get_project_timeline',
      // Team analytics
      'get_team_performance', 'get_team_utilization', 'get_team_capacity',
      // Budget analytics
      'get_budget_summary', 'get_budget_variance', 'get_budget_forecast',
      // Cache & DAX
      'get_cache_stats', 'clear_cache', 'run_dax', 'test_dax_query'
    ]
  },
  sales: {
    datasetId: process.env.SALES_DATASET_ID || 'ef5c8f43-19c5-44d4-b57e-71b788933b88',
    tools: [
      // Core Pipeline analytics
      'get_pipeline_summary', 'get_opportunity_forecast',
      'get_opportunity_details', 'get_deal_velocity',
      // Account analytics
      'get_account_revenue', 'get_account_health',
      // Sales rep performance
      'get_rep_performance', 'get_rep_conversion',
      // Product & Team analytics
      'get_product_revenue', 'get_team_pipeline',
      // Advanced Power Tools
      'get_win_loss_analysis', 'get_deal_aging',
      'get_territory_performance', 'get_renewal_forecast',
      'get_monthly_trend', 'get_top_deals',
      'get_lead_conversion', 'get_quota_attainment',
      'get_activity_metrics', 'get_executive_dashboard'
    ]
  }
};

/**
 * Determine which dataset to use based on tool name
 */
function getDatasetForTool(toolName) {
  // Check Labor tools
  if (DOMAIN_CONFIG.labor.tools.includes(toolName)) {
    console.log(`[DOMAIN] Tool '${toolName}' mapped to LABOR domain (dataset: ${DOMAIN_CONFIG.labor.datasetId})`);
    return DOMAIN_CONFIG.labor.datasetId;
  }

  // Check Sales tools
  if (DOMAIN_CONFIG.sales.tools.includes(toolName)) {
    console.log(`[DOMAIN] Tool '${toolName}' mapped to SALES domain (dataset: ${DOMAIN_CONFIG.sales.datasetId})`);
    return DOMAIN_CONFIG.sales.datasetId;
  }

  // Default to Labor dataset for unknown tools
  console.log(`[DOMAIN] Tool '${toolName}' not mapped, defaulting to LABOR domain`);
  return DOMAIN_CONFIG.labor.datasetId;
}

/**
 * Load ES modules dynamically
 */
async function loadModules() {
  if (modulesLoaded) return;

  console.log('[MODULES] Loading V27.0 modules with multi-domain support...');

  try {
    // Dynamic imports for ES modules
    msalAuth = await import('./core/auth/msal-auth.mjs');
    powerbiConnector = await import('./core/powerbi/connector.mjs');
    laborTools = await import('./core/tools/labor-tools.mjs');
    salesTools = await import('./core/tools/sales-tools.mjs');
    // DAX builder with V26.7 optimized patterns
    daxBuilder = await import('./core/dax/builder.mjs');

    modulesLoaded = true;
    console.log('[MODULES] V27.0 modules loaded successfully (Labor + Sales domains)');
  } catch (error) {
    console.error('[MODULES] Failed to load modules:', error);
    throw error;
  }
}

/**
 * Get tool handlers after modules are loaded
 */
function getToolHandlers() {
  if (!modulesLoaded || !laborTools || !salesTools) {
    throw new Error('Modules not loaded. Call loadModules() first.');
  }

  // Combine Labor and Sales tool handlers
  return {
    // === LABOR DOMAIN TOOLS ===
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
    'clear_cache': laborTools.clear_cache,

    // === SALES DOMAIN TOOLS (20 Total) ===
    // Core Pipeline analytics
    'get_pipeline_summary': salesTools.get_pipeline_summary,
    'get_opportunity_forecast': salesTools.get_opportunity_forecast,
    'get_opportunity_details': salesTools.get_opportunity_details,
    'get_deal_velocity': salesTools.get_deal_velocity,

    // Account analytics
    'get_account_revenue': salesTools.get_account_revenue,
    'get_account_health': salesTools.get_account_health,

    // Sales rep performance
    'get_rep_performance': salesTools.get_rep_performance,
    'get_rep_conversion': salesTools.get_rep_conversion,

    // Product & Team analytics
    'get_product_revenue': salesTools.get_product_revenue,
    'get_team_pipeline': salesTools.get_team_pipeline,

    // Advanced Power Tools (New)
    'get_win_loss_analysis': salesTools.get_win_loss_analysis,
    'get_deal_aging': salesTools.get_deal_aging,
    'get_territory_performance': salesTools.get_territory_performance,
    'get_renewal_forecast': salesTools.get_renewal_forecast,
    'get_monthly_trend': salesTools.get_monthly_trend,
    'get_top_deals': salesTools.get_top_deals,
    'get_lead_conversion': salesTools.get_lead_conversion,
    'get_quota_attainment': salesTools.get_quota_attainment,
    'get_activity_metrics': salesTools.get_activity_metrics,
    'get_executive_dashboard': salesTools.get_executive_dashboard
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

  // Determine which domain this tool belongs to
  const datasetId = getDatasetForTool(toolName);
  const domain = DOMAIN_CONFIG.labor.tools.includes(toolName) ? 'LABOR' :
                 DOMAIN_CONFIG.sales.tools.includes(toolName) ? 'SALES' : 'UNKNOWN';

  try {
    console.log(`[TOOL] Executing ${toolName} (${domain} domain)`, args);
    console.log(`[TOOL] Using dataset: ${datasetId}`);

    // Pass dataset ID in args for tools that need it
    const enrichedArgs = { ...args, _datasetId: datasetId };

    const result = await handler(enrichedArgs);
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

  // Count tools by domain
  const laborToolCount = Object.keys(toolHandlers).filter(name =>
    DOMAIN_CONFIG.labor.tools.includes(name)).length;
  const salesToolCount = Object.keys(toolHandlers).filter(name =>
    DOMAIN_CONFIG.sales.tools.includes(name)).length;

  return {
    name: 'USDM MCP Platform',
    version: '27.1',
    description: 'Multi-domain analytics platform with Enhanced Sales (Labor + Sales)',
    status: 'operational',
    tools: Object.keys(toolHandlers),
    toolCount: {
      total: Object.keys(toolHandlers).length,
      labor: laborToolCount,
      sales: salesToolCount
    },
    domains: {
      labor: {
        enabled: true,
        dataset_id: DOMAIN_CONFIG.labor.datasetId,
        tools: laborToolCount,
        configured: !!DOMAIN_CONFIG.labor.datasetId
      },
      sales: {
        enabled: !!process.env.SALES_DATASET_ID || true,
        dataset_id: DOMAIN_CONFIG.sales.datasetId,
        tools: salesToolCount,
        configured: !!DOMAIN_CONFIG.sales.datasetId
      }
    },
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
      workspace_id: process.env.POWERBI_WORKSPACE_ID || '927b94af-e7ef-4b5a-8b8d-02b0c5450b75',
      labor_dataset: DOMAIN_CONFIG.labor.datasetId,
      sales_dataset: DOMAIN_CONFIG.sales.datasetId,
      multi_domain: true,
      configured: true
    }
  };
}

module.exports = {
  initialize,
  executeTool,
  handleMcpRpc,
  getStatus
};