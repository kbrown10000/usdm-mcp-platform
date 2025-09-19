# USDM Labor MCP Package v27.0

## Overview
This is the MCPB package for the USDM Labor Analytics MCP, designed for Claude Desktop integration. It provides 13 enterprise labor analytics tools through a Railway backend proxy.

## Package Details
- **Name:** usdm-labor-mcp
- **Version:** 27.0.0
- **Size:** 2.4MB (compressed)
- **Architecture:** Railway Proxy Standalone
- **Backend:** https://usdm-mcp-platform-production.up.railway.app

## Installation

### One-Click Installation
1. Download `usdm-labor-v27.0-FINAL.mcpb`
2. Double-click the file in Windows Explorer
3. Claude Desktop will automatically install and register the extension

### Manual Verification
```bash
# Validate package
mcpb validate manifest.json
mcpb info usdm-labor-v27.0-FINAL.mcpb

# Test extraction
mcpb unpack usdm-labor-v27.0-FINAL.mcpb test/
cd test/server
node railway-proxy-standalone.mjs
```

## Architecture

### Standalone Railway Proxy
The package uses a standalone server (`railway-proxy-standalone.mjs`) that:
1. Handles authentication locally using MSAL
2. Proxies all data operations to the Railway backend
3. Maintains the three-token architecture (PowerBI, Graph, USDM API)
4. Preserves V26.7 authentication patterns (camelCase fields)

### Key Features
- **Device Code Flow:** Shows device code directly in Claude Desktop
- **Token Management:** Automatic acquisition of three tokens
- **Railway Backend:** All data operations via HTTPS proxy
- **Error Handling:** Graceful fallback and informative errors

## Available Tools

### Authentication (5 tools)
- `start_login` - Start device code authentication
- `check_login` - Check authentication status
- `whoami` - Get current user information
- `get_auth_status` - Detailed token status
- `refresh_tokens` - Refresh all tokens

### Analytics (8 tools)
- `person_resolver` - Find team members with fuzzy matching
- `activity_for_person_month` - Monthly activity summary
- `person_revenue_analysis` - Revenue metrics analysis
- `person_utilization` - Utilization rates calculation
- `get_timecard_details` - Timecard entries with notes
- `run_dax` - Execute custom DAX queries
- `get_cache_stats` - Cache performance statistics
- `clear_cache` - Clear cache entries

## Configuration

### Environment Variables (in manifest)
```json
{
  "AZURE_TENANT_ID": "18c250cf-2ef7-4eeb-b6fb-94660f7867e0",
  "AZURE_CLIENT_ID": "8b84dc3b-a9ff-43ed-9d35-571f757e9c19",
  "POWERBI_WORKSPACE_ID": "927b94af-e7ef-4b5a-8b8d-02b0c5450b75",
  "POWERBI_DATASET_ID": "ea5298a1-13f0-4629-91ab-14f98163532e",
  "API_AUDIENCE": "api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19",
  "RAILWAY_BACKEND_URL": "https://usdm-mcp-platform-production.up.railway.app"
}
```

## Critical Implementation Details

### MCPB Manifest Requirements
- Uses `dxt_version: "0.1"` (not manifest_version)
- Server args use `${__dirname}` for path resolution
- Tools only have name and description (no inputSchema)
- Prompts require `text` field

### Authentication Pattern
```javascript
// CRITICAL: Use camelCase fields from MSAL
response.userCode     // NOT response.user_code
response.verificationUri  // NOT response.verification_uri

// Token acquisition order
1. PowerBI token first
2. Graph token second
3. USDM API token third
```

### Railway Proxy Pattern
```javascript
// Local auth handling
if (name === 'start_login' || name === 'check_login') {
  // Handle locally with MSAL
}

// Proxy data operations
const response = await api.post('/api/tools/execute', {
  tool: name,
  arguments: args,
  auth: {
    powerbi_token: cached.powerbi.token,
    graph_token: cached.graph.token,
    usdm_token: cached.usdmApi.token
  }
});
```

## Troubleshooting

### "Server transport closed unexpectedly"
- Check server logs in Claude Desktop console
- Verify Railway backend is running
- Test standalone: `node server/railway-proxy-standalone.mjs`

### "Device code shows undefined"
- Server must use `response.userCode` not `response.user_code`
- Extended timeout (10s) for device code display

### "Cannot connect to Railway backend"
- Check RAILWAY_BACKEND_URL environment variable
- Verify backend health: `curl https://usdm-mcp-platform-production.up.railway.app/health`

## Package Structure
```
usdm-labor-v27.0-FINAL.mcpb/
├── manifest.json                      # MCPB manifest with dxt_version
├── package.json                       # Package metadata
└── server/
    ├── railway-proxy-standalone.mjs   # Standalone proxy server
    ├── package.json                   # Server dependencies
    └── node_modules/                  # Bundled dependencies (1379 files)
        ├── @modelcontextprotocol/     # MCP SDK
        ├── @azure/msal-node/          # Authentication
        ├── axios/                     # HTTP client
        └── ...                        # Other dependencies
```

## Version History
- **v27.0** - Railway proxy architecture with standalone server
- **v26.7** - Golden source with working authentication
- **v26.4** - Enhanced efficiency with semantic registry

## Support
For issues or questions, check the Railway backend logs or the Claude Desktop console for error messages.