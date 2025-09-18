#!/bin/bash
# Railway Deployment Script for USDM MCP Platform V27.0
# Project ID: 38d862fb-96c3-4078-96f7-12364ed57c4f

echo "🚀 Deploying USDM MCP Platform V27.0 to Railway"

# Export Railway token
export RAILWAY_TOKEN="9ef48cd3-bb8a-4df2-b1e8-97003b2ffeb7"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

echo "📦 Linking to Railway project..."
railway link 38d862fb-96c3-4078-96f7-12364ed57c4f

echo "⚙️ Setting environment variables..."

# Set all environment variables
railway variables set "API_AUDIENCE=api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19"
railway variables set "AZURE_CLIENT_ID=8b84dc3b-a9ff-43ed-9d35-571f757e9c19"
railway variables set "AZURE_CLIENT_SECRET=IMZ8Q~E8S5G0Nh-XYiqh_sE2LNPuHDW8TwmrbAt"
railway variables set "AZURE_TENANT_ID=18c250cf-2ef7-4eeb-b6fb-94660f7867e0"
railway variables set "ENABLE_AUTH=true"
railway variables set "ENABLE_DELIVERY_TOOLS=1"
railway variables set "ENABLE_ON_BEHALF_OF=true"
railway variables set "OAUTH_REDIRECT_URI=https://usdm-mcp-platform-production.up.railway.app/auth/callback"
railway variables set "OAUTH_SCOPES=openid profile offline_access api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation https://analysis.windows.net/powerbi/api/.default"
railway variables set "GRAPH_SCOPES=User.Read Directory.Read.All"
railway variables set "POWERBI_DATASET_ID=ea5298a1-13f0-4629-91ab-14f98163532e"
railway variables set "POWERBI_SCOPES=https://analysis.windows.net/powerbi/api/.default"
railway variables set "POWERBI_WORKSPACE_ID=927b94af-e7ef-4b5a-8b8d-020bc5450b75"
railway variables set "SESSION_SECRET=a7f8b2c9d4e6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6"
railway variables set "MAX_CONCURRENT_QUERIES=3"
railway variables set "CACHE_TTL=600"
railway variables set "ENABLE_RATE_LIMITING=true"

echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment initiated!"
echo "Monitor at: https://railway.app/project/38d862fb-96c3-4078-96f7-12364ed57c4f"