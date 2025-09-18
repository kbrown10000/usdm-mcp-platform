# Railway Deployment Fix Plan

## Current Issue
Railway deployment returning 502 errors despite server code working locally

## Analysis of Working vs Broken Deployment

### Working Deployment (enterprise-extension)
- **Server**: railway-diagnostic-server.js (plain Node.js http module)
- **Package.json**: NO `"type": "module"` (uses CommonJS by default)
- **PORT Handling**: `process.env.PORT || 8080` (no parseInt needed)
- **Railway.json**: Includes healthcheckPath, region, envVars
- **Dependencies**: Minimal (no Express)
- **Error Handling**: Comprehensive uncaught exception handlers
- **Process Management**: Graceful shutdown handlers

### Current Broken Deployment (MCP-PLATFORM)
- **Server**: server.cjs (Express)
- **Package.json**: Has `"type": "module"` (conflicts with .cjs)
- **PORT Handling**: `parseInt(process.env.PORT || '8080', 10)`
- **Railway.json**: Missing healthcheckPath property name, envVars
- **Dependencies**: Express, cors, ws
- **Error Handling**: Basic
- **Process Management**: Basic SIGTERM handler

## Key Issues Identified

1. **Package.json Type Conflict**
   - Current: `"type": "module"` forces all .js files to be ES modules
   - Railway may be confused by .cjs extension with module type
   - Solution: Remove `"type": "module"` from package.json

2. **Railway.json Configuration**
   - Missing proper healthcheck configuration
   - Missing envVars section
   - Incorrect property name (healthcheck vs healthcheckPath)

3. **PORT Handling**
   - parseInt might be causing issues
   - Railway provides PORT as string, but Node handles it fine

4. **Missing Dependencies in package.json**
   - Express and cors not listed as dependencies
   - Could cause Railway build to fail

## Fix Implementation Steps

### Step 1: Fix package.json
```json
{
  "name": "mcp-platform",
  "version": "1.0.0",
  "main": "server.cjs",
  // REMOVE "type": "module"
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0"
    // Add all required dependencies
  }
}
```

### Step 2: Fix railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.cjs",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "region": "us-west1"
  },
  "envVars": {
    "NODE_ENV": "production",
    "PORT": "${{PORT}}"
  }
}
```

### Step 3: Simplify server.cjs
- Remove parseInt for PORT
- Add comprehensive error handling
- Add process handlers from working version
- Ensure immediate server.listen()

### Step 4: Test Deployment
1. Commit and push changes
2. Monitor Railway logs
3. Test health endpoint
4. Verify all proxy endpoints

## Alternative: Use Working Server Pattern
If fixes don't work, copy the exact pattern from railway-diagnostic-server.js:
- Use plain Node.js http module instead of Express
- Minimal dependencies
- Proven to work on Railway

## Verification Checklist
- [ ] Package.json has no `"type": "module"`
- [ ] All dependencies listed in package.json
- [ ] Railway.json has healthcheckPath and envVars
- [ ] Server uses `process.env.PORT || 8080` without parseInt
- [ ] Server has comprehensive error handling
- [ ] Server binds to 0.0.0.0
- [ ] Health endpoint returns 200 immediately
- [ ] Process handlers for graceful shutdown

## Commands to Execute
```bash
# 1. Fix package.json and railway.json
# 2. Commit changes
git add -A
git commit -m "Fix Railway deployment configuration"
git push origin master

# 3. Monitor deployment
# Railway should auto-deploy from GitHub push

# 4. Test after deployment (wait ~30 seconds)
curl https://usdm-mcp-platform-production.up.railway.app/health
```