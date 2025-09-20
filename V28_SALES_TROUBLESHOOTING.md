# V28.0 Sales MCP Troubleshooting - Server Crash Issue

## Problem
Sales MCP server crashes immediately after receiving Initialize request from Claude Desktop:
- Server starts successfully
- Initialize request received
- Server immediately exits (transport closed unexpectedly)
- No diagnostic output visible in logs

## Investigation Steps Taken

### 1. Added Comprehensive Diagnostics ✅
- Early crash handlers (uncaughtException, unhandledRejection)
- Boot-time config logging
- Tool module status logging
- PowerBI token checking
- Server startup tracking

**Result**: None of these diagnostics appear in logs, meaning crash happens during module import.

### 2. Fixed Import Paths ✅
Changed from:
```javascript
import { ... } from '../../../src/core/auth/msal-auth.mjs';
```
To:
```javascript
import { ... } from '../../../../MCP-PLATFORM/src/core/auth/msal-auth.mjs';
```

**Result**: Server runs locally but still crashes in Claude Desktop.

### 3. Created Minimal Test Server ✅
Created `sales-proxy-v28-minimal.mjs` that:
- Has NO external imports (only MCP SDK)
- Only echoes protocol version
- Has minimal tools (just test_connection)
- Extensive logging at every step

**Result**: Minimal server works locally.

## Test Packages Created

### 1. Minimal Test Package
- **File**: `usdm-sales-v28.0-MINIMAL-TEST.mcpb` (3.5MB)
- **Purpose**: Test if basic Initialize handler works without external dependencies
- **What it does**:
  - Echoes protocol version correctly
  - Only imports MCP SDK (no auth, no sales tools)
  - Single test_connection tool
  - Extensive debug logging

### 2. Production Package (Still Failing)
- **File**: `usdm-sales-v28.0-PRODUCTION-READY.mcpb` (3.5MB)
- **Has**: All 26 tools, auth, diagnostics
- **Issue**: Crashes on import

## Next Steps for User

### Test the Minimal Package
1. Install `usdm-sales-v28.0-MINIMAL-TEST.mcpb` in Claude Desktop
2. Check logs for these messages:
   ```
   [SALES-MCP-MINIMAL] Starting minimal test server...
   [SALES-MCP-MINIMAL] Imports successful
   [SALES-MCP-MINIMAL] Server created
   [SALES-MCP-MINIMAL] Initialize handler registered
   ```

### If Minimal Works:
- Problem is with external imports
- Need to fix import paths or bundle dependencies differently

### If Minimal Also Fails:
- More fundamental issue with MCPB packaging or Claude Desktop
- Check if node_modules are properly included
- May need different Node.js version compatibility

## Local Testing Commands

```bash
# Test minimal server locally (works)
cd C:\DevOpps\MCP-PLATFORM\mcpb\sales
node server/sales-proxy-v28-minimal.mjs

# Test complete server locally (works)
node server/sales-proxy-v28.0-complete.mjs

# View package contents
mcpb info usdm-sales-v28.0-MINIMAL-TEST.mcpb
```

## Key Discovery
The issue appears to be that imports fail silently when run from Claude Desktop's context, even though they work locally. This suggests:
1. Path resolution differs when running from MCPB
2. Node modules might not be accessible
3. The ${__dirname} resolution might not work as expected for imports

## Recommended Solution Path
1. First test the minimal package to confirm Initialize handler works
2. If it works, gradually add back functionality:
   - Add auth tools (but mock the imports)
   - Add sales tools (but mock the imports)
   - Finally add real imports one by one
3. Consider bundling all code into a single file to avoid import issues

---

**Status**: Awaiting user test of minimal package to determine next steps