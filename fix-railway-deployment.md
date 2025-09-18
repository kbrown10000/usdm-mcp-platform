# Railway Deployment Fix Guide

## Current Issues Identified

### 1. **502 Gateway Error**
The Railway deployment is returning 502 errors, indicating the server isn't starting properly or Railway can't connect to it.

### 2. **Authentication Token Issue**
The Railway token `9ef48cd3-bb8a-4df2-b1e8-97003b2ffeb7` appears to be invalid or expired.

### 3. **GitHub Integration Status Unknown**
We need to verify if Railway is properly connected to the GitHub repository for auto-deployments.

## Step-by-Step Fix Process

### Step 1: Generate New Railway Token
1. Go to https://railway.app/account/tokens
2. Click "Generate New Token"
3. Name it "USDM-MCP-Deploy"
4. Copy the new token

### Step 2: Connect GitHub Repository
1. Go to your Railway project: https://railway.app/project/38d862fb-96c3-4078-96f7-12364ed57c4f
2. Click on the service (or create one if none exists)
3. Go to "Settings" tab
4. Under "Source", click "Connect GitHub"
5. Select repository: `kbrown10000/usdm-mcp-platform`
6. Select branch: `master`
7. Enable "Auto Deploy" toggle

### Step 3: Configure Environment Variables
Run this PowerShell script with your new token:

```powershell
# Replace with your new Railway token
$env:RAILWAY_TOKEN = "YOUR_NEW_TOKEN_HERE"

# Install Railway CLI if needed
if (!(Get-Command railway -ErrorAction SilentlyContinue)) {
    npm install -g @railway/cli
}

# Link to project
railway link

# Set all required environment variables
railway variables set API_AUDIENCE="api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19"
railway variables set AZURE_CLIENT_ID="8b84dc3b-a9ff-43ed-9d35-571f757e9c19"
railway variables set AZURE_CLIENT_SECRET="IMZ8Q~E8S5G0Nh-XYiqh_sE2LNPuHDW8TwmrbAt"
railway variables set AZURE_TENANT_ID="18c250cf-2ef7-4eeb-b6fb-94660f7867e0"
railway variables set ENABLE_AUTH="true"
railway variables set ENABLE_DELIVERY_TOOLS="1"
railway variables set ENABLE_ON_BEHALF_OF="true"
railway variables set OAUTH_REDIRECT_URI="https://usdm-mcp-platform-production.up.railway.app/auth/callback"
railway variables set OAUTH_SCOPES="openid profile offline_access api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation https://analysis.windows.net/powerbi/api/.default"
railway variables set GRAPH_SCOPES="User.Read Directory.Read.All"
railway variables set POWERBI_DATASET_ID="ea5298a1-13f0-4629-91ab-14f98163532e"
railway variables set POWERBI_SCOPES="https://analysis.windows.net/powerbi/api/.default"
railway variables set POWERBI_WORKSPACE_ID="927b94af-e7ef-4b5a-8b8d-02b0c5450b75"
railway variables set SESSION_SECRET="a7f8b2c9d4e6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6"
railway variables set MAX_CONCURRENT_QUERIES="3"
railway variables set CACHE_TTL="600"
railway variables set ENABLE_RATE_LIMITING="true"
```

### Step 4: Fix Package.json Issues

The `package.json` has conflicting module types. Update it:

```json
{
  "name": "mcp-platform",
  "version": "1.0.0",
  "description": "Multi-domain MCP platform",
  "main": "server.cjs",
  "type": "commonjs",  // Change from "module" to "commonjs" for server.cjs
  "scripts": {
    "start": "node server.cjs",
    "start:railway": "node server.cjs"
  }
}
```

Or keep `"type": "module"` and rename `server.cjs` to `server.js`.

### Step 5: Verify Railway Configuration

Ensure `railway.json` is correct:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.cjs",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "healthcheck": {
    "path": "/health",
    "timeout": 30
  }
}
```

### Step 6: Manual Deployment (if auto-deploy isn't working)

```bash
# In Git Bash or WSL
cd /c/DevOpps/MCP-PLATFORM

# Set Railway token
export RAILWAY_TOKEN="YOUR_NEW_TOKEN_HERE"

# Deploy manually
railway up

# Check logs
railway logs
```

### Step 7: Verify Deployment

After deployment, test these endpoints:

1. Health Check:
```bash
curl https://usdm-mcp-platform-production.up.railway.app/health
```

2. MCP Discovery:
```bash
curl https://usdm-mcp-platform-production.up.railway.app/mcp/discover
```

3. Root:
```bash
curl https://usdm-mcp-platform-production.up.railway.app/
```

## Alternative Approaches

### Option A: Use Railway Dashboard UI
1. Go to https://railway.app/project/38d862fb-96c3-4078-96f7-12364ed57c4f
2. Click "New Service" if no service exists
3. Choose "GitHub Repo"
4. Select `kbrown10000/usdm-mcp-platform`
5. Railway will auto-detect Node.js and use `railway.json` config
6. Check "Deployments" tab for build logs

### Option B: Create Fresh Railway Service
If the current project is corrupted:
1. Create new Railway project
2. Connect GitHub repo
3. Set environment variables via dashboard
4. Update the domain in your local `.env` files

## Common Railway Issues and Solutions

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Server not starting. Check logs with `railway logs` |
| Build fails | Check Node version. Railway uses Node 18 by default |
| Module errors | Ensure package.json type matches file extension |
| Port binding | Railway sets PORT env var automatically, don't hardcode |
| GitHub not syncing | Reconnect repo in Railway dashboard |
| Token expired | Generate new token at railway.app/account/tokens |

## Quick Debug Commands

```bash
# Check deployment logs
railway logs --tail 100

# Check environment variables
railway variables

# Redeploy
railway up --detach

# Open Railway dashboard
railway open
```

## Expected Success Output

When working correctly, you should see:
- Health endpoint returns: `{"status":"healthy","version":"27.0"}`
- No 502 errors
- Logs show: "V27.0 Production Server Started"
- Auto-deploys trigger on GitHub push

## Contact for Help
- Railway Discord: https://discord.gg/railway
- Railway Docs: https://docs.railway.app
- GitHub Issues: https://github.com/railwayapp/cli/issues