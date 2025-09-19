#!/bin/bash

# Comprehensive CI Validation Script for MCP-PLATFORM Architecture
# Validates domain isolation, auth patterns, workspace separation, and best practices
# Exit codes: 0 = all checks pass, 1 = at least one check failed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Base directory
PLATFORM_ROOT="C:/DevOpps/MCP-PLATFORM"

# Progress tracking
progress() {
    echo -e "${BLUE}[PROGRESS]${NC} $1"
}

check_pass() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    echo -e "${GREEN}✅ PASS:${NC} $1"
}

check_fail() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    echo -e "${RED}❌ FAIL:${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

# Header
echo "========================================"
echo "  MCP-PLATFORM Architecture Validation"
echo "========================================"
echo

# 1. Domain Isolation Checks
progress "1. Checking domain isolation..."

# Check for cross-domain imports in Sales
if grep -r "from.*labor" "$PLATFORM_ROOT/src/domains/sales/" 2>/dev/null | grep -v node_modules; then
    check_fail "Sales domain imports from Labor domain (violates isolation)"
else
    check_pass "Sales domain has no Labor imports"
fi

# Check for cross-domain imports in Labor
if grep -r "from.*sales" "$PLATFORM_ROOT/src/domains/labor/" 2>/dev/null | grep -v node_modules; then
    check_fail "Labor domain imports from Sales domain (violates isolation)"
else
    check_pass "Labor domain has no Sales imports"
fi

# Check for shared state between domains
if grep -r "global\." "$PLATFORM_ROOT/src/domains/" 2>/dev/null | grep -v node_modules; then
    check_fail "Domains use global state (violates isolation)"
else
    check_pass "No global state usage in domains"
fi

# Check for hardcoded cross-references
if grep -rE "(sales|labor).*=.*require.*\.\./\.\./domains" "$PLATFORM_ROOT/src/domains/" 2>/dev/null | grep -v node_modules; then
    check_fail "Direct cross-domain require() detected"
else
    check_pass "No direct cross-domain requires found"
fi

# 2. Authentication Architecture Checks  
progress "2. Checking authentication architecture..."

# Check that domains don't directly import MSAL
if grep -r "from '@azure/msal" "$PLATFORM_ROOT/src/domains/" 2>/dev/null | grep -v node_modules; then
    check_fail "Domains directly import MSAL (should use core-auth)"
else
    check_pass "Domains don't directly import MSAL"
fi

# Check that domains use core-auth
if ! grep -r "core.*auth" "$PLATFORM_ROOT/src/domains/" 2>/dev/null | grep -v node_modules; then
    check_warn "Domains might not be using core-auth module"
else
    check_pass "Domains appear to use core-auth"
fi

# Check for device code patterns (should use camelCase)
if grep -r "user_code\|device_code" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules | grep -v ".git"; then
    check_fail "Found snake_case auth fields (should be camelCase: userCode, deviceCode)"
else
    check_pass "No deprecated snake_case auth fields found"
fi


# Check for three-token architecture
auth_files=$(find "$PLATFORM_ROOT/src/" -name "*.mjs" -o -name "*.js" | grep -v node_modules)
has_three_tokens=false
for file in $auth_files; do
    if grep -q "PowerBI.*Graph.*USDM\|Graph.*PowerBI.*USDM\|USDM.*PowerBI.*Graph" "$file" 2>/dev/null; then
        has_three_tokens=true
        break
    fi
done

if [ "$has_three_tokens" = true ]; then
    check_pass "Three-token architecture pattern found"
else
    check_warn "Three-token architecture pattern not clearly visible"
fi

# 3. Workspace ID Separation
progress "3. Checking workspace ID separation..."

# Check Sales workspace IDs
sales_workspace=$(grep -r "WORKSPACE_ID\|workspaceId" "$PLATFORM_ROOT/src/domains/sales/" 2>/dev/null | grep -v node_modules | head -1)
labor_workspace=$(grep -r "WORKSPACE_ID\|workspaceId" "$PLATFORM_ROOT/src/domains/labor/" 2>/dev/null | grep -v node_modules | head -1)

if echo "$sales_workspace" | grep -q "927b94af"; then
    check_fail "Sales domain uses Labor workspace ID (should be separate)"
elif echo "$sales_workspace" | grep -q "ef5c8f43"; then
    check_pass "Sales domain uses correct workspace ID"
else
    check_warn "Sales workspace ID not clearly identified"
fi

if echo "$labor_workspace" | grep -q "ef5c8f43"; then
    check_fail "Labor domain uses Sales workspace ID (should be separate)"
elif echo "$labor_workspace" | grep -q "927b94af"; then
    check_pass "Labor domain uses correct workspace ID"
else
    check_warn "Labor workspace ID not clearly identified"
fi

# Check for shared POWERBI_WORKSPACE_ID usage
if grep -r "POWERBI_WORKSPACE_ID.*=" "$PLATFORM_ROOT/src/domains/" 2>/dev/null | grep -v node_modules; then
    shared_count=$(grep -r "POWERBI_WORKSPACE_ID.*=" "$PLATFORM_ROOT/src/domains/" 2>/dev/null | grep -v node_modules | wc -l)
    if [ "$shared_count" -gt 1 ]; then
        check_warn "Multiple domains set POWERBI_WORKSPACE_ID environment variable"
    fi
fi

# 4. Boot Validation Checks
progress "4. Checking boot validation..."

# Check for schema validation in server entry points
server_files=$(find "$PLATFORM_ROOT/src/domains/" -name "server.mjs" -o -name "server.js")
for server in $server_files; do
    if grep -q "schema.*validation\|validate.*schema" "$server" 2>/dev/null; then
        check_pass "Boot validation found in $(basename $(dirname $server)) server"
    else
        check_warn "No clear boot validation in $(basename $(dirname $server)) server"
    fi
done

# Check for graceful startup patterns
for server in $server_files; do
    if grep -q "initialize\|startup\|boot" "$server" 2>/dev/null; then
        check_pass "Initialization pattern found in $(basename $(dirname $server)) server"
    else
        check_warn "No initialization pattern in $(basename $(dirname $server)) server"
    fi
done

# 5. DAX Query Architecture
progress "5. Checking DAX query architecture..."

# Check for deprecated executeDax function usage
if grep -r "executeDax[^Q]" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules | grep -v ".git"; then
    check_fail "Deprecated executeDax function found (should use executeDaxQuery)"
else
    check_pass "No deprecated executeDax function usage"
fi

# Check for workspace parameter in executeDaxQuery calls
if grep -r "executeDaxQuery" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules; then
    if grep -r "executeDaxQuery.*workspace\|executeDaxQuery.*WORKSPACE" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules; then
        check_pass "executeDaxQuery calls include workspace parameter"
    else
        check_fail "executeDaxQuery calls missing workspace parameter"
    fi
else
    check_warn "No executeDaxQuery calls found"
fi

# Check for CALCULATETABLE vs FILTER patterns
if grep -r "FILTER.*labor\|FILTER.*opportunities" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules; then
    check_fail "Deprecated FILTER patterns found (should use CALCULATETABLE)"
else
    check_pass "No deprecated FILTER patterns in DAX queries"
fi

# 6. Logging Best Practices
progress "6. Checking logging practices..."

# Check for STDOUT contamination
if grep -r "console\.log\|process\.stdout" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules | grep -v ".git"; then
    contaminated_files=$(grep -r "console\.log\|process\.stdout" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules | grep -v ".git" | wc -l)
    if [ "$contaminated_files" -gt 5 ]; then
        check_fail "High STDOUT usage detected ($contaminated_files instances) - should use STDERR"
    else
        check_warn "Some STDOUT usage detected ($contaminated_files instances)"
    fi
else
    check_pass "No STDOUT contamination detected"
fi

# Check for proper error logging
if grep -r "console\.error\|process\.stderr" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules; then
    check_pass "STDERR logging patterns found"
else
    check_warn "No clear STDERR logging patterns"
fi

# 7. Package Structure Validation
progress "7. Checking package structure..."

# Check for proper MCP server structure
required_patterns=("Server.*from.*@modelcontextprotocol" "tools/list" "tools/call")
for pattern in "${required_patterns[@]}"; do
    if grep -r "$pattern" "$PLATFORM_ROOT/src/domains/" 2>/dev/null | grep -v node_modules; then
        check_pass "MCP pattern found: $pattern"
    else
        check_warn "MCP pattern not found: $pattern"
    fi
done

# Check for environment variable configuration
if grep -r "process\.env\." "$PLATFORM_ROOT/src/domains/" 2>/dev/null | grep -v node_modules; then
    check_pass "Environment variable configuration found"
else
    check_warn "No environment variable configuration detected"
fi

# 8. Performance Patterns
progress "8. Checking performance patterns..."

# Check for caching implementations
if grep -r "cache\|Cache" "$PLATFORM_ROOT/src/domains/" 2>/dev/null | grep -v node_modules; then
    check_pass "Caching patterns found"
else
    check_warn "No caching patterns detected"
fi

# Check for rate limiting
if grep -r "rate.*limit\|throttle\|debounce" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules; then
    check_pass "Rate limiting patterns found"
else
    check_warn "No rate limiting patterns detected"
fi

# 9. Security Checks
progress "9. Checking security patterns..."

# Check for hardcoded secrets
if grep -rE "(password|secret|key).*=.*['\"][^'\"]{10,}['\"]" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules | grep -v ".git"; then
    check_fail "Potential hardcoded secrets detected"
else
    check_pass "No obvious hardcoded secrets found"
fi

# Check for proper token handling
if grep -r "token.*=" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules | grep -v ".git"; then
    if grep -r "accessToken\|bearer\|Bearer" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules; then
        check_pass "Token handling patterns found"
    else
        check_warn "Token usage without clear handling patterns"
    fi
fi

# 10. Final Validation
progress "10. Running final validation checks..."

# Check for TODO/FIXME markers that indicate incomplete work
todo_count=$(grep -r "TODO\|FIXME\|XXX\|HACK" "$PLATFORM_ROOT/src/" 2>/dev/null | grep -v node_modules | grep -v ".git" | wc -l)
if [ "$todo_count" -gt 10 ]; then
    check_warn "High number of TODO/FIXME markers ($todo_count) - may indicate incomplete implementation"
elif [ "$todo_count" -gt 0 ]; then
    check_pass "Moderate TODO/FIXME markers ($todo_count) - acceptable for development"
else
    check_pass "No TODO/FIXME markers found"
fi

# Check for test files existence
if find "$PLATFORM_ROOT" -name "*test*" -o -name "*spec*" | grep -v node_modules | head -1 > /dev/null; then
    check_pass "Test files found in project"
else
    check_warn "No test files detected"
fi

# Summary
echo
echo "========================================"
echo "         VALIDATION SUMMARY"
echo "========================================"
echo -e "Total checks: ${BLUE}$TOTAL_CHECKS${NC}"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
echo

if [ "$FAILED_CHECKS" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED!${NC}"
    echo "Architecture validation completed successfully."
    exit 0
else
    echo -e "${RED}❌ $FAILED_CHECKS CHECKS FAILED${NC}"
    echo "Architecture validation found issues that need attention."
    echo
    echo "Common fixes:"
    echo "1. Remove cross-domain imports"
    echo "2. Use core-auth instead of direct MSAL"
    echo "3. Ensure workspace IDs are domain-specific"
    echo "4. Replace deprecated executeDax with executeDaxQuery"
    echo "5. Use console.error instead of console.log"
    echo "6. Replace FILTER with CALCULATETABLE in DAX queries"
    exit 1
fi
