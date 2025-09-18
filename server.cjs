#!/usr/bin/env node
/**
 * V27.0 Production Server - CommonJS version for Railway
 * Simplified version without ES modules for compatibility
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

// Railway provides PORT env var - default to 8080 for Railway
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

console.log('========================================');
console.log('V27.0 Production Server Starting');
console.log('========================================');
console.log(`Environment: ${process.env.NODE_ENV || process.env.RAILWAY_ENVIRONMENT || 'development'}`);
console.log(`Node Version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`PID: ${process.pid}`);
console.log(`PORT from env: ${process.env.PORT || 'not set (using default 8080)'}`);
console.log(`Binding to: ${HOST}:${PORT}`);
console.log(`Railway Project ID: ${process.env.RAILWAY_PROJECT_ID || 'not set'}`);
console.log(`Railway Service: ${process.env.RAILWAY_SERVICE_NAME || 'not set'}`);

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

// --- HEALTH & READINESS ---
let isReady = false;

// Trivial health: always 200 once ready, 503 during warmup
app.get('/health', (req, res) => {
  if (!isReady) return res.status(503).json({ status: 'starting' });
  res.status(200).json({
    status: 'ok',
    version: '27.0',
    ts: Date.now(),
    port: PORT
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

// CRITICAL: Ensure server starts listening immediately
console.log('[STARTUP] About to start listening...');
httpServer.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('[STARTUP ERROR]', err);
    process.exit(1);
  }
  console.log(`[SUCCESS] Server listening on ${HOST}:${PORT}`);
  console.log(`[SUCCESS] Server.listening = ${httpServer.listening}`);
  const address = httpServer.address();
  console.log(`[SUCCESS] Actual address: ${JSON.stringify(address)}`);
  console.log('==========================================');
  console.log('V27.0 Production Server Started');
  console.log('==========================================');
  console.log(`Local: http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.RAILWAY_ENVIRONMENT || 'development'}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  /health      - Health check`);
  console.log(`  GET  /             - Root endpoint`);
  console.log(`  GET  /mcp/discover - MCP Discovery`);
  console.log(`  POST /mcp/rpc      - MCP/RPC proxy`);
  console.log(`  POST /api/tools/*  - Tool endpoints`);
  console.log('');
  console.log('Status: CommonJS fallback mode');
  console.log('Ready to receive requests...');
  console.log('==========================================');

  // Micro-delay so frameworks/middleware settle before health is green
  setTimeout(() => {
    isReady = true;
    console.log('[READY] Health endpoint set to ready');
  }, 300);

  // Send ready signal
  if (process.send) {
    process.send('ready');
  }
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
  console.log('[SHUTDOWN] SIGTERM received, closing server gracefully...');
  httpServer.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('[SHUTDOWN] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received, closing server gracefully...');
  httpServer.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  // Don't exit, try to recover
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION] at:', promise, 'reason:', reason);
  // Don't exit, try to recover
});