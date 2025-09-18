// V26.7 DAX Query Builder - Extracted from Golden Source
// CRITICAL: These patterns are optimized for PowerBI Fabric performance
// DO NOT MODIFY: These query patterns are 5x faster than alternatives

// PERFORMANCE PATTERNS DISCOVERED IN V26.6-V26.7:
// ✅ CALCULATETABLE: 200-400ms average (5x faster than FILTER)
// ✅ RELATED(): Required for dimension joins
// ✅ COALESCE(): Prevents null propagation in financial calculations
// ✅ DATE(Y,M,D): Only format PowerBI accepts reliably
// ❌ FILTER: 1000-2000ms average (use only for specific cases)
// ❌ String dates: Break frequently in PowerBI

/**
 * Core DAX query patterns optimized for USDM Labor Dataset
 * PowerBI Dataset: ea5298a1-13f0-4629-91ab-14f98163532e
 * Workspace: 927b94af-e7ef-4b5a-8b8d-02b0c5450b75
 */

// CRITICAL RELATIONSHIPS (DO NOT CHANGE):
// labor[resourceid] → DIM_Team_Member[Team_Member_ContactID]
// labor[projectid] → DIM_Project_Min[ProjectId]
// labor[date] → DIM_Date[Full_Date]
// Names are in DIM_Team_Member[Team Member Name], NOT labor table!

/**
 * Person resolver with fuzzy matching
 * Pattern: CALCULATETABLE for exact match, FILTER with SEARCH for fuzzy
 * Performance: 200-400ms vs 1000ms+ with old patterns
 */
function buildPersonResolverQuery(searchTerm, fuzzy = true) {
  // CRITICAL: Use CALCULATETABLE for exact match (5x faster)
  const exactQuery = `EVALUATE
CALCULATETABLE(
  'DIM_Team_Member',
  'DIM_Team_Member'[Team Member Name] = "${searchTerm}"
)`;

  // Fuzzy query using SEARCH function (only when needed)
  const fuzzyQuery = `EVALUATE
FILTER(
  'DIM_Team_Member',
  SEARCH("${searchTerm}", 'DIM_Team_Member'[Team Member Name], 1, 0) > 0
)`;

  return { exactQuery, fuzzyQuery };
}

/**
 * Monthly activity with COALESCE null handling
 * CRITICAL: COALESCE prevents null errors in financial calculations
 * Pattern: SUMMARIZECOLUMNS with TREATAS for person filtering
 */
function buildMonthlyActivityQuery(personName, year, month) {
  return `EVALUATE
SUMMARIZECOLUMNS(
  'labor'[week_end_date],
  'labor'[milestone_name],
  TREATAS({("${personName}")}, 'DIM_Team_Member'[Team Member Name]),
  FILTER('labor',
    'labor'[date] >= DATE(${year}, ${month}, 1) &&
    'labor'[date] <= DATE(${year}, ${month}, 31)
  ),
  "TotalHours", COALESCE(SUM('labor'[hours]), 0),
  "BillableHours", COALESCE(CALCULATE(SUM('labor'[hours]), 'labor'[is_billable] = TRUE()), 0),
  "LaborCost", COALESCE(SUM('labor'[cost]), 0),
  "PersonalRevenue", COALESCE(SUM('labor'[personal_revenue]), 0),
  "PersonalMargin", COALESCE(SUM('labor'[personal_margin]), 0)
)`;
}

/**
 * Person revenue analysis with enhanced project data
 * CRITICAL: Uses TOPN for performance, COALESCE for null safety
 * Pattern: SUMMARIZECOLUMNS with multiple dimension joins
 */
function buildPersonRevenueQuery(personName, startDate, endDate) {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  return `EVALUATE
TOPN(10,
  SUMMARIZECOLUMNS(
    'DIM_Project_Min'[Project Name],
    'DIM_Account_Min'[Account Name],
    'DIM_Project_Min'[Project Type],
    TREATAS({("${personName}")}, 'DIM_Team_Member'[Team Member Name]),
    FILTER('labor',
      'labor'[date] >= DATE(${startYear}, ${startMonth}, ${startDay}) &&
      'labor'[date] <= DATE(${endYear}, ${endMonth}, ${endDay})
    ),
    "Hours", COALESCE(SUM('labor'[hours]), 0),
    "BillableHours", COALESCE(CALCULATE(SUM('labor'[hours]), 'labor'[is_billable] = TRUE()), 0),
    "Cost", COALESCE(SUM('labor'[cost]), 0),
    "EstRevenue", COALESCE(SUM('labor'[personal_revenue]), 0),
    "EstMargin", COALESCE(SUM('labor'[personal_margin]), 0)
  ),
  [EstRevenue], DESC
)`;
}

/**
 * Timecard details with comprehensive work notes
 * CRITICAL: MUST use RELATED for ALL dimension joins
 * Pattern: ADDCOLUMNS + FILTER + SELECTCOLUMNS for optimal performance
 * V26.7 PATTERN: Includes activity categorization capabilities
 */
function buildTimecardDetailsQuery(personName, startDate, endDate, includeEmptyNotes = false) {
  const [startY, startM, startD] = startDate.split('-').map(Number);
  const [endY, endM, endD] = endDate.split('-').map(Number);

  const notesFilter = includeEmptyNotes ? '' : ' &&\n    \'labor\'[timecard_notes] <> BLANK()';

  return `EVALUATE
SELECTCOLUMNS(
  FILTER(
    ADDCOLUMNS(
      'labor',
      "PersonName", RELATED('DIM_Team_Member'[Team Member Name]),
      "ProjectName", RELATED('DIM_Project_Min'[Project Name]),
      "ClientName", RELATED('DIM_Account_Min'[Account Name]),
      "MilestoneName", RELATED('DIM_Milestone'[Milestone Name])
    ),
    [PersonName] = "${personName}" &&
    'labor'[date] >= DATE(${startY}, ${startM}, ${startD}) &&
    'labor'[date] <= DATE(${endY}, ${endM}, ${endD})${notesFilter}
  ),
  "Date", FORMAT('labor'[date], "yyyy-mm-dd"),
  "WeekEnding", FORMAT('labor'[week_end_date], "yyyy-mm-dd"),
  "Person", [PersonName],
  "Project", [ProjectName],
  "Client", [ClientName],
  "Milestone", [MilestoneName],
  "Hours", 'labor'[hours],
  "IsBillable", IF('labor'[is_billable], "Yes", "No"),
  "BillRate", ROUND('labor'[bill_rate], 2),
  "Cost", ROUND('labor'[cost], 2),
  "Revenue", ROUND('labor'[personal_revenue], 2),
  "Margin", ROUND('labor'[personal_margin], 2),
  "WorkNotes", 'labor'[timecard_notes]
)
ORDER BY 'labor'[date] ASC`;
}

/**
 * Dataset validation queries
 * CRITICAL: These verify the PowerBI dataset schema integrity
 */
function buildValidationQueries() {
  return {
    // Check table existence
    tableExists: (tableName) => `EVALUATE ROW("TableExists", COUNTROWS('${tableName}') >= 0)`,

    // Check row counts
    rowCount: (tableName) => `EVALUATE ROW("RowCount", COUNTROWS('${tableName}'))`,

    // Check column existence
    columnExists: (tableName, columnName) => `EVALUATE ROW("Test", COUNTBLANK('${tableName}'[${columnName}]))`,

    // Test relationship with RELATED
    testRelationship: (fromTable, toTable, toColumn) => `EVALUATE
TOPN(1,
  FILTER('${fromTable}', NOT(ISBLANK(RELATED('${toTable}'[${toColumn}]))))
)`,

    // Test measure
    testMeasure: (measureName) => `EVALUATE ROW("MeasureTest", [${measureName}])`
  };
}

/**
 * General purpose query builders
 * These follow the V26.7 optimized patterns
 */
function buildGeneralQueries() {
  return {
    // Get all team members (cached frequently)
    allTeamMembers: () => `EVALUATE
SELECTCOLUMNS(
  'DIM_Team_Member',
  "Name", 'DIM_Team_Member'[Team Member Name],
  "Department", 'DIM_Team_Member'[Parent Department],
  "Email", 'DIM_Team_Member'[Email],
  "Active", 'DIM_Team_Member'[Is Active]
)
ORDER BY 'DIM_Team_Member'[Team Member Name] ASC`,

    // Get all projects
    allProjects: () => `EVALUATE
SELECTCOLUMNS(
  'DIM_Project_Min',
  "ProjectName", 'DIM_Project_Min'[Project Name],
  "ProjectType", 'DIM_Project_Min'[Project Type],
  "AccountName", RELATED('DIM_Account_Min'[Account Name])
)
ORDER BY 'DIM_Project_Min'[Project Name] ASC`,

    // Labor data summary for date range
    laborSummary: (startDate, endDate) => {
      const [startY, startM, startD] = startDate.split('-').map(Number);
      const [endY, endM, endD] = endDate.split('-').map(Number);

      return `EVALUATE
SUMMARIZECOLUMNS(
  'DIM_Team_Member'[Team Member Name],
  'DIM_Team_Member'[Parent Department],
  FILTER('labor',
    'labor'[date] >= DATE(${startY}, ${startM}, ${startD}) &&
    'labor'[date] <= DATE(${endY}, ${endM}, ${endD})
  ),
  "TotalHours", COALESCE(SUM('labor'[hours]), 0),
  "BillableHours", COALESCE(CALCULATE(SUM('labor'[hours]), 'labor'[is_billable] = TRUE()), 0),
  "TotalCost", COALESCE(SUM('labor'[cost]), 0),
  "TotalRevenue", COALESCE(SUM('labor'[personal_revenue]), 0),
  "TotalMargin", COALESCE(SUM('labor'[personal_margin]), 0)
)
ORDER BY [TotalHours] DESC`;
    }
  };
}

/**
 * Utility functions for date handling
 * CRITICAL: PowerBI requires DATE(Y,M,D) format, NOT strings
 */
function formatDateForDax(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return `DATE(${year}, ${month}, ${day})`;
}

function validateDateString(dateString) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    throw new Error('Date must be in YYYY-MM-DD format');
  }

  const [year, month, day] = dateString.split('-').map(Number);
  if (year < 2020 || year > 2030) {
    throw new Error('Year must be between 2020 and 2030');
  }
  if (month < 1 || month > 12) {
    throw new Error('Month must be between 1 and 12');
  }
  if (day < 1 || day > 31) {
    throw new Error('Day must be between 1 and 31');
  }

  return { year, month, day };
}

/**
 * Query optimization patterns
 * These are the discovered performance optimizations from V26.6-V26.7
 */
const OPTIMIZATION_PATTERNS = {
  // Use CALCULATETABLE instead of FILTER for exact matches (5x faster)
  EXACT_MATCH: 'CALCULATETABLE',

  // Use COALESCE for all financial fields to prevent null propagation
  NULL_SAFETY: 'COALESCE',

  // Use RELATED for ALL dimension table joins
  DIMENSION_JOIN: 'RELATED',

  // Use DATE(Y,M,D) format for all date literals
  DATE_FORMAT: 'DATE(Y,M,D)',

  // Use TREATAS for person filtering in summarizations
  PERSON_FILTER: 'TREATAS',

  // Use TOPN to limit large result sets
  RESULT_LIMITING: 'TOPN',

  // Use ADDCOLUMNS + FILTER + SELECTCOLUMNS for complex transformations
  COMPLEX_TRANSFORM: 'ADDCOLUMNS+FILTER+SELECTCOLUMNS'
};

/**
 * Cache key generators for the multi-tier caching strategy
 * From V26.6 optimization: Different TTLs for different query types
 */
function generateCacheKey(queryType, params) {
  switch (queryType) {
    case 'person_lookup':
      return `person_${params.searchTerm.toLowerCase()}_${params.fuzzy || false}`;
    case 'monthly_activity':
      return `monthly_${params.personName}_${params.year}_${params.month}`;
    case 'revenue_analysis':
      return `revenue_${params.personName}_${params.startDate}_${params.endDate}`;
    case 'timecard_details':
      return `timecard_${params.personName}_${params.startDate}_${params.endDate}_${params.includeEmptyNotes || false}`;
    default:
      return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Dataset constants (from V26.7 golden source)
export const DATASET_CONSTANTS = {
  TENANT_ID: '18c250cf-2ef7-4eeb-b6fb-94660f7867e0',
  WORKSPACE_ID: '927b94af-e7ef-4b5a-8b8d-02b0c5450b75',
  DATASET_ID: 'ea5298a1-13f0-4629-91ab-14f98163532e',

  // Expected row count for validation
  EXPECTED_LABOR_ROWS: 3238644,

  // Critical tables that must exist
  CORE_TABLES: [
    'labor',
    'DIM_Team_Member',
    'DIM_Project_Min',
    'DIM_Date',
    'DIM_Milestone',
    'DIM_Account_Min',
    'DIM_Product_Min'
  ],

  // Critical columns for validation
  CRITICAL_COLUMNS: {
    'labor': ['hours', 'cost', 'personal_revenue', 'personal_margin', 'date', 'resourceid'],
    'DIM_Team_Member': ['Team Member Name', 'Team_Member_ContactID']
  },

  // Known relationships for testing
  RELATIONSHIPS: [
    { from: 'labor[resourceid]', to: 'DIM_Team_Member[Team_Member_ContactID]' },
    { from: 'labor[date]', to: 'DIM_Date[Full_Date]' },
    { from: 'labor[projectid]', to: 'DIM_Project_Min[ProjectId]' }
  ]
};

// Export all functions for use in the new platform
export {
  // Core query builders
  buildPersonResolverQuery,
  buildMonthlyActivityQuery,
  buildPersonRevenueQuery,
  buildTimecardDetailsQuery,
  buildValidationQueries,
  buildGeneralQueries,

  // Utility functions
  formatDateForDax,
  validateDateString,
  generateCacheKey,

  // Constants and patterns
  OPTIMIZATION_PATTERNS
};