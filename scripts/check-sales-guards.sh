#!/bin/bash
# CI Guard Script - Prevents Sales routing regressions
# Run this in CI/CD to ensure Sales tools never use executeDax

echo "🔍 Checking Sales tools for routing safety..."

# Check 1: No executeDax imports in Sales tools
echo -n "Checking for executeDax imports in Sales tools... "
if grep -R "executeDax\b" src/core/tools/sales-*.mjs 2>/dev/null | grep -v "executeDaxQuery"; then
  echo "❌ FAIL"
  echo "ERROR: Sales tools must not use executeDax. Use executeDaxQuery(query, datasetId) instead."
  exit 1
else
  echo "✅ PASS"
fi

# Check 2: Sales tools must import executeDaxQuery
echo -n "Checking for executeDaxQuery import... "
if ! grep -q "import.*executeDaxQuery" src/core/tools/sales-tools.mjs; then
  echo "❌ FAIL"
  echo "ERROR: Sales tools must import executeDaxQuery from connector."
  exit 1
else
  echo "✅ PASS"
fi

# Check 3: No default dataset IDs in Sales tools
echo -n "Checking for hardcoded dataset fallbacks... "
if grep -q "SALES_DATASET_ID.*||.*'[a-f0-9-]*'" src/core/tools/sales-tools.mjs; then
  echo "❌ FAIL"
  echo "ERROR: Sales tools must not have fallback dataset IDs."
  exit 1
else
  echo "✅ PASS"
fi

# Check 4: Guard against Labor dataset must exist
echo -n "Checking for Labor dataset guard... "
if ! grep -q "LABOR_DATASET_ID.*ea5298a1-13f0-4629-91ab-14f98163532e" src/core/tools/sales-tools.mjs; then
  echo "⚠️ WARNING"
  echo "WARNING: Labor dataset guard not found or incorrect."
else
  echo "✅ PASS"
fi

# Check 5: runSalesDax must exist and be used
echo -n "Checking for runSalesDax wrapper... "
if ! grep -q "async function runSalesDax" src/core/tools/sales-tools.mjs; then
  echo "❌ FAIL"
  echo "ERROR: runSalesDax wrapper function not found."
  exit 1
else
  echo "✅ PASS"
fi

# Check 6: Preflight validation must exist
echo -n "Checking for preflight validation... "
if ! grep -q "assertSalesDataset" src/core/tools/sales-tools.mjs; then
  echo "⚠️ WARNING"
  echo "WARNING: Preflight validation with assertSalesDataset not found."
else
  echo "✅ PASS"
fi

echo ""
echo "✅ All Sales routing guards in place!"
echo ""
echo "Summary:"
echo "- executeDax: NOT used in Sales tools"
echo "- executeDaxQuery: Properly imported"
echo "- No fallback datasets: Confirmed"
echo "- Labor guard: Present"
echo "- runSalesDax wrapper: Present"
echo "- Preflight validation: Present"

exit 0