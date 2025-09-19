#!/usr/bin/env node
// 🔒 V26.7 TIMECARD ANALYSIS - PRODUCTION WORKING VERSION
// ⚠️ CRITICAL: This version has working authentication and optimized queries
// ⚠️ DO NOT MODIFY authentication patterns without reading:
//    - CRITICAL_DOCS_WORKING_STATE/AUTHENTICATION_DO_NOT_MODIFY.md
//    - CRITICAL_DOCS_WORKING_STATE/V22_HARDENED_SOLUTION.md
//
// V26.7 TIMECARD ANALYSIS - Added performance reporting capabilities
// Preserves all V26.6 optimizations and auth fixes
// New in V26.7:
// 1. get_timecard_details tool - Extract timecard notes and work descriptions
// 2. Activity categorization from timecard notes
// 3. Client engagement tracking from notes
// V26.6 features preserved:
// - Optimized person_resolver with fuzzy matching
// - Multi-tier caching strategy
// - COALESCE null handling
// - Working authentication (DO NOT MODIFY!)

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { PublicClientApplication } from '@azure/msal-node';

// ⚠️ DO NOT MODIFY: Production PowerBI IDs and Railway configuration
// These IDs connect to the actual USDM labor dataset in PowerBI
// Changing any ID will break data access or authentication
// Environment configuration
const TENANT_ID = process.env.AZURE_TENANT_ID || '18c250cf-2ef7-4eeb-b6fb-94660f7867e0';     // USDM tenant
const CLIENT_ID = process.env.AZURE_CLIENT_ID || '8b84dc3b-a9ff-43ed-9d35-571f757e9c19';     // Railway app registration
const BACKEND_URL = process.env.RAILWAY_BACKEND_URL || 'https://usdm-mcp-platform-production.up.railway.app';
const WORKSPACE_ID = process.env.POWERBI_WORKSPACE_ID || '927b94af-e7ef-4b5a-8b8d-02b0c5450b75';  // Labor workspace
const DATASET_ID = process.env.POWERBI_DATASET_ID || 'ea5298a1-13f0-4629-91ab-14f98163532e';      // Labor dataset with 3.2M records

// ⚠️ DO NOT MODIFY: MSAL configuration working with enterprise app
// Client ID: 8b84dc3b-a9ff-43ed-9d35-571f757e9c19 (Railway app)
// This is the ONLY working configuration after 30+ attempts
// MSAL client configuration
const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
  }
};

const pca = new PublicClientApplication(msalConfig);

// Token storage (v26 multi-token architecture)
let powerbiToken = null;
let graphToken = null;
let apiToken = null;
let authenticationComplete = false;

// V26.6 FIX: Proper auth state management
let pendingAuth = null;
let cachedAccount = null;  // V22: Store the MSAL account object

// V26.6 Multi-tier caching strategy
const cacheStore = new Map();
const CACHE_CONFIGS = {
  person_lookup: { ttl: 10 * 60 * 1000 },        // 10 minutes
  monthly_summary: { ttl: 60 * 60 * 1000 },      // 1 hour
  project_list: { ttl: 30 * 60 * 1000 },         // 30 minutes
  department_rollup: { ttl: 2 * 60 * 60 * 1000 }, // 2 hours
  financial_metrics: { ttl: 15 * 60 * 1000 },     // 15 minutes
  query_result: { ttl: 5 * 60 * 1000 }            // 5 minutes (general)
};

// Cache helper functions
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

// V26.6 Fuzzy name matching
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

// PERFORMANCE: Query throttling prevents 429 errors from PowerBI
// PowerBI limits: 120 requests/minute per user, 8 executeQueries/minute
// SAFE TO MODIFY: Adjust MAX_CONCURRENT if needed (3 works well)
// DO NOT MODIFY: The throttling structure - it prevents service overload
// Query throttling
const queryQueue = [];
let activeQueries = 0;
const MAX_CONCURRENT = 3;  // Tested optimal value - DO NOT exceed 5

async function withDaxLimit(queryId, queryFn) {
  while (activeQueries >= MAX_CONCURRENT) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  activeQueries++;
  try {
    return await queryFn();
  } finally {
    activeQueries--;
  }
}

// Enhanced DAX query execution with error handling
// DAX Query auto-fixer for common table/column name errors
function fixDaxQuery(query) {
  if (!query) return query;

  let fixed = query;

  // Fix table names
  fixed = fixed.replace(/['"]?Time Card['"]?/gi, 'labor');
  fixed = fixed.replace(/['"]?TimeCard['"]?/gi, 'labor');
  fixed = fixed.replace(/['"]?Project Header['"]?/gi, 'DIM_Project_Min');

  // Fix column names for queries using wrong schema
  // These are common mistakes from Claude or other tools
  fixed = fixed.replace(/labor\[Resource Full Name\]/gi, 'labor[resource]');
  fixed = fixed.replace(/labor\[Resource Name\]/gi, 'labor[resource]');
  fixed = fixed.replace(/labor\[Date\]/gi, 'labor[date]');
  fixed = fixed.replace(/labor\[Billable\]/gi, 'labor[is_billable]');
  fixed = fixed.replace(/labor\[Project Number\]/gi, 'labor[projectid]');
  fixed = fixed.replace(/labor\[Project Name\]/gi, 'labor[milestone_name]');
  fixed = fixed.replace(/labor\[Customer Name\]/gi, 'labor[accountid]');
  fixed = fixed.replace(/labor\[Customer\]/gi, 'labor[accountid]');
  fixed = fixed.replace(/labor\[Hours\]/gi, 'labor[hours]');

  // Fix DIM_Project_Min columns
  fixed = fixed.replace(/DIM_Project_Min\[Project Number\]/gi, 'DIM_Project_Min[ProjectId]');
  fixed = fixed.replace(/DIM_Project_Min\[Customer Name\]/gi, 'DIM_Project_Min[Customer Name]');

  // Fix boolean comparisons
  fixed = fixed.replace(/= FALSE(?!\()/gi, '= FALSE()');
  fixed = fixed.replace(/= TRUE(?!\()/gi, '= TRUE()');

  // Log if we made changes
  if (fixed !== query) {
    console.error('[DAX FIXER] Corrected query table/column names');
  }

  return fixed;
}

async function runDax(query) {
  if (!powerbiToken) {
    throw new Error('Not authenticated. Please run start_login first.');
  }

  // Fix common DAX query errors before sending
  const fixedQuery = fixDaxQuery(query);

  try {
    const response = await axios.post(
      `https://api.powerbi.com/v1.0/myorg/groups/${WORKSPACE_ID}/datasets/${DATASET_ID}/executeQueries`,
      {
        queries: [{ query: fixedQuery }],
        serializerSettings: { includeNulls: true }
      },
      {
        headers: {
          'Authorization': `Bearer ${powerbiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const result = response.data.results[0];
    if (result.error) {
      // V26.6 Enhanced error messages with suggestions
      const errorMsg = result.error.message || 'Unknown error';
      let suggestion = '';

      if (errorMsg.includes('table')) {
        suggestion = '\n💡 Suggestion: Check table names - use labor, DIM_Team_Member, DIM_Date, etc.';
      } else if (errorMsg.includes('column')) {
        suggestion = '\n💡 Suggestion: Column names are case-sensitive. Use [Team Member Name] not [team member name]';
      } else if (errorMsg.includes('syntax')) {
        suggestion = '\n💡 Suggestion: Check DAX syntax - dates need DATE(year,month,day) format';
      }

      throw new Error(`PowerBI error: ${errorMsg}${suggestion}`);
    }

    return {
      success: true,
      data: result.tables[0]?.rows || [],
      rowCount: result.tables[0]?.rows?.length || 0
    };

  } catch (error) {
    if (error.response?.status === 401) {
      powerbiToken = null;
      throw new Error('PowerBI token expired. Please run start_login again.');
    }
    throw error;
  }
}

// Create server with proper initialization
const server = new Server({
  name: 'usdm-labor-rmo-v26.6',
  version: '26.6.0'
}, {
  capabilities: { tools: {}, prompts: {} }
});

// Define tools
const tools = [
  {
    name: 'start_login',
    description: 'Start Microsoft authentication - shows device code',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'check_login',
    description: 'Check if authentication is complete',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'whoami',
    description: 'Get authenticated user profile',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'auth_status',
    description: 'Check detailed authentication status',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'run_dax',
    description: 'Run DAX query against PowerBI dataset',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'DAX query to execute' } },
      required: ['query']
    }
  },
  {
    name: 'person_resolver',
    description: 'V26.6 OPTIMIZED: Find person with exact match first, then fuzzy search',
    inputSchema: {
      type: 'object',
      properties: {
        search_term: { type: 'string', description: 'Person name or partial name' },
        fuzzy: { type: 'boolean', description: 'Enable fuzzy matching (default: true)' }
      },
      required: ['search_term']
    }
  },
  {
    name: 'activity_for_person_month',
    description: 'V26.6: Get monthly activity with improved caching',
    inputSchema: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Exact person name' },
        year: { type: 'number', description: 'Year (e.g., 2025)' },
        month: { type: 'number', description: 'Month (1-12)' }
      },
      required: ['person_name', 'year', 'month']
    }
  },
  {
    name: 'person_revenue_analysis',
    description: 'V26.6: Enhanced with null handling and better performance',
    inputSchema: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Exact person name' },
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD' }
      },
      required: ['person_name', 'start_date', 'end_date']
    }
  },
  {
    name: 'get_cache_stats',
    description: 'V26.6: View cache statistics and performance metrics',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'clear_cache',
    description: 'V26.6: Clear cache for a specific type or all',
    inputSchema: {
      type: 'object',
      properties: { cache_type: { type: 'string', description: 'Cache type to clear (optional)' } }
    }
  },
  {
    name: 'get_timecard_details',
    description: 'V26.7: Get detailed timecard entries with work descriptions and notes',
    inputSchema: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Full name of person' },
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        include_empty_notes: { type: 'boolean', description: 'Include entries without notes (default: false)' }
      },
      required: ['person_name', 'start_date', 'end_date']
    }
  },
  {
    name: 'validate_dataset',
    description: 'Validate Microsoft Fabric dataset schema and accessibility',
    inputSchema: {
      type: 'object',
      properties: {
        strict_mode: { type: 'boolean', description: 'Fail on any mismatch (default: false)' },
        validate_measures: { type: 'boolean', description: 'Validate all measures (default: true)' },
        validate_relationships: { type: 'boolean', description: 'Validate relationships (default: true)' },
        check_row_counts: { type: 'boolean', description: 'Check data volume (default: true)' }
      },
      required: []
    }
  },
  {
    name: 'dev_test_dax',
    description: 'Test DAX queries for development - shows raw results and errors',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'DAX query to test' },
        show_raw: { type: 'boolean', description: 'Show raw JSON response (default: false)' }
      },
      required: ['query']
    }
  }
];

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      // Authentication tools
      if (name === 'start_login') {
        // V26.6 FIX: Initialize auth state properly
        pendingAuth = {
          deviceCode: null,
          verificationUri: null,
          promise: null,
          complete: false
        };

        console.error('🔐 Starting device code flow...');

        // V22 HARDENED: Use exact scopes from working implementation
        const deviceFlowScopes = [
          'openid',
          'profile',
          'offline_access',
          'api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation',  // USDM API scope
          'User.Read'  // Graph scope
        ];

        // Start device code flow with v22 scopes
        pendingAuth.promise = pca.acquireTokenByDeviceCode({
          scopes: deviceFlowScopes,
          // ⚠️ DO NOT MODIFY: CRITICAL AUTHENTICATION PATTERN
          // MSAL uses camelCase fields, NOT snake_case!
          // ✅ CORRECT: response.userCode, response.verificationUri
          // ❌ WRONG: response.user_code, response.verification_uri
          // This was the #1 cause of authentication failures in v1-v25
          deviceCodeCallback: (response) => {
            // V26 FIX: Store immediately when received
            console.error(`🔑 Device code received: ${response.userCode}`);
            pendingAuth.deviceCode = response.userCode;  // MUST be camelCase!
            pendingAuth.verificationUri = response.verificationUri;  // MUST be camelCase!
          }
        });

        // Wait for device code with proper timeout
        let attempts = 0;
        while (!pendingAuth.deviceCode && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        console.error(`⏱️ Waited ${attempts * 100}ms for device code`);

        if (!pendingAuth.deviceCode) {
          return {
            content: [{ type: 'text', text: '❌ Failed to get device code after 3 seconds' }],
            isError: true
          };
        }

        // Store promise completion handler
        pendingAuth.promise.then(async (result) => {
          console.error('✅ Device auth completed');
          pendingAuth.complete = true;

          if (result && result.account) {
            // V22 PATTERN: Store account and acquire tokens separately
            cachedAccount = result.account;

            // ⚠️ DO NOT MODIFY: THREE-TOKEN SEQUENCE IS CRITICAL
            // Tokens MUST be acquired in this exact order:
            // 1. Graph token FIRST (for user profile)
            // 2. USDM API token SECOND (for backend)
            // 3. PowerBI token THIRD (for DAX queries)
            // Changing this order or combining scopes causes authentication failures
            // Each service requires its own specific token!

            // STEP 1: Get Graph token - DO NOT CHANGE ORDER
            try {
              const graphRes = await pca.acquireTokenSilent({
                account: result.account,
                scopes: ['User.Read']
              });
              graphToken = graphRes.accessToken;
              console.error('✅ Graph token acquired');
            } catch (e) {
              console.error('Graph token error:', e.message);
            }

            // STEP 2: Get USDM API token - DO NOT CHANGE ORDER
            try {
              const usdmRes = await pca.acquireTokenSilent({
                account: result.account,
                scopes: ['api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation']
              });
              apiToken = usdmRes.accessToken;
              console.error('✅ USDM API token acquired');
            } catch (e) {
              console.error('USDM token error:', e.message);
            }

            // STEP 3: Get PowerBI token - CRITICAL: Use .default scope
            // MUST use .default scope for PowerBI - individual scopes don't work!
            try {
              const pbRes = await pca.acquireTokenSilent({
                account: result.account,
                scopes: ['https://analysis.windows.net/powerbi/api/.default']
              });
              powerbiToken = pbRes.accessToken;
              console.error('✅ PowerBI token acquired');
            } catch (e) {
              console.error('PowerBI token error (expected for users without license):', e.message);
            }

            authenticationComplete = true;
          }
        }).catch(error => {
          console.error('❌ Auth failed:', error.message);
          pendingAuth.complete = true;
          pendingAuth.error = error.message;
        });

        // V26.6 FIX: Return actual device code
        return {
          content: [{
            type: 'text',
            text: `**🔐 Authentication Started**

**Device Code:** ${pendingAuth.deviceCode}

**Steps:**
1. Go to: ${pendingAuth.verificationUri}
2. Enter code: **${pendingAuth.deviceCode}**
3. Sign in with your Microsoft account
4. Run \`check_login\` to verify

Code expires in 15 minutes.`
          }]
        };
      }

      if (name === 'check_login') {
        if (!pendingAuth) {
          return {
            content: [{
              type: 'text',
              text: '❌ No authentication in progress. Run "start_login" first.'
            }]
          };
        }

        if (pendingAuth.error) {
          return {
            content: [{
              type: 'text',
              text: `❌ Authentication failed: ${pendingAuth.error}`
            }]
          };
        }

        if (!pendingAuth.complete) {
          return {
            content: [{
              type: 'text',
              text: `⏳ Authentication still in progress...

Device Code: **${pendingAuth.deviceCode}**
URL: ${pendingAuth.verificationUri}

Please complete the sign-in process and try again.`
            }]
          };
        }

        // V22 pattern: Show detailed status
        const status = {
          username: cachedAccount?.username || 'Unknown',
          graph: !!graphToken,
          usdm: !!apiToken,
          powerbi: !!powerbiToken
        };

        pendingAuth = null;  // Clear pending auth

        return {
          content: [{
            type: 'text',
            text: `✅ **Authentication Complete!**

Signed in as: ${status.username}

Token Status:
- Microsoft Graph: ${status.graph ? '✅ Ready' : '❌ Failed'}
- USDM API: ${status.usdm ? '✅ Ready' : '❌ Failed'}
- PowerBI: ${status.powerbi ? '✅ Ready' : '❌ Failed'}

You can now use all analytics tools.`
          }]
        };
      }

      if (name === 'auth_status') {
        return {
          content: [{
            type: 'text',
            text: `**🔐 Auth Status**
• PowerBI Token: ${powerbiToken ? '✅' : '❌'}
• Graph Token: ${graphToken ? '✅' : '❌'}
• API Token: ${apiToken ? '✅' : '❌'}
• Auth Complete: ${authenticationComplete ? '✅' : '❌'}`
          }]
        };
      }

      // V26.6 OPTIMIZED person_resolver
      if (name === 'person_resolver') {
        const { search_term, fuzzy = true } = args;
        if (!search_term) {
          return {
            content: [{ type: 'text', text: '❌ search_term is required' }],
            isError: true
          };
        }

        // Check cache
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

        // PERFORMANCE PATTERN: Always use CALCULATETABLE over FILTER
        // ✅ FAST: CALCULATETABLE (200-400ms average)
        // ❌ SLOW: FILTER (1000-2000ms average)
        // 5x performance difference discovered in v26.6 optimization
        // This pattern applies to ALL person lookups and data filtering
        // V26.6: Use CALCULATETABLE for exact match (5x faster than FILTER)
        let query = `EVALUATE
CALCULATETABLE(
  'DIM_Team_Member',
  'DIM_Team_Member'[Team Member Name] = "${search_term}"
)`;

        let result = await withDaxLimit(
          `person_exact_${search_term}`,
          () => runDax(query)
        );

        let data = result.data || [];

        // If no exact match and fuzzy enabled, try partial match with SEARCH function
        if (data.length === 0 && fuzzy) {
          query = `EVALUATE
FILTER(
  'DIM_Team_Member',
  SEARCH("${search_term}", 'DIM_Team_Member'[Team Member Name], 1, 0) > 0
)`;

          result = await withDaxLimit(
            `person_fuzzy_${search_term}`,
            () => runDax(query)
          );

          data = result.data || [];
        }

        // V26.6: Fuzzy scoring for better matches
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
      }

      // V26.6 Enhanced activity_for_person_month with caching
      if (name === 'activity_for_person_month') {
        const { person_name, year, month } = args;
        if (!person_name || !year || !month) {
          return {
            content: [{ type: 'text', text: '❌ person_name, year, and month are required' }],
            isError: true
          };
        }

        // Check cache
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

        // SAFETY PATTERN: Always use COALESCE for financial fields
        // PowerBI returns nulls for missing values which break calculations
        // ✅ SAFE: COALESCE('labor'[personal_revenue], 0)
        // ❌ UNSAFE: 'labor'[personal_revenue] - nulls cause errors
        // This prevents NaN and null propagation in financial metrics
        // V26.6: COALESCE for null handling
        const query = `EVALUATE
SUMMARIZECOLUMNS(
  'labor'[week_end_date],
  'labor'[milestone_name],
  TREATAS({("${person_name}")}, 'DIM_Team_Member'[Team Member Name]),
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

        const result = await withDaxLimit(
          `activity_${cacheKey}`,
          () => runDax(query)
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
      }

      // V26.6 Enhanced person_revenue_analysis
      if (name === 'person_revenue_analysis') {
        const { person_name, start_date, end_date } = args;
        const [startYear, startMonth, startDay] = start_date.split('-').map(Number);
        const [endYear, endMonth, endDay] = end_date.split('-').map(Number);

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

        // SAFETY PATTERN: COALESCE prevents null errors in aggregations
        // Financial fields (revenue, cost, margin) often have nulls
        // Without COALESCE, SUM returns null if any value is null
        // V26.6: Enhanced with COALESCE and account names
        const query = `EVALUATE
TOPN(10,
  SUMMARIZECOLUMNS(
    'DIM_Project_Min'[Project Name],
    'DIM_Account_Min'[Account Name],
    'DIM_Project_Min'[Project Type],
    TREATAS({("${person_name}")}, 'DIM_Team_Member'[Team Member Name]),
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

        const result = await withDaxLimit(
          `revenue_${cacheKey}`,
          () => runDax(query)
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
      }

      // V26.6 Cache management tools
      if (name === 'get_cache_stats') {
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

      if (name === 'clear_cache') {
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

      // V26.7: Get detailed timecard entries with notes
      if (name === 'get_timecard_details') {
        const { person_name, start_date, end_date, include_empty_notes = false } = args;

        // DATE FORMAT: PowerBI requires DATE(Y,M,D) function
        // ✅ CORRECT: DATE(2025, 8, 1)
        // ❌ WRONG: DATE("2025-08-01") or "2025-08-01" as string
        // Parse YYYY-MM-DD format and convert to DATE(Y,M,D) for DAX
        // Parse dates
        const [startY, startM, startD] = start_date.split('-').map(Number);
        const [endY, endM, endD] = end_date.split('-').map(Number);

        // CRITICAL DAX PATTERN: MUST use RELATED for dimension joins
        // ✅ WORKING: RELATED('DIM_Team_Member'[Team Member Name])
        // ❌ BROKEN: Direct reference like 'labor'[Team Member Name] - this field doesn't exist!
        // Performance: ADDCOLUMNS with FILTER is optimized for this use case
        // Names are in dimension tables, NOT the labor fact table
        // Build comprehensive DAX query to get timecard details with notes
        const query = `EVALUATE
SELECTCOLUMNS(
  FILTER(
    ADDCOLUMNS(
      'labor',
      "PersonName", RELATED('DIM_Team_Member'[Team Member Name]),  // DO NOT REMOVE RELATED!
      "ProjectName", RELATED('DIM_Project_Min'[Project Name]),     // DO NOT REMOVE RELATED!
      "ClientName", RELATED('DIM_Account_Min'[Account Name]),      // DO NOT REMOVE RELATED!
      "MilestoneName", RELATED('DIM_Milestone'[Milestone Name])    // DO NOT REMOVE RELATED!
    ),
    [PersonName] = "${person_name}" &&
    'labor'[date] >= DATE(${startY}, ${startM}, ${startD}) &&
    'labor'[date] <= DATE(${endY}, ${endM}, ${endD})${include_empty_notes ? '' : ' &&\n    \'labor\'[timecard_notes] <> BLANK()'}
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

        try {
          const result = await withDaxLimit(
            `timecard_details_${person_name}_${start_date}_${end_date}`,
            () => runDax(query)
          );

          const data = result.data || [];

          // Format the output
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

          // Categorize activities (simple keyword-based for now)
          const categorizeWork = (notes) => {
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
          };

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

      // Validate dataset schema
      if (name === 'validate_dataset') {
        const {
          strict_mode = false,
          validate_measures = true,
          validate_relationships = true,
          check_row_counts = true
        } = args;

        if (!powerbiToken) {
          return {
            content: [{ type: 'text', text: '❌ Not authenticated. Please run start_login first.' }],
            isError: true
          };
        }

        try {
          const validationResults = {
            timestamp: new Date().toISOString(),
            dataset: { id: DATASET_ID, workspace: WORKSPACE_ID },
            status: 'valid',
            issues: [],
            warnings: [],
            summary: {}
          };

          // Step 1: Validate core tables exist (verified from SEMANTIC_MODEL.md)
          const expectedTables = [
            'labor', 'DIM_Team_Member', 'DIM_Project_Min', 'DIM_Date',
            'DIM_Milestone', 'DIM_Account_Min', 'DIM_Product_Min',
            'DIM_Sales_Team_Member', 'DIM_Opportunity_Min'
          ];

          for (const table of expectedTables) {
            try {
              const query = `EVALUATE ROW("TableExists", COUNTROWS('${table}') >= 0)`;
              await runDax(query);
              validationResults.summary[table] = 'exists';
            } catch (error) {
              validationResults.issues.push(`Table missing: ${table}`);
              validationResults.status = strict_mode ? 'invalid' : 'warning';
            }
          }

          // Step 2: Check row counts if requested
          if (check_row_counts) {
            try {
              const countQuery = `EVALUATE ROW("LaborRows", COUNTROWS('labor'))`;
              const result = await runDax(countQuery);
              const rowCount = result.data?.[0]?.['[LaborRows]'] || 0;

              validationResults.summary.laborRowCount = rowCount;

              if (rowCount < 3000000) {
                validationResults.warnings.push(`Labor table has ${rowCount.toLocaleString()} rows, expected 3M+`);
              }
            } catch (error) {
              validationResults.warnings.push('Could not verify row count');
            }
          }

          // Step 3: Validate critical columns
          const criticalColumns = {
            'labor': ['hours', 'cost', 'personal_revenue', 'personal_margin', 'date', 'resourceid'],
            'DIM_Team_Member': ['Team Member Name', 'Team_Member_ContactID']
          };

          for (const [table, columns] of Object.entries(criticalColumns)) {
            for (const col of columns) {
              try {
                const query = `EVALUATE ROW("Test", COUNTBLANK('${table}'[${col}]))`;
                await runDax(query);
                validationResults.summary[`${table}.${col}`] = 'valid';
              } catch (error) {
                validationResults.issues.push(`Column missing: ${table}[${col}]`);
                if (strict_mode) validationResults.status = 'invalid';
              }
            }
          }

          // Step 4: Validate relationships if requested
          if (validate_relationships) {
            const criticalRelationships = [
              { from: 'labor[resourceid]', to: 'DIM_Team_Member[Team_Member_ContactID]' },
              { from: 'labor[date]', to: 'DIM_Date[Full_Date]' },
              { from: 'labor[projectid]', to: 'DIM_Project_Min[ProjectId]' }
            ];

            for (const rel of criticalRelationships) {
              try {
                // Test relationship with RELATED function
                const [fromTable, fromCol] = rel.from.split('[').map(s => s.replace(']', ''));
                const [toTable, toCol] = rel.to.split('[').map(s => s.replace(']', ''));

                const testQuery = `EVALUATE
                  TOPN(1,
                    FILTER('${fromTable}', NOT(ISBLANK(RELATED('${toTable}'[${toCol}]))))
                  )`;

                await runDax(testQuery);
                validationResults.summary[`rel_${rel.from}_${rel.to}`] = 'active';
              } catch (error) {
                validationResults.warnings.push(`Relationship issue: ${rel.from} → ${rel.to}`);
              }
            }
          }

          // Step 5: Validate measures if requested
          if (validate_measures) {
            const coreMeasures = [
              'AC Hours', 'AC Labor', 'AC Hours (Billable)',
              'Revenue Value from Milestone Based Projects with no Hourly Rate'
            ];

            for (const measure of coreMeasures) {
              try {
                const query = `EVALUATE ROW("MeasureTest", [${measure}])`;
                await runDax(query);
                validationResults.summary[`measure_${measure}`] = 'valid';
              } catch (error) {
                validationResults.warnings.push(`Measure not found: ${measure}`);
              }
            }
          }

          // Format output
          let output = `## 🔍 Dataset Validation Report\n\n`;
          output += `**Dataset:** ${DATASET_ID}\n`;
          output += `**Workspace:** ${WORKSPACE_ID}\n`;
          output += `**Status:** ${validationResults.status === 'valid' ? '✅ VALID' :
                      validationResults.status === 'warning' ? '⚠️ VALID WITH WARNINGS' : '❌ INVALID'}\n`;
          output += `**Timestamp:** ${validationResults.timestamp}\n\n`;

          if (validationResults.summary.laborRowCount) {
            output += `### Data Volume\n`;
            output += `• Labor table rows: **${validationResults.summary.laborRowCount.toLocaleString()}**\n\n`;
          }

          if (validationResults.issues.length > 0) {
            output += `### ❌ Issues\n`;
            validationResults.issues.forEach(issue => {
              output += `• ${issue}\n`;
            });
            output += '\n';
          }

          if (validationResults.warnings.length > 0) {
            output += `### ⚠️ Warnings\n`;
            validationResults.warnings.forEach(warning => {
              output += `• ${warning}\n`;
            });
            output += '\n';
          }

          output += `### ✅ Validated Components\n`;
          output += `• Tables: ${expectedTables.filter(t => validationResults.summary[t] === 'exists').length}/${expectedTables.length}\n`;
          output += `• Critical columns: ${Object.keys(validationResults.summary).filter(k => k.includes('.') && validationResults.summary[k] === 'valid').length}\n`;
          if (validate_relationships) {
            output += `• Relationships tested: ${Object.keys(validationResults.summary).filter(k => k.startsWith('rel_')).length}\n`;
          }
          if (validate_measures) {
            output += `• Measures validated: ${Object.keys(validationResults.summary).filter(k => k.startsWith('measure_')).length}\n`;
          }

          return {
            content: [{ type: 'text', text: output }]
          };

        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ Validation failed: ${error.message}`
            }],
            isError: true
          };
        }
      }

      // Development DAX testing tool
      if (name === 'dev_test_dax') {
        const { query, show_raw = false } = args;

        if (!powerbiToken) {
          return {
            content: [{ type: 'text', text: '❌ Not authenticated. Please run start_login first.' }],
            isError: true
          };
        }

        try {
          const startTime = Date.now();
          const result = await runDax(query);
          const executionTime = Date.now() - startTime;

          let output = `## 🧪 DAX Query Test Results\n\n`;
          output += `**Execution Time:** ${executionTime}ms\n`;
          output += `**Status:** ${result.error ? '❌ ERROR' : '✅ SUCCESS'}\n\n`;

          if (result.error) {
            output += `### Error Details\n`;
            output += `\`\`\`\n${result.error}\n\`\`\`\n\n`;
          }

          if (result.data) {
            output += `### Results (${result.data.length} rows)\n\n`;

            if (show_raw) {
              output += `#### Raw JSON Response:\n`;
              output += `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\n`;
            } else {
              // Format as table
              if (result.data.length > 0) {
                const columns = Object.keys(result.data[0]);

                // Show first 10 rows in readable format
                const displayRows = result.data.slice(0, 10);

                output += `| ${columns.join(' | ')} |\n`;
                output += `| ${columns.map(() => '---').join(' | ')} |\n`;

                displayRows.forEach(row => {
                  const values = columns.map(col => {
                    const val = row[col];
                    if (val === null || val === undefined) return 'NULL';
                    if (typeof val === 'number') return val.toLocaleString();
                    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                    return String(val).substring(0, 50);
                  });
                  output += `| ${values.join(' | ')} |\n`;
                });

                if (result.data.length > 10) {
                  output += `\n*... and ${result.data.length - 10} more rows*\n`;
                }
              }
            }
          }

          output += `\n### Query Executed:\n`;
          output += `\`\`\`dax\n${query}\n\`\`\``;

          return {
            content: [{ type: 'text', text: output }]
          };

        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ DAX test failed: ${error.message}\n\nQuery:\n\`\`\`dax\n${query}\n\`\`\``
            }],
            isError: true
          };
        }
      }

      // Generic DAX execution
      if (name === 'run_dax') {
        const { query } = args;
        const result = await withDaxLimit(
          query.substring(0, 50),
          () => runDax(query)
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error: ${error.message}`
        }],
        isError: true
      };
    }
  });

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server v26.6 OPTIMIZED started');
}

main().catch(console.error);