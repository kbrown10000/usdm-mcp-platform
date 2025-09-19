# 🎯 Implementation Plan: Achieving 100% Architecture Compliance

## Executive Summary
**Goal**: Complete remaining 35% to reach production-ready architecture
**Timeline**: 4 phases, parallel execution where possible
**Risk**: ZERO breaking changes - all updates are additive or refactoring

---

## 📋 Phase 1: Critical Safety Updates (HIGH PRIORITY)
**Goal**: Close security/isolation gaps
**Parallel Agents**: 3

### 1.1 Workspace ID Separation
```javascript
// FROM: Single shared workspace
const WORKSPACE_ID = process.env.POWERBI_WORKSPACE_ID;

// TO: Domain-specific workspaces
const SALES_WORKSPACE_ID = process.env.SALES_WORKSPACE_ID;
const LABOR_WORKSPACE_ID = process.env.LABOR_WORKSPACE_ID;
```

**Files to Update**:
- `src/core/powerbi/connector.mjs` - Add workspaceId parameter
- `src/core/tools/sales-tools.mjs` - Pass SALES_WORKSPACE_ID
- `src/core/tools/labor-tools.mjs` - Pass LABOR_WORKSPACE_ID
- `src/railway-integration.js` - Update environment config

### 1.2 Boot-time Schema Validation
```javascript
// Add to sales-proxy.mjs and labor-proxy.mjs
async function main() {
  try {
    // MUST validate before registering ANY tools
    await assertSchema(SALES_DATASET_ID, SALES_WORKSPACE_ID, 'sales');
    console.error('[SalesMCP] ✅ Schema validation passed');
  } catch (error) {
    console.error('[SalesMCP] ❌ FATAL: Schema validation failed:', error.message);
    process.exit(1); // Hard fail - no recovery
  }

  // Only register tools if schema is valid
  await registerTools();
}
```

### 1.3 Update executeDaxQuery Signature
```javascript
// FROM:
async function executeDaxQuery(query, datasetId, powerbiToken)

// TO:
async function executeDaxQuery(query, datasetId, workspaceId, powerbiToken)
```

---

## 📋 Phase 2: Reliability Improvements
**Goal**: Add production resilience
**Parallel Agents**: 2

### 2.1 Token Disk Caching
```javascript
// New: src/core/auth/token-cache.mjs
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

class TokenCache {
  constructor() {
    this.cacheDir = path.join(process.cwd(), '.cache', 'msal');
  }

  getCacheKey(tenant, client, scopes) {
    const scopeHash = crypto.createHash('sha256')
      .update(scopes.sort().join(','))
      .digest('hex').substring(0, 8);
    return `msal_${tenant}_${client}_${scopeHash}.json`;
  }

  async save(tokens, account, tenant, client, scopes) {
    await fs.mkdir(this.cacheDir, { recursive: true });
    const key = this.getCacheKey(tenant, client, scopes);
    const data = {
      tokens,
      account,
      timestamp: Date.now(),
      expiry: Date.now() + (3600 * 1000) // 1 hour
    };
    await fs.writeFile(
      path.join(this.cacheDir, key),
      JSON.stringify(data, null, 2)
    );
  }

  async load(tenant, client, scopes) {
    try {
      const key = this.getCacheKey(tenant, client, scopes);
      const data = JSON.parse(
        await fs.readFile(path.join(this.cacheDir, key), 'utf8')
      );
      if (data.expiry > Date.now()) {
        return data;
      }
    } catch {
      return null;
    }
  }
}
```

### 2.2 Retry Logic with Exponential Backoff
```javascript
// Update msal-auth.mjs
async function startLoginWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await startLogin();
      if (result.success) return result;

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.error(`[Auth] Retry ${attempt}/${maxRetries} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`[Auth] Attempt ${attempt} failed:`, error.message);
    }
  }
  throw new Error('Authentication failed after all retries');
}

// 20-second timeout for device code
const DEVICE_CODE_TIMEOUT = 20000; // Increased from 5000
```

---

## 📋 Phase 3: Package Restructuring
**Goal**: Clean architectural separation
**Parallel Agents**: 4

### 3.1 New Directory Structure
```
C:\DevOpps\MCP-PLATFORM\
├── packages/
│   ├── core-auth/
│   │   ├── src/
│   │   │   ├── msal-auth.mjs
│   │   │   └── token-cache.mjs
│   │   ├── package.json
│   │   └── index.mjs
│   │
│   ├── core-powerbi/
│   │   ├── src/
│   │   │   └── connector.mjs
│   │   ├── package.json
│   │   └── index.mjs
│   │
│   ├── domain-sales/
│   │   ├── src/
│   │   │   ├── tools/
│   │   │   ├── patterns/
│   │   │   └── env.mjs
│   │   ├── package.json
│   │   └── index.mjs
│   │
│   ├── domain-labor/
│   │   ├── src/
│   │   │   ├── tools/
│   │   │   └── env.mjs
│   │   ├── package.json
│   │   └── index.mjs
│   │
│   └── server/
│       ├── src/
│       │   └── index.mjs
│       └── package.json
│
├── apps/
│   ├── mcp-sales/
│   │   ├── index.mjs
│   │   ├── package.json
│   │   └── manifest.json
│   │
│   └── mcp-labor/
│       ├── index.mjs
│       ├── package.json
│       └── manifest.json
│
└── scripts/
    ├── ci/
    └── build/
```

### 3.2 Package Exports
```javascript
// packages/core-auth/index.mjs
export { getPowerBIToken } from './src/msal-auth.mjs';
export { TokenCache } from './src/token-cache.mjs';

// packages/core-powerbi/index.mjs
export {
  executeDaxQuery,
  assertSchema,
  getDatasetInfo
} from './src/connector.mjs';

// packages/domain-sales/index.mjs
export * as tools from './src/tools/index.mjs';
export { getSalesIds } from './src/env.mjs';
```

### 3.3 App Entry Points
```javascript
// apps/mcp-sales/index.mjs
import { startServer } from '@mcp/server';
import { assertSchema } from '@mcp/core-powerbi';
import * as salesTools from '@mcp/domain-sales';
import { getSalesIds } from '@mcp/domain-sales/env';

async function main() {
  const { datasetId, workspaceId } = getSalesIds();

  // Boot validation - exit on fail
  try {
    await assertSchema(datasetId, workspaceId, 'sales');
  } catch (error) {
    console.error('[FATAL] Sales schema invalid:', error);
    process.exit(1);
  }

  // Start server with unique name
  await startServer({
    name: process.env.MCP_SERVER_NAME || 'usdm-sales-mcp',
    version: '28.0.0',
    tools: salesTools.tools
  });
}

main().catch(console.error);
```

---

## 📋 Phase 4: CI/CD & Documentation
**Goal**: Ensure nothing breaks, ever
**Parallel Agents**: 3

### 4.1 Enhanced CI Guards
```bash
#!/bin/bash
# scripts/ci/validate-architecture.sh

# 1. No cross-domain references
echo "Checking domain isolation..."
grep -R "LABOR_DATASET_ID" packages/domain-sales && exit 1
grep -R "SALES_DATASET_ID" packages/domain-labor && exit 1

# 2. No direct MSAL in domains
echo "Checking MSAL isolation..."
grep -R "msal" packages/domain-* && exit 1

# 3. Workspace IDs required
echo "Checking workspace requirements..."
grep -R "POWERBI_WORKSPACE_ID" packages/ && exit 1
grep -q "SALES_WORKSPACE_ID" packages/domain-sales/src/env.mjs || exit 1

# 4. Boot validation exists
echo "Checking boot validation..."
grep -q "assertSchema.*process.exit" apps/mcp-sales/index.mjs || exit 1

echo "✅ All architecture guards passed!"
```

### 4.2 Smoke Tests
```javascript
// scripts/test/smoke-test.mjs
import { spawn } from 'child_process';

async function testSalesApp() {
  process.env.SALES_DATASET_ID = 'ef5c8f43-19c5-44d4-b57e-71b788933b88';
  process.env.SALES_WORKSPACE_ID = 'sales-workspace-guid';

  const sales = spawn('node', ['apps/mcp-sales/index.mjs']);

  // Test 1: Schema validation
  // Should see: "[SalesMCP] ✅ Schema validation passed"

  // Test 2: Try wrong dataset
  process.env.SALES_DATASET_ID = 'ea5298a1-13f0-4629-91ab-14f98163532e'; // Labor!
  // Should see: "[FATAL] Sales schema invalid" and exit(1)

  // Test 3: Data source info
  // Call get_data_source_info
  // Should return sales dataset, not labor
}
```

---

## 🚀 Execution Plan with Agents

### Parallel Execution Strategy

```javascript
// Launch all agents in parallel for maximum speed
Task("backend-developer", "Implement workspace ID separation in connector.mjs");
Task("backend-developer", "Add boot-time validation to all servers");
Task("msal-auth-expert", "Implement token disk caching with SHA keys");
Task("performance-optimizer", "Add retry logic with exponential backoff");
Task("project-analyst", "Restructure to packages/apps layout");
Task("documentation-specialist", "Update all architecture docs");
Task("code-reviewer", "Validate no breaking changes");
```

### Agent Assignments

| Agent | Tasks | Priority |
|-------|-------|----------|
| **backend-developer #1** | Workspace ID updates | HIGH |
| **backend-developer #2** | Boot validation | HIGH |
| **msal-auth-expert** | Token caching + retry | HIGH |
| **project-analyst** | Package restructure | MEDIUM |
| **code-reviewer** | Continuous validation | ONGOING |
| **documentation-specialist** | Update docs | LOW |

---

## ✅ Success Criteria

### Functional Requirements
- [ ] Workspace IDs fully separated
- [ ] Boot-time schema validation with exit(1)
- [ ] Token disk caching operational
- [ ] 20s timeout + 3 retries on auth
- [ ] Clean packages/apps structure
- [ ] All tests passing

### Non-Functional Requirements
- [ ] ZERO breaking changes
- [ ] No cross-domain queries possible
- [ ] 99%+ auth success rate
- [ ] <2min to add new domain
- [ ] All CI guards passing

### Documentation Updates
- [ ] ARCHITECTURE.md reflects 100% state
- [ ] README.md updated with new structure
- [ ] DEPLOYMENT.md with env vars
- [ ] TROUBLESHOOTING.md with common issues

---

## 🔒 Risk Mitigation

### During Implementation
1. **Create backup**: `git tag v27.3-before-100-percent`
2. **Test each change**: Run smoke tests after each update
3. **Incremental commits**: One feature per commit
4. **Parallel branches**: Each agent works on separate branch

### Validation Steps
```bash
# After each phase
./scripts/ci/validate-architecture.sh
./scripts/test/smoke-test.mjs
./scripts/check-sales-guards.sh

# Final validation
npm test
mcpb validate manifest.json
```

---

## 📅 Timeline

### Day 1 (Critical Safety)
- Morning: Workspace ID separation
- Afternoon: Boot validation
- Evening: Test & validate

### Day 2 (Reliability)
- Morning: Token caching
- Afternoon: Retry logic
- Evening: Integration test

### Day 3 (Architecture)
- Morning: Package restructure
- Afternoon: App entry points
- Evening: CI/CD updates

### Day 4 (Polish)
- Morning: Documentation
- Afternoon: Final testing
- Evening: Deploy v28.0

---

## 🎉 End State

When complete, we'll have:
1. **100% architectural compliance**
2. **Zero possibility of cross-domain queries**
3. **Production-ready reliability**
4. **Clean, maintainable structure**
5. **Complete documentation**
6. **Automated guards against regression**

Ready to execute? Let's launch the agents! 🚀