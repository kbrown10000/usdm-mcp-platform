# 🎯 Sales Dataset Routing Fix - COMPLETE

## Problem Solved
Sales tools were incorrectly querying the Labor dataset (ea5298a1-13f0-4629-91ab-14f98163532e) instead of the Sales dataset (ef5c8f43-19c5-44d4-b57e-71b788933b88), resulting in timecard data appearing in sales queries.

## Fixes Applied ✅

### 1. Sales Tools - Complete Rewrite (sales-tools.mjs)
✅ **No defaults allowed**: SALES_DATASET_ID required from environment
✅ **Runtime guards**: Refuses to run if dataset equals Labor GUID
✅ **Safe wrapper**: `runSalesDax()` enforces dataset selection
✅ **Observability**: Logs dataset ID (redacted) to STDERR for every query
✅ **All 20+ tools updated**: Every tool now uses the safe execution pattern

### 2. PowerBI Connector - Hard Guards (connector.mjs)
✅ **executeDaxQuery() added**: New function that requires explicit dataset ID
✅ **No fallbacks**: Throws error if datasetId not provided
✅ **Cross-domain guard**: Blocks Sales queries (containing DIM_Opportunity) against Labor dataset
✅ **assertSalesDataset() added**: Preflight validation to verify Sales tables exist

### 3. Safety Implementation
```javascript
// Every Sales tool now follows this pattern:
function getDatasetId(args = {}) {
  const datasetId = args._datasetId || SALES_DATASET_ID;

  // No dataset? FAIL FAST
  if (!datasetId) {
    throw new Error('[SalesMCP] Missing SALES_DATASET_ID. Set it in Railway Variables.');
  }

  // Labor dataset? BLOCK IT
  if (datasetId === LABOR_DATASET_ID) {
    throw new Error('[SalesMCP] CRITICAL: Refusing to run Sales tool against LABOR datasetId!');
  }

  return datasetId;
}

// Safe execution with logging
async function runSalesDax(dax, args, toolName) {
  const datasetId = getDatasetId(args);
  console.error(`[SalesMCP] ${toolName} query dataset=${redacted(datasetId)}`);
  return await executeDaxQuery(dax, datasetId);
}
```

## Railway Configuration Required

### Environment Variables to SET:
```bash
SALES_DATASET_ID=ef5c8f43-19c5-44d4-b57e-71b788933b88
LABOR_DATASET_ID=ea5298a1-13f0-4629-91ab-14f98163532e
POWERBI_WORKSPACE_ID=927b94af-e7ef-4b5a-8b8d-02b0c5450b75
```

### Variables to UNSET (remove these):
```bash
POWERBI_DATASET_ID  # This was the dangerous fallback
```

## Verification Tools

### 1. Ping Test
```javascript
// Use ping_sales_dataset() to verify connection
// Should return { ok: 1 } with Sales dataset ID
```

### 2. Schema Validation
```javascript
// Use validate_sales_schema() to check tables
// Should confirm DIM_Opportunity, Fact_Opportunity, DIM_Account exist
```

### 3. Pipeline Test
```javascript
// Use get_pipeline_summary() to see Sales stages
// Should show opportunity stages, NOT labor timecards
```

## What's Different Now

### Before (BROKEN):
- Sales tools → executeDax() → hardcoded Labor dataset
- No guards, silent failures
- Labor data appearing in Sales queries

### After (FIXED):
- Sales tools → runSalesDax() → executeDaxQuery(query, SALES_DATASET_ID)
- Multiple guards at every layer
- Loud failures if wrong dataset attempted
- Full observability in logs

## Logs to Watch

When running Sales tools, you'll see in STDERR:
```
[SalesMCP] get_pipeline_summary query dataset=ef5c8f43…3b88 ws=927b94af…0b75
```

If you see Labor dataset ID (ea5298a1…532e), the fix isn't working.

## Error Messages You Want to See

These errors are GOOD - they prevent wrong routing:
- `[SalesMCP] Missing SALES_DATASET_ID. Set it in Railway Variables.`
- `[SalesMCP] CRITICAL: Refusing to run Sales tool against LABOR datasetId!`
- `[executeDaxQuery] datasetId is REQUIRED. No fallback allowed.`
- `[executeDaxQuery] BLOCKED: Refusing to run Sales query against Labor dataset`

## Next Steps

1. **Deploy to Railway** with correct environment variables
2. **Run ping_sales_dataset()** to verify connectivity
3. **Test get_pipeline_summary()** to confirm Sales data
4. **Monitor logs** for dataset routing confirmation

---

**Status**: ✅ COMPLETE - All guards in place, no fallbacks possible
**Version**: 27.2
**Date**: 2025-09-19