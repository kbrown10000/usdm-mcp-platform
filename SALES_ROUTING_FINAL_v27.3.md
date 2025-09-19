# 🔒 Sales Routing - FINAL LOCKDOWN v27.3

## All Improvements Applied ✅

### 1. Enhanced runSalesDax with proper toolName
✅ Default parameter `toolName = 'unknown_tool'`
✅ Logs both dataset and workspace (redacted)
✅ Calls preflight validation on every execution

### 2. Preflight Validation on Startup
✅ `ensurePreflightValidation()` runs once
✅ Calls `assertSalesDataset()` to verify tables exist
✅ Crashes hard if Sales tables missing
✅ Logs success/failure to STDERR

### 3. New Debug Tool: get_data_source_info
✅ Shows exact dataset being targeted
✅ Identifies if it's Labor or Sales
✅ Returns both full and redacted IDs
✅ Perfect for "where am I?" debugging

### 4. DAX Fixes Applied
✅ Removed `EARLIER()` from get_rep_conversion (doesn't work in SUMMARIZECOLUMNS)
✅ Replaced with proper stage/probability analysis
✅ Now returns WonCount, LostCount for actual conversion metrics

### 5. executeDax Deprecated
✅ Added deprecation warning
✅ Logs to STDERR when called
✅ Clear message to use executeDaxQuery instead

### 6. CI Guard Script Created
✅ `scripts/check-sales-guards.sh` prevents regressions
✅ Checks for executeDax usage
✅ Verifies guards are in place
✅ Ensures no fallback datasets

## Complete Safety Stack

### Layer 1: Sales Tools (sales-tools.mjs)
```javascript
// Preflight on startup
await ensurePreflightValidation();  // Crashes if wrong dataset

// Every tool execution
getDatasetId(args)  // Refuses Labor GUID
runSalesDax(dax, args, toolName)  // Logs & validates
```

### Layer 2: Connector (connector.mjs)
```javascript
executeDaxQuery(query, datasetId)  // No fallbacks allowed
// Blocks DIM_Opportunity queries against Labor dataset
// assertSalesDataset() validates tables exist
```

### Layer 3: Observability
```
[SalesMCP Preflight] ✅ Sales dataset validated: ef5c8f43…3b88
[SalesMCP] get_pipeline_summary dataset=ef5c8f43…3b88 ws=927b94af…0b75
```

## Quick Verification Commands

```javascript
// 1. Where am I?
get_data_source_info()
// Returns: { datasetId, isLaborDataset: false, isSalesDataset: true }

// 2. Can I connect?
ping_sales_dataset()
// Returns: { ok: 1 }

// 3. Are my tables there?
validate_sales_schema()
// Returns: { schema_valid: true }

// 4. Show me sales data (not labor!)
get_pipeline_summary()
// Returns: Opportunity stages, not timecards
```

## Railway Deployment Checklist

### Required Environment Variables:
```bash
SALES_DATASET_ID=ef5c8f43-19c5-44d4-b57e-71b788933b88  # NO DEFAULT
LABOR_DATASET_ID=ea5298a1-13f0-4629-91ab-14f98163532e
POWERBI_WORKSPACE_ID=927b94af-e7ef-4b5a-8b8d-02b0c5450b75
```

### Remove These Variables:
```bash
POWERBI_DATASET_ID  # DANGEROUS FALLBACK - DELETE IT
```

## Regression Prevention

### Run CI Check:
```bash
./scripts/check-sales-guards.sh
```

### Expected Output:
```
✅ All Sales routing guards in place!
- executeDax: NOT used in Sales tools
- executeDaxQuery: Properly imported
- No fallback datasets: Confirmed
- Labor guard: Present
- runSalesDax wrapper: Present
- Preflight validation: Present
```

## Error Messages You WANT to See

These errors are your friends - they prevent wrong routing:

1. **Missing Config**:
   `[SalesMCP Preflight] SALES_DATASET_ID not configured`

2. **Wrong Dataset**:
   `[SalesMCP] CRITICAL: Refusing to run Sales tool against LABOR datasetId!`

3. **Missing Tables**:
   `[assertSalesDataset] Dataset missing required Sales tables: DIM_Opportunity`

4. **No Fallback**:
   `[executeDaxQuery] datasetId is REQUIRED. No fallback allowed.`

## Summary

**Version**: 27.3
**Safety Level**: MAXIMUM 🔒
**Fallback Risk**: ZERO
**Labor Contamination**: IMPOSSIBLE

The system now:
- Validates on startup (preflight)
- Guards on every call (runtime)
- Logs every routing decision (observability)
- Deprecates dangerous functions (executeDax)
- Prevents regressions (CI guards)

---

**Ship it to Railway with confidence!** 🚀