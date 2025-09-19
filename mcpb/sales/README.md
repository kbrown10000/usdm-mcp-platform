# USDM Sales MCP v27.1

Sales Analytics MCP with 20 PowerBI tools for comprehensive sales intelligence.

## Features

- **Pipeline Analytics**: 4 tools for pipeline visibility and forecasting
- **Account Intelligence**: 2 tools for account revenue and health
- **Rep Performance**: 2 tools for sales rep metrics and conversion
- **Advanced Analytics**: 10 additional tools for comprehensive insights
- **Product Analytics**: 2 tools for product revenue tracking

## Tools Available

### Core Pipeline Analytics
- `get_pipeline_summary` - Overview by stage
- `get_opportunity_forecast` - Weighted revenue forecast
- `get_opportunity_details` - Detailed opportunity info
- `get_deal_velocity` - Sales cycle metrics

### Account & Rep Analytics
- `get_account_revenue` - Account-level revenue
- `get_account_health` - Account health scores
- `get_rep_performance` - Sales rep metrics
- `get_rep_conversion` - Conversion rates by rep

### Advanced Power Tools
- `get_win_loss_analysis` - Win/loss insights
- `get_deal_aging` - Find stuck deals
- `get_territory_performance` - Geographic metrics
- `get_renewal_forecast` - Subscription renewals
- `get_monthly_trend` - Sales trends
- `get_top_deals` - Biggest opportunities
- `get_lead_conversion` - Funnel metrics
- `get_quota_attainment` - Quota tracking
- `get_activity_metrics` - Activity tracking
- `get_executive_dashboard` - C-level summary

## Installation

1. Double-click the `.mcpb` file to install in Claude Desktop
2. Or use Claude Desktop Settings → Extensions → Install from file

## Dataset Information

- **Sales Dataset**: ef5c8f43-19c5-44d4-b57e-71b788933b88
- **Workspace**: 927b94af-e7ef-4b5a-8b8d-02b0c5450b75
- **Key Tables**: DIM_Opportunity, Fact_Opportunity, DIM_Account
- **Row Count**: ~65,000 opportunities

## Version History

- v27.1.0 - Initial Sales MCP with 20 tools
- Based on V26.7 proven patterns
