/**
 * Labor-specific PowerBI connector
 * Enforces Labor dataset validation
 */

import { executeDaxQuery } from './connector.mjs';

/**
 * Assert Labor dataset has required tables
 * Preflight validation for Labor MCP startup
 * @param {string} datasetId - Labor dataset ID to validate
 * @param {string} workspaceId - Labor workspace ID to validate
 * @param {string} powerbiToken - Valid PowerBI access token
 * @returns {Promise<void>} - Throws if validation fails
 */
export async function assertLaborDataset(datasetId, workspaceId, powerbiToken) {
  if (!datasetId) {
    throw new Error('[assertLaborDataset] datasetId is REQUIRED');
  }
  if (!workspaceId) {
    throw new Error('[assertLaborDataset] workspaceId is REQUIRED');
  }

  // Get token if not provided
  if (!powerbiToken) {
    const { getTokens } = await import('../auth/msal-auth.mjs');
    const tokens = getTokens();
    powerbiToken = tokens?.powerbi;
  }

  if (!powerbiToken) {
    throw new Error(`[assertLaborDataset] PowerBI token required for validation of workspace ${workspaceId}`);
  }

  try {
    // Check for Labor-specific tables
    const testQuery = `
EVALUATE
ROW(
  "HasLabor", IF(ISBLANK(COUNTROWS('labor')), 0, 1),
  "HasDimTeamMember", IF(ISBLANK(COUNTROWS('DIM_Team_Member')), 0, 1),
  "HasDimProject", IF(ISBLANK(COUNTROWS('DIM_Project_Min')), 0, 1),
  "HasDimDate", IF(ISBLANK(COUNTROWS('DIM_Date')), 0, 1)
)`;

    const result = await executeDaxQuery(testQuery, datasetId, workspaceId, powerbiToken);
    const validation = result.data?.[0];

    const errors = [];
    if (validation?.['[HasLabor]'] !== 1) errors.push('labor');
    if (validation?.['[HasDimTeamMember]'] !== 1) errors.push('DIM_Team_Member');
    if (validation?.['[HasDimProject]'] !== 1) errors.push('DIM_Project_Min');
    if (validation?.['[HasDimDate]'] !== 1) errors.push('DIM_Date');

    if (errors.length > 0) {
      throw new Error(`[assertLaborDataset] Dataset ${datasetId} in workspace ${workspaceId} missing required Labor tables: ${errors.join(', ')}`);
    }

    console.error(`[assertLaborDataset] ✅ Labor dataset validated: ${datasetId} in workspace ${workspaceId}`);
  } catch (error) {
    if (error.message?.includes('missing required Labor tables')) {
      throw error;
    }
    throw new Error(`[assertLaborDataset] Validation failed for workspace ${workspaceId}: ${error.message}`);
  }
}

export default {
  assertLaborDataset
};