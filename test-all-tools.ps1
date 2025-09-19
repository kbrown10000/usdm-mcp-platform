# Test All 13 Labor Tools via MCP/RPC
$baseUrl = "http://localhost:3000/mcp/rpc"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing V27.0 Labor Tools" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Test authentication tools
$tools = @(
    @{name="whoami"; params=@{}},
    @{name="get_auth_status"; params=@{}},
    @{name="start_login"; params=@{}},
    @{name="check_login"; params=@{}},
    @{name="refresh_tokens"; params=@{}},

    # Test labor analytics tools
    @{name="person_resolver"; params=@{search_term="Sam Mistretta"}},
    @{name="activity_for_person_month"; params=@{person_name="Sam Mistretta"; year=2024; month=10}},
    @{name="person_revenue_analysis"; params=@{person_name="Sam Mistretta"; start_date="2024-10-01"; end_date="2024-10-31"}},
    @{name="person_utilization"; params=@{person_name="Sam Mistretta"; year=2024; month=10}},
    @{name="get_timecard_details"; params=@{person_name="Sam Mistretta"; start_date="2024-10-01"; end_date="2024-10-31"}},

    # Test DAX and cache tools
    @{name="run_dax"; params=@{query="EVALUATE TOPN(5, 'DIM_Team_Member')"}},
    @{name="get_cache_stats"; params=@{}},
    @{name="clear_cache"; params=@{}}
)

foreach ($tool in $tools) {
    Write-Host "`nTesting: $($tool.name)" -ForegroundColor Yellow

    $body = @{
        method = "tools/call"
        params = @{
            name = $tool.name
            arguments = $tool.params
        }
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method POST `
            -Headers @{"Content-Type"="application/json"} `
            -Body $body -TimeoutSec 10

        if ($response) {
            Write-Host "✅ Success" -ForegroundColor Green
            if ($response.result) {
                $result = $response.result | ConvertTo-Json -Compress
                if ($result.Length -gt 100) {
                    Write-Host "   Response: $($result.Substring(0, 100))..." -ForegroundColor Gray
                } else {
                    Write-Host "   Response: $result" -ForegroundColor Gray
                }
            }
        }
    } catch {
        Write-Host "❌ Failed: $_" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan