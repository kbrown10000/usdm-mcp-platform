# MCP-PLATFORM Scripts

This directory contains CI validation and testing scripts for the MCP-PLATFORM architecture.

## CI Validation Script

**File**: `scripts/ci/validate-architecture.sh`

### Purpose
Comprehensive validation of MCP-PLATFORM architecture integrity including:
- Domain isolation verification
- Authentication patterns validation
- Workspace ID separation checking
- DAX query architecture validation
- Logging best practices verification
- Security pattern checking

### Usage
```bash
cd /path/to/MCP-PLATFORM
bash scripts/ci/validate-architecture.sh
```

### Exit Codes
- `0` - All validation checks passed
- `1` - One or more validation checks failed

### Validation Categories

1. **Domain Isolation** (4 checks)
   - No cross-domain imports between Sales and Labor
   - No shared global state
   - No direct cross-domain requires

2. **Authentication Architecture** (4 checks)
   - Domains use core-auth (not direct MSAL)
   - camelCase field usage (userCode, not user_code)
   - Three-token architecture presence

3. **Workspace ID Separation** (3 checks)
   - Sales uses ef5c8f43-* workspace/dataset IDs
   - Labor uses 927b94af-* workspace/dataset IDs
   - No shared POWERBI_WORKSPACE_ID environment variable

4. **Boot Validation** (4 checks)
   - Schema validation in server entry points
   - Graceful initialization patterns

5. **DAX Query Architecture** (3 checks)
   - No deprecated executeDax usage
   - executeDaxQuery includes workspace parameter
   - CALCULATETABLE usage instead of FILTER

6. **Logging Best Practices** (2 checks)
   - Minimal STDOUT contamination
   - Proper STDERR usage for errors

7. **Package Structure** (3 checks)
   - MCP server patterns present
   - Environment variable configuration

8. **Performance Patterns** (2 checks)
   - Caching implementations present
   - Rate limiting patterns

9. **Security** (2 checks)
   - No hardcoded secrets
   - Proper token handling

10. **Final Validation** (2 checks)
    - Reasonable TODO/FIXME count
    - Test files present

### Common Issues and Fixes

| Issue | Fix |
|-------|-----|
| Cross-domain imports | Remove imports between domains, use core modules |
| Direct MSAL usage | Use core-auth module instead |
| snake_case auth fields | Use camelCase: userCode, deviceCode |
| Deprecated executeDax | Replace with executeDaxQuery(query, datasetId, workspaceId) |
| STDOUT logging | Use console.error for logging, console.log for data output only |
| Shared workspace IDs | Ensure each domain has separate workspace/dataset IDs |

## Smoke Test Script

**File**: `scripts/test/smoke-test-sales.mjs`

### Purpose
End-to-end smoke testing of Sales domain MCP server including:
- Server startup validation
- MCP protocol compliance
- Tool registration and execution
- Error handling verification
- Environment variable configuration

### Usage
```bash
cd /path/to/MCP-PLATFORM
node scripts/test/smoke-test-sales.mjs
```

### Test Categories

1. **Basic Server Startup**
   - Server starts without errors
   - Expected startup messages logged

2. **MCP Protocol Compliance**
   - Responds to initialize request
   - Returns valid capabilities

3. **Tool Registration**
   - Tools list is available
   - Expected sales tools present (get_pipeline_summary, get_opportunity_forecast, etc.)

4. **Schema Validation**
   - Detects wrong dataset ID configuration
   - Handles validation gracefully

5. **Tool Execution**
   - Basic tool execution works
   - Returns expected response format

6. **Environment Configuration**
   - Reads environment variables correctly
   - Handles custom configuration

### Test Environment

The smoke test uses isolated test environment variables:
- `NODE_ENV=test`
- `SALES_WORKSPACE_ID=ef5c8f43-19c5-44d4-b57e-71b788933b88`
- `SALES_DATASET_ID=ef5c8f43-19c5-44d4-b57e-71b788933b88`
- `RAILWAY_BACKEND_URL=https://test-backend.example.com`

### Expected Outcomes

All tests should pass with proper error handling. The smoke test expects:
- Server starts with "Sales MCP" in logs
- MCP initialize returns capabilities object
- Tools list contains expected sales tools
- Tool execution returns DAX query or error (both acceptable)
- Environment variables are properly read

## Running in CI/CD

These scripts are designed for CI/CD integration:

```yaml
# Example GitHub Actions workflow
- name: Validate Architecture
  run: bash scripts/ci/validate-architecture.sh

- name: Smoke Test Sales Domain
  run: node scripts/test/smoke-test-sales.mjs
```

Both scripts use appropriate exit codes for CI/CD pipeline integration.
