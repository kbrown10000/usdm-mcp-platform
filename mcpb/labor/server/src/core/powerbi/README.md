# PowerBI Connector Module

Extracted from V26.7 golden source (`railway-proxy-v26.7-timecard-analysis.mjs`) - preserves exact authentication and query patterns.

## ⚠️ CRITICAL REQUIREMENTS

**DO NOT MODIFY** the core patterns in this module. They are battle-tested and work with the production USDM labor dataset.

### Preserved Constants
- **WORKSPACE_ID**: `927b94af-e7ef-4b5a-8b8d-02b0c5450b75` (Labor workspace)
- **DATASET_ID**: `ea5298a1-13f0-4629-91ab-14f98163532e` (Labor dataset with 3.2M+ records)
- **MAX_CONCURRENT**: `3` (Tested optimal value for rate limiting)

### Key Features
- **Rate Limiting**: Prevents PowerBI 429 errors with 3 concurrent query limit
- **Enhanced Error Messages**: Provides suggestions for common DAX query issues
- **Dataset Validation**: Verifies 3,238,644 row count from golden source
- **Token Expiry Handling**: Detects 401 errors and provides clear error messages

## Usage Example

```javascript
import { executeDax, validateDataset } from './connector.js';

// Execute a DAX query
try {
  const result = await executeDax(`
    EVALUATE
    TOPN(10, 'DIM_Team_Member', 'DIM_Team_Member'[Team Member Name])
  `, powerbiToken);

  console.log(`Found ${result.rowCount} rows`);
  console.log(result.data);
} catch (error) {
  console.error('Query failed:', error.message);
}

// Validate dataset
const validation = await validateDataset(powerbiToken);
if (validation.isValid) {
  console.log('✅ Dataset validated with', validation.rowCount, 'rows');
} else {
  console.log('❌ Validation failed:', validation.message);
}
```

## API Reference

### `executeDax(query, powerbiToken)`
Execute a DAX query against the PowerBI dataset.
- **query**: DAX query string
- **powerbiToken**: Valid PowerBI access token
- **Returns**: `{ success: boolean, data: Array, rowCount: number }`

### `validateDataset(powerbiToken)`
Validate dataset accessibility and row count.
- **powerbiToken**: Valid PowerBI access token
- **Returns**: `{ success: boolean, isValid: boolean, rowCount: number, ... }`

### `getDatasetInfo()`
Get dataset configuration information.
- **Returns**: `{ workspaceId, datasetId, maxConcurrent, apiEndpoint }`

### `getQueryStatus()`
Get current query throttling status.
- **Returns**: `{ activeQueries, maxConcurrent, availableSlots, isThrottled }`

### `withDaxLimit(queryId, queryFn)`
Rate-limited wrapper for DAX queries.
- **queryId**: Unique identifier for the query
- **queryFn**: Function that executes the query
- **Returns**: Promise with query result

## Performance Notes

1. **Always use CALCULATETABLE over FILTER** - 5x performance improvement
2. **Use COALESCE for financial fields** - Prevents null propagation
3. **Date format**: Use `DATE(year, month, day)` not string dates
4. **Relationship joins**: Use `RELATED()` function for dimension lookups

## Error Handling

The module provides enhanced error messages with suggestions:
- **Table errors**: Suggests correct table names
- **Column errors**: Reminds about case sensitivity
- **Syntax errors**: Provides DAX format hints
- **Auth errors**: Detects token expiry and suggests refresh

## Integration Notes

This module is designed to be used with:
- Authentication modules that provide PowerBI tokens
- DAX query builders that construct optimized queries
- Caching layers for improved performance
- Domain-specific analytics tools

The connector preserves the exact query patterns and error handling that work in production with the USDM labor dataset.