#!/usr/bin/env node
// Example: How to integrate MSAL authentication with Railway server
// This shows how to use the extracted V26.7 authentication module

const express = require('express');
const { auth, authTools, handleAuthTool } = require('./mcp-tools.js');

// Create Express app for Railway
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  const status = auth.getAuthStatus();
  res.json({
    healthy: true,
    authenticated: status.authenticated,
    tokens: status.tokens,
    version: 'V26.7-auth-module'
  });
});

// Authentication endpoints (REST API style)
app.post('/auth/start', async (req, res) => {
  try {
    const result = await auth.startLogin();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/auth/check', async (req, res) => {
  try {
    const result = await auth.checkLogin();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/auth/whoami', async (req, res) => {
  try {
    const result = await auth.whoami();
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/auth/logout', async (req, res) => {
  try {
    const result = auth.logout();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/auth/refresh', async (req, res) => {
  try {
    const result = await auth.refreshTokens();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MCP Tools endpoint (for Claude integration)
app.post('/mcp/tool', async (req, res) => {
  const { tool, args } = req.body;

  try {
    // Check if it's an auth tool
    if (['start_login', 'check_login', 'whoami', 'auth_status', 'refresh_tokens', 'logout'].includes(tool)) {
      const result = await handleAuthTool(tool, args);
      res.json(result);
    } else {
      // Handle other tools (PowerBI, DAX, etc.)
      // This is where you'd integrate other V26.7 tools
      res.status(404).json({ error: `Tool ${tool} not found` });
    }
  } catch (error) {
    res.status(500).json({
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
      isError: true
    });
  }
});

// Example: Protected PowerBI endpoint
app.post('/powerbi/query', async (req, res) => {
  const token = auth.getPowerBIToken();

  if (!token) {
    return res.status(401).json({
      error: 'Not authenticated. Please use /auth/start to login.'
    });
  }

  // Use the token for PowerBI API calls
  const { query } = req.body;

  // This is where you'd execute DAX queries
  // For now, just return a success message
  res.json({
    message: 'PowerBI token available',
    hasToken: true,
    // In real implementation: results from DAX query
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Railway server with V26.7 auth running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Start auth: POST http://localhost:${PORT}/auth/start`);
  console.log(`✅ Check auth: GET http://localhost:${PORT}/auth/check`);
  console.log(`👤 Who am I: GET http://localhost:${PORT}/auth/whoami`);
  console.log(`🔧 MCP Tools: POST http://localhost:${PORT}/mcp/tool`);
  console.log('\nAuthentication module: V26.7 golden source patterns preserved');
});