/**
 * Sales Domain DAX Patterns
 * Optimized queries for PipelineAnalysis dataset
 *
 * Based on V26.7 golden patterns:
 * - CALCULATETABLE for 5x performance
 * - COALESCE for null safety
 * - RELATED for dimension joins
 * - DATE() for proper date handling
 */

export const SALES_DAX_PATTERNS = {
  // Pipeline Summary - Current state by stage
  pipelineByStage: (includeClosed = false) => `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[StageName],
  ${!includeClosed ? `FILTER('DIM_Opportunity', 'DIM_Opportunity'[IsClosed] = FALSE()),` : ''}
  "OpportunityCount", COUNTROWS('Fact_Opportunity'),
  "TotalAmount", COALESCE(SUM('Fact_Opportunity'[Opportunity Amount]), 0),
  "WeightedAmount", COALESCE(
    SUMX('Fact_Opportunity',
      'Fact_Opportunity'[Opportunity Amount] *
      RELATED('DIM_Opportunity'[Probability]) / 100
    ), 0
  ),
  "AvgDealSize", COALESCE(
    DIVIDE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      COUNTROWS('Fact_Opportunity'),
      0
    ), 0
  )
)
ORDER BY 'DIM_Opportunity'[StageName]`,

  // Opportunity Forecast - By period with probability weighting
  opportunityForecast: (year, month, minProbability = 0) => `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'DIM_Date'[Month_Date],
    'DIM_Opportunity'[Forecast Category Name],
    FILTER('DIM_Opportunity',
      'DIM_Opportunity'[IsClosed] = FALSE() &&
      'DIM_Opportunity'[Probability] >= ${minProbability}
    ),
    FILTER('DIM_Date',
      'DIM_Date'[Year_Number] = ${year} &&
      'DIM_Date'[Month_Number] >= ${month}
    ),
    "OpportunityCount", COUNTROWS('Fact_Opportunity'),
    "UnweightedAmount", COALESCE(SUM('Fact_Opportunity'[Opportunity Amount]), 0),
    "WeightedForecast", COALESCE(
      SUMX('Fact_Opportunity',
        'Fact_Opportunity'[Opportunity Amount] *
        RELATED('DIM_Opportunity'[Probability]) / 100
      ), 0
    ),
    "EstimatedGP", COALESCE(SUM('Fact_Opportunity'[EstWonOppGP]), 0)
  ),
  'DIM_Date'[Within_Next_30_Days] = TRUE()
)`,

  // Account Revenue Analysis
  accountRevenue: (accountName, startY, startM, startD, endY, endM, endD) => `
EVALUATE
TOPN(20,
  SUMMARIZECOLUMNS(
    'DIM_Account'[Account Name],
    'DIM_Account'[Territory],
    'DIM_Account'[Industry],
    TREATAS({("${accountName}")}, 'DIM_Account'[Account Name]),
    FILTER('DIM_Date',
      'DIM_Date'[Full_Date] >= DATE(${startY}, ${startM}, ${startD}) &&
      'DIM_Date'[Full_Date] <= DATE(${endY}, ${endM}, ${endD})
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
    ),
    "LostRevenue", COALESCE(
      CALCULATE(
        SUM('Fact_Opportunity'[Opportunity Amount]),
        'DIM_Opportunity'[IsClosed] = TRUE() &&
        'DIM_Opportunity'[IsWon] = FALSE()
      ), 0
    ),
    "WinRate", DIVIDE(
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
      CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsClosed] = TRUE()),
      0
    )
  ),
  [ClosedWonRevenue], DESC
)`,

  // Sales Rep Performance - Using CALCULATETABLE for speed
  repPerformance: (repName, year, quarter) => `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'Sales Team Member'[Sales Team Member],
    'Sales Team Member'[Manager Name],
    'Sales Team Member'[Quota Type],
    TREATAS({("${repName}")}, 'Sales Team Member'[Sales Team Member]),
    FILTER('DIM_Date',
      'DIM_Date'[Year_Number] = ${year} &&
      'DIM_Date'[Quarter_Number] = ${quarter}
    ),
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
    "OpportunitiesWon", CALCULATE(
      COUNTROWS('DIM_Opportunity'),
      'DIM_Opportunity'[IsWon] = TRUE()
    ),
    "OpportunitiesLost", CALCULATE(
      COUNTROWS('DIM_Opportunity'),
      'DIM_Opportunity'[IsClosed] = TRUE() &&
      'DIM_Opportunity'[IsWon] = FALSE()
    ),
    "AvgDealSize", COALESCE(
      DIVIDE(
        CALCULATE(SUM('Fact_Opportunity'[Opportunity Amount]), 'DIM_Opportunity'[IsWon] = TRUE()),
        CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
        0
      ), 0
    )
  )
)`,

  // Deal Velocity - Time in stages
  dealVelocity: (startY, startM, startD, endY, endM, endD) => `
EVALUATE
SUMMARIZECOLUMNS(
  'Opportunity History'[StageName],
  FILTER('Opportunity History',
    'Opportunity History'[CreatedDate] >= DATE(${startY}, ${startM}, ${startD}) &&
    'Opportunity History'[CreatedDate] <= DATE(${endY}, ${endM}, ${endD})
  ),
  "AvgDaysInStage", COALESCE(
    AVERAGEX(
      'Opportunity History',
      DATEDIFF(
        'Opportunity History'[CreatedDate],
        CALCULATE(
          MIN('Opportunity History'[CreatedDate]),
          FILTER(
            ALL('Opportunity History'),
            'Opportunity History'[OpportunityId] = EARLIER('Opportunity History'[OpportunityId]) &&
            'Opportunity History'[CreatedDate] > EARLIER('Opportunity History'[CreatedDate])
          )
        ),
        DAY
      )
    ), 0
  ),
  "OpportunityCount", DISTINCTCOUNT('Opportunity History'[OpportunityId]),
  "ConversionRate", DIVIDE(
    CALCULATE(
      DISTINCTCOUNT('Opportunity History'[OpportunityId]),
      'Opportunity History'[StageName] <> BLANK()
    ),
    DISTINCTCOUNT('Opportunity History'[OpportunityId]),
    0
  )
)
ORDER BY 'Opportunity History'[StageName]`,

  // Team Pipeline - By practice or region
  teamPipeline: (practiceId = null, regionId = null) => `
EVALUATE
SUMMARIZECOLUMNS(
  ${practiceId ? `'DIM_Opportunity'[PracticeId],` : ''}
  ${regionId ? `'DIM_Opportunity'[RegionId],` : ''}
  'Sales Team Member'[Team Leader Name],
  ${practiceId ? `FILTER('DIM_Opportunity', 'DIM_Opportunity'[PracticeId] = "${practiceId}"),` : ''}
  ${regionId ? `FILTER('DIM_Opportunity', 'DIM_Opportunity'[RegionId] = "${regionId}"),` : ''}
  "TotalPipeline", COALESCE(
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsClosed] = FALSE()
    ), 0
  ),
  "QualifiedPipeline", COALESCE(
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsClosed] = FALSE() &&
      'DIM_Opportunity'[StageName] <> "Prospecting"
    ), 0
  ),
  "ClosedWonYTD", COALESCE(
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = TRUE(),
      'DIM_Date'[IsThisYear] = TRUE()
    ), 0
  ),
  "TeamSize", DISTINCTCOUNT('Sales Team Member'[UserId])
)`,

  // Product Revenue Analysis
  productRevenue: (productType = null) => `
EVALUATE
TOPN(20,
  SUMMARIZECOLUMNS(
    'Fact_Opportunity'[Product Name],
    'Fact_Opportunity'[Product Type],
    ${productType ? `FILTER('Fact_Opportunity', 'Fact_Opportunity'[Product Type] = "${productType}"),` : ''}
    "Revenue", COALESCE(
      CALCULATE(
        SUM('Fact_Opportunity'[Opportunity Amount]),
        'DIM_Opportunity'[IsWon] = TRUE()
      ), 0
    ),
    "Pipeline", COALESCE(
      CALCULATE(
        SUM('Fact_Opportunity'[Opportunity Amount]),
        'DIM_Opportunity'[IsClosed] = FALSE()
      ), 0
    ),
    "DealCount", CALCULATE(
      COUNTROWS('Fact_Opportunity'),
      'DIM_Opportunity'[IsWon] = TRUE()
    ),
    "AttachRate", DIVIDE(
      CALCULATE(COUNTROWS('Fact_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
      CALCULATE(DISTINCTCOUNT('Fact_Opportunity'[OpportunityId]), 'DIM_Opportunity'[IsWon] = TRUE()),
      0
    )
  ),
  [Revenue], DESC
)`,

  // Opportunity Team Analysis
  opportunityTeam: (opportunityName) => `
EVALUATE
CALCULATETABLE(
  SUMMARIZECOLUMNS(
    'Opportunity Team Member'[Team Member Role],
    'FACT_OpportunityTeam'[Involvement Level],
    'FACT_OpportunityTeam'[Key Contributor],
    FILTER('DIM_Opportunity',
      SEARCH("${opportunityName}", 'DIM_Opportunity'[Opportunity Name], 1, 0) > 0
    ),
    "TeamMembers", DISTINCTCOUNT('FACT_OpportunityTeam'[UserID]),
    "AllocatedAmount", COALESCE(SUM('FACT_OpportunityTeam'[Amount]), 0),
    "EstimatedGP", COALESCE(SUM('FACT_OpportunityTeam'[EstGP]), 0)
  )
)`,

  // Win/Loss Analysis
  winLossAnalysis: (startY, startM, endY, endM) => `
EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Opportunity'[StageName],
  'DIM_Date'[Month_Date],
  FILTER('DIM_Date',
    'DIM_Date'[Year_Number] = ${startY} &&
    'DIM_Date'[Month_Number] >= ${startM} &&
    'DIM_Date'[Year_Number] = ${endY} &&
    'DIM_Date'[Month_Number] <= ${endM}
  ),
  FILTER('DIM_Opportunity', 'DIM_Opportunity'[IsClosed] = TRUE()),
  "Won", CALCULATE(
    COUNTROWS('DIM_Opportunity'),
    'DIM_Opportunity'[IsWon] = TRUE()
  ),
  "Lost", CALCULATE(
    COUNTROWS('DIM_Opportunity'),
    'DIM_Opportunity'[IsWon] = FALSE()
  ),
  "WinRate", DIVIDE(
    CALCULATE(COUNTROWS('DIM_Opportunity'), 'DIM_Opportunity'[IsWon] = TRUE()),
    COUNTROWS('DIM_Opportunity'),
    0
  ),
  "WonRevenue", COALESCE(
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = TRUE()
    ), 0
  ),
  "LostRevenue", COALESCE(
    CALCULATE(
      SUM('Fact_Opportunity'[Opportunity Amount]),
      'DIM_Opportunity'[IsWon] = FALSE()
    ), 0
  )
)`,

  // Simple test queries
  testSalesCount: () => `
EVALUATE
ROW(
  "OpportunityCount", COUNTROWS('DIM_Opportunity'),
  "AccountCount", COUNTROWS('DIM_Account'),
  "SalesRepCount", COUNTROWS('Sales Team Member')
)`,

  listSalesTables: () => `
EVALUATE
INFO.TABLES()`,

  sampleOpportunities: (rows = 10) => `
EVALUATE
TOPN(${rows},
  'DIM_Opportunity',
  'DIM_Opportunity'[Close Date], DESC
)`
};

// Export helper to fix common Sales DAX errors
export function fixSalesDaxQuery(query) {
  if (!query) return query;

  let fixed = query;

  // Common Sales table name corrections
  fixed = fixed.replace(/['"]?Opportunities['"]?/gi, 'DIM_Opportunity');
  fixed = fixed.replace(/['"]?Accounts['"]?/gi, 'DIM_Account');
  fixed = fixed.replace(/['"]?Sales Reps['"]?/gi, 'Sales Team Member');
  fixed = fixed.replace(/['"]?Opportunity Facts['"]?/gi, 'Fact_Opportunity');

  // Column name corrections
  fixed = fixed.replace(/\[Opportunity Value\]/gi, '[Opportunity Amount]');
  fixed = fixed.replace(/\[Deal Size\]/gi, '[Opportunity Amount]');
  fixed = fixed.replace(/\[Rep Name\]/gi, '[Sales Team Member]');
  fixed = fixed.replace(/\[Customer\]/gi, '[Account Name]');

  // Boolean corrections
  fixed = fixed.replace(/= TRUE(?!\()/gi, '= TRUE()');
  fixed = fixed.replace(/= FALSE(?!\()/gi, '= FALSE()');

  return fixed;
}