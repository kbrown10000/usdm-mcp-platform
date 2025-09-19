# Schema Management Layer

This directory contains schema validation and management components.

## Components

- `validator.ts` - Runtime Schema Validation
- `discovery.ts` - Schema Auto-Discovery
- `versioning.ts` - Schema Version Control

## Purpose

Validate domain configurations against actual PowerBI schemas at startup to fail fast and prevent runtime errors. Ensures table names, column mappings, and metric definitions are valid before deployment.