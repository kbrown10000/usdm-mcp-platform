/**
 * Reusable DAX Patterns Library
 * Common patterns for Sales and other analytics domains
 */

// ================================================
// SECTION 1: TIME INTELLIGENCE PATTERNS
// ================================================

/**
 * Year-to-Date calculation pattern
 */
export const YTD_PATTERN = (measureExpression, dateColumn) => `
CALCULATE(
  ${measureExpression},
  DATESYTD(${dateColumn})
)`;

/**
 * Quarter-to-Date calculation pattern
 */
export const QTD_PATTERN = (measureExpression, dateColumn) => `
CALCULATE(
  ${measureExpression},
  DATESQTD(${dateColumn})
)`;

/**
 * Month-to-Date calculation pattern
 */
export const MTD_PATTERN = (measureExpression, dateColumn) => `
CALCULATE(
  ${measureExpression},
  DATESMTD(${dateColumn})
)`;

/**
 * Previous Period comparison pattern
 */
export const PREVIOUS_PERIOD_PATTERN = (measureExpression, dateColumn, periodsBack) => `
CALCULATE(
  ${measureExpression},
  DATEADD(${dateColumn}, -${periodsBack}, MONTH)
)`;

/**
 * Period-over-Period growth pattern
 */
export const PERIOD_GROWTH_PATTERN = (currentMeasure, previousMeasure) => `
DIVIDE(
  ${currentMeasure} - ${previousMeasure},
  ${previousMeasure},
  0
)`;

/**
 * Rolling Average pattern
 */
export const ROLLING_AVERAGE_PATTERN = (measureExpression, dateColumn, days) => `
CALCULATE(
  AVERAGE(${measureExpression}),
  DATESINPERIOD(${dateColumn}, LASTDATE(${dateColumn}), -${days}, DAY)
)`;

// ================================================
// SECTION 2: RANKING & TOP N PATTERNS
// ================================================

/**
 * Top N by measure pattern
 */
export const TOP_N_PATTERN = (n, table, groupByColumn, measureExpression, orderDirection = 'DESC') => `
TOPN(${n},
  SUMMARIZECOLUMNS(
    ${groupByColumn},
    "${measureExpression.name}", ${measureExpression.expression}
  ),
  [${measureExpression.name}], ${orderDirection}
)`;

/**
 * Rank by measure pattern
 */
export const RANK_PATTERN = (groupByColumn, measureExpression) => `
RANKX(
  ALL(${groupByColumn}),
  ${measureExpression},
  ,
  DESC,
  Dense
)`;

/**
 * Percentile ranking pattern
 */
export const PERCENTILE_PATTERN = (measureExpression, percentile) => `
PERCENTILE.INC(
  ${measureExpression},
  ${percentile}
)`;

// ================================================
// SECTION 3: CONVERSION & FUNNEL PATTERNS
// ================================================

/**
 * Stage-to-stage conversion pattern
 */
export const STAGE_CONVERSION_PATTERN = (currentStageCount, previousStageCount) => `
DIVIDE(
  ${currentStageCount},
  ${previousStageCount},
  0
)`;

/**
 * Win Rate calculation pattern
 */
export const WIN_RATE_PATTERN = (table, wonCondition, closedCondition) => `
DIVIDE(
  CALCULATE(COUNTROWS(${table}), ${wonCondition}),
  CALCULATE(COUNTROWS(${table}), ${closedCondition}),
  0
)`;

/**
 * Conversion funnel pattern
 */
export const FUNNEL_PATTERN = (stages, table, stageColumn) => `
UNION(
  ${stages.map(stage => `
  ROW(
    "Stage", "${stage}",
    "Count", CALCULATE(COUNTROWS(${table}), ${stageColumn} = "${stage}")
  )`).join(',\n  ')}
)`;

// ================================================
// SECTION 4: FORECASTING PATTERNS
// ================================================

/**
 * Weighted pipeline pattern
 */
export const WEIGHTED_PIPELINE_PATTERN = (amountColumn, probabilityColumn) => `
SUMX(
  'Fact_Opportunity',
  ${amountColumn} * ${probabilityColumn} / 100
)`;

/**
 * Best case scenario pattern
 */
export const BEST_CASE_PATTERN = (table, amountColumn, openCondition) => `
CALCULATE(
  SUM(${amountColumn}),
  ${openCondition}
)`;

/**
 * Worst case scenario pattern
 */
export const WORST_CASE_PATTERN = (table, amountColumn, highProbabilityCondition) => `
CALCULATE(
  SUM(${amountColumn}),
  ${highProbabilityCondition}
)`;

/**
 * Expected value pattern
 */
export const EXPECTED_VALUE_PATTERN = (bestCase, worstCase, mostLikely) => `
(${bestCase} + 4 * ${mostLikely} + ${worstCase}) / 6`;

// ================================================
// SECTION 5: AGGREGATION PATTERNS
// ================================================

/**
 * Safe division pattern (prevents divide by zero)
 */
export const SAFE_DIVIDE_PATTERN = (numerator, denominator, defaultValue = 0) => `
DIVIDE(
  ${numerator},
  ${denominator},
  ${defaultValue}
)`;

/**
 * Null coalesce pattern
 */
export const COALESCE_PATTERN = (expression, defaultValue = 0) => `
COALESCE(${expression}, ${defaultValue})`;

/**
 * Conditional aggregation pattern
 */
export const CONDITIONAL_SUM_PATTERN = (table, amountColumn, condition) => `
CALCULATE(
  SUM(${amountColumn}),
  ${condition}
)`;

/**
 * Distinct count pattern
 */
export const DISTINCT_COUNT_PATTERN = (table, column) => `
DISTINCTCOUNT(${column})`;

// ================================================
// SECTION 6: FILTERING PATTERNS
// ================================================

/**
 * Date range filter pattern
 */
export const DATE_RANGE_PATTERN = (dateColumn, startDate, endDate) => `
FILTER(
  ALL(${dateColumn}),
  ${dateColumn} >= DATE(${startDate}) &&
  ${dateColumn} <= DATE(${endDate})
)`;

/**
 * Search filter pattern
 */
export const SEARCH_PATTERN = (searchTerm, column) => `
SEARCH("${searchTerm}", ${column}, 1, 0) > 0`;

/**
 * Multiple condition filter pattern
 */
export const MULTI_FILTER_PATTERN = (conditions) =>
  conditions.length > 0
    ? `FILTER(ALL('DIM_Opportunity'), ${conditions.join(' && ')})`
    : '';

/**
 * IN filter pattern
 */
export const IN_FILTER_PATTERN = (column, values) => `
${column} IN {${values.map(v => `"${v}"`).join(', ')}}`;

// ================================================
// SECTION 7: RELATIONSHIP PATTERNS
// ================================================

/**
 * Related value pattern
 */
export const RELATED_PATTERN = (relatedTable, relatedColumn) => `
RELATED(${relatedTable}[${relatedColumn}])`;

/**
 * Related table aggregation pattern
 */
export const RELATED_TABLE_PATTERN = (relatedTable, aggregation) => `
SUMX(
  RELATEDTABLE(${relatedTable}),
  ${aggregation}
)`;

/**
 * Lookup value pattern
 */
export const LOOKUP_PATTERN = (lookupTable, lookupColumn, searchValue, returnColumn) => `
LOOKUPVALUE(
  ${lookupTable}[${returnColumn}],
  ${lookupTable}[${lookupColumn}],
  ${searchValue}
)`;

// ================================================
// SECTION 8: PERFORMANCE OPTIMIZATION PATTERNS
// ================================================

/**
 * CALCULATETABLE pattern (optimized filtering)
 */
export const CALCULATE_TABLE_PATTERN = (tableExpression, ...filters) => `
CALCULATETABLE(
  ${tableExpression},
  ${filters.join(',\n  ')}
)`;

/**
 * Variables pattern (for complex calculations)
 */
export const VARIABLES_PATTERN = (variables, returnExpression) => `
VAR ${variables.map(v => `${v.name} = ${v.expression}`).join('\nVAR ')}
RETURN
  ${returnExpression}`;

/**
 * Summarize columns pattern (optimized grouping)
 */
export const SUMMARIZE_PATTERN = (columns, measures) => `
SUMMARIZECOLUMNS(
  ${columns.join(',\n  ')},
  ${measures.map(m => `"${m.name}", ${m.expression}`).join(',\n  ')}
)`;

// ================================================
// SECTION 9: COMPLETE DAX QUERY BUILDERS
// ================================================

/**
 * Build a complete DAX query with error handling
 */
export function buildDAXQuery(pattern, parameters) {
  try {
    return `EVALUATE\n${pattern(parameters)}`;
  } catch (error) {
    console.error('[DAX] Query build error:', error);
    return `EVALUATE { ("Error", "${error.message}") }`;
  }
}

/**
 * Build a paginated query
 */
export function buildPaginatedQuery(baseQuery, offset = 0, limit = 100) {
  return `
EVALUATE
TOPN(${limit},
  OFFSET ${offset} ROWS
  ${baseQuery}
)`;
}

/**
 * Build a filtered and sorted query
 */
export function buildFilteredSortedQuery(table, filters, sortColumn, sortDirection = 'DESC', limit = 100) {
  const filterClause = filters.length > 0
    ? `FILTER(${table}, ${filters.join(' && ')}),`
    : '';

  return `
EVALUATE
TOPN(${limit},
  ${filterClause ? 'CALCULATETABLE(' : ''}
  SUMMARIZECOLUMNS(
    ${table}[*]
  )${filterClause ? `, ${filterClause.slice(0, -1)})` : ''},
  ${sortColumn}, ${sortDirection}
)`;
}

// ================================================
// SECTION 10: COMMON SALES PATTERNS
// ================================================

/**
 * Pipeline summary by any dimension
 */
export const PIPELINE_BY_DIMENSION = (dimension, includeMetrics = true) => `
SUMMARIZECOLUMNS(
  ${dimension},
  "OpportunityCount", COUNTROWS('DIM_Opportunity'),
  "TotalAmount", SUM('Fact_Opportunity'[Opportunity Amount])
  ${includeMetrics ? `,
  "AvgDealSize", AVERAGE('Fact_Opportunity'[Opportunity Amount]),
  "WinRate", DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
    0
  )` : ''}
)`;

/**
 * Account scoring pattern
 */
export const ACCOUNT_SCORE_PATTERN = () => `
DIVIDE(
  CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()) * 100 +
  CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = FALSE()) * 50 +
  CALCULATE(SUM('Fact_Opportunity'[Opportunity Amount])) / 10000,
  COUNTROWS('DIM_Opportunity') + 1,
  0
)`;

/**
 * Sales velocity pattern
 */
export const SALES_VELOCITY_PATTERN = () => `
DIVIDE(
  CALCULATE(COUNT('DIM_Opportunity'[OpportunityId])) *
  AVERAGE('Fact_Opportunity'[Opportunity Amount]) *
  CALCULATE(
    DIVIDE(
      COUNTROWS(FILTER('DIM_Opportunity', 'DIM_Opportunity'[IsWon] = TRUE())),
      COUNTROWS('DIM_Opportunity'),
      0
    )
  ),
  AVERAGE('DIM_Opportunity'[DaysToClose]),
  0
)`;

// Export all patterns
export default {
  // Time Intelligence
  YTD_PATTERN,
  QTD_PATTERN,
  MTD_PATTERN,
  PREVIOUS_PERIOD_PATTERN,
  PERIOD_GROWTH_PATTERN,
  ROLLING_AVERAGE_PATTERN,
  // Ranking
  TOP_N_PATTERN,
  RANK_PATTERN,
  PERCENTILE_PATTERN,
  // Conversion
  STAGE_CONVERSION_PATTERN,
  WIN_RATE_PATTERN,
  FUNNEL_PATTERN,
  // Forecasting
  WEIGHTED_PIPELINE_PATTERN,
  BEST_CASE_PATTERN,
  WORST_CASE_PATTERN,
  EXPECTED_VALUE_PATTERN,
  // Aggregation
  SAFE_DIVIDE_PATTERN,
  COALESCE_PATTERN,
  CONDITIONAL_SUM_PATTERN,
  DISTINCT_COUNT_PATTERN,
  // Filtering
  DATE_RANGE_PATTERN,
  SEARCH_PATTERN,
  MULTI_FILTER_PATTERN,
  IN_FILTER_PATTERN,
  // Relationships
  RELATED_PATTERN,
  RELATED_TABLE_PATTERN,
  LOOKUP_PATTERN,
  // Performance
  CALCULATE_TABLE_PATTERN,
  VARIABLES_PATTERN,
  SUMMARIZE_PATTERN,
  // Builders
  buildDAXQuery,
  buildPaginatedQuery,
  buildFilteredSortedQuery,
  // Sales Patterns
  PIPELINE_BY_DIMENSION,
  ACCOUNT_SCORE_PATTERN,
  SALES_VELOCITY_PATTERN
};