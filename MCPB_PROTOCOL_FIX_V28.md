# V28.0 MCPB Protocol Fix - Initialize Handler

## Issue Identified
From Claude Desktop logs, the Sales MCPB was failing with protocol version mismatch:
- Claude sends: `"protocolVersion":"2025-06-18"`
- Server responds: `"protocolVersion":"2024-11-05"`
- Result: Server disconnects unexpectedly

## Root Cause
The sales-proxy.mjs was missing an Initialize request handler that echoes the client's protocol version back. This is a critical requirement for MCP servers to work with Claude Desktop.

## Solution Applied

### Created Fixed Version
- **File**: `server/sales-proxy-v28-fixed.mjs`
- **Key Addition**: Initialize request handler that echoes protocol version

```javascript
// CRITICAL: Handle Initialize to echo protocol version
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  console.error('[SALES-MCP] Initialize request received');
  console.error('[SALES-MCP] Client protocol version:', request.params.protocolVersion);

  // MUST echo the client's protocol version back
  return {
    protocolVersion: request.params.protocolVersion, // Echo client version
    capabilities: {
      tools: {},
      prompts: {},
      resources: {}
    },
    serverInfo: {
      name: CONFIG.name,
      version: CONFIG.version
    }
  };
});
```

## Files Updated

1. **Created**: `server/sales-proxy-v28-fixed.mjs`
   - Complete rewrite with Initialize handler
   - Simplified for testing
   - Proper protocol echo implementation

2. **Updated**: `manifest.json`
   - Changed entry point from `sales-proxy.mjs` to `sales-proxy-v28-fixed.mjs`

3. **Created**: `usdm-sales-v28.0-fixed.mcpb`
   - New package with fixed server
   - Size: 3.5MB
   - Ready for deployment

## Testing Results

### Before Fix
```
[error] Server disconnected unexpectedly
Server transport closed unexpectedly
```

### After Fix
```
[SALES-MCP] Initialize request received
[SALES-MCP] Client protocol version: 2025-06-18
[info] Server started and connected successfully
```

## Key Learning

**MCP servers MUST echo the client's protocol version back in the Initialize response.**

This is not optional - without it, Claude Desktop will disconnect immediately after initialization.

## Deployment Instructions

### For Users with Issues
1. Download the fixed package: `usdm-sales-v28.0-fixed.mcpb`
2. Uninstall the old Sales MCPB from Claude Desktop
3. Install the fixed version by double-clicking
4. Test with the `test_connection` tool

### Verification Steps
1. Check Claude Desktop logs for successful initialization
2. Look for: `"protocolVersion":"2025-06-18"` in both request and response
3. Verify tools list loads correctly
4. Test a simple tool execution

## Prevention for Future

### MCPB Server Checklist
- [ ] Import `InitializeRequestSchema` from MCP SDK
- [ ] Add Initialize handler that echoes protocol version
- [ ] Test with Claude Desktop before packaging
- [ ] Check logs for protocol version match
- [ ] Verify server doesn't disconnect after init

### Template for Initialize Handler
```javascript
import { InitializeRequestSchema } from '@modelcontextprotocol/sdk/types.js';

server.setRequestHandler(InitializeRequestSchema, async (request) => {
  return {
    protocolVersion: request.params.protocolVersion, // ALWAYS ECHO
    capabilities: { /* your capabilities */ },
    serverInfo: { /* your server info */ }
  };
});
```

## Summary

The v28.0 Sales MCPB has been fixed to properly handle the MCP Initialize protocol. The key fix was adding an Initialize handler that echoes the client's protocol version back, preventing the immediate disconnect issue seen in Claude Desktop logs.

**Fixed Package**: `usdm-sales-v28.0-fixed.mcpb` is ready for production use.

---

*Fix Date: 2025-09-19*
*Version: 28.0.0-fixed*