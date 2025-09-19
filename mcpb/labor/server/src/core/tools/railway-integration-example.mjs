// Railway Server Integration Example for V26.7 Labor Tools
// This shows how to integrate the extracted tools with an Express/Railway server
// Based on the existing railway-server.js patterns

import express from 'express';
import cors from 'cors';
import toolsModule from './index.mjs';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: 'v26.7-tools-extraction',
    availableTools: toolsModule.getToolDefinitions().length
  });
});

// List all available tools
app.get('/api/tools', (req, res) => {
  try {
    const definitions = toolsModule.getToolDefinitions();
    res.json({
      success: true,
      count: definitions.length,
      tools: definitions.map(tool => ({
        name: tool.name,
        description: tool.description,
        requiredParams: tool.inputSchema.required || [],
        allParams: Object.keys(tool.inputSchema.properties || {})
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute a specific tool
app.post('/api/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;

  try {
    console.log(`🔧 Executing tool: ${toolName} with args:`, args);

    if (!toolsModule.hasToolHandler(toolName)) {
      return res.status(404).json({
        success: false,
        error: `Tool '${toolName}' not found`,
        availableTools: toolsModule.getToolDefinitions().map(t => t.name)
      });
    }

    // Execute the tool
    const result = await toolsModule.handleToolCall(toolName, args);

    // Convert MCP format to REST API format
    const response = {
      success: !result.isError,
      toolName,
      timestamp: new Date().toISOString(),
      result: {
        content: result.content,
        isError: result.isError || false
      }
    };

    if (result.isError) {
      res.status(400).json(response);
    } else {
      res.json(response);
    }

  } catch (error) {
    console.error(`❌ Tool ${toolName} execution error:`, error);
    res.status(500).json({
      success: false,
      toolName,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Batch tool execution
app.post('/api/tools/batch', async (req, res) => {
  const { tools } = req.body;

  if (!Array.isArray(tools)) {
    return res.status(400).json({
      success: false,
      error: 'Request body must contain "tools" array'
    });
  }

  try {
    console.log(`🔧 Executing ${tools.length} tools in batch`);

    const results = await Promise.allSettled(
      tools.map(async ({ name, args = {} }) => {
        if (!toolsModule.hasToolHandler(name)) {
          throw new Error(`Tool '${name}' not found`);
        }
        const result = await toolsModule.handleToolCall(name, args);
        return { name, result };
      })
    );

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      results: results.map((result, index) => ({
        tool: tools[index].name,
        status: result.status,
        ...(result.status === 'fulfilled'
          ? { data: result.value.result }
          : { error: result.reason.message })
      }))
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Batch execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Authentication flow endpoints (convenience wrappers)
app.post('/api/auth/start', async (req, res) => {
  try {
    const result = await toolsModule.handleToolCall('start_login', {});
    res.json({
      success: !result.isError,
      message: result.content[0].text,
      isError: result.isError
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/auth/status', async (req, res) => {
  try {
    const result = await toolsModule.handleToolCall('get_auth_status', {});
    res.json({
      success: !result.isError,
      message: result.content[0].text,
      isError: result.isError
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/check', async (req, res) => {
  try {
    const result = await toolsModule.handleToolCall('check_login', {});
    res.json({
      success: !result.isError,
      message: result.content[0].text,
      isError: result.isError
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Person analytics endpoints (convenience wrappers)
app.get('/api/person/:name/resolver', async (req, res) => {
  try {
    const result = await toolsModule.handleToolCall('person_resolver', {
      search_term: req.params.name,
      fuzzy: req.query.fuzzy !== 'false'
    });
    res.json({
      success: !result.isError,
      data: result.content[0].text,
      isError: result.isError
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/person/:name/activity/:year/:month', async (req, res) => {
  try {
    const result = await toolsModule.handleToolCall('activity_for_person_month', {
      person_name: req.params.name,
      year: parseInt(req.params.year),
      month: parseInt(req.params.month)
    });
    res.json({
      success: !result.isError,
      data: result.content[0].text,
      isError: result.isError
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cache management endpoints
app.get('/api/cache/stats', async (req, res) => {
  try {
    const result = await toolsModule.handleToolCall('get_cache_stats', {});
    res.json({
      success: !result.isError,
      data: result.content[0].text,
      isError: result.isError
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/cache/:type?', async (req, res) => {
  try {
    const args = req.params.type ? { cache_type: req.params.type } : {};
    const result = await toolsModule.handleToolCall('clear_cache', args);
    res.json({
      success: !result.isError,
      message: result.content[0].text,
      isError: result.isError
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /api/tools',
      'POST /api/tools/:toolName',
      'POST /api/tools/batch',
      'POST /api/auth/start',
      'GET /api/auth/status',
      'POST /api/auth/check',
      'GET /api/person/:name/resolver',
      'GET /api/person/:name/activity/:year/:month',
      'GET /api/cache/stats',
      'DELETE /api/cache/:type?'
    ]
  });
});

// Only start server if this file is run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(port, () => {
    console.log(`🚀 V26.7 Labor Tools Railway Server running on port ${port}`);
    console.log(`📊 Available tools: ${toolsModule.getToolDefinitions().length}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
    console.log(`📋 Tools list: http://localhost:${port}/api/tools`);
  });
}

export default app;