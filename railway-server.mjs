#!/usr/bin/env node
/**
 * Railway Production Server - Based on working V26.7 patterns
 * This server follows the exact patterns from the working deployment
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import axios from 'axios';

// Import authentication module
import {
  startLogin,
  checkLogin,
  whoami,
  logout,
  refreshTokens,
  getAuthStatus,
  getPowerBIToken,
  getGraphToken,
  getUSDMToken
} from './src/core/auth/msal-auth.mjs';

// Import DAX query builders
import {
  buildPersonResolverQuery,
  buildMonthlyActivityQuery,
  buildPersonRevenueQuery,
  buildTimecardDetailsQuery,
  buildValidationQueries,
  buildGeneralQueries,
  validateDateString,
  generateCacheKey,
  DATASET_CONSTANTS
} from './src/core/dax/queries.mjs';

// Load environment
dotenv.config();

// PowerBI Configuration - from extracted module
const WORKSPACE_ID = process.env.POWERBI_WORKSPACE_ID || '927b94af-e7ef-4b5a-8b8d-02b0c5450b75';
const DATASET_ID = process.env.POWERBI_DATASET_ID || 'ea5298a1-13f0-4629-91ab-14f98163532e';

// Query throttling
let activeQueries = 0;
const MAX_CONCURRENT = 3;

// Cache for person lookups
const personCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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

// PowerBI Query Functions
async function withDaxLimit(queryId, queryFn) {
  while (activeQueries >= MAX_CONCURRENT) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  activeQueries++;
  try {
    return await queryFn();
  } finally {
    activeQueries--;
  }
}

async function executeDax(query, powerbiToken) {
  if (!powerbiToken) {
    throw new Error('Not authenticated. PowerBI token required.');
  }

  try {
    const response = await axios.post(
      `https://api.powerbi.com/v1.0/myorg/groups/${WORKSPACE_ID}/datasets/${DATASET_ID}/executeQueries`,
      {
        queries: [{ query }],
        serializerSettings: { includeNulls: true }
      },
      {
        headers: {
          'Authorization': `Bearer ${powerbiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const result = response.data.results[0];
    if (result.error) {
      const errorMsg = result.error.message || 'Unknown error';
      let suggestion = '';

      if (errorMsg.includes('table')) {
        suggestion = '\n💡 Suggestion: Check table names - use labor, DIM_Team_Member, DIM_Date, etc.';
      } else if (errorMsg.includes('column')) {
        suggestion = '\n💡 Suggestion: Column names are case-sensitive. Use [Team Member Name] not [team member name]';
      } else if (errorMsg.includes('syntax')) {
        suggestion = '\n💡 Suggestion: Check DAX syntax - dates need DATE(year,month,day) format';
      }

      throw new Error(`PowerBI error: ${errorMsg}${suggestion}`);
    }

    return {
      success: true,
      data: result.tables[0]?.rows || [],
      rowCount: result.tables[0]?.rows?.length || 0
    };

  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('PowerBI token expired. Please refresh authentication.');
    }
    throw error;
  }
}

// Utility function for consistent error responses
function createErrorResponse(error, statusCode = 500) {
  return {
    success: false,
    error: error.message || error,
    timestamp: new Date().toISOString(),
    statusCode
  };
}

// Utility function for consistent success responses
function createSuccessResponse(data, message = 'Success') {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

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
  const authStatus = getAuthStatus();
  res.status(200).json({
    name: 'USDM MCP Platform',
    version: '27.0',
    description: 'Enterprise labor analytics platform',
    status: 'operational',
    authenticated: authStatus.authenticated,
    tokens: authStatus.tokens,
    tools: [
      'start_login',
      'check_login',
      'whoami',
      'get_auth_status',
      'refresh_tokens',
      'logout',
      'person_resolver',
      'activity_for_person_month',
      'person_revenue_analysis',
      'get_timecard_details',
      'validate_dataset',
      'list_team_members',
      'list_projects'
    ],
    transport: ['http', 'websocket'],
    endpoints: {
      health: '/health',
      discover: '/mcp/discover',
      tools: '/api/tools',
      auth: '/api/auth'
    },
    powerbi: {
      workspaceId: WORKSPACE_ID,
      datasetId: DATASET_ID,
      activeQueries,
      maxConcurrent: MAX_CONCURRENT
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

// Authentication Tools
app.post('/api/tools/start_login', async (req, res) => {
  try {
    console.log('🔐 Starting authentication flow...');
    const result = await startLogin();
    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

app.post('/api/tools/check_login', async (req, res) => {
  try {
    const result = await checkLogin();
    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('Check login error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

app.post('/api/tools/whoami', async (req, res) => {
  try {
    const result = await whoami();
    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('Whoami error:', error);
    res.status(401).json(createErrorResponse(error, 401));
  }
});

app.post('/api/tools/get_auth_status', async (req, res) => {
  try {
    const result = getAuthStatus();
    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

app.post('/api/tools/refresh_tokens', async (req, res) => {
  try {
    const result = await refreshTokens();
    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

app.post('/api/tools/logout', async (req, res) => {
  try {
    const result = logout();
    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

// PowerBI Analytics Tools
app.post('/api/tools/person_resolver', async (req, res) => {
  try {
    const { searchTerm, fuzzy = true } = req.body;

    if (!searchTerm) {
      return res.status(400).json(createErrorResponse('searchTerm is required', 400));
    }

    const powerbiToken = getPowerBIToken();
    if (!powerbiToken) {
      return res.status(401).json(createErrorResponse('Not authenticated. Please run start_login first.', 401));
    }

    // Check cache first
    const cacheKey = `person_${searchTerm.toLowerCase()}_${fuzzy}`;
    const cached = personCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return res.status(200).json(createSuccessResponse(cached.data, 'Found in cache'));
    }

    const { exactQuery, fuzzyQuery } = buildPersonResolverQuery(searchTerm, fuzzy);

    // Try exact match first
    let result = await withDaxLimit('person_exact', () => executeDax(exactQuery, powerbiToken));

    // If no exact match and fuzzy enabled, try fuzzy search
    if (result.rowCount === 0 && fuzzy) {
      result = await withDaxLimit('person_fuzzy', () => executeDax(fuzzyQuery, powerbiToken));
    }

    // Cache the result
    personCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('Person resolver error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

app.post('/api/tools/activity_for_person_month', async (req, res) => {
  try {
    const { personName, year, month } = req.body;

    if (!personName || !year || !month) {
      return res.status(400).json(createErrorResponse('personName, year, and month are required', 400));
    }

    const powerbiToken = getPowerBIToken();
    if (!powerbiToken) {
      return res.status(401).json(createErrorResponse('Not authenticated. Please run start_login first.', 401));
    }

    const query = buildMonthlyActivityQuery(personName, year, month);
    const result = await withDaxLimit('monthly_activity', () => executeDax(query, powerbiToken));

    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('Monthly activity error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

app.post('/api/tools/person_revenue_analysis', async (req, res) => {
  try {
    const { personName, startDate, endDate } = req.body;

    if (!personName || !startDate || !endDate) {
      return res.status(400).json(createErrorResponse('personName, startDate, and endDate are required', 400));
    }

    // Validate date formats
    validateDateString(startDate);
    validateDateString(endDate);

    const powerbiToken = getPowerBIToken();
    if (!powerbiToken) {
      return res.status(401).json(createErrorResponse('Not authenticated. Please run start_login first.', 401));
    }

    const query = buildPersonRevenueQuery(personName, startDate, endDate);
    const result = await withDaxLimit('revenue_analysis', () => executeDax(query, powerbiToken));

    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('Revenue analysis error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

app.post('/api/tools/get_timecard_details', async (req, res) => {
  try {
    const { personName, startDate, endDate, includeEmptyNotes = false } = req.body;

    if (!personName || !startDate || !endDate) {
      return res.status(400).json(createErrorResponse('personName, startDate, and endDate are required', 400));
    }

    // Validate date formats
    validateDateString(startDate);
    validateDateString(endDate);

    const powerbiToken = getPowerBIToken();
    if (!powerbiToken) {
      return res.status(401).json(createErrorResponse('Not authenticated. Please run start_login first.', 401));
    }

    const query = buildTimecardDetailsQuery(personName, startDate, endDate, includeEmptyNotes);
    const result = await withDaxLimit('timecard_details', () => executeDax(query, powerbiToken));

    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('Timecard details error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

// Dataset Validation Tools
app.post('/api/tools/validate_dataset', async (req, res) => {
  try {
    const powerbiToken = getPowerBIToken();
    if (!powerbiToken) {
      return res.status(401).json(createErrorResponse('Not authenticated. Please run start_login first.', 401));
    }

    const validationQuery = `EVALUATE ROW("LaborRows", COUNTROWS('labor'))`;
    const result = await withDaxLimit('validate_dataset', () => executeDax(validationQuery, powerbiToken));

    const rowCount = result.data?.[0]?.['[LaborRows]'] || 0;
    const expectedRowCount = DATASET_CONSTANTS.EXPECTED_LABOR_ROWS;
    const isValid = rowCount >= expectedRowCount * 0.95;

    const validation = {
      success: true,
      isValid,
      rowCount,
      expectedRowCount,
      datasetId: DATASET_ID,
      workspaceId: WORKSPACE_ID,
      message: isValid
        ? `✅ Dataset validated - ${rowCount.toLocaleString()} rows found`
        : `⚠️ Row count mismatch - Expected ~${expectedRowCount.toLocaleString()}, found ${rowCount.toLocaleString()}`
    };

    res.status(200).json(createSuccessResponse(validation));
  } catch (error) {
    console.error('Dataset validation error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

// General Data Tools
app.post('/api/tools/list_team_members', async (req, res) => {
  try {
    const powerbiToken = getPowerBIToken();
    if (!powerbiToken) {
      return res.status(401).json(createErrorResponse('Not authenticated. Please run start_login first.', 401));
    }

    const queries = buildGeneralQueries();
    const result = await withDaxLimit('list_team_members', () => executeDax(queries.allTeamMembers(), powerbiToken));

    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('List team members error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

app.post('/api/tools/list_projects', async (req, res) => {
  try {
    const powerbiToken = getPowerBIToken();
    if (!powerbiToken) {
      return res.status(401).json(createErrorResponse('Not authenticated. Please run start_login first.', 401));
    }

    const queries = buildGeneralQueries();
    const result = await withDaxLimit('list_projects', () => executeDax(queries.allProjects(), powerbiToken));

    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json(createErrorResponse(error));
  }
});

// Fallback for unimplemented tools
app.post('/api/tools/:tool', (req, res) => {
  const { tool } = req.params;
  res.status(404).json(createErrorResponse(`Tool '${tool}' not implemented in V27.0`, 404));
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

// Server initialization
async function initializeServer() {
  console.log('\n🚀 Initializing V27.0 MCP Platform...');

  // Initialize authentication system
  console.log('🔐 Authentication system initialized');
  const authStatus = getAuthStatus();
  console.log(`Auth Status: ${JSON.stringify(authStatus, null, 2)}`);

  // Initialize PowerBI connection info
  console.log('📊 PowerBI connector initialized');
  console.log(`Workspace: ${WORKSPACE_ID}`);
  console.log(`Dataset: ${DATASET_ID}`);
  console.log(`Max Concurrent Queries: ${MAX_CONCURRENT}`);

  console.log('✅ V27.0 Platform initialization complete\n');
}

// Create HTTP server - matches working pattern
const httpServer = http.createServer(app);

// Start server - EXACT pattern from working deployment
httpServer.listen(PORT, HOST, async () => {
  // Initialize platform components
  await initializeServer();

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

Authentication Tools:
  POST http://${HOST}:${PORT}/api/tools/start_login
  POST http://${HOST}:${PORT}/api/tools/check_login
  POST http://${HOST}:${PORT}/api/tools/whoami
  POST http://${HOST}:${PORT}/api/tools/get_auth_status
  POST http://${HOST}:${PORT}/api/tools/refresh_tokens
  POST http://${HOST}:${PORT}/api/tools/logout

Analytics Tools:
  POST http://${HOST}:${PORT}/api/tools/person_resolver
  POST http://${HOST}:${PORT}/api/tools/activity_for_person_month
  POST http://${HOST}:${PORT}/api/tools/person_revenue_analysis
  POST http://${HOST}:${PORT}/api/tools/get_timecard_details
  POST http://${HOST}:${PORT}/api/tools/validate_dataset
  POST http://${HOST}:${PORT}/api/tools/list_team_members
  POST http://${HOST}:${PORT}/api/tools/list_projects

PowerBI Configuration:
  Workspace: ${WORKSPACE_ID}
  Dataset: ${DATASET_ID}

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