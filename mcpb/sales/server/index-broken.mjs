#!/usr/bin/env node

/**
 * USDM Sales Analytics MCP Domain Server
 * Provides sales pipeline, opportunity, and revenue analytics
 *
 * PowerBI Dataset: PipelineAnalysis
 * Workspace ID: ef5c8f43-19c5-44d4-b57e-71b788933b88
 * Dataset ID: ef5c8f43-19c5-44d4-b57e-71b788933b88
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Configuration
const SALES_CONFIG = {
  name: 'usdm-sales-mcp',
  version: '1.0.0',
  description: 'USDM Sales Analytics - Pipeline, Opportunities, and Revenue',
  powerbi: {
    workspaceId: process.env.SALES_WORKSPACE_ID || 'ef5c8f43-19c5-44d4-b57e-71b788933b88',
    datasetId: process.env.SALES_DATASET_ID || 'ef5c8f43-19c5-44d4-b57e-71b788933b88'
  },
  auth: {
    tenantId: process.env.AZURE_TENANT_ID || '18c250cf-2ef7-4eeb-b6fb-94660f7867e0',
    clientId: process.env.AZURE_CLIENT_ID || '8b84dc3b-a9ff-43ed-9d35-571f757e9c19'
  },
  backend: {
    url: process.env.RAILWAY_BACKEND_URL || 'https://usdm-mcp-platform-production.up.railway.app'
  }
};

// Table mappings for Sales schema
const SALES_TABLES = {
  opportunities: 'DIM_Opportunity',
  accounts: 'DIM_Account',
  factOpportunity: 'Fact_Opportunity',
  factOppsCreated: 'Fact_Opportunities_Created',
  oppTeam: 'FACT_OpportunityTeam',
  oppHistory: 'Opportunity History',
  salesTeam: 'Sales Team Member',
  oppTeamMember: 'Opportunity Team Member',
  date: 'DIM_Date',
  measures: 'Pipeline Measures',
  boxFolder: 'boxfolderid'
};

class SalesServer {
  constructor() {
    this.server = new Server(
      {
        name: SALES_CONFIG.name,
        version: SALES_CONFIG.version,
      },
      {
        capabilities: {
          tools: {}
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List all available sales tools
    this.server.setRequestHandler('tools/list', async () => ({
      tools: this.getSalesTools()
    }));

    // Main tool execution handler
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.executeTool(name, args || {});
        return {
          content: [{
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        console.error(`[Sales MCP] Tool execution error: ${error.message}`);
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    });
  }

  getSalesTools() {
    return [
      // Pipeline Analytics
      {
        name: 'get_pipeline_summary',
        description: 'Current sales pipeline by stage with amounts and counts',
        inputSchema: {
          type: 'object',
          properties: {
            include_closed: { type: 'boolean', description: 'Include closed opportunities' }
          }
        }
      },
      {
        name: 'get_opportunity_forecast',
        description: 'Revenue forecast by close date and probability',
        inputSchema: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['month', 'quarter', 'year'] },
            min_probability: { type: 'number', minimum: 0, maximum: 100 }
          }
        }
      },

      // Opportunity Management
      {
        name: 'get_opportunity_details',
        description: 'Detailed information about specific opportunities',
        inputSchema: {
          type: 'object',
          properties: {
            opportunity_name: { type: 'string', description: 'Name or partial name of opportunity' },
            account_name: { type: 'string', description: 'Filter by account name' },
            owner_name: { type: 'string', description: 'Filter by owner name' }
          }
        }
      },
      {
        name: 'get_deal_velocity',
        description: 'Average time opportunities spend in each stage',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' }
          }
        }
      },

      // Account Analytics
      {
        name: 'get_account_revenue',
        description: 'Revenue history and forecast by account',
        inputSchema: {
          type: 'object',
          properties: {
            account_name: { type: 'string', description: 'Account name' },
            period: { type: 'string', enum: ['month', 'quarter', 'year'] }
          },
          required: ['account_name']
        }
      },
      {
        name: 'get_account_health',
        description: 'Account health score based on activity and revenue',
        inputSchema: {
          type: 'object',
          properties: {
            territory: { type: 'string', description: 'Filter by territory' },
            industry: { type: 'string', description: 'Filter by industry' }
          }
        }
      },

      // Sales Rep Performance
      {
        name: 'get_rep_performance',
        description: 'Sales rep quota attainment and pipeline metrics',
        inputSchema: {
          type: 'object',
          properties: {
            rep_name: { type: 'string', description: 'Sales rep name' },
            period: { type: 'string', enum: ['month', 'quarter', 'year'] }
          }
        }
      },
      {
        name: 'get_rep_conversion',
        description: 'Conversion rates by sales rep and stage',
        inputSchema: {
          type: 'object',
          properties: {
            team_leader: { type: 'string', description: 'Filter by team leader' }
          }
        }
      },

      // Product Analytics
      {
        name: 'get_product_revenue',
        description: 'Revenue by product type and category',
        inputSchema: {
          type: 'object',
          properties: {
            product_type: { type: 'string', description: 'Product type filter' },
            period: { type: 'string', enum: ['month', 'quarter', 'year'] }
          }
        }
      },

      // Team Analytics
      {
        name: 'get_team_pipeline',
        description: 'Pipeline summary by team or practice',
        inputSchema: {
          type: 'object',
          properties: {
            practice_id: { type: 'string', description: 'Practice ID' },
            region_id: { type: 'string', description: 'Region ID' }
          }
        }
      }
    ];
  }

  async executeTool(name, args) {
    // For now, proxy to Railway backend with Sales dataset config
    const backendUrl = `${SALES_CONFIG.backend.url}/api/tools/${name}`;

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': SALES_CONFIG.powerbi.workspaceId,
          'X-Dataset-Id': SALES_CONFIG.powerbi.datasetId
        },
        body: JSON.stringify(args)
      });

      if (!response.ok) {
        // If backend doesn't have the tool, use local implementation
        return await this.executeLocalTool(name, args);
      }

      return await response.json();
    } catch (error) {
      // Fallback to local implementation
      return await this.executeLocalTool(name, args);
    }
  }

  async executeLocalTool(name, args) {
    // Local DAX implementations for Sales tools
    const daxQuery = this.buildDaxQuery(name, args);

    if (!daxQuery) {
      throw new Error(`Tool '${name}' not implemented yet`);
    }

    // For now, return the DAX query as a placeholder
    // In production, this would execute against PowerBI
    return {
      tool: name,
      args: args,
      dax: daxQuery,
      note: 'DAX query generated - execution pending PowerBI connection'
    };
  }

  buildDaxQuery(toolName, args) {
    // Sales-specific DAX patterns
    const daxPatterns = {
      get_pipeline_summary: () => `
        EVALUATE
        SUMMARIZECOLUMNS(
          '${SALES_TABLES.opportunities}'[StageName],
          FILTER('${SALES_TABLES.opportunities}',
            ${args.include_closed ? 'TRUE()' : "'DIM_Opportunity'[IsClosed] = FALSE()"}
          ),
          "OpportunityCount", COUNTROWS('${SALES_TABLES.factOpportunity}'),
          "TotalAmount", SUM('${SALES_TABLES.factOpportunity}'[Opportunity Amount]),
          "WeightedAmount", SUMX('${SALES_TABLES.factOpportunity}',
            '${SALES_TABLES.factOpportunity}'[Opportunity Amount] *
            RELATED('${SALES_TABLES.opportunities}'[Probability]) / 100
          )
        )
        ORDER BY '${SALES_TABLES.opportunities}'[StageName]
      `,

      get_opportunity_forecast: () => `
        EVALUATE
        CALCULATETABLE(
          SUMMARIZECOLUMNS(
            '${SALES_TABLES.date}'[${args.period === 'month' ? 'Month_Date' :
                                   args.period === 'quarter' ? 'Quarter_Date' :
                                   'Year_Date'}],
            FILTER('${SALES_TABLES.opportunities}',
              '${SALES_TABLES.opportunities}'[IsClosed] = FALSE() &&
              '${SALES_TABLES.opportunities}'[Probability] >= ${args.min_probability || 0}
            ),
            "ForecastAmount", SUMX('${SALES_TABLES.factOpportunity}',
              '${SALES_TABLES.factOpportunity}'[Opportunity Amount] *
              RELATED('${SALES_TABLES.opportunities}'[Probability]) / 100
            ),
            "OpportunityCount", COUNTROWS('${SALES_TABLES.factOpportunity}')
          ),
          '${SALES_TABLES.date}'[Within_Next_30_Days] = TRUE()
        )
      `,

      get_account_revenue: () => `
        EVALUATE
        TOPN(50,
          SUMMARIZECOLUMNS(
            '${SALES_TABLES.accounts}'[Account Name],
            '${SALES_TABLES.date}'[${args.period === 'month' ? 'Month_Date' :
                                     args.period === 'quarter' ? 'Quarter_Date' :
                                     'Year_Date'}],
            FILTER('${SALES_TABLES.accounts}',
              SEARCH("${args.account_name}", '${SALES_TABLES.accounts}'[Account Name], 1, 0) > 0
            ),
            "ClosedWonRevenue", CALCULATE(
              SUM('${SALES_TABLES.factOpportunity}'[Opportunity Amount]),
              '${SALES_TABLES.opportunities}'[IsWon] = TRUE()
            ),
            "PipelineRevenue", CALCULATE(
              SUM('${SALES_TABLES.factOpportunity}'[Opportunity Amount]),
              '${SALES_TABLES.opportunities}'[IsClosed] = FALSE()
            )
          ),
          [ClosedWonRevenue], DESC
        )
      `,

      get_rep_performance: () => `
        EVALUATE
        FILTER(
          SUMMARIZECOLUMNS(
            '${SALES_TABLES.salesTeam}'[Sales Team Member],
            ${args.rep_name ? `FILTER('${SALES_TABLES.salesTeam}',
              SEARCH("${args.rep_name}", '${SALES_TABLES.salesTeam}'[Sales Team Member], 1, 0) > 0),` : ''}
            "ClosedWon", CALCULATE(
              SUM('${SALES_TABLES.factOpportunity}'[Opportunity Amount]),
              '${SALES_TABLES.opportunities}'[IsWon] = TRUE()
            ),
            "Pipeline", CALCULATE(
              SUM('${SALES_TABLES.factOpportunity}'[Opportunity Amount]),
              '${SALES_TABLES.opportunities}'[IsClosed] = FALSE()
            ),
            "WinRate", DIVIDE(
              CALCULATE(COUNTROWS('${SALES_TABLES.opportunities}'),
                '${SALES_TABLES.opportunities}'[IsWon] = TRUE()),
              CALCULATE(COUNTROWS('${SALES_TABLES.opportunities}'),
                '${SALES_TABLES.opportunities}'[IsClosed] = TRUE()),
              0
            )
          ),
          [ClosedWon] > 0 || [Pipeline] > 0
        )
      `
    };

    return daxPatterns[toolName] ? daxPatterns[toolName]() : null;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[Sales MCP] Server started successfully');
  }
}

// Start the server
const server = new SalesServer();
server.run().catch(console.error);