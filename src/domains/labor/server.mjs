/**
 * Labor Domain MCP Server - V26.7 Labor Analytics
 * Extends BaseMCPServer with 13 labor-specific tools
 * Reference: AGENT_DEFINITIVE_EXECUTION_PLAN.md Phase 7
 */

import { BaseMCPServer } from '../../core/base-server.mjs';

// Labor domain configuration
const LABOR_CONFIG = {
  name: 'labor',
  version: '27.0',
  description: 'USDM Labor Analytics Domain - V26.7 Functionality',
  schema: {
    dataset: {
      workspaceId: '927b94af-e7ef-4b5a-8b8d-02b0c5450b75',
      datasetId: 'ea5298a1-13f0-4629-91ab-14f98163532e'
    },
    expectedRowCount: 3238644
  },
  strictValidation: false,  // Don't fail if schema validation has warnings
  cache: {
    ttl: 600000,  // 10 minutes
    maxSize: 100
  }
};

export class LaborServer extends BaseMCPServer {
  constructor() {
    super(LABOR_CONFIG);
    this.laborTools = null;  // Will be loaded dynamically
  }

  /**
   * Get required OAuth scopes for labor domain
   * Must include PowerBI, Graph, and USDM API scopes
   */
  getRequiredScopes() {
    return [
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/User.ReadBasic.All',
      'https://analysis.windows.net/powerbi/api/.default',
      'api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation'  // USDM API
    ];
  }

  /**
   * Register labor domain-specific tools
   * Implements the 13 tools from V26.7
   */
  async registerDomainTools() {
    console.log(`[${this.name}] Registering labor domain tools...`);

    try {
      // Dynamically import labor tools module
      const laborToolsModule = await import('../../core/tools/labor-tools.mjs');
      this.laborTools = laborToolsModule.default || laborToolsModule;

      // Register person analytics tools
      this.registerTool('person_resolver', async (args) => {
        return await this.laborTools.person_resolver(args);
      });

      this.registerTool('activity_for_person_month', async (args) => {
        return await this.laborTools.activity_for_person_month(args);
      });

      this.registerTool('person_revenue_analysis', async (args) => {
        return await this.laborTools.person_revenue_analysis(args);
      });

      this.registerTool('person_utilization', async (args) => {
        return await this.laborTools.person_utilization(args);
      });

      // Register timecard tool
      this.registerTool('get_timecard_details', async (args) => {
        return await this.laborTools.get_timecard_details(args);
      });

      // Register DAX query tool
      this.registerTool('run_dax', async (args) => {
        return await this.laborTools.run_dax(args);
      });

      // Override base authentication tools with V26.7 implementations
      this.registerTool('start_login', async (args) => {
        return await this.laborTools.start_login(args);
      });

      this.registerTool('check_login', async (args) => {
        return await this.laborTools.check_login(args);
      });

      this.registerTool('whoami', async (args) => {
        return await this.laborTools.whoami(args);
      });

      this.registerTool('get_auth_status', async (args) => {
        return await this.laborTools.get_auth_status(args);
      });

      this.registerTool('refresh_tokens', async (args) => {
        return await this.laborTools.refresh_tokens(args);
      });

      // Override cache management with V26.7 implementations
      this.registerTool('get_cache_stats', async (args) => {
        return await this.laborTools.get_cache_stats(args);
      });

      this.registerTool('clear_cache', async (args) => {
        return await this.laborTools.clear_cache(args);
      });

      console.log(`[${this.name}] ✅ ${this.tools.size} labor tools registered`);

    } catch (error) {
      console.error(`[${this.name}] Failed to register labor tools:`, error);
      throw error;
    }
  }

  /**
   * Custom initialization for labor domain
   */
  async onInitialize() {
    console.log(`[${this.name}] Labor domain custom initialization`);

    // Set PowerBI dataset configuration
    if (process.env.NODE_ENV !== 'production') {
      process.env.POWERBI_WORKSPACE_ID = this.config.schema.dataset.workspaceId;
      process.env.POWERBI_DATASET_ID = this.config.schema.dataset.datasetId;
    }
  }

  /**
   * Handle schema validation results
   */
  async onSchemaValidated(validationResult) {
    if (!validationResult.valid) {
      console.warn(`[${this.name}] Schema validation had issues:`, validationResult.errors);

      // In production, we might want to alert but continue
      if (process.env.NODE_ENV === 'production') {
        console.log(`[${this.name}] Continuing despite schema validation warnings`);
      }
    }
  }

  /**
   * Tool execution interceptor for logging
   */
  async onToolCall(toolName, args) {
    console.log(`[${this.name}] Executing tool: ${toolName}`);

    // Log performance metrics for key tools
    if (['person_resolver', 'get_timecard_details', 'activity_for_person_month'].includes(toolName)) {
      this.startTime = Date.now();
    }
  }

  /**
   * Error handling with context
   */
  async onError(toolName, error) {
    console.error(`[${this.name}] Tool '${toolName}' failed:`, error.message);

    // Log performance even on error
    if (this.startTime) {
      const elapsed = Date.now() - this.startTime;
      console.log(`[${this.name}] Tool '${toolName}' failed after ${elapsed}ms`);
      this.startTime = null;
    }

    // Re-throw to maintain error flow
    throw error;
  }

  /**
   * Get performance metrics for this domain
   */
  getPerformanceMetrics() {
    return {
      domain: this.name,
      version: this.version,
      toolsRegistered: this.tools.size,
      expectedPerformance: {
        'person_resolver': { baseline: 387, max: 406 },  // +5%
        'activity_for_person_month': { baseline: 1489, max: 1563 },
        'get_timecard_details': { baseline: 2341, max: 2458 }
      }
    };
  }
}

// Export for use in integration tests
export default LaborServer;

// Standalone server startup (if run directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting Labor Domain Server...');

  const server = new LaborServer();

  server.initialize()
    .then(() => {
      console.log('Labor server ready');
      console.log('Available tools:', server.getTools());
    })
    .catch(error => {
      console.error('Failed to start labor server:', error);
      process.exit(1);
    });

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await server.shutdown();
    process.exit(0);
  });
}