/**
 * Sales Domain Tools - v27.3 with Runtime Guards & Preflight
 * Complete implementation with 20+ analytics tools for Sales MCP
 * CRITICAL: Enforces Sales dataset routing, prevents Labor contamination
 */

import { executeDaxQuery, assertSalesDataset } from '../powerbi/connector.mjs';

// Required: set these in Railway Variables
const SALES_DATASET_ID = process.env.SALES_DATASET_ID; // REQUIRED - no default!
const SALES_WORKSPACE_ID = process.env.SALES_WORKSPACE_ID || '927b94af-e7ef-4b5a-8b8d-02b0c5450b75';
const LABOR_DATASET_ID = process.env.LABOR_DATASET_ID || 'ea5298a1-13f0-4629-91ab-14f98163532e';
const WORKSPACE_ID = process.env.POWERBI_WORKSPACE_ID || '927b94af-e7ef-4b5a-8b8d-02b0c5450b75';

// ============================================
// PREFLIGHT VALIDATION (Run once on startup)
// ============================================
let preflightComplete = false;

async function ensurePreflightValidation() {
  if (preflightComplete) return;

  if (!SALES_DATASET_ID) {
    throw new Error('[SalesMCP Preflight] SALES_DATASET_ID not configured. Set in Railway Variables.');
  }

  try {
    await assertSalesDataset(SALES_DATASET_ID, SALES_WORKSPACE_ID);
    console.error(`[SalesMCP Preflight] ✅ Sales dataset validated: ${SALES_DATASET_ID.slice(0, 8)}…${SALES_DATASET_ID.slice(-4)}`);
    preflightComplete = true;
  } catch (error) {
    console.error(`[SalesMCP Preflight] ❌ FATAL: ${error.message}`);
    throw error;
  }
}

// ============================================
// CRITICAL SAFETY GUARDS
// ============================================

function requireId(name, value) {
  if (!value) {
    throw new Error(`[SalesMCP] Missing ${name}. Set it in Railway Variables.`);
  }
}

function redacted(id) {
  return id ? `${id.slice(0, 8)}…${id.slice(-4)}` : 'undefined';
}

function getDatasetId(args = {}) {
  // Prefer enriched args from Railway integration; otherwise use ENV
  const datasetId = args._datasetId || SALES_DATASET_ID;

  requireId('SALES_DATASET_ID', datasetId);

  if (datasetId === LABOR_DATASET_ID) {
    throw new Error('[SalesMCP] CRITICAL: Refusing to run Sales tool against LABOR datasetId!');
  }

  return datasetId;
}

/**
 * Safe execution wrapper with logging
 */
async function runSalesDax(dax, args, toolName = 'unknown_tool') {
  // Ensure preflight validation has run
  await ensurePreflightValidation();

  const datasetId = getDatasetId(args);
  console.error(
    `[SalesMCP] ${toolName} dataset=${redacted(datasetId)} ` +
    `ws=${redacted(SALES_WORKSPACE_ID)}`
  );

  try {
    return await executeDaxQuery(dax, datasetId, SALES_WORKSPACE_ID);
  } catch (error) {
    console.error(`[SalesMCP] ${toolName} error:`, error.message);
    throw error;
  }
}

// ============================================
// VALIDATION & PING
// ============================================

/**
 * Get data source information (debugging tool)
 * Shows exactly which dataset is being targeted
 */
export async function get_data_source_info(args = {}) {
  const datasetId = getDatasetId(args);
  return {
    success: true,
    domain: 'sales',
    datasetId: datasetId,
    datasetIdRedacted: redacted(datasetId),
    workspaceId: SALES_WORKSPACE_ID,
    workspaceIdRedacted: redacted(SALES_WORKSPACE_ID),
    isLaborDataset: datasetId === LABOR_DATASET_ID,
    isSalesDataset: datasetId === process.env.SALES_DATASET_ID
  };
}

/**
 * Ping Sales dataset to verify connectivity
 */
export async function ping_sales_dataset(args = {}) {
  const dax = `EVALUATE ROW("ok", 1)`;
  const res = await runSalesDax(dax, args, 'ping_sales_dataset');
  return {
    success: true,
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    data: res.data
  };
}

/**
 * Validate Sales dataset has required tables
 */
export async function validate_sales_schema(args = {}) {
  const dax = `
EVALUATE
ROW(
  "HasOpportunity", IF(ISBLANK(COUNTROWS('DIM_Opportunity')), 0, 1),
  "HasFactOpp", IF(ISBLANK(COUNTROWS('Fact_Opportunity')), 0, 1),
  "HasAccount", IF(ISBLANK(COUNTROWS('DIM_Account')), 0, 1)
)`;

  const res = await runSalesDax(dax, args, 'validate_sales_schema');
  return {
    success: true,
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    schema_valid: res.data?.[0]?.['[HasOpportunity]'] === 1,
    data: res.data
  };
}

// ============================================
// SECTION 1: CORE PIPELINE ANALYTICS
// ============================================

/**
 * Get pipeline summary by stage
 */
export async function get_pipeline_summary(args = {}) {
  const { include_closed = false } = args;

  const dax = include_closed
    ? `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[StageName],
  "OpportunityCount", COUNTROWS('DIM_Opportunity'),
  "TotalAmount", COALESCE(SUM('Fact_Opportunity'[Opportunity Amount]), 0),
  "AvgDealSize", DIVIDE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    COUNTROWS('DIM_Opportunity'),
    0
  )
)
ORDER BY [TotalAmount] DESC`
    : `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[StageName],
    "OpportunityCount", COUNTROWS('DIM_Opportunity'),
    "TotalAmount", COALESCE(SUM('Fact_Opportunity'[Opportunity Amount]), 0),
    "AvgDealSize", DIVIDE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      COUNTROWS('DIM_Opportunity'),
      0
    )
  ),
  'DIM_Opportunity'[IsClosed] = FALSE()
)
ORDER BY [TotalAmount] DESC`;

  const res = await runSalesDax(dax, args, 'get_pipeline_summary');

  return {
    success: true,
    tool: 'get_pipeline_summary',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    include_closed,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Get opportunity forecast with probability weighting
 */
export async function get_opportunity_forecast(args = {}) {
  const { min_probability = 0, max_days = 90 } = args;

  const dax = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[StageName],
    'DIM_Opportunity'[Forecast Category],
    "OpportunityCount", COUNTROWS('DIM_Opportunity'),
    "UnweightedAmount", SUM('Fact_Opportunity'[Opportunity Amount]),
    "WeightedForecast",
    SUMX(
      'Fact_Opportunity',
      'Fact_Opportunity'[Opportunity Amount] *
      COALESCE(RELATED('DIM_Opportunity'[Probability]), 50) / 100
    )
  ),
  'DIM_Opportunity'[IsClosed] = FALSE() &&
  'DIM_Opportunity'[CloseDate] <= TODAY() + ${max_days}
)
ORDER BY [WeightedForecast] DESC`;

  const res = await runSalesDax(dax, args, 'get_opportunity_forecast');

  return {
    success: true,
    tool: 'get_opportunity_forecast',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    min_probability,
    max_days,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Get opportunity details with flexible filters
 */
export async function get_opportunity_details(args = {}) {
  const {
    stage = null,
    min_amount = 0,
    is_closed = null,
    top_n = 20
  } = args;

  let filters = [];
  if (stage) filters.push(`'DIM_Opportunity'[StageName] = "${stage}"`);
  if (min_amount > 0) filters.push(`'Fact_Opportunity'[Opportunity Amount] >= ${min_amount}`);
  if (is_closed !== null) filters.push(`'DIM_Opportunity'[IsClosed] = ${is_closed ? 'TRUE()' : 'FALSE()'}`);

  const filterClause = filters.length > 0
    ? `CALCULATETABLE(..., ${filters.join(' && ')})`
    : '';

  const innerQuery = `
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[Opportunity Name],
  'DIM_Opportunity'[StageName],
  'DIM_Opportunity'[Probability],
  'DIM_Opportunity'[CloseDate],
  'DIM_Opportunity'[Account Name],
  "Amount", SUM('Fact_Opportunity'[Opportunity Amount]),
  "WeightedAmount",
  SUMX(
    'Fact_Opportunity',
    'Fact_Opportunity'[Opportunity Amount] *
    COALESCE(RELATED('DIM_Opportunity'[Probability]), 0) / 100
  )
)`;

  const dax = filters.length > 0
    ? `EVALUATE TOPN(${top_n}, CALCULATETABLE(${innerQuery}, ${filters.join(' && ')}), [Amount], DESC)`
    : `EVALUATE TOPN(${top_n}, ${innerQuery}, [Amount], DESC)`;

  const res = await runSalesDax(dax, args, 'get_opportunity_details');

  return {
    success: true,
    tool: 'get_opportunity_details',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    filters: { stage, min_amount, is_closed, top_n },
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Analyze deal velocity and sales cycle metrics
 */
export async function get_deal_velocity(args = {}) {
  const { group_by = 'StageName' } = args;

  const dax = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[${group_by}],
  "AvgDaysInStage",
  AVERAGEX(
    'DIM_Opportunity',
    DATEDIFF('DIM_Opportunity'[CreateDate], TODAY(), DAY)
  ),
  "OpportunityCount", COUNTROWS('DIM_Opportunity'),
  "TotalValue", SUM('Fact_Opportunity'[Opportunity Amount]),
  "AvgDealSize", AVERAGE('Fact_Opportunity'[Opportunity Amount])
)
ORDER BY [AvgDaysInStage] DESC`;

  const res = await runSalesDax(dax, args, 'get_deal_velocity');

  return {
    success: true,
    tool: 'get_deal_velocity',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    group_by,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

// ============================================
// SECTION 2: ACCOUNT ANALYTICS
// ============================================

/**
 * Get account-level revenue analysis
 */
export async function get_account_revenue(args = {}) {
  const { top_n = 20, include_pipeline = true } = args;

  const dax = include_pipeline
    ? `
EVALUATE
TOPN(
  ${top_n},
  SUMMARIZECOLUMNS(
    'DIM_Account'[Account Name],
    "TotalRevenue", SUM('Fact_Opportunity'[Opportunity Amount]),
    "WonRevenue",
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = TRUE()
    ),
    "PipelineRevenue",
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsClosed] = FALSE()
    ),
    "OpportunityCount", COUNTROWS('DIM_Opportunity')
  ),
  [TotalRevenue], DESC
)`
    : `
EVALUATE
TOPN(
  ${top_n},
  SUMMARIZECOLUMNS(
    'DIM_Account'[Account Name],
    "WonRevenue",
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = TRUE()
    ),
    "OpportunityCount",
    CALCULATE(
      COUNTROWS('DIM_Opportunity'),
      'DIM_Opportunity'[IsWon] = TRUE()
    )
  ),
  [WonRevenue], DESC
)`;

  const res = await runSalesDax(dax, args, 'get_account_revenue');

  return {
    success: true,
    tool: 'get_account_revenue',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    top_n,
    include_pipeline,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Calculate account health scores
 */
export async function get_account_health(args = {}) {
  const { min_opportunities = 1 } = args;

  const dax = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_Account'[Account Name],
    "OpportunityCount", COUNTROWS('DIM_Opportunity'),
    "TotalValue", SUM('Fact_Opportunity'[Opportunity Amount]),
    "WinRate",
    DIVIDE(
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
      0
    ),
    "AvgDealSize", AVERAGE('Fact_Opportunity'[Opportunity Amount]),
    "LastActivityDays",
    MIN(DATEDIFF(MAX('DIM_Opportunity'[LastActivityDate]), TODAY(), DAY))
  ),
  COUNTROWS('DIM_Opportunity') >= ${min_opportunities}
)
ORDER BY [TotalValue] DESC`;

  const res = await runSalesDax(dax, args, 'get_account_health');

  return {
    success: true,
    tool: 'get_account_health',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    min_opportunities,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

// ============================================
// SECTION 3: REP PERFORMANCE
// ============================================

/**
 * Get sales rep performance metrics
 */
export async function get_rep_performance(args = {}) {
  const { period_days = 90, min_deals = 1 } = args;

  const dax = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[Owner Name],
    "TotalDeals", COUNTROWS('DIM_Opportunity'),
    "WonDeals",
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    "Revenue", SUM('Fact_Opportunity'[Opportunity Amount]),
    "WonRevenue",
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = TRUE()
    ),
    "PipelineValue",
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsClosed] = FALSE()
    ),
    "WinRate",
    DIVIDE(
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
      0
    )
  ),
  'DIM_Opportunity'[CloseDate] >= TODAY() - ${period_days} &&
  COUNTROWS('DIM_Opportunity') >= ${min_deals}
)
ORDER BY [WonRevenue] DESC`;

  const res = await runSalesDax(dax, args, 'get_rep_performance');

  return {
    success: true,
    tool: 'get_rep_performance',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    period_days,
    min_deals,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Analyze rep conversion rates by stage
 */
export async function get_rep_conversion(args = {}) {
  const { rep_name = null } = args;

  // Fixed: Removed EARLIER() which doesn't work in SUMMARIZECOLUMNS
  // Now just shows opportunity count by stage for conversion analysis
  const baseQuery = `
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[Owner Name],
  'DIM_Opportunity'[StageName],
  'DIM_Opportunity'[Probability],
  "OpportunityCount", COUNTROWS('DIM_Opportunity'),
  "TotalValue", SUM('Fact_Opportunity'[Opportunity Amount]),
  "WonCount",
  CALCULATE(
    COUNTROWS('DIM_Opportunity'),
    'DIM_Opportunity'[IsWon] = TRUE()
  ),
  "LostCount",
  CALCULATE(
    COUNTROWS('DIM_Opportunity'),
    'DIM_Opportunity'[IsLost] = TRUE()
  )
)`;

  const dax = rep_name
    ? `EVALUATE CALCULATETABLE(${baseQuery}, 'DIM_Opportunity'[Owner Name] = "${rep_name}")`
    : `EVALUATE ${baseQuery}`;

  const res = await runSalesDax(dax, args, 'get_rep_conversion');

  return {
    success: true,
    tool: 'get_rep_conversion',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    rep_name,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

// ============================================
// SECTION 4: PRODUCT & CATEGORY ANALYTICS
// ============================================

/**
 * Get product revenue analysis
 */
export async function get_product_revenue(args = {}) {
  const { top_n = 15, include_lost = false } = args;

  const filter = include_lost ? '' : `'DIM_Opportunity'[IsLost] = FALSE()`;

  const dax = filter
    ? `
EVALUATE
TOPN(
  ${top_n},
  CALCULATETABLE(
    SUMMARIZECOLUMNS(
      'DIM_Product'[Product Family],
      "Revenue", SUM('Fact_Opportunity'[Opportunity Amount]),
      "OpportunityCount", COUNTROWS('DIM_Opportunity'),
      "AvgDealSize", AVERAGE('Fact_Opportunity'[Opportunity Amount])
    ),
    ${filter}
  ),
  [Revenue], DESC
)`
    : `
EVALUATE
TOPN(
  ${top_n},
  SUMMARIZECOLUMNS(
    'DIM_Product'[Product Family],
    "Revenue", SUM('Fact_Opportunity'[Opportunity Amount]),
    "OpportunityCount", COUNTROWS('DIM_Opportunity'),
    "AvgDealSize", AVERAGE('Fact_Opportunity'[Opportunity Amount])
  ),
  [Revenue], DESC
)`;

  const res = await runSalesDax(dax, args, 'get_product_revenue');

  return {
    success: true,
    tool: 'get_product_revenue',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    top_n,
    include_lost,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Get team pipeline metrics
 */
export async function get_team_pipeline(args = {}) {
  const { team_filter = null } = args;

  const baseQuery = `
SUMMARIZECOLUMNS(
  'DIM_Team'[Team Name],
  'DIM_Opportunity'[StageName],
  "OpportunityCount", COUNTROWS('DIM_Opportunity'),
  "PipelineValue", SUM('Fact_Opportunity'[Opportunity Amount]),
  "WeightedPipeline",
  SUMX(
    'Fact_Opportunity',
    'Fact_Opportunity'[Opportunity Amount] *
    COALESCE(RELATED('DIM_Opportunity'[Probability]), 0) / 100
  )
)`;

  const dax = team_filter
    ? `EVALUATE CALCULATETABLE(${baseQuery}, 'DIM_Team'[Team Name] = "${team_filter}")`
    : `EVALUATE ${baseQuery}`;

  const res = await runSalesDax(dax, args, 'get_team_pipeline');

  return {
    success: true,
    tool: 'get_team_pipeline',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    team_filter,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

// ============================================
// SECTION 5: WIN/LOSS & COMPETITIVE ANALYSIS
// ============================================

/**
 * Analyze win/loss reasons
 */
export async function get_win_loss_analysis(args = {}) {
  const { period_days = 180 } = args;

  const dax = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[Stage Reason],
    'DIM_Opportunity'[IsWon],
    "Count", COUNTROWS('DIM_Opportunity'),
    "TotalValue", SUM('Fact_Opportunity'[Opportunity Amount]),
    "AvgDealSize", AVERAGE('Fact_Opportunity'[Opportunity Amount]),
    "AvgCycleDays",
    AVERAGEX(
      'DIM_Opportunity',
      DATEDIFF('DIM_Opportunity'[CreateDate], 'DIM_Opportunity'[CloseDate], DAY)
    )
  ),
  'DIM_Opportunity'[IsClosed] = TRUE() &&
  'DIM_Opportunity'[CloseDate] >= TODAY() - ${period_days}
)
ORDER BY [Count] DESC`;

  const res = await runSalesDax(dax, args, 'get_win_loss_analysis');

  return {
    success: true,
    tool: 'get_win_loss_analysis',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    period_days,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Find aging/stuck deals
 */
export async function get_deal_aging(args = {}) {
  const { min_age_days = 30, min_amount = 10000 } = args;

  const dax = `
EVALUATE
TOPN(
  50,
  CALCULATETABLE(
    SUMMARIZECOLUMNS(
      'DIM_Opportunity'[Opportunity Name],
      'DIM_Opportunity'[Account Name],
      'DIM_Opportunity'[Owner Name],
      'DIM_Opportunity'[StageName],
      'DIM_Opportunity'[LastActivityDate],
      "Amount", SUM('Fact_Opportunity'[Opportunity Amount]),
      "DaysInStage",
      DATEDIFF('DIM_Opportunity'[Stage Date], TODAY(), DAY),
      "DaysSinceActivity",
      DATEDIFF('DIM_Opportunity'[LastActivityDate], TODAY(), DAY)
    ),
    'DIM_Opportunity'[IsClosed] = FALSE() &&
    DATEDIFF('DIM_Opportunity'[Stage Date], TODAY(), DAY) >= ${min_age_days} &&
    'Fact_Opportunity'[Opportunity Amount] >= ${min_amount}
  ),
  [Amount], DESC
)`;

  const res = await runSalesDax(dax, args, 'get_deal_aging');

  return {
    success: true,
    tool: 'get_deal_aging',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    min_age_days,
    min_amount,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

// ============================================
// SECTION 6: TERRITORY & GEOGRAPHIC ANALYSIS
// ============================================

/**
 * Get territory performance metrics
 */
export async function get_territory_performance(args = {}) {
  const { group_by_region = true } = args;

  const groupField = group_by_region ? 'Region' : 'Territory';

  const dax = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Territory'[${groupField}],
  "OpportunityCount", COUNTROWS('DIM_Opportunity'),
  "TotalRevenue", SUM('Fact_Opportunity'[Opportunity Amount]),
  "WonRevenue",
  CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsWon] = TRUE()
  ),
  "Pipeline",
  CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsClosed] = FALSE()
  ),
  "WinRate",
  DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
    0
  )
)
ORDER BY [TotalRevenue] DESC`;

  const res = await runSalesDax(dax, args, 'get_territory_performance');

  return {
    success: true,
    tool: 'get_territory_performance',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    group_by_region,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Track renewal forecasts
 */
export async function get_renewal_forecast(args = {}) {
  const { next_days = 90 } = args;

  const dax = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[Type],
    'DIM_Date'[Month],
    "RenewalCount",
    CALCULATE(
      COUNTROWS('DIM_Opportunity'),
      'DIM_Opportunity'[Type] IN {"Renewal", "Upsell"}
    ),
    "RenewalValue",
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[Type] IN {"Renewal", "Upsell"}
    ),
    "AtRiskValue",
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[Type] IN {"Renewal", "Upsell"} &&
      'DIM_Opportunity'[Probability] < 50
    )
  ),
  'DIM_Opportunity'[CloseDate] >= TODAY() &&
  'DIM_Opportunity'[CloseDate] <= TODAY() + ${next_days}
)
ORDER BY 'DIM_Date'[Month]`;

  const res = await runSalesDax(dax, args, 'get_renewal_forecast');

  return {
    success: true,
    tool: 'get_renewal_forecast',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    next_days,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

// ============================================
// SECTION 7: TIME-BASED ANALYTICS
// ============================================

/**
 * Analyze monthly trends
 */
export async function get_monthly_trend(args = {}) {
  const { months_back = 12, metric = 'revenue' } = args;

  const measureMap = {
    revenue: 'SUM(\'Fact_Opportunity\'[Opportunity Amount])',
    count: 'COUNTROWS(\'DIM_Opportunity\')',
    win_rate: `DIVIDE(
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
      0
    )`
  };

  const measure = measureMap[metric] || measureMap.revenue;

  const dax = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_Date'[Year],
    'DIM_Date'[Month],
    "MetricValue", ${measure},
    "NewOpportunities",
    CALCULATE(
      COUNTROWS('DIM_Opportunity'),
      'DIM_Opportunity'[CreateDate] = 'DIM_Date'[Date]
    ),
    "ClosedWon",
    CALCULATE(
      COUNTROWS('DIM_Opportunity'),
      'DIM_Opportunity'[IsWon] = TRUE()
    )
  ),
  'DIM_Date'[Date] >= TODAY() - (${months_back} * 30)
)
ORDER BY 'DIM_Date'[Year], 'DIM_Date'[Month]`;

  const res = await runSalesDax(dax, args, 'get_monthly_trend');

  return {
    success: true,
    tool: 'get_monthly_trend',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    months_back,
    metric,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

// ============================================
// SECTION 8: EXECUTIVE DASHBOARDS
// ============================================

/**
 * Get top deals in pipeline
 */
export async function get_top_deals(args = {}) {
  const { top_n = 10, min_probability = 0 } = args;

  const dax = `
EVALUATE
TOPN(
  ${top_n},
  CALCULATETABLE(
    SUMMARIZECOLUMNS(
      'DIM_Opportunity'[Opportunity Name],
      'DIM_Opportunity'[Account Name],
      'DIM_Opportunity'[Owner Name],
      'DIM_Opportunity'[StageName],
      'DIM_Opportunity'[Probability],
      'DIM_Opportunity'[CloseDate],
      "Amount", SUM('Fact_Opportunity'[Opportunity Amount]),
      "WeightedAmount",
      SUMX(
        'Fact_Opportunity',
        'Fact_Opportunity'[Opportunity Amount] *
        COALESCE(RELATED('DIM_Opportunity'[Probability]), 0) / 100
      )
    ),
    'DIM_Opportunity'[IsClosed] = FALSE() &&
    'DIM_Opportunity'[Probability] >= ${min_probability}
  ),
  [Amount], DESC
)`;

  const res = await runSalesDax(dax, args, 'get_top_deals');

  return {
    success: true,
    tool: 'get_top_deals',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    top_n,
    min_probability,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Get lead conversion funnel metrics
 */
export async function get_lead_conversion(args = {}) {
  const { period_days = 90 } = args;

  const dax = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_LeadSource'[Lead Source],
    "LeadsCreated",
    CALCULATE(
      COUNTROWS('DIM_Lead'),
      'DIM_Lead'[CreateDate] >= TODAY() - ${period_days}
    ),
    "LeadsConverted",
    CALCULATE(
      COUNTROWS('DIM_Lead'),
      'DIM_Lead'[IsConverted] = TRUE()
    ),
    "OpportunitiesCreated",
    COUNTROWS('DIM_Opportunity'),
    "Revenue",
    SUM('Fact_Opportunity'[Opportunity Amount]),
    "ConversionRate",
    DIVIDE(
      CALCULATE(COUNTROWS('DIM_Lead'), 'DIM_Lead'[IsConverted] = TRUE()),
      COUNTROWS('DIM_Lead'),
      0
    )
  ),
  'DIM_Lead'[CreateDate] >= TODAY() - ${period_days}
)
ORDER BY [Revenue] DESC`;

  const res = await runSalesDax(dax, args, 'get_lead_conversion');

  return {
    success: true,
    tool: 'get_lead_conversion',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    period_days,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Track quota attainment
 */
export async function get_quota_attainment(args = {}) {
  const { current_quarter = true } = args;

  const periodFilter = current_quarter
    ? `'DIM_Date'[Quarter] = QUARTER(TODAY()) && 'DIM_Date'[Year] = YEAR(TODAY())`
    : `'DIM_Date'[Year] = YEAR(TODAY())`;

  const dax = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_SalesRep'[Rep Name],
    'DIM_SalesRep'[Quota],
    "Achieved",
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = TRUE()
    ),
    "Pipeline",
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsClosed] = FALSE()
    ),
    "AttainmentPercent",
    DIVIDE(
      CALCULATE(
        SUM('Fact_Opportunity'[Opportunity Amount]),
        'DIM_Opportunity'[IsWon] = TRUE()
      ),
      'DIM_SalesRep'[Quota],
      0
    ) * 100
  ),
  ${periodFilter}
)
ORDER BY [AttainmentPercent] DESC`;

  const res = await runSalesDax(dax, args, 'get_quota_attainment');

  return {
    success: true,
    tool: 'get_quota_attainment',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    current_quarter,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Get activity metrics
 */
export async function get_activity_metrics(args = {}) {
  const { period_days = 30, group_by = 'Owner Name' } = args;

  const dax = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_Activity'[${group_by}],
    'DIM_Activity'[Activity Type],
    "ActivityCount", COUNTROWS('DIM_Activity'),
    "UniqueAccounts", DISTINCTCOUNT('DIM_Activity'[Account ID]),
    "UniqueOpportunities", DISTINCTCOUNT('DIM_Activity'[Opportunity ID]),
    "CompletedActivities",
    CALCULATE(
      COUNTROWS('DIM_Activity'),
      'DIM_Activity'[Is Completed] = TRUE()
    ),
    "OverdueActivities",
    CALCULATE(
      COUNTROWS('DIM_Activity'),
      'DIM_Activity'[Due Date] < TODAY() &&
      'DIM_Activity'[Is Completed] = FALSE()
    )
  ),
  'DIM_Activity'[Activity Date] >= TODAY() - ${period_days}
)
ORDER BY [ActivityCount] DESC`;

  const res = await runSalesDax(dax, args, 'get_activity_metrics');

  return {
    success: true,
    tool: 'get_activity_metrics',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    period_days,
    group_by,
    rowCount: res.rowCount || res.data?.length || 0,
    data: res.data
  };
}

/**
 * Executive dashboard summary
 */
export async function get_executive_dashboard(args = {}) {
  const dax = `
EVALUATE
ROW(
  "TotalPipeline",
  CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsClosed] = FALSE()
  ),
  "WeightedPipeline",
  CALCULATE(
    SUMX(
      'Fact_Opportunity',
      'Fact_Opportunity'[Opportunity Amount] *
      COALESCE(RELATED('DIM_Opportunity'[Probability]), 0) / 100
    ),
    'DIM_Opportunity'[IsClosed] = FALSE()
  ),
  "QTDRevenue",
  CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsWon] = TRUE(),
    'DIM_Date'[Quarter] = QUARTER(TODAY()),
    'DIM_Date'[Year] = YEAR(TODAY())
  ),
  "YTDRevenue",
  CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsWon] = TRUE(),
    'DIM_Date'[Year] = YEAR(TODAY())
  ),
  "WinRate",
  DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
    0
  ),
  "AvgDealSize",
  CALCULATE(
    AVERAGE('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsWon] = TRUE()
  ),
  "AvgSalesCycle",
  CALCULATE(
    AVERAGEX(
      'DIM_Opportunity',
      DATEDIFF('DIM_Opportunity'[CreateDate], 'DIM_Opportunity'[CloseDate], DAY)
    ),
    'DIM_Opportunity'[IsWon] = TRUE()
  ),
  "ActiveOpportunities",
  CALCULATE(
    COUNTROWS('DIM_Opportunity'),
    'DIM_Opportunity'[IsClosed] = FALSE()
  )
)`;

  const res = await runSalesDax(dax, args, 'get_executive_dashboard');

  return {
    success: true,
    tool: 'get_executive_dashboard',
    domain: 'sales',
    datasetIdUsed: getDatasetId(args),
    data: res.data
  };
}

// ============================================
// EXPORT ALL TOOLS
// ============================================

export default {
  // Validation & Debug
  get_data_source_info,  // Added for debugging dataset routing
  ping_sales_dataset,
  validate_sales_schema,

  // Core Pipeline
  get_pipeline_summary,
  get_opportunity_forecast,
  get_opportunity_details,
  get_deal_velocity,

  // Account Analytics
  get_account_revenue,
  get_account_health,

  // Rep Performance
  get_rep_performance,
  get_rep_conversion,

  // Product & Category
  get_product_revenue,
  get_team_pipeline,

  // Win/Loss & Competitive
  get_win_loss_analysis,
  get_deal_aging,

  // Territory & Geographic
  get_territory_performance,
  get_renewal_forecast,

  // Time-based
  get_monthly_trend,

  // Executive
  get_top_deals,
  get_lead_conversion,
  get_quota_attainment,
  get_activity_metrics,
  get_executive_dashboard
};