# Generic Tool Implementations

This directory contains generic MCP tools that work across all domains.

## Components

- `base-tool.ts` - Abstract tool class
- `generic-tools.ts` - Domain-agnostic tool implementations

## Generic Tools Replace Domain-Specific Tools

Instead of separate tools for each domain:
- `get_metric` - Universal metric retrieval by dimension
- `analyze_trend` - Time series analysis for any metric
- `compare_entities` - Cross-entity comparison
- `forecast` - ML-based forecasting
- `get_insights` - Automated insight discovery

Configuration drives behavior, not code changes.