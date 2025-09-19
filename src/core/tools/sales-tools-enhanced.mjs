/**
 * Sales Domain Tools - Enhanced Version
 * Complete implementation with 20+ analytics tools for Sales MCP
 * Based on actual schema: DIM_Opportunity, Fact_Opportunity, DIM_Account, etc.
 */

import { executeDaxQuery } from '../powerbi/connector.mjs';

// Use Sales dataset ID from environment or default
const SALES_DATASET_ID = process.env.SALES_DATASET_ID || 'ef5c8f43-19c5-44d4-b57e-71b788933b88';

// ============================================
// SECTION 1: CORE PIPELINE ANALYTICS (Fixed)
// ============================================

/**
 * Get pipeline summary by stage
 * TESTED & WORKING with actual data
 */
export async function get_pipeline_summary(args) {
  const { include_closed = false } = args;

  const daxQuery = include_closed
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
)`
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
 * Get opportunity forecast with probability weighting
 * FIXED: Using actual table structure
 */
export async function get_opportunity_forecast(args) {
  const { min_probability = 0, max_days = 90 } = args;

  const daxQuery = `
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
)`;

  console.log('[SALES] Executing opportunity forecast query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_opportunity_forecast',
    domain: 'sales',
    min_probability,
    max_days,
    data: result
  };
}

/**
 * Get detailed opportunity information
 * FIXED: Proper filtering and column selection
 */
export async function get_opportunity_details(args) {
  const { opportunity_name, account_name, stage, limit = 50 } = args;

  let filterConditions = [];
  if (opportunity_name) {
    filterConditions.push(`SEARCH("${opportunity_name}", 'DIM_Opportunity'[Opportunity Name], 1, 0) > 0`);
  }
  if (account_name) {
    filterConditions.push(`SEARCH("${account_name}", RELATED('DIM_Account'[Account Name]), 1, 0) > 0`);
  }
  if (stage) {
    filterConditions.push(`'DIM_Opportunity'[StageName] = "${stage}"`);
  }

  const filterClause = filterConditions.length > 0
    ? `FILTER('DIM_Opportunity', ${filterConditions.join(' && ')}),`
    : '';

  const daxQuery = `
EVALUATE
TOPN(${limit},
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[Opportunity Name],
    'DIM_Opportunity'[StageName],
    'DIM_Opportunity'[Status],
    'DIM_Opportunity'[CloseDate],
    'DIM_Opportunity'[Probability],
    ${filterClause}
    "Amount", SUM('Fact_Opportunity'[Opportunity Amount]),
    "Owner", MAX('DIM_Opportunity'[Opportunity Owner]),
    "AccountName", MAX('DIM_Opportunity'[Account Name])
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
 * Get deal velocity metrics
 * FIXED: Simplified to work with available fields
 */
export async function get_deal_velocity(args) {
  const { start_date, end_date } = args;

  const dateFilter = start_date && end_date
    ? `FILTER('DIM_Opportunity',
        'DIM_Opportunity'[CloseDate] >= DATE(${start_date.replace(/-/g, ',')}) &&
        'DIM_Opportunity'[CloseDate] <= DATE(${end_date.replace(/-/g, ',')})),`
    : '';

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[StageName],
  ${dateFilter}
  "OpportunityCount", COUNTROWS('DIM_Opportunity'),
  "AvgDealSize", AVERAGE('Fact_Opportunity'[Opportunity Amount]),
  "TotalValue", SUM('Fact_Opportunity'[Opportunity Amount]),
  "WinRate", DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
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

// ============================================
// SECTION 2: ACCOUNT ANALYTICS
// ============================================

/**
 * Get account revenue analysis
 * FIXED: Using actual Account Name field from DIM_Opportunity
 */
export async function get_account_revenue(args) {
  const { account_name, top_n = 20 } = args;

  const filterClause = account_name
    ? `FILTER('DIM_Opportunity', SEARCH("${account_name}", 'DIM_Opportunity'[Account Name], 1, 0) > 0),`
    : '';

  const daxQuery = `
EVALUATE
TOPN(${top_n},
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[Account Name],
    ${filterClause}
    "TotalOpportunities", COUNTROWS('DIM_Opportunity'),
    "ClosedWonRevenue", CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = TRUE()
    ),
    "PipelineRevenue", CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsClosed] = FALSE()
    ),
    "LostRevenue", CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = FALSE() && 'DIM_Opportunity'[IsClosed] = TRUE()
    ),
    "WinRate", DIVIDE(
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
      0
    )
  ),
  [ClosedWonRevenue], DESC
)`;

  console.log('[SALES] Executing account revenue query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_account_revenue',
    domain: 'sales',
    account_name,
    top_n,
    data: result
  };
}

/**
 * Get account health scoring
 * ENHANCED: Multi-factor health score
 */
export async function get_account_health(args) {
  const { min_opportunities = 3 } = args;

  const daxQuery = `
EVALUATE
FILTER(
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[Account Name],
    "OpportunityCount", COUNTROWS('DIM_Opportunity'),
    "TotalRevenue", SUM('Fact_Opportunity'[Opportunity Amount]),
    "WonRevenue", CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = TRUE()
    ),
    "OpenPipeline", CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
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
      COUNTROWS('DIM_Opportunity'),
      0
    )
  ),
  [OpportunityCount] >= ${min_opportunities}
)`;

  console.log('[SALES] Executing account health query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_account_health',
    domain: 'sales',
    min_opportunities,
    data: result
  };
}

// ============================================
// SECTION 3: REP PERFORMANCE
// ============================================

/**
 * Get sales rep performance metrics
 * FIXED: Using Opportunity Owner field
 */
export async function get_rep_performance(args) {
  const { rep_name, top_n = 50 } = args;

  const filterClause = rep_name
    ? `FILTER('DIM_Opportunity', SEARCH("${rep_name}", 'DIM_Opportunity'[Opportunity Owner], 1, 0) > 0),`
    : '';

  const daxQuery = `
EVALUATE
TOPN(${top_n},
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[Opportunity Owner],
    ${filterClause}
    "TotalOpportunities", COUNTROWS('DIM_Opportunity'),
    "ClosedWonAmount", CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = TRUE()
    ),
    "PipelineAmount", CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsClosed] = FALSE()
    ),
    "AvgDealSize", DIVIDE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      COUNTROWS('DIM_Opportunity'),
      0
    ),
    "WinRate", DIVIDE(
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
      0
    )
  ),
  [ClosedWonAmount], DESC
)`;

  console.log('[SALES] Executing rep performance query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_rep_performance',
    domain: 'sales',
    rep_name,
    top_n,
    data: result
  };
}

/**
 * Get rep conversion rates by stage
 * ENHANCED: Stage-by-stage conversion
 */
export async function get_rep_conversion(args) {
  const { rep_name } = args;

  const filterClause = rep_name
    ? `FILTER('DIM_Opportunity', SEARCH("${rep_name}", 'DIM_Opportunity'[Opportunity Owner], 1, 0) > 0),`
    : '';

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[Opportunity Owner],
  'DIM_Opportunity'[StageName],
  ${filterClause}
  "OpportunityCount", COUNTROWS('DIM_Opportunity'),
  "TotalValue", SUM('Fact_Opportunity'[Opportunity Amount]),
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
    rep_name,
    data: result
  };
}

// ============================================
// SECTION 4: PRODUCT ANALYTICS
// ============================================

/**
 * Get product revenue analysis
 * FIXED: Using Fact_Opportunity product fields
 */
export async function get_product_revenue(args) {
  const { product_name, top_n = 20 } = args;

  const filterClause = product_name
    ? `FILTER('Fact_Opportunity', SEARCH("${product_name}", 'Fact_Opportunity'[Product Name], 1, 0) > 0),`
    : '';

  const daxQuery = `
EVALUATE
TOPN(${top_n},
  SUMMARIZECOLUMNS(
    'Fact_Opportunity'[Product Name],
    'Fact_Opportunity'[Family],
    ${filterClause}
    "TotalRevenue", SUM('Fact_Opportunity'[Opportunity Amount]),
    "UnitsSold", SUM('Fact_Opportunity'[Quantity]),
    "AvgPrice", AVERAGE('Fact_Opportunity'[UnitPrice]),
    "OpportunityCount", DISTINCTCOUNT('Fact_Opportunity'[OpportunityId])
  ),
  [TotalRevenue], DESC
)`;

  console.log('[SALES] Executing product revenue query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_product_revenue',
    domain: 'sales',
    product_name,
    top_n,
    data: result
  };
}

/**
 * Get team pipeline metrics
 * FIXED: Simplified team metrics
 */
export async function get_team_pipeline(args) {
  const { stage_filter } = args;

  const stageClause = stage_filter
    ? `FILTER('DIM_Opportunity', 'DIM_Opportunity'[StageName] = "${stage_filter}"),`
    : '';

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[StageName],
  ${stageClause}
  "TeamOpportunities", COUNTROWS('DIM_Opportunity'),
  "TeamPipeline", CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsClosed] = FALSE()
  ),
  "TeamClosedWon", CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsWon] = TRUE()
  ),
  "TeamWinRate", DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
    0
  )
)`;

  console.log('[SALES] Executing team pipeline query');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_team_pipeline',
    domain: 'sales',
    stage_filter,
    data: result
  };
}

// ============================================
// SECTION 5: NEW POWER TOOLS (10 Additional)
// ============================================

/**
 * Win/Loss Analysis
 * Understand why deals are won or lost
 */
export async function get_win_loss_analysis(args) {
  const { period_days = 90 } = args;

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[StageName],
  'DIM_Opportunity'[Status],
  FILTER('DIM_Opportunity',
    'DIM_Opportunity'[CloseDate] >= TODAY() - ${period_days} &&
    'DIM_Opportunity'[IsClosed] = TRUE()
  ),
  "TotalDeals", COUNTROWS('DIM_Opportunity'),
  "TotalValue", SUM('Fact_Opportunity'[Opportunity Amount]),
  "WonDeals", CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
  "LostDeals", CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = FALSE()),
  "WinRate", DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    COUNTROWS('DIM_Opportunity'),
    0
  )
)`;

  console.log('[SALES] Executing win/loss analysis');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_win_loss_analysis',
    domain: 'sales',
    period_days,
    data: result
  };
}

/**
 * Deal Aging Analysis
 * Find stuck deals in the pipeline
 */
export async function get_deal_aging(args) {
  const { max_age_days = 30 } = args;

  const daxQuery = `
EVALUATE
TOPN(50,
  CALCULATETABLE(
    SUMMARIZECOLUMNS(
      'DIM_Opportunity'[Opportunity Name],
      'DIM_Opportunity'[StageName],
      'DIM_Opportunity'[Opportunity Owner],
      'DIM_Opportunity'[CloseDate],
      "Amount", SUM('Fact_Opportunity'[Opportunity Amount]),
      "AgeInDays", MAX('DIM_Opportunity'[AgeInDays])
    ),
    'DIM_Opportunity'[IsClosed] = FALSE() &&
    'DIM_Opportunity'[AgeInDays] > ${max_age_days}
  ),
  [AgeInDays], DESC
)`;

  console.log('[SALES] Executing deal aging analysis');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_deal_aging',
    domain: 'sales',
    max_age_days,
    data: result
  };
}

/**
 * Territory Performance
 * Analyze performance by region
 */
export async function get_territory_performance(args) {
  const { group_by = 'Region' } = args;

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'Fact_Opportunity'[RegionID],
  "TerritoryOpportunities", DISTINCTCOUNT('Fact_Opportunity'[OpportunityId]),
  "TerritoryRevenue", SUM('Fact_Opportunity'[Opportunity Amount]),
  "WonRevenue", CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsWon] = TRUE()
  ),
  "PipelineRevenue", CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsClosed] = FALSE()
  )
)`;

  console.log('[SALES] Executing territory performance');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_territory_performance',
    domain: 'sales',
    group_by,
    data: result
  };
}

/**
 * Renewal Forecast
 * Track subscription renewals
 */
export async function get_renewal_forecast(args) {
  const { days_ahead = 90 } = args;

  const daxQuery = `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[Opportunity Name],
    'DIM_Opportunity'[Account Name],
    'DIM_Opportunity'[CloseDate],
    "RenewalAmount", SUM('Fact_Opportunity'[Opportunity Amount]),
    "IsRenewal", MAX('Fact_Opportunity'[IsSubRenewal])
  ),
  'DIM_Opportunity'[CloseDate] >= TODAY() &&
  'DIM_Opportunity'[CloseDate] <= TODAY() + ${days_ahead} &&
  'Fact_Opportunity'[IsSubRenewal] = TRUE()
)`;

  console.log('[SALES] Executing renewal forecast');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_renewal_forecast',
    domain: 'sales',
    days_ahead,
    data: result
  };
}

/**
 * Monthly Sales Trend
 * Track sales performance over time
 */
export async function get_monthly_trend(args) {
  const { months = 12 } = args;

  const daxQuery = `
EVALUATE
TOPN(${months},
  SUMMARIZECOLUMNS(
    'DIM_Opportunity'[CloseDate],
    FILTER('DIM_Opportunity',
      'DIM_Opportunity'[CloseDate] >= TODAY() - (${months} * 30) &&
      'DIM_Opportunity'[CloseDate] <= TODAY()
    ),
    "MonthlyWon", CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = TRUE()
    ),
    "MonthlyLost", CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = FALSE() && 'DIM_Opportunity'[IsClosed] = TRUE()
    ),
    "MonthlyPipeline", CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsClosed] = FALSE()
    )
  ),
  'DIM_Opportunity'[CloseDate], DESC
)`;

  console.log('[SALES] Executing monthly trend');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_monthly_trend',
    domain: 'sales',
    months,
    data: result
  };
}

/**
 * Top Deals Dashboard
 * Get the biggest opportunities
 */
export async function get_top_deals(args) {
  const { limit = 10, include_closed = false } = args;

  const closedFilter = include_closed ? '' : "'DIM_Opportunity'[IsClosed] = FALSE() &&";

  const daxQuery = `
EVALUATE
TOPN(${limit},
  CALCULATETABLE(
    SUMMARIZECOLUMNS(
      'DIM_Opportunity'[Opportunity Name],
      'DIM_Opportunity'[Account Name],
      'DIM_Opportunity'[StageName],
      'DIM_Opportunity'[Probability],
      'DIM_Opportunity'[CloseDate],
      'DIM_Opportunity'[Opportunity Owner],
      "DealAmount", SUM('Fact_Opportunity'[Opportunity Amount])
    ),
    ${closedFilter}
    'Fact_Opportunity'[Opportunity Amount] > 0
  ),
  [DealAmount], DESC
)`;

  console.log('[SALES] Executing top deals dashboard');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_top_deals',
    domain: 'sales',
    limit,
    include_closed,
    data: result
  };
}

/**
 * Lead Conversion Funnel
 * Track conversion through stages
 */
export async function get_lead_conversion(args) {
  const { cohort_days = 90 } = args;

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[StageName],
  FILTER('DIM_Opportunity',
    'DIM_Opportunity'[CreatedDate] >= TODAY() - ${cohort_days}
  ),
  "StageCount", COUNTROWS('DIM_Opportunity'),
  "StageValue", SUM('Fact_Opportunity'[Opportunity Amount]),
  "ConversionToWon", DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    COUNTROWS('DIM_Opportunity'),
    0
  )
)`;

  console.log('[SALES] Executing lead conversion funnel');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_lead_conversion',
    domain: 'sales',
    cohort_days,
    data: result
  };
}

/**
 * Quota Attainment
 * Track performance against targets
 */
export async function get_quota_attainment(args) {
  const { quota_amount = 1000000 } = args;

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[Opportunity Owner],
  "ClosedWon", CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsWon] = TRUE()
  ),
  "Pipeline", CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsClosed] = FALSE()
  ),
  "QuotaAttainment", DIVIDE(
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = TRUE()
    ),
    ${quota_amount},
    0
  ),
  "PipelineCoverage", DIVIDE(
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsClosed] = FALSE()
    ),
    ${quota_amount},
    0
  )
)`;

  console.log('[SALES] Executing quota attainment');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_quota_attainment',
    domain: 'sales',
    quota_amount,
    data: result
  };
}

/**
 * Activity Metrics
 * Track sales activities and their impact
 */
export async function get_activity_metrics(args) {
  const { days_back = 30 } = args;

  const daxQuery = `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[Opportunity Owner],
  'DIM_Opportunity'[StageName],
  FILTER('DIM_Opportunity',
    'DIM_Opportunity'[CreatedDate] >= TODAY() - ${days_back}
  ),
  "NewOpportunities", COUNTROWS('DIM_Opportunity'),
  "NewOpportunityValue", SUM('Fact_Opportunity'[Opportunity Amount]),
  "AvgDealSize", AVERAGE('Fact_Opportunity'[Opportunity Amount])
)`;

  console.log('[SALES] Executing activity metrics');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_activity_metrics',
    domain: 'sales',
    days_back,
    data: result
  };
}

/**
 * Executive Dashboard
 * C-level summary metrics
 */
export async function get_executive_dashboard(args) {
  const { fiscal_year = 2024 } = args;

  const daxQuery = `
EVALUATE
{
  ("Total Pipeline", CALCULATE(SUM('Fact_Opportunity'[Opportunity Amount]), 'DIM_Opportunity'[IsClosed] = FALSE())),
  ("Closed Won YTD", CALCULATE(
    SUM('Fact_Opportunity'[Opportunity Amount]),
    'DIM_Opportunity'[IsWon] = TRUE() &&
    YEAR('DIM_Opportunity'[CloseDate]) = ${fiscal_year}
  )),
  ("Win Rate", DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
    0
  )),
  ("Avg Deal Size", AVERAGE('Fact_Opportunity'[Opportunity Amount])),
  ("Total Opportunities", COUNTROWS('DIM_Opportunity')),
  ("Active Accounts", DISTINCTCOUNT('DIM_Opportunity'[Account Name]))
}`;

  console.log('[SALES] Executing executive dashboard');
  const result = await executeDaxQuery(daxQuery, SALES_DATASET_ID);

  return {
    tool: 'get_executive_dashboard',
    domain: 'sales',
    fiscal_year,
    data: result
  };
}

// Export all Sales tools (20 total)
export default {
  // Core Pipeline (Fixed)
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
  // Product Analytics
  get_product_revenue,
  get_team_pipeline,
  // New Power Tools
  get_win_loss_analysis,
  get_deal_aging,
  get_territory_performance,
  get_renewal_forecast,
  get_monthly_trend,
  get_top_deals,
  get_lead_conversion,
  get_quota_attainment,
  get_activity_metrics,
  get_executive_dashboard
};