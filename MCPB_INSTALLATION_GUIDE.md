# MCP-PLATFORM v28.0 MCPB Installation & Testing Guide

## Overview
v28.0 provides two completely independent MCPB packages with 100% domain isolation:
- **Labor MCPB**: Analytics for labor/timecard data
- **Sales MCPB**: Analytics for sales/opportunity data

## Package Files

### Labor MCPB
- **File**: `mcpb/labor/usdm-labor-v28.0.mcpb`
- **Size**: 2.4MB (8.4MB unpacked)
- **Tools**: 43 tools (6 auth + 37 labor analytics)
- **Dataset**: Labor timecard data

### Sales MCPB
- **File**: `mcpb/sales/usdm-sales-v28.0.mcpb`
- **Size**: 3.5MB (11.7MB unpacked)
- **Tools**: 26 tools (6 auth + 20 sales analytics)
- **Dataset**: Sales opportunity data

## Installation Instructions

### Installing Labor MCPB

1. **Locate the package**:
   ```
   C:\DevOpps\MCP-PLATFORM\mcpb\labor\usdm-labor-v28.0.mcpb
   ```

2. **Install in Claude Desktop**:
   - Double-click the `.mcpb` file
   - OR: Claude Desktop → Settings → Extensions → Install from file
   - Select `usdm-labor-v28.0.mcpb`

3. **Verify installation**:
   - Open Claude Desktop
   - Check Extensions list for "usdm-labor-mcp v28.0.0"
   - Status should show "Enabled"

### Installing Sales MCPB

1. **Locate the package**:
   ```
   C:\DevOpps\MCP-PLATFORM\mcpb\sales\usdm-sales-v28.0.mcpb
   ```

2. **Install in Claude Desktop**:
   - Double-click the `.mcpb` file
   - OR: Claude Desktop → Settings → Extensions → Install from file
   - Select `usdm-sales-v28.0.mcpb`

3. **Verify installation**:
   - Open Claude Desktop
   - Check Extensions list for "usdm-sales-mcp v28.0.0"
   - Status should show "Enabled"

## Testing Instructions

### Test 1: Labor MCPB Authentication

1. **Start authentication**:
   ```
   Use tool: start_login
   ```
   Expected: Device code displayed (e.g., "ABCD1234")

2. **Complete authentication**:
   - Go to https://microsoft.com/devicelogin
   - Enter the device code
   - Sign in with Microsoft account

3. **Check status**:
   ```
   Use tool: check_login
   ```
   Expected: "Authentication successful"

4. **Verify tokens**:
   ```
   Use tool: whoami
   ```
   Expected: User profile with all three tokens (Graph, PowerBI, USDM)

### Test 2: Labor MCPB Functionality

1. **List team members**:
   ```
   Use tool: list_team_members
   ```
   Expected: List of team member names

2. **Get timecard details**:
   ```
   Use tool: get_timecard_details
   Arguments: {
     "person_name": "John Smith",
     "month": 11,
     "year": 2024
   }
   ```
   Expected: Timecard entries with notes

3. **Check person utilization**:
   ```
   Use tool: person_utilization
   Arguments: {
     "person_name": "John Smith",
     "start_date": "2024-11-01",
     "end_date": "2024-11-30"
   }
   ```
   Expected: Utilization metrics

### Test 3: Sales MCPB Authentication

1. **Start authentication** (if testing separately):
   ```
   Use tool: start_login
   ```
   Expected: Device code displayed

2. **Check authentication**:
   ```
   Use tool: get_auth_status
   ```
   Expected: Shows authentication status and tokens

### Test 4: Sales MCPB Functionality

1. **List opportunities**:
   ```
   Use tool: list_opportunities
   ```
   Expected: List of sales opportunities

2. **Get pipeline summary**:
   ```
   Use tool: pipeline_summary
   Arguments: {}
   ```
   Expected: Sales pipeline metrics

3. **Get opportunity details**:
   ```
   Use tool: opportunity_details
   Arguments: {
     "opportunity_name": "Example Opportunity"
   }
   ```
   Expected: Detailed opportunity information

### Test 5: Domain Isolation Verification

1. **Labor MCPB cannot access Sales data**:
   - With Labor MCPB active, try:
   ```
   Use tool: test_dax
   Arguments: {
     "query": "EVALUATE SUMMARIZE(DIM_Opportunity, [Opportunity Name])"
   }
   ```
   Expected: Error - Sales tables not accessible

2. **Sales MCPB cannot access Labor data**:
   - With Sales MCPB active, try:
   ```
   Use tool: test_dax
   Arguments: {
     "query": "EVALUATE SUMMARIZE(labor, labor[resource])"
   }
   ```
   Expected: Error - Labor tables not accessible

## Troubleshooting

### Issue: "Device code not appearing"
- **Solution**: Authentication service may be initializing
- Wait 10 seconds and retry `start_login`

### Issue: "PowerBI token required for validation"
- **Solution**: This is expected on first run
- Complete authentication first with `start_login`
- Token will be cached for future use

### Issue: "Cannot find module" error
- **Solution**: Package may be corrupted
- Re-download the MCPB file
- Ensure you're using the v28.0 version

### Issue: "Schema validation failed"
- **Solution**: Wrong workspace/dataset configuration
- Labor MCPB requires Labor dataset
- Sales MCPB requires Sales dataset
- Cannot mix domains

### Issue: Both MCPBs installed but conflicting
- **Solution**: This shouldn't happen with v28.0
- Each MCPB is completely isolated
- Check Extensions list - both should work independently
- If issues persist, disable one while testing the other

## Performance Expectations

### Labor MCPB
- **Cold start**: ~2.1s with schema validation
- **Authentication**: <1s with cached tokens
- **Query response**: 500ms - 2s depending on complexity
- **Cache hit rate**: >70%

### Sales MCPB
- **Cold start**: ~1.8s with schema validation
- **Authentication**: <1s with cached tokens
- **Query response**: 300ms - 1.5s depending on data volume
- **Cache hit rate**: >75%

## Security Notes

1. **Token Caching**: Tokens are cached on disk for 1 hour
2. **Workspace Isolation**: Each MCPB can only access its designated workspace
3. **Dataset Guards**: Runtime checks prevent cross-domain queries
4. **Boot Validation**: Server refuses to start with invalid schema

## Support

### Logs Location
- Labor MCPB logs: Check Claude Desktop console
- Sales MCPB logs: Check Claude Desktop console
- Look for `[LABOR-MCP]` or `[SALES-MCP]` prefixes

### Validation Commands
```bash
# Validate Labor MCPB
mcpb validate mcpb/labor/manifest.json

# Validate Sales MCPB
mcpb validate mcpb/sales/manifest.json

# Check package info
mcpb info mcpb/labor/usdm-labor-v28.0.mcpb
mcpb info mcpb/sales/usdm-sales-v28.0.mcpb
```

## Next Steps

After successful testing:
1. Deploy to production users
2. Monitor authentication success rates
3. Track query performance metrics
4. Gather user feedback on domain separation

---

**Version**: 28.0.0
**Date**: 2025-09-19
**Status**: Production Ready