/**
 * DAX Query Builder - V26.7 Optimized Patterns
 * CRITICAL: Use CALCULATETABLE for exact matches (5x faster than FILTER)
 * Reference: V26.7 Lines 565-570
 */

export class DAXQueryBuilder {
  constructor() {
    this.components = [];
    this.currentExpression = '';
    this.variables = new Map();
  }

  /**
   * Build exact match query using CALCULATETABLE
   * 5x faster than FILTER for exact matches
   * @param {string} table - Table name
   * @param {string} column - Column to match
   * @param {string} value - Value to match
   */
  exactMatch(table, column, value) {
    // Escape quotes in value
    const escapedValue = value.replace(/"/g, '""');

    // V26.7 Pattern: CALCULATETABLE for exact match (Lines 571-574)
    const query = `EVALUATE
CALCULATETABLE(
  '${table}',
  '${table}'[${column}] = "${escapedValue}"
)`;

    this.currentExpression = query;
    return this;
  }

  /**
   * Build fuzzy search query using FILTER
   * Only use for non-exact matches
   * @param {string} table - Table name
   * @param {string} column - Column to search
   * @param {string} searchTerm - Search term
   */
  fuzzySearch(table, column, searchTerm) {
    // Escape quotes in search term
    const escapedTerm = searchTerm.replace(/"/g, '""');

    // V26.7 Pattern: FILTER for fuzzy search (Lines 586-590)
    const query = `EVALUATE
FILTER(
  '${table}',
  SEARCH("${escapedTerm}", '${table}'[${column}], 1, 0) > 0
)`;

    this.currentExpression = query;
    return this;
  }

  /**
   * Build person activity query with date filtering
   * @param {string} personName - Person's name
   * @param {number} year - Year
   * @param {number} month - Month
   */
  personActivity(personName, year, month) {
    const escapedName = personName.replace(/"/g, '""');

    // V26.7 Pattern: SUMMARIZE with TREATAS and FILTER (Lines 665-671)
    const query = `EVALUATE
SUMMARIZE(
  'labor',
  'labor'[date],
  'labor'[project],
  'labor'[milestone_name],
  TREATAS({("${escapedName}")}, 'DIM_Team_Member'[Team Member Name]),
  FILTER('labor',
    'labor'[date] >= DATE(${year}, ${month}, 1) &&
    'labor'[date] <= DATE(${year}, ${month}, 31)
  ),
  "total_hours", SUM('labor'[hours]),
  "total_cost", SUM('labor'[cost])
)`;

    this.currentExpression = query;
    return this;
  }

  /**
   * Build timecard details query
   * @param {string} personName - Person's name
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  timecardDetails(personName, startDate, endDate) {
    const escapedName = personName.replace(/"/g, '""');
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();

    // V26.7 Pattern: Complex timecard query (Lines 890-900)
    const query = `EVALUATE
SELECTCOLUMNS(
  FILTER(
    ADDCOLUMNS(
      'labor',
      "TeamMemberName", RELATED('DIM_Team_Member'[Team Member Name]),
      "HasNotes", NOT(ISBLANK('labor'[notes]))
    ),
    [TeamMemberName] = "${escapedName}" &&
    [HasNotes] = TRUE() &&
    'labor'[date] >= DATE(${startYear}, ${startMonth}, ${startDay}) &&
    'labor'[date] <= DATE(${endYear}, ${endMonth}, ${endDay})
  ),
  "date", 'labor'[date],
  "project", 'labor'[project],
  "hours", 'labor'[hours],
  "notes", 'labor'[notes]
)`;

    this.currentExpression = query;
    return this;
  }

  /**
   * Build aggregation query with measures
   * @param {string} table - Table name
   * @param {string[]} groupBy - Columns to group by
   * @param {Object} measures - Measure definitions
   */
  summarize(table, groupBy = [], measures = {}) {
    let query = `EVALUATE\nSUMMARIZE(\n  '${table}'`;

    // Add groupBy columns
    if (groupBy.length > 0) {
      query += `,\n  ${groupBy.map(col => `'${table}'[${col}]`).join(',\n  ')}`;
    }

    // Add measures with COALESCE for nulls
    for (const [name, formula] of Object.entries(measures)) {
      // Wrap aggregates in COALESCE to handle nulls
      const wrappedFormula = formula.includes('SUM') || formula.includes('AVERAGE') || formula.includes('COUNT')
        ? `COALESCE(${formula}, 0)`
        : formula;
      query += `,\n  "${name}", ${wrappedFormula}`;
    }

    query += '\n)';
    this.currentExpression = query;
    return this;
  }

  /**
   * Add ORDER BY clause
   * @param {string} column - Column to order by
   * @param {string} direction - ASC or DESC
   */
  orderBy(column, direction = 'ASC') {
    if (!this.currentExpression) {
      throw new Error('No query to order');
    }

    this.currentExpression += `\nORDER BY [${column}] ${direction}`;
    return this;
  }

  /**
   * Add TOP N clause
   * @param {number} n - Number of rows to return
   */
  topN(n) {
    if (!this.currentExpression) {
      throw new Error('No query to limit');
    }

    // Wrap current expression in TOPN
    this.currentExpression = this.currentExpression.replace(
      'EVALUATE',
      `EVALUATE\nTOPN(${n},`
    ) + ')';

    return this;
  }

  /**
   * Build the final query string
   */
  build() {
    if (!this.currentExpression) {
      throw new Error('No query built');
    }

    return this.currentExpression;
  }

  /**
   * Create a raw DAX query (escape hatch for complex queries)
   * @param {string} query - Raw DAX query
   */
  static raw(query) {
    const builder = new DAXQueryBuilder();
    builder.currentExpression = query;
    return builder;
  }
}

/**
 * Helper functions for DAX expressions
 */
export const DAXHelpers = {
  /**
   * Format date for DAX DATE function
   * @param {Date} date - JavaScript date
   */
  formatDate(date) {
    return `DATE(${date.getFullYear()}, ${date.getMonth() + 1}, ${date.getDate()})`;
  },

  /**
   * Escape string values for DAX
   * @param {string} value - String to escape
   */
  escapeString(value) {
    return value.replace(/"/g, '""');
  },

  /**
   * Build RELATED expression for dimension lookups
   * @param {string} table - Related table
   * @param {string} column - Column to lookup
   */
  related(table, column) {
    return `RELATED('${table}'[${column}])`;
  },

  /**
   * Build TREATAS expression for filtering by dimension
   * @param {string} value - Value to filter
   * @param {string} table - Dimension table
   * @param {string} column - Dimension column
   */
  treatAs(value, table, column) {
    const escaped = value.replace(/"/g, '""');
    return `TREATAS({("${escaped}")}, '${table}'[${column}])`;
  }
};

export default DAXQueryBuilder;