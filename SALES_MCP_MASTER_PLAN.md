# Sales MCP Master Development Plan

## 🎯 Mission
Build an amazing Sales MCP server with powerful, tested DAX queries that provide real-time sales intelligence.

## 📊 Phase 1: Data Discovery & Schema Mapping
### Tables Discovered:
- **DIM_Opportunity** (23,057 rows) - Main opportunity dimension
  - Key fields: OpportunityId, Opportunity Name, StageName, Amount, IsClosed, IsWon, Probability, CloseDate
  - Owner fields: OwnerId, Opportunity Owner
  - Account fields: AccountId, Account Name

- **Fact_Opportunity** (42,197 rows) - Opportunity line items/products
  - Key fields: Opportunity Amount, ProductId, Quantity, UnitPrice
  - Date fields: CloseDate, CreatedDate
  - Classification: IsWon, IsClosed, Segment

- **DIM_Account** - Customer accounts
- **DIM_Date** - Date dimension for time intelligence
- **Sales Team Member** - Sales rep information

### Key Relationships:
- DIM_Opportunity → Fact_Opportunity (1:Many)
- DIM_Account → DIM_Opportunity (1:Many)
- Sales Team Member → DIM_Opportunity (1:Many)

## 🔧 Phase 2: Core Sales Tools (Fix & Test)
### Existing 10 Tools to Fix:
1. ✅ **get_pipeline_summary** - Pipeline by stage
2. 🔧 **get_opportunity_forecast** - Revenue forecasting
3. 🔧 **get_opportunity_details** - Detailed opportunity info
4. 🔧 **get_deal_velocity** - Sales cycle analysis
5. 🔧 **get_account_revenue** - Account-level analytics
6. 🔧 **get_account_health** - Account scoring
7. 🔧 **get_rep_performance** - Sales rep metrics
8. 🔧 **get_rep_conversion** - Conversion funnel
9. 🔧 **get_product_revenue** - Product performance
10. 🔧 **get_team_pipeline** - Team-level metrics

## 🚀 Phase 3: New Power Tools (10 Additional)
### Advanced Analytics Tools:
1. **get_win_loss_analysis** - Why deals win/lose
2. **get_quota_attainment** - Rep vs quota tracking
3. **get_deal_aging** - Stuck deals analysis
4. **get_competitor_analysis** - Win rates by competitor
5. **get_territory_performance** - Geographic analytics
6. **get_renewal_forecast** - Subscription renewals
7. **get_lead_conversion** - Lead to opportunity metrics
8. **get_activity_metrics** - Sales activity tracking
9. **get_commission_forecast** - Commission calculations
10. **get_executive_dashboard** - C-level summary

## 📈 Phase 4: DAX Pattern Library
### Reusable Patterns:
1. **Time Intelligence**
   - YTD, QTD, MTD calculations
   - Period-over-period comparisons
   - Rolling averages

2. **Ranking & Top N**
   - Top performers
   - Bottom performers
   - Percentile rankings

3. **Conversion Funnels**
   - Stage-to-stage conversion
   - Time in stage
   - Velocity metrics

4. **Forecasting**
   - Weighted pipeline
   - Probability-adjusted
   - Best/worst case scenarios

## 🧪 Phase 5: Testing Strategy
1. Test each DAX query with dev tool
2. Verify data accuracy
3. Measure query performance
4. Handle edge cases (nulls, zeros, etc.)
5. Test with Railway backend

## 📝 Phase 6: Documentation
- Complete API documentation
- DAX query reference
- Use case examples
- Performance benchmarks

## 🎯 Success Metrics
- ✅ All 20 tools working with real data
- ✅ Query response < 2 seconds
- ✅ 100% test coverage
- ✅ Railway deployment successful
- ✅ Claude Desktop integration working

---

## Execution Timeline
1. **Hour 1**: Schema exploration & mapping ✅
2. **Hour 2**: Fix existing 10 tools
3. **Hour 3**: Build 10 new tools
4. **Hour 4**: Testing & optimization
5. **Hour 5**: Documentation & deployment