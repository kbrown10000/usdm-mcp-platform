# MCP Platform - Multi-Domain Analytics Ecosystem

This repository contains the unified multi-MCP platform architecture following the PortingPlanDraft.md specifications.

## Directory Structure

### Core Components (100% reusable)
- `src/core/auth/` - MSAL authentication implementation
- `src/core/powerbi/` - PowerBI connector
- `src/core/cache/` - Caching layer
- `src/core/dax/` - DAX Abstraction Layer (NEW)
- `src/core/schema/` - Schema Management (NEW)

### Domain Implementations (5% domain-specific)
- `src/domains/labor/` - Labor analytics configuration
- `src/domains/sales/` - Sales pipeline configuration
- `src/domains/finance/` - Financial analytics configuration

### Shared Utilities
- `src/shared/analytics/` - Generic Analytics Engine
- `src/shared/tools/` - Generic Tool Implementations
- `src/shared/utils/` - Common utilities

### Templates & Scripts
- `templates/` - Domain, Railway, and MCPB templates
- `scripts/` - Migration, validation, and deployment scripts
- `tests/` - Unit, integration, and e2e tests
- `archive/v26.7-golden` - V26.7 golden baseline preservation

## Key Features

- **95%+ Code Reuse** through DAX Abstraction Layer
- **Configuration-Driven Domains** - New domains via JSON only
- **Generic Analytics Tools** - Same tools work across all domains
- **Multi-Agent Orchestration Ready** - LangGraph.js integration
- **TypeScript Throughout** - Single technology stack

## Next Steps

1. Migrate core components from existing v26.7 codebase
2. Create domain configurations for labor, sales, finance
3. Implement DAX abstraction layer
4. Add schema validation
5. Deploy to Railway with domain-specific environment variables

## Architecture

Single codebase, multiple Railway deployments:
- Each Railway project uses DOMAIN_CONFIG environment variable
- Same GitHub repo, different domain configurations
- Independent scaling per business domain