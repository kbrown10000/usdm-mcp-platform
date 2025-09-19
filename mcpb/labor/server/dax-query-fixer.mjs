/**
 * DAX Query Fixer - Corrects common table/column name errors
 * Maps incorrect names to correct PowerBI schema
 */

export function fixDaxQuery(query) {
  if (!query) return query;

  let fixed = query;

  // Table name corrections
  fixed = fixed.replace(/['"]?Time Card['"]?/gi, 'labor');
  fixed = fixed.replace(/['"]?TimeCard['"]?/gi, 'labor');
  fixed = fixed.replace(/['"]?Hours['"]?(?=\[)/gi, 'labor');
  fixed = fixed.replace(/['"]?Person['"]?(?=\[)/gi, 'DIM_Team_Member');
  fixed = fixed.replace(/['"]?People['"]?(?=\[)/gi, 'DIM_Team_Member');
  fixed = fixed.replace(/['"]?Project Header['"]?/gi, 'DIM_Project_Min');

  // Column name corrections for labor table
  fixed = fixed.replace(/\[Resource Full Name\]/gi, '[resourceid]');
  fixed = fixed.replace(/\[Resource Name\]/gi, '[resourceid]');
  fixed = fixed.replace(/\[Person Name\]/gi, '[resourceid]');
  fixed = fixed.replace(/\[Date\]/gi, '[date]');
  fixed = fixed.replace(/\[Billable\]/gi, '[is_billable]');
  fixed = fixed.replace(/\[Project Number\]/gi, '[projectid]');
  fixed = fixed.replace(/\[Project Name\]/gi, '[milestone_name]'); // Closest in labor table
  fixed = fixed.replace(/\[Customer Name\]/gi, '[accountid]');
  fixed = fixed.replace(/\[Hours\]/gi, '[hours]');

  // Column corrections for DIM_Team_Member
  fixed = fixed.replace(/DIM_Team_Member\[Person\]/gi, 'DIM_Team_Member[Team Member Name]');
  fixed = fixed.replace(/DIM_Team_Member\[Name\]/gi, 'DIM_Team_Member[Team Member Name]');
  fixed = fixed.replace(/DIM_Team_Member\[Department\]/gi, 'DIM_Team_Member[Parent Department]');

  // Fix boolean comparisons
  fixed = fixed.replace(/= FALSE\(\)/gi, '= FALSE()');
  fixed = fixed.replace(/= TRUE\(\)/gi, '= TRUE()');
  fixed = fixed.replace(/= FALSE(?!\()/gi, '= FALSE()');
  fixed = fixed.replace(/= TRUE(?!\()/gi, '= TRUE()');

  // Common query pattern fixes
  // If query is filtering labor by person name directly, need to use RELATED
  if (fixed.includes('labor[resourceid] = "') && fixed.includes('"')) {
    // This is trying to filter by name but resourceid is a GUID
    // Need to restructure to use RELATED
    console.error('[DAX FIXER] Warning: Query trying to filter resourceid by name - this needs RELATED()');

    // Extract the person name
    const nameMatch = fixed.match(/labor\[resourceid\] = "([^"]+)"/);
    if (nameMatch) {
      const personName = nameMatch[1];
      // Replace with proper RELATED pattern
      fixed = fixed.replace(
        /labor\[resourceid\] = "[^"]+"/g,
        `RELATED('DIM_Team_Member'[Team Member Name]) = "${personName}"`
      );
    }
  }

  // Log changes if any were made
  if (fixed !== query) {
    console.error('[DAX FIXER] Query corrected:');
    console.error('[DAX FIXER] Original:', query.substring(0, 100) + '...');
    console.error('[DAX FIXER] Fixed:', fixed.substring(0, 100) + '...');
  }

  return fixed;
}

// V26.7 Golden DAX Patterns - PROVEN TO WORK
export const DAX_PATTERNS = {
  // Find person by name - V26.7 PATTERN (5x faster with CALCULATETABLE)
  findPerson: (name) => `
EVALUATE
CALCULATETABLE(
  'DIM_Team_Member',
  'DIM_Team_Member'[Team Member Name] = "${name}"
)`,

  // Activity for person month - V26.7 GOLDEN PATTERN
  activityForPersonMonth: (personName, year, month) => `
EVALUATE
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
)`,

  // Person revenue analysis - V26.7 GOLDEN PATTERN
  personRevenueAnalysis: (personName, startY, startM, startD, endY, endM, endD) => `
EVALUATE
TOPN(10,
  SUMMARIZECOLUMNS(
    'DIM_Project_Min'[Project Name],
    'DIM_Account_Min'[Account Name],
    'DIM_Project_Min'[Project Type],
    TREATAS({("${personName}")}, 'DIM_Team_Member'[Team Member Name]),
    FILTER('labor',
      'labor'[date] >= DATE(${startY}, ${startM}, ${startD}) &&
      'labor'[date] <= DATE(${endY}, ${endM}, ${endD})
    ),
    "Hours", COALESCE(SUM('labor'[hours]), 0),
    "BillableHours", COALESCE(CALCULATE(SUM('labor'[hours]), 'labor'[is_billable] = TRUE()), 0),
    "Cost", COALESCE(SUM('labor'[cost]), 0),
    "EstRevenue", COALESCE(SUM('labor'[personal_revenue]), 0),
    "EstMargin", COALESCE(SUM('labor'[personal_margin]), 0)
  ),
  [EstRevenue], DESC
)`,

  // Timecard details - V26.7 NEW PATTERN
  timecardDetails: (personName, startY, startM, startD, endY, endM, endD, includeEmpty = false) => `
EVALUATE
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
    'labor'[date] <= DATE(${endY}, ${endM}, ${endD})${includeEmpty ? '' : ' &&\n    \'labor\'[timecard_notes] <> BLANK()'}
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
ORDER BY 'labor'[date] ASC`,

  // Team utilization - V26.7 PATTERN
  teamUtilization: (startY, startM, startD, endY, endM, endD, minHours = 0) => `
EVALUATE
FILTER(
  SUMMARIZECOLUMNS(
    'DIM_Team_Member'[Team Member Name],
    FILTER('labor',
      'labor'[date] >= DATE(${startY}, ${startM}, ${startD}) &&
      'labor'[date] <= DATE(${endY}, ${endM}, ${endD})
    ),
    "TotalHours", SUM('labor'[hours]),
    "BillableHours", CALCULATE(SUM('labor'[hours]), 'labor'[is_billable] = TRUE()),
    "Utilization_Pct", DIVIDE(
      CALCULATE(SUM('labor'[hours]), 'labor'[is_billable] = TRUE()),
      184, 0
    ) * 100,
    "BillableRatio_Pct", DIVIDE(
      CALCULATE(SUM('labor'[hours]), 'labor'[is_billable] = TRUE()),
      SUM('labor'[hours]), 0
    ) * 100
  ),
  [TotalHours] >= ${minHours}
)
ORDER BY [Utilization_Pct] DESC`,

  // Financial performance - V26.7 PATTERN
  financialPerformance: (groupBy, startY, startM, startD, endY, endM, endD, top = 20) => {
    const groupColumn = groupBy === 'department' ?
      "'DIM_Team_Member'[Parent Department]" :
      "'DIM_Team_Member'[Team Member Name]";

    return `
EVALUATE
TOPN(${top},
  FILTER(
    SUMMARIZECOLUMNS(
      ${groupColumn},
      FILTER('labor',
        'labor'[date] >= DATE(${startY}, ${startM}, ${startD}) &&
        'labor'[date] <= DATE(${endY}, ${endM}, ${endD})
      ),
      "Revenue", SUM('labor'[personal_revenue]),
      "Cost", SUM('labor'[cost]),
      "Margin", SUM('labor'[personal_revenue]) - SUM('labor'[cost]),
      "MarginPct", DIVIDE(
        SUM('labor'[personal_revenue]) - SUM('labor'[cost]),
        SUM('labor'[personal_revenue]), 0
      ) * 100
    ),
    [Revenue] > 0
  ),
  [Revenue], DESC
)`;
  },

  // Simple row count test
  testLaborCount: () => `
EVALUATE
ROW("LaborRowCount", COUNTROWS('labor'))`,

  // List all tables
  listTables: () => `
EVALUATE
INFO.TABLES()`,

  // Sample data from table
  sampleData: (tableName, rows = 10) => `
EVALUATE
TOPN(${rows}, '${tableName}')`
};