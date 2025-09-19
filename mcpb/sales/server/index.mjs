#!/usr/bin/env node

/**
 * USDM Sales Analytics MCP Server - Fixed Version
 * Provides sales pipeline, opportunity, and revenue analytics
 *
 * PowerBI Dataset: PipelineAnalysis
 * Workspace ID: 927b94af-e7ef-4b5a-8b8d-02b0c5450b75 (Same as Labor)
 * Dataset ID: ef5c8f43-19c5-44d4-b57e-71b788933b88 (PipelineAnalysis)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Log to stderr for debugging (appears in Claude Desktop logs)
console.error('[Sales MCP] Starting server...');

// Configuration
const SALES_CONFIG = {
  name: 'usdm-sales-mcp',
  version: '1.0.0',
  description: 'USDM Sales Analytics - Pipeline, Opportunities, and Revenue',
  powerbi: {
    workspaceId: process.env.SALES_WORKSPACE_ID || '927b94af-e7ef-4b5a-8b8d-02b0c5450b75', // Same workspace as Labor
    datasetId: process.env.SALES_DATASET_ID || 'ef5c8f43-19c5-44d4-b57e-71b788933b88'    // Different dataset (PipelineAnalysis)
  }
};

// Create the server
const server = new Server(
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

// CRITICAL: Handle Initialize to echo protocol version
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  console.error('[Sales MCP] Initialize request received');
  console.error('[Sales MCP] Protocol version:', request.params.protocolVersion);

  // MUST echo the protocol version back
  return {
    protocolVersion: request.params.protocolVersion,
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: SALES_CONFIG.name,
      version: SALES_CONFIG.version
    }
  };
});

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('[Sales MCP] List tools request received');

  return {
    tools: [
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
            opportunity_name: { type: 'string' },
            account_name: { type: 'string' },
            owner_name: { type: 'string' }
          }
        }
      },
      {
        name: 'get_deal_velocity',
        description: 'Average time opportunities spend in each stage',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: { type: 'string' },
            end_date: { type: 'string' }
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
            account_name: { type: 'string' },
            period: { type: 'string' }
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
            territory: { type: 'string' },
            industry: { type: 'string' }
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
            rep_name: { type: 'string' },
            period: { type: 'string' }
          }
        }
      },
      {
        name: 'get_rep_conversion',
        description: 'Conversion rates by sales rep and stage',
        inputSchema: {
          type: 'object',
          properties: {
            team_leader: { type: 'string' }
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
            product_type: { type: 'string' },
            period: { type: 'string' }
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
            practice_id: { type: 'string' },
            region_id: { type: 'string' }
          }
        }
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[Sales MCP] Tool called: ${name}`);
  console.error(`[Sales MCP] Arguments:`, args);

  try {
    // Build sample DAX query based on tool
    let daxQuery = '';
    let result = {};

    switch (name) {
      case 'get_pipeline_summary':
        daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[StageName],
  ${args?.include_closed ? '' : "FILTER('DIM_Opportunity', 'DIM_Opportunity'[IsClosed] = FALSE()),"}
  "OpportunityCount", COUNTROWS('Fact_Opportunity'),
  "TotalAmount", COALESCE(SUM('Fact_Opportunity'[Opportunity Amount]), 0)
)`;
        result = {
          description: 'Pipeline summary query generated',
          dax: daxQuery,
          note: 'This would execute against PowerBI dataset ef5c8f43-19c5-44d4-b57e-71b788933b88'
        };
        break;

      case 'get_opportunity_forecast':
        const period = args?.period || 'quarter';
        const minProb = args?.min_probability || 0;
        daxQuery = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_Date'[${period === 'month' ? 'Month_Date' : period === 'year' ? 'Year_Date' : 'Quarter_Date'}],
    FILTER('DIM_Opportunity',
      'DIM_Opportunity'[IsClosed] = FALSE() &&
      'DIM_Opportunity'[Probability] >= ${minProb}
    ),
    "ForecastAmount", COALESCE(
      SUMX('Fact_Opportunity',
        'Fact_Opportunity'[Opportunity Amount] *
        RELATED('DIM_Opportunity'[Probability]) / 100
      ), 0
    )
  ),
  'DIM_Date'[Within_Next_30_Days] = TRUE()
)`;
        result = {
          description: 'Forecast query generated',
          dax: daxQuery,
          period: period,
          minProbability: minProb
        };
        break;

      case 'get_account_revenue':
        const accountName = args?.account_name || '';
        daxQuery = `
EVALUATE
TOPN(20,
  SUMMARIZECOLUMNS(
    'DIM_Account'[Account Name],
    FILTER('DIM_Account',
      SEARCH("${accountName}", 'DIM_Account'[Account Name], 1, 0) > 0
    ),
    "ClosedWonRevenue", COALESCE(
      CALCULATE(
        SUM('Fact_Opportunity'[Opportunity Amount]),
        'DIM_Opportunity'[IsWon] = TRUE()
      ), 0
    ),
    "PipelineRevenue", COALESCE(
      CALCULATE(
        SUM('Fact_Opportunity'[Opportunity Amount]),
        'DIM_Opportunity'[IsClosed] = FALSE()
      ), 0
    )
  ),
  [ClosedWonRevenue], DESC
)`;
        result = {
          description: `Account revenue for: ${accountName}`,
          dax: daxQuery,
          account: accountName
        };
        break;

      case 'get_rep_performance':
        const repName = args?.rep_name || '';
        daxQuery = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'Sales Team Member'[Sales Team Member],
    ${repName ? `FILTER('Sales Team Member', SEARCH("${repName}", 'Sales Team Member'[Sales Team Member], 1, 0) > 0),` : ''}
    "ClosedWonAmount", COALESCE(
      CALCULATE(
        SUM('Fact_Opportunity'[Opportunity Amount]),
        'DIM_Opportunity'[IsWon] = TRUE()
      ), 0
    ),
    "PipelineAmount", COALESCE(
      CALCULATE(
        SUM('Fact_Opportunity'[Opportunity Amount]),
        'DIM_Opportunity'[IsClosed] = FALSE()
      ), 0
    ),
    "WinRate", DIVIDE(
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
      0
    )
  )
)`;
        result = {
          description: `Performance metrics for: ${repName || 'All reps'}`,
          dax: daxQuery,
          rep: repName
        };
        break;

      default:
        result = {
          tool: name,
          args: args,
          status: 'Tool recognized but DAX generation pending',
          availableTools: [
            'get_pipeline_summary',
            'get_opportunity_forecast',
            'get_account_revenue',
            'get_rep_performance'
          ]
        };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };

  } catch (error) {
    console.error(`[Sales MCP] Error executing tool ${name}:`, error);
    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Sales MCP] Server connected and ready');
}

main().catch((error) => {
  console.error('[Sales MCP] Fatal error:', error);
  process.exit(1);
});