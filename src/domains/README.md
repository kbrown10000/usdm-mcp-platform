# Domain Configurations

This directory contains business domain-specific configurations (only 5% of total code).

## Structure

Each domain folder contains:
- `config.json` - Domain configuration (schema, metrics, mappings)
- `metrics.json` - Metric definitions
- `mappings.json` - Column mappings

## Domains

- `labor/` - Team utilization, billing, project analytics
- `sales/` - Pipeline analysis, BANT scoring, win rates
- `finance/` - Revenue forecasting, burn rates, financial metrics

## Configuration-Driven Approach

New domains require only JSON configuration files - no code changes needed. The DAX abstraction layer and generic tools handle all implementation details.