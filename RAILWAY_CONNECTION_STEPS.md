# Railway Connection Steps

## Current Issue
The Railway project (ID: 38d862fb-96c3-4078-96f7-12364ed57c4f) is not connected to our GitHub repository.

## Required Steps in Railway Dashboard

### 1. Connect GitHub Repository
1. Go to your Railway project: https://railway.app/project/38d862fb-96c3-4078-96f7-12364ed57c4f
2. Click on the service (usdm-mcp-platform)
3. Go to Settings tab
4. Under "Source", click "Connect GitHub repo"
5. Select repository: `kbrown10000/usdm-mcp-platform`
6. Select branch: `master` (not main)
7. Click "Connect"

### 2. Verify Configuration
The following should be automatically detected from our files:
- **Builder**: DOCKERFILE (from railway.toml)
- **Dockerfile Path**: Dockerfile
- **Start Command**: node server.cjs
- **Health Check Path**: /health
- **Port**: 8080

### 3. Environment Variables (if needed)
Add these in Railway dashboard under Variables tab:
```
NODE_ENV=production
PORT=8080
```

### 4. Deploy
Once connected, Railway should automatically:
1. Pull the latest code from GitHub
2. Build using Dockerfile
3. Deploy the server
4. Health check should pass at /health

## Files Ready for Deployment

✅ **Dockerfile** - Builds Node.js 18 Alpine image
✅ **railway.toml** - Railway configuration with proper settings
✅ **server.cjs** - CommonJS server with all endpoints
✅ **.dockerignore** - Excludes unnecessary files
✅ **package.json** - Dependencies properly listed

## Testing After Connection
```bash
# Test health endpoint
curl https://usdm-mcp-platform-production.up.railway.app/health

# Expected response:
{
  "status": "healthy",
  "version": "27.0",
  "timestamp": "...",
  "port": 8080,
  "environment": "production"
}
```

## Alternative: Manual Deployment
If GitHub connection doesn't work, you can:
1. Use Railway CLI: `railway up`
2. Or push directly from command line with Railway token

## Key Differences from Working Server
- Working server uses `main` branch, we use `master`
- Working server repo: `usdm-labor-analysis-mcp`
- Our repo: `usdm-mcp-platform`

Both should work once properly connected!