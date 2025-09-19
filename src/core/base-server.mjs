/**
 * Base MCP Server Class - Foundation for all domain MCPs
 * Provides core functionality: auth, PowerBI, cache, DAX, and common tools
 * Reference: restructure_plan_docs/BASE_SERVER_CLASS.md
 */

export class BaseMCPServer {
  constructor(domainConfig) {
    this.config = domainConfig;
    this.name = domainConfig.name;
    this.version = domainConfig.version;
    this.description = domainConfig.description;

    // Core services (will be initialized)
    this.authService = null;
    this.powerbiConnector = null;
    this.cacheManager = null;
    this.daxBuilder = null;
    this.schemaValidator = null;

    // Tool registry
    this.tools = new Map();
    this.initialized = false;
  }

  /**
   * Initialize all core services
   */
  async initialize() {
    console.log(`[${this.name}] Initializing domain server...`);

    try {
      // Step 1: Initialize core modules
      await this.initializeCoreServices();

      // Step 2: Validate schema if PowerBI configured
      if (this.config.schema) {
        await this.validateSchema();
      }

      // Step 3: Register common tools
      this.registerCommonTools();

      // Step 4: Register domain-specific tools
      await this.registerDomainTools();

      // Step 5: Custom initialization hook
      await this.onInitialize();

      this.initialized = true;
      console.log(`[${this.name}] ✅ Server initialized successfully`);
      console.log(`[${this.name}] ${this.tools.size} tools registered`);

      return true;
    } catch (error) {
      console.error(`[${this.name}] ❌ Initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Initialize core services (auth, PowerBI, cache, DAX)
   */
  async initializeCoreServices() {
    // Dynamic import of core modules
    const [authModule, powerbiModule, cacheModule, daxModule, schemaModule] = await Promise.all([
      import('./auth/msal-auth.mjs'),
      import('./powerbi/connector.mjs'),
      import('./cache/manager.mjs'),
      import('./dax/builder.mjs'),
      import('./schema/validator.mjs')
    ]);

    // Initialize services
    this.authService = authModule.default || authModule;
    this.powerbiConnector = powerbiModule.default || powerbiModule;
    this.cacheManager = cacheModule.default || cacheModule;
    this.daxBuilder = daxModule.DAXQueryBuilder || daxModule.default;

    // Schema validator needs PowerBI connector
    const SchemaValidator = schemaModule.SchemaValidator || schemaModule.default;
    if (SchemaValidator && typeof SchemaValidator === 'function') {
      this.schemaValidator = new SchemaValidator(this.powerbiConnector);
    }

    console.log(`[${this.name}] Core services initialized`);
  }

  /**
   * Validate PowerBI schema on startup
   */
  async validateSchema() {
    if (!this.schemaValidator) {
      console.log(`[${this.name}] Schema validator not available, skipping validation`);
      return;
    }

    console.log(`[${this.name}] Validating schema...`);
    const validationResult = await this.schemaValidator.validateOnStartup();

    if (!validationResult.valid) {
      console.error(`[${this.name}] ❌ Schema validation failed`);
      if (this.config.strictValidation) {
        throw new Error('Schema validation failed, cannot start server');
      }
    } else {
      console.log(`[${this.name}] ✅ Schema validated successfully`);
    }

    // Hook for post-validation
    await this.onSchemaValidated(validationResult);
  }

  /**
   * Register common tools available to all domains
   */
  registerCommonTools() {
    // Authentication tools
    this.registerTool('start_login', this.handleStartLogin.bind(this));
    this.registerTool('check_login', this.handleCheckLogin.bind(this));
    this.registerTool('whoami', this.handleWhoami.bind(this));
    this.registerTool('get_auth_status', this.handleAuthStatus.bind(this));

    // DAX query tool
    this.registerTool('execute_dax_query', this.handleExecuteDax.bind(this));

    // Cache management tools
    this.registerTool('get_cache_stats', this.handleCacheStats.bind(this));
    this.registerTool('clear_cache', this.handleClearCache.bind(this));

    // Schema validation tool
    this.registerTool('validate_schema', this.handleValidateSchema.bind(this));

    console.log(`[${this.name}] Common tools registered`);
  }

  /**
   * Register a tool with the server
   */
  registerTool(name, handler) {
    this.tools.set(name, handler);
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName, args = {}) {
    if (!this.initialized) {
      throw new Error(`Server not initialized`);
    }

    const handler = this.tools.get(toolName);
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    try {
      // Pre-execution hook
      await this.onToolCall(toolName, args);

      // Execute tool
      const result = await handler(args);

      return result;
    } catch (error) {
      // Error hook
      await this.onError(toolName, error);
      throw error;
    }
  }

  /**
   * Get list of available tools
   */
  getTools() {
    return Array.from(this.tools.keys());
  }

  // === Common Tool Handlers ===

  async handleStartLogin() {
    if (!this.authService || !this.authService.startLogin) {
      return {
        content: [{
          type: 'text',
          text: '❌ Authentication service not available'
        }],
        isError: true
      };
    }

    return await this.authService.startLogin();
  }

  async handleCheckLogin() {
    if (!this.authService || !this.authService.checkLogin) {
      return {
        content: [{
          type: 'text',
          text: '❌ Authentication service not available'
        }],
        isError: true
      };
    }

    return await this.authService.checkLogin();
  }

  async handleWhoami() {
    if (!this.authService || !this.authService.whoami) {
      return {
        content: [{
          type: 'text',
          text: '❌ Not authenticated. Please run start_login first.'
        }],
        isError: true
      };
    }

    return await this.authService.whoami();
  }

  async handleAuthStatus() {
    if (!this.authService || !this.authService.getAuthStatus) {
      return {
        content: [{
          type: 'text',
          text: '❌ Authentication service not available'
        }],
        isError: true
      };
    }

    return await this.authService.getAuthStatus();
  }

  async handleExecuteDax({ query }) {
    if (!query) {
      return {
        content: [{
          type: 'text',
          text: '❌ Query parameter required'
        }],
        isError: true
      };
    }

    if (!this.powerbiConnector || !this.powerbiConnector.executeDaxQuery) {
      return {
        content: [{
          type: 'text',
          text: '❌ PowerBI connector not available'
        }],
        isError: true
      };
    }

    try {
      const result = await this.powerbiConnector.executeDaxQuery(query);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ DAX query failed: ${error.message}`
        }],
        isError: true
      };
    }
  }

  async handleCacheStats() {
    if (!this.cacheManager || !this.cacheManager.getStats) {
      return {
        content: [{
          type: 'text',
          text: 'Cache not configured'
        }]
      };
    }

    const stats = await this.cacheManager.getStats();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(stats, null, 2)
      }]
    };
  }

  async handleClearCache() {
    if (!this.cacheManager || !this.cacheManager.clear) {
      return {
        content: [{
          type: 'text',
          text: 'Cache not configured'
        }]
      };
    }

    await this.cacheManager.clear();
    return {
      content: [{
        type: 'text',
        text: '✅ Cache cleared successfully'
      }]
    };
  }

  async handleValidateSchema() {
    if (!this.schemaValidator) {
      return {
        content: [{
          type: 'text',
          text: '❌ Schema validator not available'
        }],
        isError: true
      };
    }

    const result = await this.schemaValidator.validateOnStartup();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  // === Abstract Methods (to be implemented by domains) ===

  /**
   * Get required OAuth scopes for this domain
   * @abstract
   */
  getRequiredScopes() {
    // Default scopes - domains should override
    return [
      'https://graph.microsoft.com/User.Read',
      'https://analysis.windows.net/powerbi/api/.default'
    ];
  }

  /**
   * Register domain-specific tools
   * @abstract
   */
  async registerDomainTools() {
    // To be implemented by each domain
    console.log(`[${this.name}] No domain-specific tools registered`);
  }

  // === Extension Points (optional overrides) ===

  /**
   * Custom initialization hook
   */
  async onInitialize() {
    // Optional: domains can override for custom initialization
  }

  /**
   * Post-schema validation hook
   */
  async onSchemaValidated(validationResult) {
    // Optional: domains can override to handle validation results
  }

  /**
   * Tool execution interceptor
   */
  async onToolCall(toolName, args) {
    // Optional: domains can override to intercept tool calls
  }

  /**
   * Error handling hook
   */
  async onError(toolName, error) {
    // Optional: domains can override for custom error handling
    console.error(`[${this.name}] Tool '${toolName}' error:`, error.message);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log(`[${this.name}] Shutting down...`);

    // Custom shutdown hook
    await this.onShutdown();

    // Cleanup services
    if (this.cacheManager && this.cacheManager.close) {
      await this.cacheManager.close();
    }

    this.initialized = false;
    console.log(`[${this.name}] Shutdown complete`);
  }

  /**
   * Shutdown hook
   */
  async onShutdown() {
    // Optional: domains can override for cleanup
  }
}

export default BaseMCPServer;