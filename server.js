#!/usr/bin/env node
/**
 * V27.0 Production Server - CommonJS version for Railway
 * Simplified version without ES modules for compatibility
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

// Parse PORT as integer - Railway provides as string
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';

console.log('========================================');
console.log('V27.0 Production Server Starting');
console.log('========================================');
console.log(`Environment: ${process.env.RAILWAY_ENVIRONMENT || 'development'}`);
console.log(`PORT: ${PORT}`);
console.log(`HOST: ${HOST}`);

// Create Express app
const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: '27.0',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.RAILWAY_ENVIRONMENT || 'development',
    node: process.version,
    platform: 'CommonJS fallback'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).send(`V27.0 Server Running on port ${PORT}`);
});

// MCP Discovery endpoint
app.get('/mcp/discover', (req, res) => {
  res.status(200).json({
    name: 'USDM MCP Platform',
    version: '27.0',
    description: 'Enterprise labor analytics platform with V26.7 functionality',
    status: 'operational',
    tools: [
      'start_login',
      'check_login',
      'whoami',
      'get_auth_status',
      'refresh_tokens',
      'person_resolver',
      'activity_for_person_month',
      'person_revenue_analysis',
      'person_utilization',
      'get_timecard_details',
      'run_dax'
    ],
    transport: ['http', 'websocket'],
    endpoints: {
      health: '/health',
      discover: '/mcp/discover',
      tools: '/api/tools/:toolName'
    },
    authentication: {
      type: 'MSAL',
      flow: 'device_code',
      provider: 'Microsoft'
    },
    powerbi: {
      workspace_id: process.env.POWERBI_WORKSPACE_ID || '927b94af-e7ef-4b5a-8b8d-02b0c5450b75',
      dataset_id: process.env.POWERBI_DATASET_ID || 'ea5298a1-13f0-4629-91ab-14f98163532e',
      expected_rows: 3238644
    }
  });
});

// Tools endpoint - placeholder for now
app.post('/api/tools/:toolName', (req, res) => {
  const { toolName } = req.params;

  // Basic response for testing
  if (toolName === 'start_login') {
    res.status(200).json({
      content: [{
        type: 'text',
        text: `Authentication would start here. ES modules being debugged.

This is the CommonJS fallback server to ensure Railway deployment works.`
      }]
    });
  } else {
    res.status(200).json({
      tool: toolName,
      status: 'available',
      message: `Tool ${toolName} is available but ES modules are being debugged`,
      version: '27.0'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.url
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Create HTTP server
const httpServer = http.createServer(app);

// Start server
httpServer.listen(PORT, HOST, () => {
  console.log(`
==========================================
V27.0 Production Server Started
==========================================
Local: http://${HOST}:${PORT}
Environment: ${process.env.RAILWAY_ENVIRONMENT || 'development'}

Endpoints:
  Health: http://${HOST}:${PORT}/health
  Discovery: http://${HOST}:${PORT}/mcp/discover
  Tools: POST http://${HOST}:${PORT}/api/tools/:toolName

Status: CommonJS fallback mode (ES modules being debugged)
Ready to receive requests...
==========================================
  `);
});

// Handle server errors
httpServer.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});