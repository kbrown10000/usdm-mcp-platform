#!/usr/bin/env node
/**
 * V27.0 Railway Server - Temporary direct implementation
 * Using V26.7 golden patterns until full migration complete
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Load environment
config();

const app = express();
// Railway provides PORT dynamically
const PORT = process.env.PORT || 3000;
console.log(`Railway PORT environment variable: ${process.env.PORT}`);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '27.0',
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      railway: process.env.RAILWAY_ENVIRONMENT || 'development'
    }
  });
});

// MCP discovery endpoint
app.get('/mcp/discover', (req, res) => {
  res.json({
    name: 'USDM Labor MCP Platform',
    version: '27.0',
    description: 'Modular MCP platform for enterprise labor analytics',
    tools: [
      'start_login',
      'check_login',
      'whoami',
      'person_resolver',
      'activity_for_person_month',
      'person_revenue_analysis',
      'person_utilization',
      'get_timecard_details',
      'get_cache_stats',
      'clear_cache',
      'run_dax'
    ],
    transport: ['http', 'websocket', 'sse'],
    authentication: {
      type: 'oauth2',
      provider: 'microsoft'
    }
  });
});

// Placeholder for MCP tools endpoint
app.post('/api/tools/:toolName', (req, res) => {
  const { toolName } = req.params;

  // For now, return a placeholder response
  res.json({
    tool: toolName,
    status: 'pending_migration',
    message: 'This tool is being migrated from V26.7 to V27.0 modular architecture',
    version: '27.0'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server - CRITICAL: Bind to 0.0.0.0 for Railway
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 V27.0 Railway Server running on port ${PORT}`);
  console.log(`📍 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🔍 Discovery: http://0.0.0.0:${PORT}/mcp/discover`);
  console.log(`✅ Environment: ${process.env.RAILWAY_ENVIRONMENT || 'development'}`);
  console.log(`🌐 Server is listening on 0.0.0.0:${PORT}`);
});

// Add server error handling
server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});