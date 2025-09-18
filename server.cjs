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
console.log(`Railway Static URL: ${process.env.RAILWAY_STATIC_URL || 'not set'}`);
console.log(`Railway Public Domain: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'not set'}`);
console.log(`PORT (raw): "${process.env.PORT}"`);
console.log(`PORT (parsed): ${PORT}`);
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

// CRITICAL: MCP/RPC endpoint - Railway proxy pattern
app.post('/mcp/rpc', (req, res) => {
  const { method, params, id } = req.body;
  const authToken = req.headers.authorization?.replace('Bearer ', '');

  console.log(`MCP/RPC: ${method} (auth: ${authToken ? 'yes' : 'no'})`);

  // Handle tool calls
  if (method === 'tools/call') {
    const toolName = params?.name;

    if (toolName === 'start_login') {
      res.json({
        result: {
          content: [{
            type: 'text',
            text: `Device code authentication starting...
This endpoint confirms Railway proxy is working.
Full authentication being integrated.`
          }]
        },
        id: id || null
      });
    } else {
      res.json({
        result: {
          tool: toolName,
          status: 'operational',
          message: `Tool ${toolName} via MCP/RPC proxy`
        },
        id: id || null
      });
    }
  } else {
    res.json({
      result: {
        message: 'MCP/RPC endpoint operational',
        method: method
      },
      id: id || null
    });
  }
});

// MCP Streamable HTTP endpoint (SSE)
app.post('/mcp', (req, res) => {
  if (req.headers.accept === 'text/event-stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: {"status": "SSE endpoint operational"}\n\n');
  } else {
    res.json({
      status: 'MCP endpoint operational',
      transports: ['rpc', 'sse', 'websocket']
    });
  }
});

// Auth endpoints matching Railway pattern
app.get('/auth/login', (req, res) => {
  res.json({
    message: 'OAuth login endpoint',
    redirect: 'Would redirect to Microsoft login'
  });
});

app.get('/auth/callback', (req, res) => {
  res.json({
    message: 'OAuth callback endpoint',
    status: 'Would handle Microsoft callback'
  });
});

app.get('/auth/profile', (req, res) => {
  const authToken = req.headers.authorization?.replace('Bearer ', '');
  res.json({
    authenticated: !!authToken,
    profile: authToken ? { name: 'Test User' } : null
  });
});

// Direct tool execution endpoint
app.post('/api/tools/call', (req, res) => {
  const { tool, args } = req.body;
  res.json({
    tool: tool,
    result: `Direct tool execution: ${tool}`,
    args: args
  });
});

// Tools endpoint - Railway pattern
app.post('/api/tools/:toolName', (req, res) => {
  const { toolName } = req.params;
  const authToken = req.headers.authorization?.replace('Bearer ', '');

  res.status(200).json({
    tool: toolName,
    status: 'available',
    authenticated: !!authToken,
    message: `Tool ${toolName} ready via Railway proxy`,
    version: '27.0'
  });
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