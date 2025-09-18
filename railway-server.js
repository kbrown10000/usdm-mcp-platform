#!/usr/bin/env node
/**
 * Railway Production Server - Based on working V26.7 patterns
 * This server follows the exact patterns from the working deployment
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const dotenv = require('dotenv');

// Load environment
dotenv.config();

// CRITICAL: Parse PORT as integer - matches working server pattern
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';

console.log('========================================');
console.log('V27.0 Railway Server Starting');
console.log('========================================');
console.log(`PORT from environment: ${process.env.PORT}`);
console.log(`Parsed PORT: ${PORT}`);
console.log(`HOST: ${HOST}`);

// Create Express app
const app = express();

// Apply middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint - MUST respond quickly for Railway
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: '27.0',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.RAILWAY_ENVIRONMENT || 'development',
    node: process.version
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).send(`V27.0 Railway Server Running on port ${PORT}`);
});

// MCP Discovery endpoint
app.get('/mcp/discover', (req, res) => {
  res.status(200).json({
    name: 'USDM MCP Platform',
    version: '27.0',
    description: 'Enterprise labor analytics platform',
    status: 'operational',
    tools: [
      'start_login',
      'check_login',
      'whoami',
      'person_resolver',
      'activity_for_person_month',
      'get_timecard_details'
    ],
    transport: ['http', 'websocket'],
    endpoints: {
      health: '/health',
      discover: '/mcp/discover',
      tools: '/api/tools'
    }
  });
});

// MCP endpoint placeholder
app.post('/mcp', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'MCP endpoint operational',
    version: '27.0'
  });
});

// API tools endpoint placeholder
app.post('/api/tools/:tool', (req, res) => {
  const { tool } = req.params;
  res.status(200).json({
    tool: tool,
    status: 'pending_migration',
    message: `Tool ${tool} is being migrated to V27.0`,
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

// Create HTTP server - matches working pattern
const httpServer = http.createServer(app);

// Start server - EXACT pattern from working deployment
httpServer.listen(PORT, HOST, () => {
  console.log(`
==========================================
V27.0 Railway Server Started
==========================================
Local: http://${HOST}:${PORT}
Environment: ${process.env.RAILWAY_ENVIRONMENT || 'development'}

Endpoints:
  Health: http://${HOST}:${PORT}/health
  Discovery: http://${HOST}:${PORT}/mcp/discover
  MCP: POST http://${HOST}:${PORT}/mcp

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

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});