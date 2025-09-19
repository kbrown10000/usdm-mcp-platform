# 🧪 MCP-PLATFORM v28.0 Comprehensive Testing Plan

## Executive Summary
**Goal**: Validate 100% functionality of v28.0 architecture
**Approach**: Systematic testing with automated verification
**Documentation**: Real-time updates for any issues found

---

## 📋 Test Categories

### 1. Local Sales MCPB Testing
### 2. Authentication & Token Caching
### 3. Workspace Isolation
### 4. DAX Query Execution
### 5. Railway Deployment
### 6. CI/CD Validation
### 7. Error Scenarios
### 8. Performance Benchmarks

---

## 🔬 Detailed Test Procedures

### Test Suite 1: Sales MCPB Installation & Basic Function
```bash
# 1.1 Install MCPB in Claude Desktop
Location: usdm-sales-v28.0.0-final.mcpb

# 1.2 Verify tools registration
Expected: 26 tools (6 auth + 20 sales)

# 1.3 Test basic connectivity
Tool: get_auth_status
Expected: Shows unauthenticated state

# 1.4 Check logs
Location: STDERR output
Expected: No STDOUT pollution
```

### Test Suite 2: Authentication Flow
```bash
# 2.1 Start login
Tool: start_login
Expected: Device code displayed (e.g., ABCD1234)
Verify: Code appears within 20 seconds

# 2.2 Complete authentication
Steps:
1. Navigate to https://microsoft.com/devicelogin
2. Enter device code
3. Sign in with Microsoft account

# 2.3 Check login status
Tool: check_login
Expected: Shows authenticated with 3 tokens

# 2.4 Verify token types
Tool: whoami
Expected:
- Graph: ✅
- USDM: ✅
- PowerBI: ✅ (or ❌ if no license)

# 2.5 Test token caching
Steps:
1. Note time of authentication
2. Restart Claude Desktop
3. Run start_login again
Expected: "Authenticated from cache (XX min remaining)"
```

### Test Suite 3: Workspace Isolation
```bash
# 3.1 Verify correct workspace
Tool: get_data_source_info
Expected:
- datasetId: ef5c8f43-19c5-44d4-b57e-71b788933b88 (Sales)
- workspaceId: 927b94af-e7ef-4b5a-8b8d-02b0c5450b75
- isSalesDataset: true
- isLaborDataset: false

# 3.2 Test cross-domain protection
Test: Try to query with Labor dataset ID
Expected: Error - "Refusing to run Sales tool against LABOR datasetId"

# 3.3 Verify environment variables
Check logs for:
- SALES_WORKSPACE_ID set correctly
- No POWERBI_WORKSPACE_ID usage
```

### Test Suite 4: DAX Query Execution
```bash
# 4.1 Test basic Sales query
Tool: get_pipeline_summary
Expected: Returns opportunity stages data

# 4.2 Verify DAX with dev-tools
cd C:\DevOpps\MCP-PLATFORM\dev-tools\powerbi-discovery
node test-sales-dax-queries.mjs

Expected outputs:
- DIM_Opportunity table found
- Fact_Opportunity table found
- Pipeline data returned

# 4.3 Test complex queries
Tool: get_executive_dashboard
Expected: Comprehensive metrics returned

# 4.4 Check query logs
Verify in STDERR:
[SalesMCP] get_pipeline_summary dataset=ef5c8f43…3b88 ws=927b94af…0b75
```

### Test Suite 5: Boot-time Validation
```bash
# 5.1 Test with correct dataset
Start server normally
Expected:
[SALES-MCP] ✅ Schema validation passed

# 5.2 Test with wrong dataset ID
Set SALES_DATASET_ID=ea5298a1-13f0-4629-91ab-14f98163532e (Labor)
Expected:
[SALES-MCP] ❌ FATAL: Schema validation failed
Process exits with code 1

# 5.3 Test with invalid workspace
Set SALES_WORKSPACE_ID=invalid-guid
Expected:
Error connecting to PowerBI
Process exits with code 1
```

### Test Suite 6: Railway Deployment
```bash
# 6.1 Deploy to Railway
cd C:\DevOpps\MCP-PLATFORM
git add .
git commit -m "v28.0 deployment test"
git push origin main

# 6.2 Check Railway logs
railway logs --service=mcp-platform

Expected:
- No startup errors
- Schema validation passed
- Server listening

# 6.3 Test Railway endpoints
curl https://usdm-mcp-platform-production.up.railway.app/health

Expected: {"status":"healthy","version":"28.0.0"}

# 6.4 Test with wrong credentials
Remove SALES_DATASET_ID from Railway
Expected: Service fails to start
```

### Test Suite 7: CI/CD Validation
```bash
# 7.1 Run architecture validation
bash scripts/ci/validate-architecture.sh

Expected:
✅ All architecture guards passed!
Exit code: 0

# 7.2 Run smoke tests
node scripts/test/smoke-test-sales.mjs

Expected:
✅ All tests passed (X/X)
Exit code: 0

# 7.3 Check for regressions
bash scripts/check-sales-guards.sh

Expected:
✅ All Sales routing guards in place!
```

### Test Suite 8: Error Scenarios
```bash
# 8.1 Test network failure
Disconnect network, run query
Expected: Graceful error message

# 8.2 Test token expiry
Wait 1+ hour, run query
Expected: Auto-refresh or re-auth prompt

# 8.3 Test invalid DAX
Manually craft bad DAX query
Expected: PowerBI error with suggestions

# 8.4 Test rate limiting
Run 10 queries rapidly
Expected: Throttling kicks in, no 429 errors
```

### Test Suite 9: Performance Benchmarks
```bash
# 9.1 Cold start time
Measure: Time from server start to ready
Target: <3 seconds

# 9.2 Cached auth time
Measure: Time to authenticate from cache
Target: <100ms

# 9.3 Query response time
Measure: Simple DAX query execution
Target: <2 seconds

# 9.4 Memory usage
Measure: Server memory footprint
Target: <200MB
```

---

## 🔍 Log Analysis Checklist

### Check for these patterns in logs:

#### ✅ Good Patterns
```
[SALES-MCP] ✅ Schema validation passed
[SalesMCP] Preflight validation complete
✅ Authenticated from cache
[SalesMCP] get_pipeline_summary dataset=ef5c8f43…3b88
```

#### ❌ Bad Patterns
```
STDOUT pollution (any non-JSON output to STDOUT)
[executeDax] WARNING: Deprecated function
Cross-domain query attempted
PowerBI token expired
Failed to get device code after 20 seconds
```

---

## 🐛 Issue Resolution Process

### If Test Fails:
1. **Document the issue** in TESTING_ISSUES.md
2. **Identify root cause** using logs
3. **Implement fix** in appropriate module
4. **Update documentation** to reflect change
5. **Re-run test suite** to verify fix
6. **Update ARCHITECTURE_V28_COMPLETE.md** if needed

### Common Issues & Fixes:

#### Issue: Authentication fails
```bash
# Fix 1: Check MSAL configuration
- Verify TENANT_ID and CLIENT_ID
- Check camelCase fields (userCode, not user_code)

# Fix 2: Clear token cache
rm -rf .cache/msal
```

#### Issue: Wrong dataset targeted
```bash
# Fix 1: Check environment variables
- Ensure SALES_DATASET_ID is set
- Verify no POWERBI_DATASET_ID fallback

# Fix 2: Check preflight validation
- Verify assertSalesDataset runs at boot
```

#### Issue: Railway deployment fails
```bash
# Fix 1: Check environment variables
railway variables

# Fix 2: Check build logs
railway logs --build

# Fix 3: Verify package.json scripts
```

---

## 📊 Test Execution Tracker

| Test Suite | Status | Issues Found | Resolution |
|------------|--------|--------------|------------|
| 1. MCPB Installation | ⏳ | - | - |
| 2. Authentication | ⏳ | - | - |
| 3. Workspace Isolation | ⏳ | - | - |
| 4. DAX Queries | ⏳ | - | - |
| 5. Boot Validation | ⏳ | - | - |
| 6. Railway Deploy | ⏳ | - | - |
| 7. CI/CD | ⏳ | - | - |
| 8. Error Scenarios | ⏳ | - | - |
| 9. Performance | ⏳ | - | - |

---

## 🎯 Success Criteria

### All tests pass when:
1. ✅ Authentication works with token caching
2. ✅ Workspace isolation prevents cross-domain queries
3. ✅ Boot validation exits on bad schema
4. ✅ DAX queries return correct Sales data
5. ✅ Railway deployment successful
6. ✅ CI validation shows 100% compliance
7. ✅ No regression from v26.7 behavior
8. ✅ Performance meets targets

---

## 📝 Test Commands Reference

```bash
# Quick validation
npm test

# Full test suite
./scripts/run-all-tests.sh

# Railway deployment
railway up

# Check logs
railway logs -n 100

# Dev tools testing
cd dev-tools/powerbi-discovery
node test-sales-dax-queries.mjs

# CI validation
bash scripts/ci/validate-architecture.sh
```

---

## 🔄 Continuous Testing

### After each change:
1. Run relevant test suite
2. Check logs for errors
3. Validate no regressions
4. Update documentation

### Before deployment:
1. Run full test suite
2. Check all logs clean
3. Verify CI passes
4. Document version

---

*Test Plan Version: 1.0*
*Created: 2025-09-19*
*Target: v28.0.0*