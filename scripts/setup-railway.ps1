# PowerShell script to set up Railway environment variables
# Run this in Railway CLI or copy variables to Railway Dashboard

Write-Host "Setting up Railway environment variables for USDM MCP Platform V27.0" -ForegroundColor Green

$vars = @{
    "API_AUDIENCE" = "api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19"
    "AZURE_CLIENT_ID" = "8b84dc3b-a9ff-43ed-9d35-571f757e9c19"
    "AZURE_CLIENT_SECRET" = "IMZ8Q~E8S5G0Nh-XYiqh_sE2LNPuHDW8TwmrbAt"
    "AZURE_TENANT_ID" = "18c250cf-2ef7-4eeb-b6fb-94660f7867e0"
    "ENABLE_AUTH" = "true"
    "ENABLE_DELIVERY_TOOLS" = "1"
    "ENABLE_ON_BEHALF_OF" = "true"
    "OAUTH_REDIRECT_URI" = "https://usdm-mcp-platform-production.up.railway.app/auth/callback"
    "OAUTH_SCOPES" = "openid profile offline_access api://8b84dc3b-a9ff-43ed-9d35-571f757e9c19/user_impersonation https://analysis.windows.net/powerbi/api/.default"
    "GRAPH_SCOPES" = "User.Read Directory.Read.All"
    "POWERBI_DATASET_ID" = "ea5298a1-13f0-4629-91ab-14f98163532e"
    "POWERBI_SCOPES" = "https://analysis.windows.net/powerbi/api/.default"
    "POWERBI_WORKSPACE_ID" = "927b94af-e7ef-4b5a-8b8d-020bc5450b75"
    "SESSION_SECRET" = "a7f8b2c9d4e6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6"
    "MAX_CONCURRENT_QUERIES" = "3"
    "CACHE_TTL" = "600"
    "ENABLE_RATE_LIMITING" = "true"
}

Write-Host "`nUsing Railway CLI:" -ForegroundColor Yellow
foreach ($key in $vars.Keys) {
    Write-Host "railway variables set $key='$($vars[$key])'"
}

Write-Host "`n✅ Remember to:" -ForegroundColor Cyan
Write-Host "1. Add Redis service in Railway Dashboard"
Write-Host "2. Update OAUTH_REDIRECT_URI with your actual Railway URL"
Write-Host "3. Deploy from GitHub repo: kbrown10000/usdm-mcp-platform"
Write-Host "4. Monitor deployment logs for any issues"