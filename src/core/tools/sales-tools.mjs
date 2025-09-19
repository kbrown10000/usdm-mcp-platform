/**
 * Sales Domain Tools
 * Implements all Sales analytics tools for the MCP platform
 */

import { executeDaxQuery } from '../powerbi/connector.mjs';

// Use Sales dataset ID from environment or default
const SALES_DATASET_ID = process.env.SALES_DATASET_ID || 'ef5c8f43-19c5-44d4-b57e-71b788933b88';

/**
 * Get pipeline summary by stage
 */
export async function get_pipeline_summary(args) {
  const { include_closed = false } = args;

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[StageName],
  ${include_closed ? '' : "FILTER('DIM_Opportunity', 'DIM_Opportunity'[IsClosed] = FALSE()),"}
  "OpportunityCount", COUNTROWS('Fact_Opportunity'),
  "TotalAmount", COALESCE(SUM('Fact_Opportunity'[Opportunity Amount]), 0)
)`;

  console.log('[SALES] Executing pipeline summary query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_pipeline_summary',
    domain: 'sales',
    include_closed,
    data: result
  };
}

/**
 * Get opportunity forecast
 */
export async function get_opportunity_forecast(args) {
  const period = args?.period || 'quarter';
  const minProb = args?.min_probability || 0;

  const daxQuery = `
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

  console.log('[SALES] Executing opportunity forecast query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_opportunity_forecast',
    domain: 'sales',
    period,
    min_probability: minProb,
    data: result
  };
}

/**
 * Get account revenue
 */
export async function get_account_revenue(args) {
  const accountName = args?.account_name || '';

  if (!accountName) {
    throw new Error('account_name is required');
  }

  const daxQuery = `
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

  console.log(`[SALES] Executing account revenue query for: ${accountName}`);
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_account_revenue',
    domain: 'sales',
    account_name: accountName,
    data: result
  };
}

/**
 * Get sales rep performance
 */
export async function get_rep_performance(args) {
  const repName = args?.rep_name || '';
  const period = args?.period || 'current';

  const daxQuery = `
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

  console.log(`[SALES] Executing rep performance query for: ${repName || 'All reps'}`);
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_rep_performance',
    domain: 'sales',
    rep_name: repName,
    period,
    data: result
  };
}

/**
 * Get opportunity details
 */
export async function get_opportunity_details(args) {
  const { opportunity_name, account_name, owner_name } = args;

  let filterConditions = [];
  if (opportunity_name) {
    filterConditions.push(`SEARCH("${opportunity_name}", 'DIM_Opportunity'[Opportunity Name], 1, 0) > 0`);
  }
  if (account_name) {
    filterConditions.push(`SEARCH("${account_name}", 'DIM_Account'[Account Name], 1, 0) > 0`);
  }
  if (owner_name) {
    filterConditions.push(`SEARCH("${owner_name}", 'DIM_Opportunity'[Owner Name], 1, 0) > 0`);
  }

  const filterClause = filterConditions.length > 0
    ? `FILTER(ALL('DIM_Opportunity'), ${filterConditions.join(' && ')}),`
    : '';

  const daxQuery = `
EVALUATE
TOPN(50,
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[Opportunity Name],
    'DIM_Opportunity'[StageName],
    'DIM_Account'[Account Name],
    'DIM_Opportunity'[Owner Name],
    ${filterClause}
    "Amount", SUM('Fact_Opportunity'[Opportunity Amount]),
    "Probability", AVERAGE('DIM_Opportunity'[Probability]),
    "CloseDate", MAX('DIM_Opportunity'[CloseDate])
  ),
  'DIM_Opportunity'[CloseDate], DESC
)`;

  console.log('[SALES] Executing opportunity details query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_opportunity_details',
    domain: 'sales',
    filters: args,
    data: result
  };
}

/**
 * Get deal velocity
 */
export async function get_deal_velocity(args) {
  const { start_date, end_date } = args;

  const dateFilter = start_date && end_date
    ? `FILTER('DIM_Date', 'DIM_Date'[Full_Date] >= DATE(${start_date.replace(/-/g, ',')}) && 'DIM_Date'[Full_Date] <= DATE(${end_date.replace(/-/g, ',')})),`
    : '';

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[StageName],
  ${dateFilter}
  "AvgDaysInStage", AVERAGE('Opportunity History'[Stage Days]),
  "OpportunityCount", COUNTROWS('DIM_Opportunity'),
  "ConversionRate", DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    COUNTROWS('DIM_Opportunity'),
    0
  )
)`;

  console.log('[SALES] Executing deal velocity query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_deal_velocity',
    domain: 'sales',
    date_range: { start_date, end_date },
    data: result
  };
}

/**
 * Get account health
 */
export async function get_account_health(args) {
  const { territory, industry } = args;

  let filterConditions = [];
  if (territory) {
    filterConditions.push(`'DIM_Account'[Territory] = "${territory}"`);
  }
  if (industry) {
    filterConditions.push(`'DIM_Account'[Industry] = "${industry}"`);
  }

  const filterClause = filterConditions.length > 0
    ? `FILTER('DIM_Account', ${filterConditions.join(' && ')}),`
    : '';

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Account'[Account Name],
  'DIM_Account'[Territory],
  'DIM_Account'[Industry],
  ${filterClause}
  "TotalRevenue", SUM('Fact_Opportunity'[Opportunity Amount]),
  "OpenOpportunities", CALCULATE(
    COUNTROWS('DIM_Opportunity'),
    'DIM_Opportunity'[IsClosed] = FALSE()
  ),
  "WinRate", DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
    0
  ),
  "HealthScore",
    DIVIDE(
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()) * 100 +
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = FALSE()) * 50,
      CALCULATE(COUNTROWS('DIM_Opportunity')),
      0
    )
)`;

  console.log('[SALES] Executing account health query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_account_health',
    domain: 'sales',
    filters: args,
    data: result
  };
}

/**
 * Get rep conversion rates
 */
export async function get_rep_conversion(args) {
  const { team_leader } = args;

  const filterClause = team_leader
    ? `FILTER('Sales Team Member', 'Sales Team Member'[Team Leader] = "${team_leader}"),`
    : '';

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'Sales Team Member'[Sales Team Member],
  'DIM_Opportunity'[StageName],
  ${filterClause}
  "OpportunityCount", COUNTROWS('DIM_Opportunity'),
  "ConversionToNext",
    DIVIDE(
      CALCULATE(
        COUNTROWS('DIM_Opportunity'),
        'DIM_Opportunity'[Stage Progress] > EARLIER('DIM_Opportunity'[Stage Progress])
      ),
      COUNTROWS('DIM_Opportunity'),
      0
    ),
  "WinRate", DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    COUNTROWS('DIM_Opportunity'),
    0
  )
)`;

  console.log('[SALES] Executing rep conversion query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_rep_conversion',
    domain: 'sales',
    team_leader,
    data: result
  };
}

/**
 * Get product revenue
 */
export async function get_product_revenue(args) {
  const { product_type, period } = args;

  let filterConditions = [];
  if (product_type) {
    filterConditions.push(`'DIM_Product'[Product Type] = "${product_type}"`);
  }

  const filterClause = filterConditions.length > 0
    ? `FILTER('DIM_Product', ${filterConditions.join(' && ')}),`
    : '';

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Product'[Product Name],
  'DIM_Product'[Product Type],
  'DIM_Product'[Product Category],
  ${filterClause}
  "TotalRevenue", SUM('Fact_Opportunity'[Opportunity Amount]),
  "OpportunityCount", COUNTROWS('Fact_Opportunity'),
  "AvgDealSize", AVERAGE('Fact_Opportunity'[Opportunity Amount]),
  "WinRate", DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
    0
  )
)`;

  console.log('[SALES] Executing product revenue query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_product_revenue',
    domain: 'sales',
    product_type,
    period,
    data: result
  };
}

/**
 * Get team pipeline
 */
export async function get_team_pipeline(args) {
  const { practice_id, region_id } = args;

  let filterConditions = [];
  if (practice_id) {
    filterConditions.push(`'DIM_Team'[Practice ID] = "${practice_id}"`);
  }
  if (region_id) {
    filterConditions.push(`'DIM_Team'[Region ID] = "${region_id}"`);
  }

  const filterClause = filterConditions.length > 0
    ? `FILTER('DIM_Team', ${filterConditions.join(' && ')}),`
    : '';

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Team'[Team Name],
  'DIM_Team'[Practice ID],
  'DIM_Team'[Region ID],
  ${filterClause}
  "PipelineAmount", CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsClosed] = FALSE()
  ),
  "ClosedWonAmount", CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsWon] = TRUE()
  ),
  "OpportunityCount", COUNTROWS('Fact_Opportunity'),
  "TeamSize", DISTINCTCOUNT('Sales Team Member'[Sales Team Member])
)`;

  console.log('[SALES] Executing team pipeline query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_team_pipeline',
    domain: 'sales',
    practice_id,
    region_id,
    data: result
  };
}

// Export all Sales tools
export default {
  get_pipeline_summary,
  get_opportunity_forecast,
  get_opportunity_details,
  get_deal_velocity,
  get_account_revenue,
  get_account_health,
  get_rep_performance,
  get_rep_conversion,
  get_product_revenue,
  get_team_pipeline
};