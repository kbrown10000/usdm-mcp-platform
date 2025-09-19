#!/usr/bin/env node
/**
 * V27.0 Production Server - CommonJS version for Railway
 * Simplified version without ES modules for compatibility
 */

const express = require('express');
const cors = require('cors');
const http = require('http');

// Only load .env in development, not production
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Import railway integration module with V26.7 functionality
const railwayIntegration = require('./src/railway-integration.js');

// Debug: Check where PORT is coming from
const hasPORT = Object.prototype.hasOwnProperty.call(process.env, 'PORT');
console.log('[PORT CHECK]', { value: process.env.PORT, hasPORT });

// Safety: If in production and PORT is 8080, ignore it (likely from env file)
if (process.env.NODE_ENV === 'production' && process.env.PORT === '8080') {
  console.warn('[PORT SAFETY] Overriding suspicious PORT=8080 in production');
  delete process.env.PORT;
}

// Railway provides PORT env var - default to 8080 for local dev
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

// MCP Discovery endpoint - using V26.7 status
app.get('/mcp/discover', async (req, res) => {
  try {
    const status = await railwayIntegration.getStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error('[DISCOVER ERROR]', error);
    // Fallback to basic status
    res.status(200).json({
      name: 'USDM MCP Platform',
      version: '27.0',
      status: 'error',
      error: error.message
    });
  }
});

// CRITICAL: MCP/RPC endpoint - Using V26.7 functionality
app.post('/mcp/rpc', async (req, res) => {
  const { method, params, id } = req.body;
  const authToken = req.headers.authorization?.replace('Bearer ', '');

  console.log(`[MCP/RPC] Method: ${method} (auth: ${authToken ? 'yes' : 'no'})`);

  try {
    const result = await railwayIntegration.handleMcpRpc(method, params);
    res.json({
      ...result,
      id: id || null
    });
  } catch (error) {
    console.error('[MCP/RPC ERROR]', error);
    res.status(500).json({
      error: {
        code: -32603,
        message: error.message
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
app.post('/api/tools/call', async (req, res) => {
  const { tool, args } = req.body;

  try {
    const result = await railwayIntegration.executeTool(tool, args || {});
    res.json({
      tool: tool,
      result: result,
      success: true
    });
  } catch (error) {
    console.error('[TOOL CALL ERROR]', error);
    res.status(500).json({
      tool: tool,
      error: error.message,
      success: false
    });
  }
});

// Tools endpoint - Railway pattern
app.post('/api/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const authToken = req.headers.authorization?.replace('Bearer ', '');
  const args = req.body;

  try {
    const result = await railwayIntegration.executeTool(toolName, args || {});
    res.status(200).json({
      tool: toolName,
      result: result,
      authenticated: !!authToken,
      version: '27.0',
      success: true
    });
  } catch (error) {
    console.error(`[TOOL ERROR] ${toolName}:`, error);
    res.status(500).json({
      tool: toolName,
      error: error.message,
      authenticated: !!authToken,
      version: '27.0',
      success: false
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

  // Initialize V26.7 modules
  railwayIntegration.initialize()
    .then(() => {
      console.log('[INIT] V26.7 modules initialized successfully');
    })
    .catch((err) => {
      console.error('[INIT ERROR] Failed to initialize V26.7 modules:', err);
    });

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