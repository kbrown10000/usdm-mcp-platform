# Sales MCP v28.0 Validation Checklist

## ✅ 6-Point Validation Protocol

### 1. Authentication First
```
Tool: start_login
Expected: Device code displayed (e.g., SALES-AUTH-123)
Action: Complete auth at microsoft.com/devicelogin

Tool: check_login
Expected: "Authentication complete!"

Tool: get_auth_status
Expected: Shows all 3 tokens ✅ (PowerBI, Graph, USDM)
```

### 2. Dataset Sanity Check (Prove it's Sales)
```
Tool: test_dax_query
Query: EVALUATE ROW("HasDimOpp", NOT ISBLANK(COUNTROWS('DIM_Opportunity')), "HasFactOpp", NOT ISBLANK(COUNTROWS('Fact_Opportunity')))

Expected Result:
- HasDimOpp = TRUE ✅
- HasFactOpp = TRUE ✅

If FALSE: Wrong dataset configured!
```

### 3. Schema Visibility
```
Tool: get_table_info

Expected Sales Tables:
✅ DIM_Opportunity
✅ Fact_Opportunity
✅ DIM_Account
✅ DIM_Product
✅ DIM_Sales_Rep

Should NOT See (Labor tables):
❌ labor
❌ DIM_Team_Member
❌ timecard
```

### 4. Guard the Route (Negative Test)
```
Tool: test_dax_query
Query: EVALUATE 'labor'  // Intentionally try Labor table

Expected: ❌ BLOCKED error message
"Cannot query Labor tables from Sales MCP"

This proves guards are working!
```

### 5. Pipeline Smoke Test
```
Tool: get_pipeline_summary

Expected Output:
- Stage names (Prospecting, Qualification, etc.) ✅
- Dollar amounts ✅
- Deal counts ✅

Should NOT contain:
- No "hours" column ❌
- No "timecard" references ❌
- No "Team Member" names ❌
```

### 6. Validate Dataset Tool
```
Tool: validate_dataset

Expected:
- Server: Sales MCP v28.0.0 ✅
- Dataset ID: ef5c8f43-... (Sales) ✅
- Guards: Active ✅
- Labor access: Blocked ✅
```

---

## 🛡️ Guards in Place

### Environment Guards
- Refuses to start if `POWERBI_DATASET_ID` = Labor GUID
- Logs Sales dataset ID on startup
- Validates configuration before tool registration

### Runtime Guards
- Checks all tool arguments for Labor dataset ID
- Blocks queries containing "labor" or "timecard"
- Rejects Labor-related tool names

### Response Guards
- All responses labeled with "(SALES ONLY)"
- No Labor data ever returned
- Clear error messages when Labor access attempted

---

## 🚫 What Gets Blocked

### Blocked Dataset IDs
```
Labor Dataset: ea5298a1-13f0-4629-91ab-14f98163532e
Action: Returns "ACCESS DENIED" error
```

### Blocked Table Names
- `labor`
- `timecard`
- `DIM_Team_Member`
- Any table with "labor" in name

### Blocked Tool Names
- Anything with "timecard"
- Anything with "labor"
- Anything with "team_member"

---

## ✅ Quick Validation Script

Run these in order in Claude Desktop:

1. `test_connection` → Should say "SALES ONLY"
2. `validate_dataset` → Should confirm Sales dataset
3. `get_table_info` → Should list Sales tables only
4. `get_pipeline_summary` → Should show sales stages
5. Try: `get_timecard_details` → Should be BLOCKED

If all pass, Sales MCP is correctly configured and guarded!

---

## 📊 Expected Logs

Server startup should show:
```
[SALES-MCP][CONFIG] Sales Dataset ID: ef5c8f43...
[SALES-MCP][CONFIG] Sales Workspace ID: 927b94af...
[SALES-MCP][GUARD] Will reject any Labor dataset access
[SALES-MCP] 30 tools available (Sales domain only)
[SALES-MCP] Ready - Will reject any Labor dataset access
```

---

## 🔧 Troubleshooting

### Issue: "Still seeing Labor data"
- Check environment variables
- Ensure Labor MCP is disabled in Claude Desktop
- Verify dataset ID in logs

### Issue: "Authentication fails"
- Check tenant/client IDs
- Verify public client enabled
- Try 20s timeout with 3 retries

### Issue: "Wrong dataset error"
- Set `SALES_DATASET_ID` explicitly
- Remove any `POWERBI_DATASET_ID` env var
- Check workspace ID is correct

---

## 🎯 Success Criteria

✅ All 6 validation checks pass
✅ No Labor data accessible
✅ Guards block cross-domain access
✅ Sales queries return Sales data only
✅ Clear domain separation maintained

**Status: VALIDATED** when all checks pass!