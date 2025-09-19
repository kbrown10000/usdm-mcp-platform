// PowerBI Connector Module - Extracted from V26.7 Golden Source
// CRITICAL: DO NOT MODIFY - Preserves exact authentication and query patterns
// Source: railway-proxy-v26.7-timecard-analysis.mjs (Lines 129-193)

import axios from 'axios';

// ⚠️ DO NOT MODIFY: Production PowerBI IDs
// These IDs connect to the actual USDM labor dataset in PowerBI
// Changing any ID will break data access
const WORKSPACE_ID = process.env.POWERBI_WORKSPACE_ID || '927b94af-e7ef-4b5a-8b8d-02b0c5450b75';  // Labor workspace
const DATASET_ID = process.env.POWERBI_DATASET_ID || 'ea5298a1-13f0-4629-91ab-14f98163532e';      // Labor dataset with 3.2M records

// PERFORMANCE: Query throttling prevents 429 errors from PowerBI
// PowerBI limits: 120 requests/minute per user, 8 executeQueries/minute
// SAFE TO MODIFY: Adjust MAX_CONCURRENT if needed (3 works well)
// DO NOT MODIFY: The throttling structure - it prevents service overload
let activeQueries = 0;
const MAX_CONCURRENT = 3;  // Tested optimal value - DO NOT exceed 5

/**
 * Rate limiting wrapper for DAX queries
 * @param {string} queryId - Unique identifier for the query
 * @param {Function} queryFn - Function that executes the query
 * @returns {Promise} - Query result
 */
async function withDaxLimit(queryId, queryFn) {
  while (activeQueries >= MAX_CONCURRENT) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  activeQueries++;
  try {
    return await queryFn();
  } finally {
    activeQueries--;
  }
}

/**
 * Execute DAX query against PowerBI dataset
 * CRITICAL: Preserves exact error handling and response format from V26.7
 * @param {string} query - DAX query to execute
 * @param {string} powerbiToken - Valid PowerBI access token
 * @returns {Promise<Object>} - Query result with success flag, data, and rowCount
 */
async function executeDax(query, powerbiToken) {
  if (!powerbiToken) {
    throw new Error('Not authenticated. PowerBI token required.');
  }

  try {
    const response = await axios.post(
      `https://api.powerbi.com/v1.0/myorg/groups/${WORKSPACE_ID}/datasets/${DATASET_ID}/executeQueries`,
      {
        queries: [{ query }],
        serializerSettings: { includeNulls: true }
      },
      {
        headers: {
          'Authorization': `Bearer ${powerbiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const result = response.data.results[0];
    if (result.error) {
      // V26.6 Enhanced error messages with suggestions
      const errorMsg = result.error.message || 'Unknown error';
      let suggestion = '';

      if (errorMsg.includes('table')) {
        suggestion = '\n💡 Suggestion: Check table names - use labor, DIM_Team_Member, DIM_Date, etc.';
      } else if (errorMsg.includes('column')) {
        suggestion = '\n💡 Suggestion: Column names are case-sensitive. Use [Team Member Name] not [team member name]';
      } else if (errorMsg.includes('syntax')) {
        suggestion = '\n💡 Suggestion: Check DAX syntax - dates need DATE(year,month,day) format';
      }

      throw new Error(`PowerBI error: ${errorMsg}${suggestion}`);
    }

    return {
      success: true,
      data: result.tables[0]?.rows || [],
      rowCount: result.tables[0]?.rows?.length || 0
    };

  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('PowerBI token expired. Please refresh authentication.');
    }
    throw error;
  }
}

/**
 * Validate dataset accessibility and row count
 * CRITICAL: Must return 3,238,644 rows for labor table to verify golden source compatibility
 * @param {string} powerbiToken - Valid PowerBI access token
 * @returns {Promise<Object>} - Validation result with row count
 */
async function validateDataset(powerbiToken) {
  if (!powerbiToken) {
    throw new Error('Not authenticated. PowerBI token required.');
  }

  try {
    // Test query to verify dataset accessibility and get exact row count
    const validationQuery = `EVALUATE ROW("LaborRows", COUNTROWS('labor'))`;

    const result = await executeDax(validationQuery, powerbiToken);
    const rowCount = result.data?.[0]?.['[LaborRows]'] || 0;

    // CRITICAL: Expected row count from V26.7 golden source
    const expectedRowCount = 3238644;
    const isValid = rowCount >= expectedRowCount * 0.95; // Allow 5% tolerance

    return {
      success: true,
      isValid,
      rowCount,
      expectedRowCount,
      datasetId: DATASET_ID,
      workspaceId: WORKSPACE_ID,
      message: isValid
        ? `✅ Dataset validated - ${rowCount.toLocaleString()} rows found`
        : `⚠️ Row count mismatch - Expected ~${expectedRowCount.toLocaleString()}, found ${rowCount.toLocaleString()}`
    };

  } catch (error) {
    return {
      success: false,
      isValid: false,
      error: error.message,
      datasetId: DATASET_ID,
      workspaceId: WORKSPACE_ID
    };
  }
}

/**
 * Get dataset information
 * @returns {Object} - Dataset configuration
 */
function getDatasetInfo() {
  return {
    workspaceId: WORKSPACE_ID,
    datasetId: DATASET_ID,
    maxConcurrent: MAX_CONCURRENT,
    apiEndpoint: `https://api.powerbi.com/v1.0/myorg/groups/${WORKSPACE_ID}/datasets/${DATASET_ID}/executeQueries`
  };
}

/**
 * Get current query status
 * @returns {Object} - Current query throttling status
 */
function getQueryStatus() {
  return {
    activeQueries,
    maxConcurrent: MAX_CONCURRENT,
    availableSlots: MAX_CONCURRENT - activeQueries,
    isThrottled: activeQueries >= MAX_CONCURRENT
  };
}

export {
  executeDax,
  validateDataset,
  getDatasetInfo,
  getQueryStatus,
  withDaxLimit,
  // Export constants for reference
  WORKSPACE_ID,
  DATASET_ID,
  MAX_CONCURRENT
};

export default {
  executeDax,
  validateDataset,
  getDatasetInfo,
  getQueryStatus,
  withDaxLimit,
  WORKSPACE_ID,
  DATASET_ID,
  MAX_CONCURRENT
};