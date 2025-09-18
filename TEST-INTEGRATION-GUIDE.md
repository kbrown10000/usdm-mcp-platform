# V27.0 Integration Testing Guide

## Overview

This guide covers the comprehensive integration testing suite for the V27.0 Multi-MCP Platform. The tests verify:

- ✅ Railway server startup and health
- ✅ Authentication flow (device code → tokens)
- ✅ PowerBI connection and data access
- ✅ Critical tools functionality
- ✅ Performance benchmarks

## Test Files

| File | Purpose | Type |
|------|---------|------|
| `test-integration.js` | Core automated tests | Automated |
| `test-integration-manual.js` | Auth flow with user interaction | Manual |
| `test-railway.js` | Railway deployment tests | Automated |

## Quick Start

### 1. Prerequisites

```bash
# Install dependencies
npm install

# Ensure Railway server can start
npm run start:test
```

### 2. Run Automated Tests

```bash
# Full integration test suite
npm run test:integration

# All tests (unit + integration)
npm run test:all

# Railway-specific tests (requires deployed service)
RAILWAY_URL=https://your-app.railway.app node test-railway.js
```

### 3. Run Manual Tests (Optional)

```bash
# Interactive authentication testing
npm run test:integration:manual
```

## Test Scenarios

### Automated Tests (`test-integration.js`)

#### ✅ Server Infrastructure
- **Server Startup**: Verifies Railway server starts correctly
- **Health Endpoint**: Tests `/health` returns proper status
- **Discovery Endpoint**: Validates `/mcp/discover` tool listing
- **Performance**: Cold start under 3 seconds, health checks under 500ms

#### ✅ Authentication Endpoints
- **start_login**: Device code flow initiation endpoint
- **check_login**: Authentication status checking endpoint
- **whoami**: User profile retrieval endpoint

#### ✅ Tool Endpoints
- **person_resolver**: Person search functionality
- **get_timecard_details**: Timecard analysis tool
- **run_dax**: DAX query execution
- **get_cache_stats**: Cache system monitoring

#### ✅ Error Handling
- **404 Handling**: Non-existent endpoints return proper errors
- **Invalid Requests**: Malformed tool requests handled gracefully

### Manual Tests (`test-integration-manual.js`)

#### 🔐 Full Authentication Flow
1. **Device Code Display**: Shows Microsoft device code for user
2. **User Authentication**: Waits for user to authenticate in browser
3. **Token Validation**: Verifies all three tokens acquired (Graph, USDM, PowerBI)
4. **Profile Retrieval**: Confirms user profile accessible

#### 📊 PowerBI Data Validation
1. **Row Count**: Confirms dataset contains 3,238,644 rows (V26.7 baseline)
2. **Table Access**: Verifies critical tables accessible (`labor`, `DIM_Team_Member`, etc.)
3. **Query Performance**: DAX queries execute under 5 seconds

#### 🔍 Tool Functionality
1. **Person Search**: Tests fuzzy and exact person resolution
2. **Timecard Analysis**: Validates timecard detail extraction
3. **Cache System**: Confirms cache statistics and operation

### Railway Tests (`test-railway.js`)

#### 🚂 Deployment Validation
- **Service Health**: Deployed Railway service responds correctly
- **SSL/HTTPS**: Certificate and redirect validation
- **Auto-Scaling**: Load testing with concurrent requests
- **Performance**: Cold start and warm response benchmarks

## Running Tests Locally

### Environment Setup

```bash
# Create test environment file
cp .env.template .env.test

# Set required variables
export PORT=3000
export NODE_ENV=test
```

### Run Complete Test Suite

```bash
# 1. Start server in background
npm run start:test &
SERVER_PID=$!

# 2. Wait for startup
sleep 5

# 3. Run automated tests
npm run test:integration

# 4. Cleanup
kill $SERVER_PID
```

### Windows PowerShell

```powershell
# 1. Start server
Start-Process -FilePath "npm" -ArgumentList "run", "start:test" -PassThru
$serverProcess = Get-Process npm | Sort-Object StartTime -Descending | Select-Object -First 1

# 2. Wait and test
Start-Sleep -Seconds 5
npm run test:integration

# 3. Cleanup
Stop-Process -Id $serverProcess.Id -Force
```

## Running Tests on Railway

### Prerequisites

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy service
railway up
```

### Railway Integration Tests

```bash
# Get Railway URL
RAILWAY_URL=$(railway domain)

# Run Railway-specific tests
RAILWAY_URL=$RAILWAY_URL node test-railway.js

# Or use direct URL
RAILWAY_URL=https://your-app.railway.app node test-railway.js
```

### Railway Environment Variables

Ensure these are set in Railway dashboard:

```
AZURE_TENANT_ID=18c250cf-2ef7-4eeb-b6fb-94660f7867e0
AZURE_CLIENT_ID=8b84dc3b-a9ff-43ed-9d35-571f757e9c19
POWERBI_WORKSPACE_ID=927b94af-e7ef-4b5a-8b8d-02b0c5450b75
POWERBI_DATASET_ID=ea5298a1-13f0-4629-91ab-14f98163532e
NODE_ENV=production
```

## Test Output Examples

### ✅ Successful Test Run

```
🚀 Starting V27.0 Platform Integration Tests
✅ [2025-01-XX] PASS: Server cold start under 3000ms (actual: 2847ms)
✅ [2025-01-XX] PASS: Health endpoint returns 200
✅ [2025-01-XX] PASS: Health status is healthy
✅ [2025-01-XX] PASS: Version is 27.0
✅ [2025-01-XX] PASS: Critical tool 'start_login' is listed
✅ [2025-01-XX] PASS: Critical tool 'person_resolver' is listed

=== Test Results ===
Total tests: 24
Passed: 24
Failed: 0
Pass rate: 100.0%
Total time: 15432ms

✅ Integration tests PASSED
```

### ❌ Failed Test Run

```
🚀 Starting V27.0 Platform Integration Tests
❌ [2025-01-XX] FAIL: Server startup timeout
❌ [2025-01-XX] FAIL: Health check failed: connect ECONNREFUSED

=== Test Results ===
Total tests: 8
Passed: 0
Failed: 8
Pass rate: 0.0%

=== Failures ===
1. Server startup timeout
2. Health check failed: connect ECONNREFUSED

❌ Integration tests FAILED
```

## Performance Benchmarks

Based on V26.7 baseline measurements:

| Metric | Target | V27.0 Goal | Test |
|--------|--------|------------|------|
| Cold Start | <3.0s | <2.8s | Server startup |
| Health Check | <500ms | <300ms | `/health` endpoint |
| Person Lookup | <1.0s | <600ms | `person_resolver` |
| DAX Query | <5.0s | <3.0s | `run_dax` |
| Cache Hit Rate | >70% | >80% | Cache statistics |

## Troubleshooting

### Common Issues

#### 1. Server Won't Start
```bash
# Check port availability
netstat -an | grep :3000

# Check Node.js version
node --version  # Should be >=18.0.0

# Check dependencies
npm install
```

#### 2. Authentication Tests Fail
```bash
# Verify Azure app registration
az ad app show --id 8b84dc3b-a9ff-43ed-9d35-571f757e9c19

# Check environment variables
echo $AZURE_TENANT_ID
echo $AZURE_CLIENT_ID
```

#### 3. PowerBI Connection Issues
```bash
# Verify workspace access
# Check PowerBI workspace: 927b94af-e7ef-4b5a-8b8d-02b0c5450b75
# Check dataset: ea5298a1-13f0-4629-91ab-14f98163532e
```

#### 4. Railway Deployment Issues
```bash
# Check Railway logs
railway logs

# Verify environment variables
railway variables

# Test Railway URL directly
curl https://your-app.railway.app/health
```

### Test Debugging

#### Enable Verbose Logging
```bash
DEBUG=* npm run test:integration
```

#### Run Individual Test Sections
```javascript
// Modify test-integration.js to skip tests
// Comment out test functions you don't want to run

// await testServerStartup();
// await testHealthEndpoint();
await testAuthenticationFlow();  // Run only auth tests
```

#### Manual Railway Testing
```bash
# Test specific endpoints
curl -X GET https://your-app.railway.app/health
curl -X GET https://your-app.railway.app/mcp/discover
curl -X POST https://your-app.railway.app/api/tools/start_login
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: V27.0 Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run integration tests
        run: npm run test:integration
        env:
          NODE_ENV: test
          PORT: 3000

      - name: Upload test report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: integration-test-report
          path: test-integration-report.json
```

### Railway Deploy Hook

```bash
# Add to railway.json
{
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "on_failure"
  }
}
```

## Test Maintenance

### Adding New Tests

1. **Add test function** to appropriate test file
2. **Update test runner** to include new test
3. **Document test** in this guide
4. **Update benchmarks** if performance-related

### Updating Baselines

When migrating from V26.7 to V27.0:

1. **Run V26.7 baseline** to capture current metrics
2. **Migrate components** one by one
3. **Compare test results** after each migration
4. **Update test expectations** only if improvements verified

### Test Data Management

- **Person Test Data**: Use "Hussam Kazi" for consistency with V26.7
- **Date Ranges**: Use August 2024 for reproducible results
- **Row Counts**: Expect 3,238,644 rows in labor dataset
- **Performance**: Compare against V26.7 baseline measurements

## Success Criteria

The V27.0 platform integration tests **PASS** when:

```javascript
✅ All automated tests pass (0 failures)
✅ Server starts under 3 seconds
✅ Health check responds under 500ms
✅ All critical tools endpoints respond
✅ Railway deployment is healthy
✅ No performance regressions vs V26.7
```

The platform is **READY FOR PRODUCTION** when:

```javascript
✅ Integration tests pass
✅ Manual authentication flow works
✅ PowerBI data validation passes
✅ All 43 tools from V26.7 migrated and tested
✅ Performance within 5% of V26.7 baseline
```

---

**Next Steps**: After integration tests pass, proceed with:
1. Authentication migration (Phase 2)
2. PowerBI connector migration (Phase 3)
3. Tool-by-tool migration (Phase 4-5)
4. Full V26.7 compatibility validation