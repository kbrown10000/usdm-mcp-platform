// Labor Tools Module - V26.7 Critical Tools Extraction
// 🔒 CRITICAL: These 11 tools are extracted EXACTLY from V26.7 golden source
// Source: railway-proxy-v26.7-timecard-analysis.mjs (lines 332-1335)
//
// AUTHENTICATION TOOLS (5):
// 1. start_login - Device code authentication initiation
// 2. check_login - Authentication status verification
// 3. whoami - User profile from Graph API
// 4. get_auth_status - Detailed authentication status
// 5. refresh_tokens - Token refresh functionality
//
// ANALYTICS TOOLS (6):
// 6. person_resolver - Optimized fuzzy person search
// 7. activity_for_person_month - Monthly activity with caching
// 8. person_revenue_analysis - Enhanced revenue analysis
// 9. person_utilization - Utilization metrics
// 10. get_timecard_details - V26.7 timecard analysis with categorization
// 11. run_dax - Direct DAX query execution
//
// CRITICAL PATTERNS PRESERVED:
// - Multi-tier caching with different TTLs
// - CALCULATETABLE over FILTER (5x performance)
// - COALESCE for null safety in financial calculations
// - RELATED() for all dimension joins
// - Three-token authentication sequence
// - Device code camelCase field handling
// - Query throttling (max 3 concurrent)

import {
  startLogin,
  checkLogin,
  whoami,
  getAuthStatus,
  refreshTokens,
  getPowerBIToken
} from '../auth/msal-auth.mjs';

import {
  executeDax,
  withDaxLimit,
  validateDataset
} from '../powerbi/connector.mjs';

import {
  buildPersonResolverQuery,
  buildMonthlyActivityQuery,
  buildPersonRevenueQuery,
  buildTimecardDetailsQuery,
  generateCacheKey,
  validateDateString
} from '../dax/queries.mjs';

// V26.7 Multi-tier caching strategy - EXACT copy from golden source
const cacheStore = new Map();
const CACHE_CONFIGS = {
  person_lookup: { ttl: 10 * 60 * 1000 },        // 10 minutes
  monthly_summary: { ttl: 60 * 60 * 1000 },      // 1 hour
  project_list: { ttl: 30 * 60 * 1000 },         // 30 minutes
  department_rollup: { ttl: 2 * 60 * 60 * 1000 }, // 2 hours
  financial_metrics: { ttl: 15 * 60 * 1000 },     // 15 minutes
  query_result: { ttl: 5 * 60 * 1000 }            // 5 minutes (general)
};

// V26.7 Cache helper functions - EXACT copy from golden source (lines 71-85)
function getCached(cacheType, key) {
  const config = CACHE_CONFIGS[cacheType] || CACHE_CONFIGS.query_result;
  const cacheKey = `${cacheType}:${key}`;
  const cached = cacheStore.get(cacheKey);

  if (cached && Date.now() - cached.time < config.ttl) {
    return cached.data;
  }
  return null;
}

function setCached(cacheType, key, data) {
  const cacheKey = `${cacheType}:${key}`;
  cacheStore.set(cacheKey, { time: Date.now(), data });
}

// V26.7 Fuzzy name matching - EXACT copy from golden source (lines 88-117)
function fuzzyMatchScore(search, target) {
  const s = search.toLowerCase();
  const t = target.toLowerCase();

  // Exact match
  if (s === t) return 100;

  // Contains match
  if (t.includes(s)) return 80;

  // Each word of search appears in target
  const searchWords = s.split(/\s+/);
  const targetWords = t.split(/\s+/);
  const wordMatches = searchWords.filter(sw =>
    targetWords.some(tw => tw.includes(sw))
  );
  if (wordMatches.length === searchWords.length) return 60;

  // Partial word matches
  if (wordMatches.length > 0) return 40;

  // Levenshtein distance-based score (simplified)
  const maxLen = Math.max(s.length, t.length);
  let distance = 0;
  for (let i = 0; i < maxLen; i++) {
    if (s[i] !== t[i]) distance++;
  }
  const similarity = (1 - distance / maxLen) * 30;
  return Math.max(0, similarity);
}

/**
 * Activity categorization helper - V26.7 pattern from lines 942-958
 * Categorizes work notes for timecard analysis
 */
function categorizeWork(notes) {
  if (!notes) return 'Uncategorized';
  const lowerNotes = notes.toLowerCase();

  if (lowerNotes.includes('ai') || lowerNotes.includes('gpt') || lowerNotes.includes('claude') || lowerNotes.includes('ml')) {
    return '🤖 AI/Innovation';
  }
  if (lowerNotes.includes('client') || lowerNotes.includes('poc') || lowerNotes.includes('demo') || lowerNotes.includes('proposal')) {
    return '👥 Client Engagement';
  }
  if (lowerNotes.includes('meeting') || lowerNotes.includes('status') || lowerNotes.includes('planning')) {
    return '📊 Project Management';
  }
  if (lowerNotes.includes('training') || lowerNotes.includes('documentation') || lowerNotes.includes('admin')) {
    return '📚 Administration';
  }
  return '💼 General Work';
}

/**
 * TOOL 1: start_login - Device code authentication initiation
 * V26.7 Source: Lines 337-468
 * CRITICAL: Preserves exact camelCase field handling and device code display
 */
async function startLoginTool(args = {}) {
  try {
    const result = await startLogin();

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `❌ ${result.error}` }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text',
        text: `**🔐 Authentication Started**

**Device Code:** ${result.deviceCode}

**Steps:**
1. Go to: ${result.verificationUri}
2. Enter code: **${result.deviceCode}**
3. Sign in with your Microsoft account
4. Run \`check_login\` to verify

Code expires in 15 minutes.`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Login failed: ${error.message}` }],
      isError: true
    };
  }
}

/**
 * TOOL 2: check_login - Authentication status verification
 * V26.7 Source: Lines 470-528
 * CRITICAL: Shows three-token status and clears pending auth
 */
async function checkLoginTool(args = {}) {
  try {
    const result = await checkLogin();

    if (!result.success && result.pending) {
      return {
        content: [{
          type: 'text',
          text: `⏳ Authentication still in progress...

Device Code: **${result.deviceCode}**
URL: ${result.verificationUri}

Please complete the sign-in process and try again.`
        }]
      };
    }

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `❌ ${result.error}` }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text',
        text: `✅ **Authentication Complete!**

Signed in as: ${result.username}

Token Status:
- Microsoft Graph: ${result.tokens.graph ? '✅ Ready' : '❌ Failed'}
- USDM API: ${result.tokens.usdm ? '✅ Ready' : '❌ Failed'}
- PowerBI: ${result.tokens.powerbi ? '✅ Ready' : '❌ Failed'}

You can now use all analytics tools.`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Check login failed: ${error.message}` }],
      isError: true
    };
  }
}

/**
 * TOOL 3: whoami - User profile from Graph API
 * V26.7 Source: Extracted from auth implementation
 * CRITICAL: Uses Graph token to get user profile
 */
async function whoamiTool(args = {}) {
  try {
    const result = await whoami();

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `❌ ${result.error}` }],
        isError: true
      };
    }

    const user = result.user;
    const tokens = result.tokens;

    return {
      content: [{
        type: 'text',
        text: `**👤 User Profile**

**Name:** ${user.displayName}
**Email:** ${user.mail}
**Job Title:** ${user.jobTitle || 'Not specified'}
**Department:** ${user.department || 'Not specified'}
**Office:** ${user.officeLocation || 'Not specified'}

**Authentication Status:**
- Microsoft Graph: ${tokens.graph ? '✅' : '❌'}
- USDM API: ${tokens.usdm ? '✅' : '❌'}
- PowerBI: ${tokens.powerbi ? '✅' : '❌'}

**Account ID:** ${user.id}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Failed to get profile: ${error.message}` }],
      isError: true
    };
  }
}

/**
 * TOOL 4: get_auth_status - Detailed authentication status
 * V26.7 Source: Lines 530-541
 * CRITICAL: Shows token availability without exposing sensitive data
 */
async function getAuthStatusTool(args = {}) {
  try {
    const status = getAuthStatus();

    return {
      content: [{
        type: 'text',
        text: `**🔐 Authentication Status**

• **Authenticated:** ${status.authenticated ? '✅' : '❌'}
• **Pending Auth:** ${status.pendingAuth ? '⏳' : '✅'}

**Token Status:**
• PowerBI Token: ${status.tokens.powerbi ? '✅ Available' : '❌ Missing'}
• Graph Token: ${status.tokens.graph ? '✅ Available' : '❌ Missing'}
• USDM API Token: ${status.tokens.usdm ? '✅ Available' : '❌ Missing'}

${status.account ? `**Account:** ${status.account.username} (${status.account.tenantId})` : '**Account:** Not cached'}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Status check failed: ${error.message}` }],
      isError: true
    };
  }
}

/**
 * TOOL 5: refresh_tokens - Token refresh functionality
 * V26.7 Source: Extracted from auth implementation
 * CRITICAL: Refreshes all three tokens using cached account
 */
async function refreshTokensTool(args = {}) {
  try {
    const result = await refreshTokens();

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `❌ ${result.error}` }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text',
        text: `**🔄 Token Refresh Results**

${result.message}

**Details:**
- Graph Token: ${result.refreshed.graph ? '✅ Refreshed' : '❌ Failed'}
- USDM API Token: ${result.refreshed.usdm ? '✅ Refreshed' : '❌ Failed'}
- PowerBI Token: ${result.refreshed.powerbi ? '✅ Refreshed' : '❌ Failed'}

You can now use all analytics tools with fresh tokens.`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Token refresh failed: ${error.message}` }],
      isError: true
    };
  }
}

/**
 * TOOL 6: person_resolver - Optimized fuzzy person search
 * V26.7 Source: Lines 544-633
 * CRITICAL: Uses CALCULATETABLE for 5x performance improvement
 */
async function personResolverTool(args) {
  const { search_term, fuzzy = true } = args;

  if (!search_term) {
    return {
      content: [{ type: 'text', text: '❌ search_term is required' }],
      isError: true
    };
  }

  const powerbiToken = getPowerBIToken();
  if (!powerbiToken) {
    return {
      content: [{ type: 'text', text: '❌ Not authenticated. Please run start_login first.' }],
      isError: true
    };
  }

  try {
    // Check cache first - V26.7 pattern
    const cacheKey = `${search_term.toLowerCase()}_${fuzzy}`;
    const cached = getCached('person_lookup', cacheKey);
    if (cached) {
      return {
        content: [{
          type: 'text',
          text: `**📋 Person Search (cached)**\n\n${cached}`
        }]
      };
    }

    // Build queries using V26.7 optimized patterns
    const { exactQuery, fuzzyQuery } = buildPersonResolverQuery(search_term, fuzzy);

    // Try exact match first (CALCULATETABLE - 5x faster)
    let result = await withDaxLimit(
      `person_exact_${search_term}`,
      () => executeDax(exactQuery, powerbiToken)
    );

    let data = result.data || [];

    // If no exact match and fuzzy enabled, try fuzzy search
    if (data.length === 0 && fuzzy) {
      result = await withDaxLimit(
        `person_fuzzy_${search_term}`,
        () => executeDax(fuzzyQuery, powerbiToken)
      );
      data = result.data || [];
    }

    // V26.7: Fuzzy scoring for better matches
    if (data.length > 1 && fuzzy) {
      data = data.map(p => ({
        ...p,
        fuzzyScore: fuzzyMatchScore(search_term, p['DIM_Team_Member[Team Member Name]'] || '')
      })).sort((a, b) => b.fuzzyScore - a.fuzzyScore);
    }

    let response = '';
    if (data.length === 0) {
      response = `❌ No person found matching "${search_term}"\n\n💡 Tips:\n• Check spelling\n• Try partial name (e.g., last name only)\n• Use fuzzy=true for broader search`;
    } else if (data.length === 1) {
      const p = data[0];
      const name = p['DIM_Team_Member[Team Member Name]'] || 'Unknown';
      const dept = p['DIM_Team_Member[Parent Department]'] || 'Unknown';
      const active = p['DIM_Team_Member[Is Active]'] || false;
      const email = p['DIM_Team_Member[Email]'] || 'N/A';
      response = `**✅ Match Found**\n\n**Name:** ${name}\n**Email:** ${email}\n**Department:** ${dept}\n**Active:** ${active ? 'Yes' : 'No'}`;
    } else {
      response = `**🔍 Multiple Matches (${data.length})**\n\n${data.slice(0, 5).map((p, i) => {
        const score = p.fuzzyScore || 0;
        const name = p['DIM_Team_Member[Team Member Name]'];
        const dept = p['DIM_Team_Member[Parent Department]'] || 'Unknown';
        return `${i+1}. **${name}** (${dept}) ${score > 80 ? '⭐' : ''}`;
      }).join('\n')}\n\n💡 Use exact name for best results`;
    }

    // Cache result
    setCached('person_lookup', cacheKey, response);

    return {
      content: [{ type: 'text', text: response }]
    };

  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Person search failed: ${error.message}` }],
      isError: true
    };
  }
}

/**
 * TOOL 7: activity_for_person_month - Monthly activity with caching
 * V26.7 Source: Lines 636-719
 * CRITICAL: Uses COALESCE for null safety and TREATAS for filtering
 */
async function activityForPersonMonthTool(args) {
  const { person_name, year, month } = args;

  if (!person_name || !year || !month) {
    return {
      content: [{ type: 'text', text: '❌ person_name, year, and month are required' }],
      isError: true
    };
  }

  const powerbiToken = getPowerBIToken();
  if (!powerbiToken) {
    return {
      content: [{ type: 'text', text: '❌ Not authenticated. Please run start_login first.' }],
      isError: true
    };
  }

  try {
    // Check cache first
    const cacheKey = `${person_name}_${year}_${month}`;
    const cached = getCached('monthly_summary', cacheKey);
    if (cached) {
      return {
        content: [{
          type: 'text',
          text: `**📊 Monthly Activity (cached)**\n\n${cached}`
        }]
      };
    }

    // Build query using V26.7 COALESCE patterns
    const query = buildMonthlyActivityQuery(person_name, year, month);

    const result = await withDaxLimit(
      `activity_${cacheKey}`,
      () => executeDax(query, powerbiToken)
    );

    const data = result.data || [];
    const totals = data.reduce((acc, r) => ({
      hours: acc.hours + (r['[TotalHours]'] || 0),
      billable: acc.billable + (r['[BillableHours]'] || 0),
      cost: acc.cost + (r['[LaborCost]'] || 0),
      revenue: acc.revenue + (r['[PersonalRevenue]'] || 0),
      margin: acc.margin + (r['[PersonalMargin]'] || 0)
    }), { hours: 0, billable: 0, cost: 0, revenue: 0, margin: 0 });

    const response = `**📊 Monthly Activity: ${person_name}**
**Period:** ${month}/${year}

**Summary:**
• **Total Hours:** ${totals.hours.toFixed(1)}
• **Billable Hours:** ${totals.billable.toFixed(1)} (${totals.hours > 0 ? ((totals.billable/totals.hours)*100).toFixed(0) : 0}%)
• **Labor Cost:** $${totals.cost.toLocaleString()}
• **Est. Personal Revenue:** $${totals.revenue.toLocaleString()}*
• **Est. Personal Margin:** $${totals.margin.toLocaleString()}*

*Personal estimates only, not actual project revenue.

**Weekly Breakdown:**
${data.slice(0, 4).map(r => {
  const week = new Date(r['labor[week_end_date]']).toLocaleDateString();
  const milestone = r['labor[milestone_name]'] || 'General';
  const hours = r['[TotalHours]'] || 0;
  return `• Week ${week}: ${hours.toFixed(1)}h - ${milestone}`;
}).join('\n')}`;

    // Cache result
    setCached('monthly_summary', cacheKey, response);

    return {
      content: [{ type: 'text', text: response }]
    };

  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Monthly activity failed: ${error.message}` }],
      isError: true
    };
  }
}

/**
 * TOOL 8: person_revenue_analysis - Enhanced revenue analysis
 * V26.7 Source: Lines 722-805
 * CRITICAL: Uses TOPN and COALESCE for performance and safety
 */
async function personRevenueAnalysisTool(args) {
  const { person_name, start_date, end_date } = args;

  if (!person_name || !start_date || !end_date) {
    return {
      content: [{ type: 'text', text: '❌ person_name, start_date, and end_date are required' }],
      isError: true
    };
  }

  const powerbiToken = getPowerBIToken();
  if (!powerbiToken) {
    return {
      content: [{ type: 'text', text: '❌ Not authenticated. Please run start_login first.' }],
      isError: true
    };
  }

  try {
    // Validate dates
    validateDateString(start_date);
    validateDateString(end_date);

    // Check cache
    const cacheKey = `${person_name}_${start_date}_${end_date}`;
    const cached = getCached('financial_metrics', cacheKey);
    if (cached) {
      return {
        content: [{
          type: 'text',
          text: `**💰 Revenue Analysis (cached)**\n\n${cached}`
        }]
      };
    }

    // Build query using V26.7 enhanced patterns
    const query = buildPersonRevenueQuery(person_name, start_date, end_date);

    const result = await withDaxLimit(
      `revenue_${cacheKey}`,
      () => executeDax(query, powerbiToken)
    );

    const data = result.data || [];
    const totals = data.reduce((acc, r) => ({
      hours: acc.hours + (r['[Hours]'] || 0),
      billable: acc.billable + (r['[BillableHours]'] || 0),
      cost: acc.cost + (r['[Cost]'] || 0),
      revenue: acc.revenue + (r['[EstRevenue]'] || 0),
      margin: acc.margin + (r['[EstMargin]'] || 0)
    }), { hours: 0, billable: 0, cost: 0, revenue: 0, margin: 0 });

    const marginPct = totals.revenue > 0 ? (totals.margin / totals.revenue * 100) : 0;

    const response = `**💰 Revenue Analysis: ${person_name}**
**Period:** ${start_date} to ${end_date}

**📌 Note:** Personal contribution estimates only.

**Overall:**
• **Total Hours:** ${totals.hours.toFixed(1)}
• **Billable %:** ${totals.hours > 0 ? (totals.billable/totals.hours*100).toFixed(1) : 0}%
• **Est. Revenue:** $${totals.revenue.toLocaleString()}
• **Est. Margin:** $${totals.margin.toLocaleString()} (${marginPct.toFixed(1)}%)

**Top Projects:**
${data.slice(0, 5).map((r, i) => {
  const proj = r['DIM_Project_Min[Project Name]'] || 'Unknown';
  const acct = r['DIM_Account_Min[Account Name]'] || 'Unknown';
  const rev = r['[EstRevenue]'] || 0;
  const hours = r['[Hours]'] || 0;
  return `${i+1}. **${proj}**\n   Customer: ${acct}\n   ${hours.toFixed(0)}h = $${rev.toLocaleString()}`;
}).join('\n\n')}`;

    // Cache result
    setCached('financial_metrics', cacheKey, response);

    return {
      content: [{ type: 'text', text: response }]
    };

  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Revenue analysis failed: ${error.message}` }],
      isError: true
    };
  }
}

/**
 * TOOL 9: person_utilization - Calculate utilization metrics
 * V26.7 Source: Derived from revenue analysis patterns
 * CRITICAL: Uses same COALESCE and TREATAS patterns
 */
async function personUtilizationTool(args) {
  const { person_name, start_date, end_date, target_hours_per_week = 40 } = args;

  if (!person_name || !start_date || !end_date) {
    return {
      content: [{ type: 'text', text: '❌ person_name, start_date, and end_date are required' }],
      isError: true
    };
  }

  const powerbiToken = getPowerBIToken();
  if (!powerbiToken) {
    return {
      content: [{ type: 'text', text: '❌ Not authenticated. Please run start_login first.' }],
      isError: true
    };
  }

  try {
    // Validate dates
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
    const weeksDiff = daysDiff / 7;
    const targetTotalHours = weeksDiff * target_hours_per_week;

    // Use monthly activity pattern for utilization calculation
    const [startYear, startMonth, startDay] = start_date.split('-').map(Number);
    const [endYear, endMonth, endDay] = end_date.split('-').map(Number);

    const query = `EVALUATE
SUMMARIZECOLUMNS(
  'labor'[week_end_date],
  TREATAS({("${person_name}")}, 'DIM_Team_Member'[Team Member Name]),
  FILTER('labor',
    'labor'[date] >= DATE(${startYear}, ${startMonth}, ${startDay}) &&
    'labor'[date] <= DATE(${endYear}, ${endMonth}, ${endDay})
  ),
  "TotalHours", COALESCE(SUM('labor'[hours]), 0),
  "BillableHours", COALESCE(CALCULATE(SUM('labor'[hours]), 'labor'[is_billable] = TRUE()), 0),
  "NonBillableHours", COALESCE(CALCULATE(SUM('labor'[hours]), 'labor'[is_billable] = FALSE()), 0)
)
ORDER BY 'labor'[week_end_date] ASC`;

    const result = await withDaxLimit(
      `utilization_${person_name}_${start_date}_${end_date}`,
      () => executeDax(query, powerbiToken)
    );

    const data = result.data || [];
    const totals = data.reduce((acc, r) => ({
      total: acc.total + (r['[TotalHours]'] || 0),
      billable: acc.billable + (r['[BillableHours]'] || 0),
      nonBillable: acc.nonBillable + (r['[NonBillableHours]'] || 0)
    }), { total: 0, billable: 0, nonBillable: 0 });

    const utilizationPct = targetTotalHours > 0 ? (totals.total / targetTotalHours * 100) : 0;
    const billablePct = totals.total > 0 ? (totals.billable / totals.total * 100) : 0;
    const avgHoursPerWeek = weeksDiff > 0 ? (totals.total / weeksDiff) : 0;

    const response = `**📈 Utilization Analysis: ${person_name}**
**Period:** ${start_date} to ${end_date} (${weeksDiff.toFixed(1)} weeks)

**Summary:**
• **Total Hours:** ${totals.total.toFixed(1)}
• **Target Hours:** ${targetTotalHours.toFixed(1)} (${target_hours_per_week}h/week)
• **Utilization:** ${utilizationPct.toFixed(1)}%
• **Avg Hours/Week:** ${avgHoursPerWeek.toFixed(1)}

**Hour Breakdown:**
• **Billable:** ${totals.billable.toFixed(1)} (${billablePct.toFixed(1)}%)
• **Non-Billable:** ${totals.nonBillable.toFixed(1)} (${(100-billablePct).toFixed(1)}%)

**Weekly Detail:**
${data.map(r => {
  const week = new Date(r['labor[week_end_date]']).toLocaleDateString();
  const total = r['[TotalHours]'] || 0;
  const billable = r['[BillableHours]'] || 0;
  const util = target_hours_per_week > 0 ? (total / target_hours_per_week * 100) : 0;
  return `• Week ${week}: ${total.toFixed(1)}h (${util.toFixed(0)}% util, ${billable.toFixed(1)}h billable)`;
}).join('\n')}

**Utilization Rating:**
${utilizationPct >= 90 ? '🟢 Excellent (≥90%)' :
  utilizationPct >= 80 ? '🟡 Good (80-89%)' :
  utilizationPct >= 70 ? '🟠 Fair (70-79%)' : '🔴 Low (<70%)'}`;

    return {
      content: [{ type: 'text', text: response }]
    };

  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Utilization analysis failed: ${error.message}` }],
      isError: true
    };
  }
}

/**
 * TOOL 10: get_timecard_details - V26.7 timecard analysis with categorization
 * V26.7 Source: Lines 873-1047
 * CRITICAL: Uses RELATED() for all joins and includes activity categorization
 */
async function getTimecardDetailsTool(args) {
  const { person_name, start_date, end_date, include_empty_notes = false } = args;

  if (!person_name || !start_date || !end_date) {
    return {
      content: [{ type: 'text', text: '❌ person_name, start_date, and end_date are required' }],
      isError: true
    };
  }

  const powerbiToken = getPowerBIToken();
  if (!powerbiToken) {
    return {
      content: [{ type: 'text', text: '❌ Not authenticated. Please run start_login first.' }],
      isError: true
    };
  }

  try {
    // Validate dates
    validateDateString(start_date);
    validateDateString(end_date);

    // Build comprehensive DAX query using V26.7 patterns
    const query = buildTimecardDetailsQuery(person_name, start_date, end_date, include_empty_notes);

    const result = await withDaxLimit(
      `timecard_details_${person_name}_${start_date}_${end_date}`,
      () => executeDax(query, powerbiToken)
    );

    const data = result.data || [];

    // Format the output with V26.7 categorization
    let output = `📋 **Timecard Details: ${person_name}**\n`;
    output += `📅 Period: ${start_date} to ${end_date}\n`;
    output += `📝 Entries with notes: ${data.length}\n\n`;

    // Group by week for better readability
    const byWeek = {};
    data.forEach(entry => {
      const week = entry['[WeekEnding]'] || 'Unknown';
      if (!byWeek[week]) byWeek[week] = [];
      byWeek[week].push(entry);
    });

    // Format each week's entries
    for (const [week, entries] of Object.entries(byWeek)) {
      output += `\n### Week Ending: ${week}\n`;

      entries.forEach(e => {
        const date = e['[Date]'] || 'Unknown';
        const hours = e['[Hours]'] || 0;
        const billable = e['[IsBillable]'] || 'No';
        const project = e['[Project]'] || 'Unknown';
        const client = e['[Client]'] || 'N/A';
        const notes = e['[WorkNotes]'] || 'No notes';
        const revenue = e['[Revenue]'] || 0;
        const category = categorizeWork(notes);

        output += `\n**${date}** - ${hours}h - ${project}${client !== 'N/A' ? ` (${client})` : ''}\n`;
        output += `• Category: ${category}\n`;
        output += `• Billable: ${billable} | Revenue: $${revenue}\n`;
        if (notes && notes !== 'No notes') {
          output += `• 📝 Notes: *${notes}*\n`;
        }
      });
    }

    // Summary statistics with category breakdown
    const totalHours = data.reduce((sum, e) => sum + (parseFloat(e['[Hours]']) || 0), 0);
    const billableHours = data.filter(e => e['[IsBillable]'] === 'Yes')
                              .reduce((sum, e) => sum + (parseFloat(e['[Hours]']) || 0), 0);
    const totalRevenue = data.reduce((sum, e) => sum + (parseFloat(e['[Revenue]']) || 0), 0);
    const totalCost = data.reduce((sum, e) => sum + (parseFloat(e['[Cost]']) || 0), 0);
    const totalMargin = data.reduce((sum, e) => sum + (parseFloat(e['[Margin]']) || 0), 0);

    // Category breakdown
    const categoryHours = {};
    data.forEach(e => {
      const category = categorizeWork(e['[WorkNotes]']);
      const hours = parseFloat(e['[Hours]']) || 0;
      categoryHours[category] = (categoryHours[category] || 0) + hours;
    });

    output += `\n---\n## 📊 Summary Analysis\n\n`;
    output += `### Time Metrics\n`;
    output += `• **Total Hours:** ${totalHours.toFixed(1)}\n`;
    output += `• **Billable Hours:** ${billableHours.toFixed(1)} (${totalHours > 0 ? ((billableHours/totalHours)*100).toFixed(1) : 0}%)\n`;
    output += `• **Utilization:** ${totalHours > 0 ? ((billableHours/totalHours)*100).toFixed(1) : 0}%\n\n`;

    output += `### Financial Metrics\n`;
    output += `• **Revenue:** $${totalRevenue.toLocaleString()}\n`;
    output += `• **Cost:** $${totalCost.toLocaleString()}\n`;
    output += `• **Margin:** $${totalMargin.toLocaleString()}\n`;
    output += `• **Margin %:** ${totalRevenue > 0 ? ((totalMargin/totalRevenue)*100).toFixed(1) : 0}%\n\n`;

    output += `### Activity Categories\n`;
    for (const [category, hours] of Object.entries(categoryHours)) {
      const pct = totalHours > 0 ? ((hours/totalHours)*100).toFixed(1) : 0;
      output += `• **${category}:** ${hours.toFixed(1)}h (${pct}%)\n`;
    }

    // Extract client mentions
    const clientMentions = new Set();
    data.forEach(e => {
      const notes = e['[WorkNotes]'] || '';
      const client = e['[Client]'];
      if (client && client !== 'N/A') clientMentions.add(client);
      // Look for other client names in notes
      ['Amgen', 'Astellas', 'Veeva', 'Pfizer', 'Care Access'].forEach(c => {
        if (notes.includes(c)) clientMentions.add(c);
      });
    });

    if (clientMentions.size > 0) {
      output += `\n### Client Engagement\n`;
      output += `Active clients mentioned: ${Array.from(clientMentions).join(', ')}\n`;
    }

    return {
      content: [{ type: 'text', text: output }]
    };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error retrieving timecard details: ${error.message}\n\n💡 Check that the person name is exact and the date range is valid.`
      }],
      isError: true
    };
  }
}

/**
 * TOOL 11: run_dax - Direct DAX query execution
 * V26.7 Source: Lines 1306-1319
 * CRITICAL: Direct access to PowerBI with rate limiting
 */
async function runDaxTool(args) {
  const { query } = args;

  if (!query) {
    return {
      content: [{ type: 'text', text: '❌ query parameter is required' }],
      isError: true
    };
  }

  const powerbiToken = getPowerBIToken();
  if (!powerbiToken) {
    return {
      content: [{ type: 'text', text: '❌ Not authenticated. Please run start_login first.' }],
      isError: true
    };
  }

  try {
    const result = await withDaxLimit(
      query.substring(0, 50),
      () => executeDax(query, powerbiToken)
    );

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };

  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ DAX query failed: ${error.message}` }],
      isError: true
    };
  }
}

/**
 * Get cache statistics - Helper tool from V26.7
 * V26.7 Source: Lines 808-841
 */
async function getCacheStatsTool(args = {}) {
  const stats = {};
  let totalEntries = 0;

  for (const [key, value] of cacheStore.entries()) {
    const [type] = key.split(':');
    if (!stats[type]) {
      stats[type] = { count: 0, oldestMs: Infinity, newestMs: 0 };
    }
    stats[type].count++;
    const age = Date.now() - value.time;
    stats[type].oldestMs = Math.min(stats[type].oldestMs, age);
    stats[type].newestMs = Math.max(stats[type].newestMs, age);
    totalEntries++;
  }

  return {
    content: [{
      type: 'text',
      text: `**📊 Cache Statistics**

**Total Entries:** ${totalEntries}

**By Type:**
${Object.entries(stats).map(([type, info]) => {
  const config = CACHE_CONFIGS[type] || CACHE_CONFIGS.query_result;
  return `• **${type}**: ${info.count} entries
  TTL: ${config.ttl / 1000}s
  Oldest: ${Math.floor(info.oldestMs / 1000)}s
  Newest: ${Math.floor(info.newestMs / 1000)}s`;
}).join('\n\n')}`
    }]
  };
}

/**
 * Clear cache - Helper tool from V26.7
 * V26.7 Source: Lines 843-870
 */
async function clearCacheTool(args = {}) {
  const { cache_type } = args;

  if (cache_type) {
    let cleared = 0;
    for (const key of cacheStore.keys()) {
      if (key.startsWith(`${cache_type}:`)) {
        cacheStore.delete(key);
        cleared++;
      }
    }
    return {
      content: [{
        type: 'text',
        text: `✅ Cleared ${cleared} entries from ${cache_type} cache`
      }]
    };
  } else {
    const total = cacheStore.size;
    cacheStore.clear();
    return {
      content: [{
        type: 'text',
        text: `✅ Cleared all ${total} cache entries`
      }]
    };
  }
}

// Export all 11 critical tools plus helpers
export {
  // Core 11 tools from V26.7
  startLoginTool as start_login,
  checkLoginTool as check_login,
  whoamiTool as whoami,
  getAuthStatusTool as get_auth_status,
  refreshTokensTool as refresh_tokens,
  personResolverTool as person_resolver,
  activityForPersonMonthTool as activity_for_person_month,
  personRevenueAnalysisTool as person_revenue_analysis,
  personUtilizationTool as person_utilization,
  getTimecardDetailsTool as get_timecard_details,
  runDaxTool as run_dax,

  // Helper tools
  getCacheStatsTool as get_cache_stats,
  clearCacheTool as clear_cache,

  // Utility functions for external use
  getCached,
  setCached,
  fuzzyMatchScore,
  categorizeWork,

  // Cache configuration export
  CACHE_CONFIGS
};

// Default export for easier importing
export default {
  start_login: startLoginTool,
  check_login: checkLoginTool,
  whoami: whoamiTool,
  get_auth_status: getAuthStatusTool,
  refresh_tokens: refreshTokensTool,
  person_resolver: personResolverTool,
  activity_for_person_month: activityForPersonMonthTool,
  person_revenue_analysis: personRevenueAnalysisTool,
  person_utilization: personUtilizationTool,
  get_timecard_details: getTimecardDetailsTool,
  run_dax: runDaxTool,
  get_cache_stats: getCacheStatsTool,
  clear_cache: clearCacheTool,
  getCached,
  setCached,
  fuzzyMatchScore,
  categorizeWork,
  CACHE_CONFIGS
};