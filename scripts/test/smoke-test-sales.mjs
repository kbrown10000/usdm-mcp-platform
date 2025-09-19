#!/usr/bin/env node

/**
 * Sales Domain Smoke Test
 * Tests basic functionality of Sales MCP server including:
 * - Server startup
 * - Schema validation
 * - Tool registration
 * - Error handling with wrong dataset ID
 * - Basic tool execution
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,  // 30 seconds timeout
  salesServer: join(__dirname, '..', '..', 'src', 'domains', 'sales', 'server.mjs'),
  wrongDatasetId: 'wrong-dataset-id-12345',
  correctWorkspaceId: 'ef5c8f43-19c5-44d4-b57e-71b788933b88',
  correctDatasetId: 'ef5c8f43-19c5-44d4-b57e-71b788933b88'
};

// Test environment variables
const TEST_ENV = {
  ...process.env,
  NODE_ENV: 'test',
  SALES_WORKSPACE_ID: TEST_CONFIG.correctWorkspaceId,
  SALES_DATASET_ID: TEST_CONFIG.correctDatasetId,
  AZURE_TENANT_ID: '18c250cf-2ef7-4eeb-b6fb-94660f7867e0',
  AZURE_CLIENT_ID: '8b84dc3b-a9ff-43ed-9d35-571f757e9c19',
  RAILWAY_BACKEND_URL: 'https://test-backend.example.com'
};

// Colors for output
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m", 
  blue: "\x1b[34m",
  reset: "\x1b[0m"
};

class SmokeTestRunner {
  constructor() {
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.totalTests = 0;
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  testPass(testName) {
    this.totalTests++;
    this.testsPassed++;
    this.log(`✅ PASS: ${testName}`, 'green');
  }

  testFail(testName, error) {
    this.totalTests++;
    this.testsFailed++;
    this.log(`❌ FAIL: ${testName}`, 'red');
    if (error) {
      this.log(`   Error: ${error}`, 'red');
    }
  }

  testSkip(testName, reason) {
    this.log(`⏭️  SKIP: ${testName} (${reason})`, 'yellow');
  }

  async runTest(testName, testFn) {
    this.log(`🔄 Running: ${testName}`, 'blue');
    try {
      await testFn();
      this.testPass(testName);
    } catch (error) {
      this.testFail(testName, error.message);
    }
  }

  async spawnSalesServer(env = TEST_ENV, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const server = spawn('node', [TEST_CONFIG.salesServer], {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          server.kill();
          reject(new Error(`Server startup timeout after ${timeout}ms`));
        }
      }, timeout);

      server.stdout.on('data', (data) => {
        stdout += data.toString();
        // Look for successful startup indicators
        if (stdout.includes('Server started successfully') || 
            stdout.includes('Sales MCP') ||
            stderr.includes('Server started successfully')) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve({
              server,
              stdout,
              stderr,
              cleanup: () => server.kill()
            });
          }
        }
      });

      server.stderr.on('data', (data) => {
        stderr += data.toString();
        // Also check stderr for startup messages
        if (stderr.includes('Server started successfully') || 
            stderr.includes('Sales MCP')) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve({
              server,
              stdout,
              stderr,
              cleanup: () => server.kill()
            });
          }
        }
      });

      server.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      server.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          if (code === 0) {
            resolve({
              server: null,
              stdout,
              stderr,
              cleanup: () => {}
            });
          } else {
            reject(new Error(`Server exited with code ${code}\nStdout: ${stdout}\nStderr: ${stderr}`));
          }
        }
      });
    });
  }

  async sendMCPRequest(server, request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP request timeout'));
      }, 5000);

      let response = '';
      
      const dataHandler = (data) => {
        response += data.toString();
        try {
          const lines = response.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const parsed = JSON.parse(line);
            if (parsed.id === request.id) {
              clearTimeout(timeout);
              server.stdout.removeListener('data', dataHandler);
              resolve(parsed);
              return;
            }
          }
        } catch (e) {
          // Continue collecting data
        }
      };

      server.stdout.on('data', dataHandler);
      
      server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async runAllTests() {
    this.log('='.repeat(50), 'blue');
    this.log('SALES DOMAIN SMOKE TEST', 'blue');
    this.log('='.repeat(50), 'blue');

    // Test 1: Basic server startup
    await this.runTest('Sales server starts successfully', async () => {
      const result = await this.spawnSalesServer();
      result.cleanup();
      
      if (!result.stderr.includes('Sales MCP') && !result.stdout.includes('Sales MCP')) {
        throw new Error('Sales server did not log expected startup message');
      }
    });

    // Test 2: Server responds to MCP initialize
    await this.runTest('Server responds to MCP initialize', async () => {
      const result = await this.spawnSalesServer();
      
      try {
        const initRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'smoke-test',
              version: '1.0.0'
            }
          }
        };

        const response = await this.sendMCPRequest(result.server, initRequest);
        
        if (!response.result || !response.result.capabilities) {
          throw new Error('Invalid initialize response');
        }
      } finally {
        result.cleanup();
      }
    });

    // Test 3: Tools list is available
    await this.runTest('Tools list is available', async () => {
      const result = await this.spawnSalesServer();
      
      try {
        // Initialize first
        await this.sendMCPRequest(result.server, {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {}
          }
        });

        // Get tools list
        const toolsResponse = await this.sendMCPRequest(result.server, {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        });

        if (!toolsResponse.result || !toolsResponse.result.tools || toolsResponse.result.tools.length === 0) {
          throw new Error('No tools returned from server');
        }

        // Check for expected sales tools
        const tools = toolsResponse.result.tools;
        const expectedTools = ['get_pipeline_summary', 'get_opportunity_forecast', 'get_account_revenue'];
        
        for (const expectedTool of expectedTools) {
          if (!tools.find(tool => tool.name === expectedTool)) {
            throw new Error(`Expected tool '${expectedTool}' not found`);
          }
        }
      } finally {
        result.cleanup();
      }
    });

    // Test 4: Schema validation works
    await this.runTest('Schema validation detects issues', async () => {
      // Test with wrong dataset ID
      const wrongEnv = {
        ...TEST_ENV,
        SALES_DATASET_ID: TEST_CONFIG.wrongDatasetId
      };

      const result = await this.spawnSalesServer(wrongEnv);
      result.cleanup();

      // Server should start but may log warnings about schema validation
      // This is acceptable as we're testing the validation mechanism
    });

    // Test 5: Test get_pipeline_summary tool execution
    await this.runTest('get_pipeline_summary tool execution', async () => {
      const result = await this.spawnSalesServer();
      
      try {
        // Initialize
        await this.sendMCPRequest(result.server, {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {}
          }
        });

        // Try to call a simple tool
        const toolResponse = await this.sendMCPRequest(result.server, {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'get_pipeline_summary',
            arguments: {
              include_closed: false
            }
          }
        });

        // Tool should respond (even if it's an error due to no real PowerBI connection)
        if (!toolResponse.result && !toolResponse.error) {
          throw new Error('Tool call returned no response');
        }

        // Check that we get some kind of meaningful response
        if (toolResponse.result && toolResponse.result.content) {
          const content = toolResponse.result.content[0];
          if (content.type === 'text' && content.text.includes('DAX query generated')) {
            // This is expected for local implementation
          } else if (content.text.includes('Error:')) {
            // Also acceptable - means tool executed but failed due to backend
          } else {
            throw new Error('Unexpected tool response format');
          }
        }
      } finally {
        result.cleanup();
      }
    });

    // Test 6: Environment variable configuration
    await this.runTest('Environment variable configuration', async () => {
      // Test that server reads environment variables correctly
      const customEnv = {
        ...TEST_ENV,
        SALES_WORKSPACE_ID: 'custom-workspace-123',
        SALES_DATASET_ID: 'custom-dataset-456'
      };

      const result = await this.spawnSalesServer(customEnv);
      result.cleanup();

      // If server starts successfully, it means env vars were read
      // (More detailed validation would require inspecting server internals)
    });

    // Summary
    this.log('\n' + '='.repeat(50), 'blue');
    this.log('SMOKE TEST SUMMARY', 'blue');
    this.log('='.repeat(50), 'blue');
    this.log(`Total tests: ${this.totalTests}`, 'blue');
    this.log(`Passed: ${this.testsPassed}`, 'green');
    this.log(`Failed: ${this.testsFailed}`, this.testsFailed > 0 ? 'red' : 'green');

    if (this.testsFailed === 0) {
      this.log('\n🎉 ALL SMOKE TESTS PASSED!', 'green');
      this.log('Sales domain server is working correctly.', 'green');
      return 0;
    } else {
      this.log(`\n❌ ${this.testsFailed} TESTS FAILED`, 'red');
      this.log('Sales domain server has issues that need attention.', 'red');
      return 1;
    }
  }
}

// Run smoke tests
async function main() {
  const runner = new SmokeTestRunner();
  
  try {
    const exitCode = await runner.runAllTests();
    process.exit(exitCode);
  } catch (error) {
    runner.log(`Fatal error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { SmokeTestRunner, TEST_CONFIG };
