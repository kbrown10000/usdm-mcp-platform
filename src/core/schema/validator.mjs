/**
 * Schema Validator - V26.7 PowerBI Dataset Validation
 * Validates PowerBI dataset schemas against domain configurations
 * Reference: semantic/registry.usdm.labor.json
 */

import { DAXQueryBuilder } from '../dax/builder.mjs';

// Expected schema from semantic registry
const EXPECTED_SCHEMA = {
  version: '27.0',
  modelName: 'LaborAnalysis',
  dataset: {
    workspaceId: '927b94af-e7ef-4b5a-8b8d-02b0c5450b75',
    datasetId: 'ea5298a1-13f0-4629-91ab-14f98163532e'
  },
  tables: {
    factLabor: 'labor',
    dimTeamMember: 'DIM_Team_Member',
    dimSalesTeamMember: 'DIM_Sales_Team_Member',
    dimProject: 'DIM_Project_Min',
    dimMilestone: 'DIM_Milestone',
    dimAccount: 'DIM_Account_Min',
    dimDate: 'DIM_Date',
    dimProduct: 'DIM_Product_Min',
    dimOpportunity: 'DIM_Opportunity_Min'
  },
  criticalTables: [
    { name: 'labor', expectedRows: 3238644 },
    { name: 'DIM_Team_Member', minRows: 100 }
  ]
};

export class SchemaValidator {
  constructor(powerbiConnector) {
    this.connector = powerbiConnector;
    this.daxBuilder = new DAXQueryBuilder();
    this.validationResults = {
      valid: false,
      errors: [],
      warnings: [],
      suggestions: []
    };
  }

  /**
   * Validate schema on startup
   * Must verify dataset exists, check all tables, validate relationships
   */
  async validateOnStartup() {
    console.log('[SCHEMA] Starting schema validation...');

    try {
      // Step 1: Dataset Access Check
      await this.validateDatasetAccess();

      // Step 2: Table Validation
      await this.validateTables();

      // Step 3: Critical Row Counts
      await this.validateRowCounts();

      // Step 4: Relationship Validation
      await this.validateRelationships();

      // Determine overall validity
      this.validationResults.valid = this.validationResults.errors.length === 0;

      // Log results
      this.logResults();

      return this.validationResults;

    } catch (error) {
      console.error('[SCHEMA] Validation failed:', error);
      this.validationResults.errors.push(`Fatal error: ${error.message}`);
      this.validationResults.valid = false;
      return this.validationResults;
    }
  }

  /**
   * Verify dataset is accessible
   */
  async validateDatasetAccess() {
    console.log('[SCHEMA] Validating dataset access...');

    try {
      // Simple query to test access
      const query = 'EVALUATE ROW("Test", 1)';
      const result = await this.connector.executeDaxQuery(query);

      if (!result) {
        this.validationResults.errors.push('Cannot access PowerBI dataset');
      } else {
        console.log('[SCHEMA] ✅ Dataset accessible');
      }
    } catch (error) {
      this.validationResults.errors.push(`Dataset access error: ${error.message}`);
    }
  }

  /**
   * Validate all expected tables exist
   */
  async validateTables() {
    console.log('[SCHEMA] Validating tables...');

    for (const [key, tableName] of Object.entries(EXPECTED_SCHEMA.tables)) {
      try {
        // Test table with TOPN query
        const query = `EVALUATE TOPN(1, '${tableName}')`;
        const result = await this.connector.executeDaxQuery(query);

        if (!result || result.length === 0) {
          this.validationResults.warnings.push(`Table '${tableName}' appears empty`);
        } else {
          console.log(`[SCHEMA] ✅ Table '${tableName}' validated`);
        }
      } catch (error) {
        this.validationResults.errors.push(`Table '${tableName}' not accessible: ${error.message}`);
      }
    }
  }

  /**
   * Validate critical row counts
   */
  async validateRowCounts() {
    console.log('[SCHEMA] Validating row counts...');

    for (const tableInfo of EXPECTED_SCHEMA.criticalTables) {
      try {
        const query = `EVALUATE ROW("RowCount", COUNTROWS('${tableInfo.name}'))`;
        const result = await this.connector.executeDaxQuery(query);

        if (result && result[0]) {
          const rowCount = result[0].RowCount || result[0][0];

          if (tableInfo.expectedRows && rowCount !== tableInfo.expectedRows) {
            this.validationResults.warnings.push(
              `Table '${tableInfo.name}' has ${rowCount} rows, expected ${tableInfo.expectedRows}`
            );
          } else if (tableInfo.minRows && rowCount < tableInfo.minRows) {
            this.validationResults.errors.push(
              `Table '${tableInfo.name}' has ${rowCount} rows, minimum required ${tableInfo.minRows}`
            );
          } else {
            console.log(`[SCHEMA] ✅ Table '${tableInfo.name}' has ${rowCount} rows`);
          }
        }
      } catch (error) {
        this.validationResults.warnings.push(
          `Cannot count rows for '${tableInfo.name}': ${error.message}`
        );
      }
    }
  }

  /**
   * Validate key relationships work
   */
  async validateRelationships() {
    console.log('[SCHEMA] Validating relationships...');

    // Test labor -> DIM_Team_Member relationship
    try {
      const query = `EVALUATE
TOPN(1,
  FILTER('labor', NOT(ISBLANK(RELATED('DIM_Team_Member'[Team Member Name]))))
)`;

      const result = await this.connector.executeDaxQuery(query);

      if (!result || result.length === 0) {
        this.validationResults.errors.push(
          'Relationship labor -> DIM_Team_Member not working'
        );
      } else {
        console.log('[SCHEMA] ✅ Relationship labor -> DIM_Team_Member validated');
      }
    } catch (error) {
      this.validationResults.warnings.push(
        `Cannot validate labor -> DIM_Team_Member relationship: ${error.message}`
      );
    }

    // Test labor -> DIM_Project_Min relationship
    try {
      const query = `EVALUATE
TOPN(1,
  FILTER('labor', NOT(ISBLANK(RELATED('DIM_Project_Min'[Project Type]))))
)`;

      const result = await this.connector.executeDaxQuery(query);

      if (!result || result.length === 0) {
        this.validationResults.warnings.push(
          'Relationship labor -> DIM_Project_Min may have issues'
        );
      } else {
        console.log('[SCHEMA] ✅ Relationship labor -> DIM_Project_Min validated');
      }
    } catch (error) {
      // Not critical, just log warning
      this.validationResults.warnings.push(
        `Cannot validate labor -> DIM_Project_Min relationship: ${error.message}`
      );
    }
  }

  /**
   * Log validation results
   */
  logResults() {
    console.log('\n[SCHEMA] Validation Results:');
    console.log('================================');

    if (this.validationResults.valid) {
      console.log('✅ SCHEMA VALIDATION PASSED');
    } else {
      console.log('❌ SCHEMA VALIDATION FAILED');
    }

    if (this.validationResults.errors.length > 0) {
      console.log('\nCRITICAL ERRORS:');
      this.validationResults.errors.forEach(err => {
        console.log(`  ❌ ${err}`);
      });
    }

    if (this.validationResults.warnings.length > 0) {
      console.log('\nWARNINGS:');
      this.validationResults.warnings.forEach(warn => {
        console.log(`  ⚠️ ${warn}`);
      });
    }

    if (this.validationResults.suggestions.length > 0) {
      console.log('\nSUGGESTIONS:');
      this.validationResults.suggestions.forEach(sug => {
        console.log(`  💡 ${sug}`);
      });
    }

    console.log('================================\n');
  }

  /**
   * Discover schema from PowerBI (for documentation)
   */
  async discoverSchema() {
    const discoveredSchema = {
      version: '27.0',
      discoveredAt: new Date().toISOString(),
      tables: {},
      measures: []
    };

    for (const [key, tableName] of Object.entries(EXPECTED_SCHEMA.tables)) {
      try {
        // Get sample row to discover columns
        const query = `EVALUATE TOPN(1, '${tableName}')`;
        const result = await this.connector.executeDaxQuery(query);

        if (result && result[0]) {
          discoveredSchema.tables[tableName] = {
            columns: Object.keys(result[0]),
            sampleData: result[0]
          };
        }
      } catch (error) {
        console.warn(`[SCHEMA] Cannot discover table '${tableName}':`, error.message);
      }
    }

    return discoveredSchema;
  }

  /**
   * Validate a specific DAX query (for testing)
   */
  async validateQuery(query) {
    try {
      const result = await this.connector.executeDaxQuery(query);
      return {
        valid: true,
        result: result
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

export default SchemaValidator;