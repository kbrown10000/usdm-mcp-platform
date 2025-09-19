# V26.7 Labor Tools Module

This module contains the **11 critical tools** extracted from the V26.7 golden source (`railway-proxy-v26.7-timecard-analysis.mjs`). These tools preserve the exact authentication patterns, query optimizations, and business logic that make V26.7 a production-ready solution.

## 🔒 Critical Tools Extracted

### Authentication Tools (5)

1. **`start_login`** - Device code authentication initiation
   - **Source**: Lines 337-468
   - **Critical**: Preserves camelCase field handling (`response.userCode`)
   - **Pattern**: Three-token sequence (Graph → USDM API → PowerBI)

2. **`check_login`** - Authentication status verification
   - **Source**: Lines 470-528
   - **Critical**: Shows detailed token status and clears pending auth

3. **`whoami`** - User profile from Graph API
   - **Critical**: Uses Graph token for Microsoft 365 user data

4. **`get_auth_status`** - Detailed authentication status
   - **Source**: Lines 530-541
   - **Critical**: Token availability without exposing sensitive data

5. **`refresh_tokens`** - Token refresh functionality
   - **Critical**: Refreshes all three tokens using cached MSAL account

### Analytics Tools (6)

6. **`person_resolver`** - Optimized fuzzy person search
   - **Source**: Lines 544-633
   - **Critical**: Uses CALCULATETABLE (5x faster than FILTER)
   - **Pattern**: Exact match first, then fuzzy with scoring

7. **`activity_for_person_month`** - Monthly activity with caching
   - **Source**: Lines 636-719
   - **Critical**: COALESCE for null safety, TREATAS for filtering
   - **Cache**: 1-hour TTL for monthly summaries

8. **`person_revenue_analysis`** - Enhanced revenue analysis
   - **Source**: Lines 722-805
   - **Critical**: TOPN for performance, account names included
   - **Cache**: 15-minute TTL for financial metrics

9. **`person_utilization`** - Utilization metrics calculation
   - **Pattern**: Derived from V26.7 revenue analysis patterns
   - **Features**: Weekly breakdown, utilization rating, billable percentage

10. **`get_timecard_details`** - V26.7 timecard analysis with categorization
    - **Source**: Lines 873-1047
    - **Critical**: RELATED() for all dimension joins
    - **Features**: Activity categorization, client extraction, financial metrics

11. **`run_dax`** - Direct DAX query execution
    - **Source**: Lines 1306-1319
    - **Critical**: Rate limiting with PowerBI token validation

## 🏗️ Architecture

### Module Structure
```
src/core/tools/
├── labor-tools.mjs          # Core 11 tools implementation
├── index.mjs                # Tool registry and handler
├── railway-integration-example.mjs  # Express server integration
└── README.md                # This documentation
```

### Dependencies
- **Authentication**: `../auth/msal-auth.mjs`
- **PowerBI**: `../powerbi/connector.mjs`
- **DAX Queries**: `../dax/queries.mjs`

### Key Patterns Preserved

#### 1. Multi-Tier Caching Strategy
```javascript
const CACHE_CONFIGS = {
  person_lookup: { ttl: 10 * 60 * 1000 },        // 10 minutes
  monthly_summary: { ttl: 60 * 60 * 1000 },      // 1 hour
  financial_metrics: { ttl: 15 * 60 * 1000 },    // 15 minutes
  query_result: { ttl: 5 * 60 * 1000 }           // 5 minutes (general)
};
```

#### 2. Query Optimization Patterns
- ✅ **CALCULATETABLE**: 5x faster than FILTER for exact matches
- ✅ **COALESCE**: Prevents null propagation in financial calculations
- ✅ **RELATED()**: Required for all dimension table joins
- ✅ **DATE(Y,M,D)**: Only date format PowerBI accepts reliably

#### 3. Authentication Flow
```javascript
// Three-token sequence (CRITICAL ORDER):
1. Graph token (User.Read scope)
2. USDM API token (user_impersonation scope)
3. PowerBI token (.default scope)
```

#### 4. Activity Categorization
- 🤖 **AI/Innovation**: AI, GPT, Claude, ML keywords
- 👥 **Client Engagement**: Client, POC, demo, proposal
- 📊 **Project Management**: Meeting, status, planning
- 📚 **Administration**: Training, documentation, admin

## 🚀 Usage

### Basic Integration
```javascript
import toolsModule from './src/core/tools/index.mjs';

// Get all tool definitions
const tools = toolsModule.getToolDefinitions();

// Execute a tool
const result = await toolsModule.handleToolCall('person_resolver', {
  search_term: 'John Smith',
  fuzzy: true
});
```

### Railway Server Integration
```javascript
import express from 'express';
import toolsModule from './src/core/tools/index.mjs';

const app = express();

// Execute any tool via REST API
app.post('/api/tools/:toolName', async (req, res) => {
  const result = await toolsModule.handleToolCall(
    req.params.toolName,
    req.body
  );
  res.json(result);
});
```

### MCP Server Integration
```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import toolsModule from './src/core/tools/index.mjs';

const server = new Server({ name: 'labor-mcp', version: '26.7.0' });

// Register all tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolsModule.getToolDefinitions()
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return await toolsModule.handleToolCall(
    request.params.name,
    request.params.arguments
  );
});
```

## 🧪 Testing

Run the integration test to verify all tools are properly extracted:

```bash
cd C:\DevOpps\MCP-PLATFORM
node test-tools-integration.mjs
```

Expected output:
```
🎉 All 11 critical V26.7 tools successfully extracted!
✅ Ready for Railway server integration
```

## 📊 Performance Metrics

### Cache Hit Rates (V26.7 Production)
- **Person lookups**: 72% hit rate
- **Monthly summaries**: 68% hit rate
- **Financial metrics**: 45% hit rate

### Query Performance (Optimized)
- **Person resolver**: 200-400ms (was 1000-2000ms)
- **Monthly activity**: 387ms average
- **Revenue analysis**: 450ms average
- **Timecard details**: 2341ms (complex joins)

### PowerBI Limits Respected
- **Max concurrent queries**: 3 (prevents 429 errors)
- **Rate limiting**: 120 requests/minute per user
- **executeQueries limit**: 8/minute (handled by throttling)

## ⚠️ Critical Warnings

### DO NOT MODIFY
1. **Authentication patterns** - Lines 27-469 in golden source
2. **PowerBI IDs** - TENANT_ID, CLIENT_ID, WORKSPACE_ID, DATASET_ID
3. **DAX query structures** - CALCULATETABLE, COALESCE, RELATED patterns
4. **Cache TTL values** - Optimized through V26.6-V26.7 testing
5. **Device code field names** - MUST use camelCase (`userCode`, not `user_code`)

### Expected Data
- **Labor table rows**: 3,238,644 (validation benchmark)
- **Team member names**: In `DIM_Team_Member[Team Member Name]`
- **Financial fields**: May contain nulls (hence COALESCE usage)

### Common Errors
```javascript
// ❌ WRONG - Breaks authentication
response.user_code

// ✅ CORRECT - Works with MSAL
response.userCode

// ❌ WRONG - 5x slower
FILTER(labor, labor[resource] = "Name")

// ✅ CORRECT - Optimized
CALCULATETABLE(labor, RELATED(DIM_Team_Member[Team Member Name]) = "Name")
```

## 🔄 Deployment

### Railway Environment Variables
```env
AZURE_TENANT_ID=18c250cf-2ef7-4eeb-b6fb-94660f7867e0
AZURE_CLIENT_ID=8b84dc3b-a9ff-43ed-9d35-571f757e9c19
POWERBI_WORKSPACE_ID=927b94af-e7ef-4b5a-8b8d-02b0c5450b75
POWERBI_DATASET_ID=ea5298a1-13f0-4629-91ab-14f98163532e
PORT=3000
```

### Health Check
```bash
curl http://your-app.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "v26.7-tools-extraction",
  "availableTools": 13
}
```

## 📝 Changelog

### V26.7 Tools Extraction
- ✅ Extracted all 11 critical tools from golden source
- ✅ Preserved exact authentication patterns
- ✅ Maintained query optimization patterns
- ✅ Integrated multi-tier caching strategy
- ✅ Added activity categorization from timecard analysis
- ✅ ES modules architecture for new platform
- ✅ Railway server integration examples
- ✅ Comprehensive integration testing

## 🆘 Troubleshooting

### "Device code shows undefined"
- **Fix**: Check camelCase usage (`response.userCode`)
- **Source**: V26.7 lines 365-370

### "Queries taking too long"
- **Fix**: Verify CALCULATETABLE usage over FILTER
- **Source**: V26.7 optimization patterns

### "PowerBI 401 errors"
- **Fix**: Run `refresh_tokens` tool
- **Pattern**: Token expiration handling

### "No data for person"
- **Fix**: Use exact name from `person_resolver` first
- **Pattern**: Names are in dimension tables, not labor table

For additional support, reference the V26.7 golden source and critical documentation in `CRITICAL_DOCS_WORKING_STATE/`.