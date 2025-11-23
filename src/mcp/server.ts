/**
 * AutomatosX MCP Server
 *
 * Implements stdio JSON-RPC server for Model Context Protocol (MCP).
 * Exposes AutomatosX capabilities as MCP tools for Claude Code and other clients.
 */

import { join } from 'path';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { Mutex } from 'async-mutex'; // BUG FIX (v9.0.1): Added for initialization mutex
import { getVersion } from '../utils/version.js';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  McpInitializeRequest,
  McpInitializeResponse,
  McpToolListRequest,
  McpToolListResponse,
  McpToolCallRequest,
  McpToolCallResponse,
  McpTool,
  ToolHandler
} from './types.js';
import { McpErrorCode } from './types.js';
import { logger, setLogLevel } from '../utils/logger.js';
import { loadConfig } from '../core/config.js';
import { Router } from '../core/router.js';
import { LazyMemoryManager } from '../core/lazy-memory-manager.js';
import type { IMemoryManager } from '../types/memory.js';
import { SessionManager } from '../core/session-manager.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { ContextManager } from '../agents/context-manager.js';
import { ProfileLoader } from '../agents/profile-loader.js';
import { AbilitiesManager } from '../agents/abilities-manager.js';
import { TeamManager } from '../core/team-manager.js';
import { PathResolver } from '../core/path-resolver.js';
import { ConversationContextStore } from '../core/conversation-context-store.js';

// Import tool handlers - Phase 1
import { createRunAgentHandler } from './tools/run-agent.js';
import { createListAgentsHandler } from './tools/list-agents.js';
import { createSearchMemoryHandler } from './tools/search-memory.js';
import { createGetStatusHandler } from './tools/get-status.js';

// Import tool handlers - Phase 2: Sessions
import { createSessionCreateHandler } from './tools/session-create.js';
import { createSessionListHandler } from './tools/session-list.js';
import { createSessionStatusHandler } from './tools/session-status.js';
import { createSessionCompleteHandler } from './tools/session-complete.js';
import { createSessionFailHandler } from './tools/session-fail.js';

// Import tool handlers - Phase 2: Memory
import { createMemoryAddHandler } from './tools/memory-add.js';
import { createMemoryListHandler } from './tools/memory-list.js';
import { createMemoryDeleteHandler } from './tools/memory-delete.js';
import { createMemoryExportHandler } from './tools/memory-export.js';
import { createMemoryImportHandler } from './tools/memory-import.js';
import { createMemoryStatsHandler } from './tools/memory-stats.js';
import { createMemoryClearHandler } from './tools/memory-clear.js';

// Import tool handlers - Phase 3.1: Context Sharing
import { createGetConversationContextHandler } from './tools/get-conversation-context.js';
import { createInjectConversationContextHandler } from './tools/inject-conversation-context.js';

// Import tool handlers - Phase 3.1: Tool Chaining
import { createImplementAndDocumentHandler } from './tools/implement-and-document.js';

export interface McpServerOptions {
  debug?: boolean;
}

export class McpServer {
  // Use 'any' for heterogeneous tool handlers to avoid unsafe type casts
  // Runtime validation via validateToolInput provides type safety
  private tools: Map<string, ToolHandler<any, any>> = new Map();
  private toolSchemas: McpTool[] = [];
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private initializationMutex = new Mutex(); // BUG FIX (v9.0.1): Prevent concurrent initialization
  private version: string;
  private ajv: Ajv;
  private compiledValidators = new Map<string, ValidateFunction>();

  // Shared services (initialized once per server)
  private router!: Router;
  private memoryManager!: IMemoryManager;
  private sessionManager!: SessionManager;
  private workspaceManager!: WorkspaceManager;
  private contextManager!: ContextManager;
  private profileLoader!: ProfileLoader;
  private pathResolver!: PathResolver;
  private contextStore!: ConversationContextStore;

  constructor(options: McpServerOptions = {}) {
    if (options.debug) {
      setLogLevel('debug');
    }

    this.version = getVersion();
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);

    logger.info('[MCP Server] Initializing AutomatosX MCP Server', {
      version: this.version
    });
  }

  /**
   * Initialize shared services once per server process
   */
  private async initializeServices(): Promise<void> {
    logger.info('[MCP Server] Initializing shared services...');

    const projectDir = process.cwd();
    const config = await loadConfig(projectDir);

    // Initialize TeamManager
    const teamManager = new TeamManager(
      join(projectDir, '.automatosx', 'teams')
    );

    // Initialize ProfileLoader
    this.profileLoader = new ProfileLoader(
      join(projectDir, '.automatosx', 'agents'),
      undefined,
      teamManager
    );

    // Initialize AbilitiesManager
    const abilitiesManager = new AbilitiesManager(
      join(projectDir, '.automatosx', 'abilities')
    );

    // Initialize MemoryManager
    this.memoryManager = new LazyMemoryManager({
      dbPath: join(projectDir, '.automatosx', 'memory', 'memory.db')
    });

    // Initialize PathResolver
    this.pathResolver = new PathResolver({
      projectDir,
      workingDir: process.cwd(),
      agentWorkspace: join(projectDir, '.automatosx', 'workspaces')
    });

    // Initialize Providers
    const providers = [];
    if (config.providers['claude-code']?.enabled) {
      const { ClaudeProvider } = await import('../providers/claude-provider.js');
      providers.push(new ClaudeProvider({ ...config.providers['claude-code'], name: 'claude-code' }));
    }
    if (config.providers['gemini-cli']?.enabled) {
      const { GeminiProvider } = await import('../providers/gemini-provider.js');
      providers.push(new GeminiProvider({ ...config.providers['gemini-cli'], name: 'gemini-cli' }));
    }
    if (config.providers['openai']?.enabled) {
        const { createOpenAIProviderSync } = await import('../providers/openai-provider-factory.js');
        providers.push(createOpenAIProviderSync({ ...config.providers['openai'], name: 'openai' }, config.providers['openai'].integration));
    }

    // Initialize Router
    const healthCheckInterval = config.router?.healthCheckInterval;
    this.router = new Router({
      providers,
      fallbackEnabled: true,
      healthCheckInterval,
      providerCooldownMs: config.router?.providerCooldownMs,
      enableFreeTierPrioritization: config.router?.enableFreeTierPrioritization,
      enableWorkloadAwareRouting: config.router?.enableWorkloadAwareRouting
    });

    // Initialize SessionManager
    this.sessionManager = new SessionManager({
      persistencePath: join(projectDir, '.automatosx', 'sessions', 'sessions.json')
    });
    await this.sessionManager.initialize();

    // Initialize WorkspaceManager
    this.workspaceManager = new WorkspaceManager(projectDir);

    // Initialize ContextManager
    this.contextManager = new ContextManager({
      profileLoader: this.profileLoader,
      abilitiesManager,
      memoryManager: this.memoryManager,
      router: this.router,
      pathResolver: this.pathResolver,
      sessionManager: this.sessionManager,
      workspaceManager: this.workspaceManager
    });

    // Initialize ConversationContextStore (Phase 3.1)
    this.contextStore = new ConversationContextStore({
      storePath: join(projectDir, '.automatosx', 'context'),
      maxEntries: 100,
      ttlMs: 24 * 60 * 60 * 1000  // 24 hours
    });
    await this.contextStore.initialize();

    logger.info('[MCP Server] Services initialized successfully');
  }

  /**
   * Cleanup resources before shutdown
   */
  private async cleanup(): Promise<void> {
    logger.info('[MCP Server] Performing cleanup...');
    if (this.memoryManager) await this.memoryManager.close();
    logger.info('[MCP Server] Cleanup completed');
  }

  /**
   * Register Phase 1 tools
   */
  private registerTools(): void {
    logger.info('[MCP Server] Registering tools...');

    const register = (name: string, handler: ToolHandler<any,any>, schema: McpTool) => {
        this.tools.set(name, handler);
        this.toolSchemas.push(schema);
        this.compiledValidators.set(name, this.ajv.compile(schema.inputSchema));
    }

    register('run_agent', createRunAgentHandler({ contextManager: this.contextManager, executorConfig: { sessionManager: this.sessionManager, workspaceManager: this.workspaceManager, contextManager: this.contextManager, profileLoader: this.profileLoader } }), {
      name: 'run_agent',
      description: 'Execute an AutomatosX agent with a specific task',
      inputSchema: { type: 'object', properties: { agent: { type: 'string', description: 'The name of the agent to run (e.g., backend, Paris, Bob)' }, task: { type: 'string', description: 'The task for the agent to perform' }, provider: { type: 'string', description: 'Optional: Override the AI provider', enum: ['claude', 'gemini', 'openai'] }, no_memory: { type: 'boolean', description: 'Optional: Skip memory injection', default: false } }, required: ['agent', 'task'] }
    });

    register('list_agents', createListAgentsHandler({ profileLoader: this.profileLoader }), {
      name: 'list_agents',
      description: 'List all available AutomatosX agents',
      inputSchema: { type: 'object', properties: {} }
    });

    register('search_memory', createSearchMemoryHandler({ memoryManager: this.memoryManager }), {
      name: 'search_memory',
      description: 'Search AutomatosX memory for relevant information',
      inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' }, limit: { type: 'number', description: 'Maximum number of results', default: 10 } }, required: ['query'] }
    });

    register('get_status', createGetStatusHandler({ memoryManager: this.memoryManager, sessionManager: this.sessionManager, router: this.router }), {
      name: 'get_status',
      description: 'Get AutomatosX system status and configuration',
      inputSchema: { type: 'object', properties: {} }
    });

    register('session_create', createSessionCreateHandler({ sessionManager: this.sessionManager }), {
      name: 'session_create',
      description: 'Create a new multi-agent session',
      inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Session name/task description' }, agent: { type: 'string', description: 'Initiating agent name' } }, required: ['name', 'agent'] }
    });

    register('session_list', createSessionListHandler({ sessionManager: this.sessionManager }), {
      name: 'session_list',
      description: 'List all active sessions',
      inputSchema: { type: 'object', properties: {} }
    });

    register('session_status', createSessionStatusHandler({ sessionManager: this.sessionManager }), {
        name: 'session_status',
        description: 'Get detailed status of a specific session',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Session ID' } }, required: ['id'] }
    });

    register('session_complete', createSessionCompleteHandler({ sessionManager: this.sessionManager }), {
        name: 'session_complete',
        description: 'Mark a session as completed',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Session ID' } }, required: ['id'] }
    });

    register('session_fail', createSessionFailHandler({ sessionManager: this.sessionManager }), {
        name: 'session_fail',
        description: 'Mark a session as failed with an error reason',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Session ID' }, reason: { type: 'string', description: 'Failure reason' } }, required: ['id', 'reason'] }
    });

    register('memory_add', createMemoryAddHandler({ memoryManager: this.memoryManager }), {
        name: 'memory_add',
        description: 'Add a new memory entry to the system',
        inputSchema: { type: 'object', properties: { content: { type: 'string', description: 'Memory content' }, metadata: { type: 'object', description: 'Optional metadata (agent, timestamp, etc.)', properties: { agent: { type: 'string' }, timestamp: { type: 'string' } } } }, required: ['content'] }
    });

    register('memory_list', createMemoryListHandler({ memoryManager: this.memoryManager }), {
        name: 'memory_list',
        description: 'List memory entries with optional filtering',
        inputSchema: { type: 'object', properties: { agent: { type: 'string', description: 'Filter by agent name' }, limit: { type: 'number', description: 'Maximum number of entries', default: 50 } } }
    });

    register('memory_delete', createMemoryDeleteHandler({ memoryManager: this.memoryManager }), {
        name: 'memory_delete',
        description: 'Delete a specific memory entry by ID',
        inputSchema: { type: 'object', properties: { id: { type: 'number', description: 'Memory entry ID' } }, required: ['id'] }
    });

    register('memory_export', createMemoryExportHandler({ memoryManager: this.memoryManager, pathResolver: this.pathResolver }), {
        name: 'memory_export',
        description: 'Export all memory entries to a JSON file',
        inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Export file path' } }, required: ['path'] }
    });

    register('memory_import', createMemoryImportHandler({ memoryManager: this.memoryManager, pathResolver: this.pathResolver }), {
        name: 'memory_import',
        description: 'Import memory entries from a JSON file',
        inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Import file path' } }, required: ['path'] }
    });

    register('memory_stats', createMemoryStatsHandler({ memoryManager: this.memoryManager }), {
        name: 'memory_stats',
        description: 'Get detailed memory statistics',
        inputSchema: { type: 'object', properties: {} }
    });

    register('memory_clear', createMemoryClearHandler({ memoryManager: this.memoryManager }), {
        name: 'memory_clear',
        description: 'Clear all memory entries from the database',
        inputSchema: { type: 'object', properties: {} }
    });

    // Phase 3.1: Context Sharing
    register('get_conversation_context', createGetConversationContextHandler({ contextStore: this.contextStore }), {
        name: 'get_conversation_context',
        description: 'Retrieve conversation context from the shared context store',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Optional: Context ID to retrieve' }, source: { type: 'string', description: 'Optional: Filter by source (e.g., gemini-cli)' }, limit: { type: 'number', description: 'Optional: Max results (default: 10)', default: 10 } } }
    });

    register('inject_conversation_context', createInjectConversationContextHandler({ contextStore: this.contextStore }), {
        name: 'inject_conversation_context',
        description: 'Inject conversation context into the shared context store',
        inputSchema: { type: 'object', properties: { source: { type: 'string', description: 'Source assistant (e.g., gemini-cli, claude-code)' }, content: { type: 'string', description: 'Context content' }, metadata: { type: 'object', description: 'Optional metadata', properties: { topic: { type: 'string' }, participants: { type: 'array', items: { type: 'string' } }, tags: { type: 'array', items: { type: 'string' } } } } }, required: ['source', 'content'] }
    });

    // Phase 3.1: Tool Chaining
    register('implement_and_document', createImplementAndDocumentHandler({ contextManager: this.contextManager, executorConfig: { sessionManager: this.sessionManager, workspaceManager: this.workspaceManager, contextManager: this.contextManager, profileLoader: this.profileLoader } }), {
        name: 'implement_and_document',
        description: 'Implement code and generate documentation atomically to prevent documentation drift',
        inputSchema: { type: 'object', properties: { task: { type: 'string', description: 'Task description' }, agent: { type: 'string', description: 'Optional: Agent to use (default: backend)' }, documentation: { type: 'object', description: 'Documentation options', properties: { format: { type: 'string', enum: ['markdown', 'jsdoc'], description: 'Doc format (default: markdown)' }, outputPath: { type: 'string', description: 'Optional: Custom doc output path' }, updateChangelog: { type: 'boolean', description: 'Update CHANGELOG.md (default: true)', default: true } } }, provider: { type: 'string', enum: ['claude', 'gemini', 'openai'], description: 'Optional: AI provider override' } }, required: ['task'] }
    });

    logger.info('[MCP Server] Registered tools', {
      count: this.tools.size,
      tools: Array.from(this.tools.keys())
    });
  }

  /**
   * Handle MCP protocol messages
   */
  private async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, params, id } = request;
    logger.debug('[MCP Server] Handling request', { method, id });

    try {
      if (method === 'initialize') {
        return await this.handleInitialize(request as McpInitializeRequest, id ?? null);
      }
      if (method === 'tools/list') {
        return this.handleToolsList(request as McpToolListRequest, id ?? null);
      }
      if (method === 'tools/call') {
        return await this.handleToolCall(request as McpToolCallRequest, id ?? null);
      }
      return this.createErrorResponse(id ?? null, McpErrorCode.MethodNotFound, `Method not found: ${method}`);
    } catch (error) {
      logger.error('[MCP Server] Request handling failed', { method, error });
      return this.createErrorResponse(id ?? null, McpErrorCode.InternalError, `Internal error: ${(error as Error).message}`);
    }
  }

  /**
   * Handle initialize request
   * BUG FIX (v9.0.1): Added mutex to prevent concurrent initialization race conditions
   */
  private async handleInitialize(request: McpInitializeRequest, id: string | number | null): Promise<JsonRpcResponse> {
    logger.info('[MCP Server] Initialize request received', { clientInfo: request.params.clientInfo });

    // BUG FIX: Use mutex to prevent concurrent initialization attempts
    await this.initializationMutex.runExclusive(async () => {
      if (!this.initialized) {
        if (!this.initializationPromise) {
          logger.info('[MCP Server] Starting initialization (mutex-protected)');
          this.initializationPromise = (async () => {
            try {
              await this.initializeServices();
              this.registerTools();
              this.initialized = true;
              logger.info('[MCP Server] Initialization complete');
            } catch (error) {
              logger.error('[MCP Server] Initialization failed', {
                error: error instanceof Error ? error.message : String(error)
              });
              this.initializationPromise = null; // Allow retry on failure
              throw error;
            }
          })();
        }
        await this.initializationPromise;
      }
    });

    const response: McpInitializeResponse = {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'automatosx', version: this.version }
    };

    return { jsonrpc: '2.0', id, result: response };
  }

  /**
   * Handle tools/list request
   */
  private handleToolsList(_request: McpToolListRequest, id: string | number | null): JsonRpcResponse {
    logger.debug('[MCP Server] Tools list requested');
    if (!this.initialized) {
      return this.createErrorResponse(id, McpErrorCode.ServerNotInitialized, 'Server not initialized. Please send initialize request first.');
    }
    return { jsonrpc: '2.0', id, result: { tools: this.toolSchemas } };
  }

  /**
   * Validate tool input against its JSON schema.
   */
  private validateToolInput(toolName: string, input: Record<string, unknown>): { valid: boolean; error?: string } {
    const validate = this.compiledValidators.get(toolName);
    if (!validate) {
      return { valid: false, error: `No validator found for tool: ${toolName}` };
    }
    if (validate(input)) {
      return { valid: true };
    }
    return { valid: false, error: this.ajv.errorsText(validate.errors) };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(request: McpToolCallRequest, id: string | number | null): Promise<JsonRpcResponse> {
    const { name, arguments: args } = request.params;
    logger.info('[MCP Server] Tool call', { tool: name });

    if (!this.initialized) {
      return this.createErrorResponse(id, McpErrorCode.ServerNotInitialized, 'Server not initialized. Send initialize request first.');
    }

    const handler = this.tools.get(name);
    if (!handler) {
      return this.createErrorResponse(id, McpErrorCode.ToolNotFound, `Tool not found: ${name}`);
    }

    const validation = this.validateToolInput(name, args || {});
    if (!validation.valid) {
      return this.createErrorResponse(id, McpErrorCode.InvalidParams, validation.error || 'Invalid parameters');
    }

    try {
      const result = await handler(args || {});
      const response: McpToolCallResponse = { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      return { jsonrpc: '2.0', id, result: response };
    } catch (error) {
      logger.error('[MCP Server] Tool execution failed', { tool: name, error });
      const response: McpToolCallResponse = { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      return { jsonrpc: '2.0', id, result: response };
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(id: string | number | null, code: McpErrorCode, message: string): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }

  /**
   * Write MCP-compliant response with Content-Length framing
   */
  private writeResponse(response: JsonRpcResponse): void {
    const json = JSON.stringify(response);
    const contentLength = Buffer.byteLength(json, 'utf-8');
    const message = `Content-Length: ${contentLength}\r\n\r\n${json}`;
    process.stdout.write(message);
    logger.debug('[MCP Server] Response sent', { id: response.id, contentLength });
  }

  /**
   * Start stdio server with Content-Length framing
   *
   * BUG FIX (v9.0.1): Added iteration limit and buffer size checks to prevent infinite loops
   */
  async start(): Promise<void> {
    logger.info('[MCP Server] Starting stdio JSON-RPC server...');
    let buffer = '';
    let contentLength: number | null = null;

    // Safety limits to prevent infinite loops and excessive memory usage
    const MAX_ITERATIONS_PER_CHUNK = 100;
    const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_MESSAGE_SIZE = 5 * 1024 * 1024; // 5MB

    process.stdin.on('data', async (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');

      // BUG FIX: Check buffer size to prevent memory exhaustion
      if (buffer.length > MAX_BUFFER_SIZE) {
        logger.error('[MCP Server] Buffer size exceeded maximum', {
          bufferSize: buffer.length,
          maxSize: MAX_BUFFER_SIZE
        });
        buffer = ''; // Reset buffer
        contentLength = null;
        return;
      }

      // BUG FIX: Add iteration counter to prevent infinite loops
      let iterations = 0;
      while (iterations < MAX_ITERATIONS_PER_CHUNK) {
        iterations++;

        if (contentLength === null) {
          const headerEndIndex = buffer.indexOf('\r\n\r\n');
          if (headerEndIndex === -1) break;
          const headerBlock = buffer.slice(0, headerEndIndex);
          for (const line of headerBlock.split('\r\n')) {
            const [key, value] = line.split(':', 2).map(s => s.trim());
            if (key && key.toLowerCase() === 'content-length' && value) {
              contentLength = parseInt(value, 10);

              // BUG FIX: Validate content length
              if (isNaN(contentLength) || contentLength <= 0 || contentLength > MAX_MESSAGE_SIZE) {
                logger.error('[MCP Server] Invalid Content-Length', { contentLength });
                buffer = buffer.slice(headerEndIndex + 4);
                contentLength = null;
                continue;
              }
            }
          }
          if (contentLength === null) {
            logger.error('[MCP Server] No Content-Length header found');
            buffer = buffer.slice(headerEndIndex + 4);
            continue;
          }
          buffer = buffer.slice(headerEndIndex + 4);
        }

        if (Buffer.byteLength(buffer, 'utf-8') < contentLength) break;

        const messageBuffer = Buffer.from(buffer, 'utf-8');
        const jsonMessage = messageBuffer.slice(0, contentLength).toString('utf-8');
        buffer = messageBuffer.slice(contentLength).toString('utf-8');
        contentLength = null;

        try {
          const request = JSON.parse(jsonMessage) as JsonRpcRequest;
          logger.debug('[MCP Server] Request received', { method: request.method, id: request.id });
          const response = await this.handleRequest(request);
          if (request.id !== undefined && request.id !== null) {
            this.writeResponse(response);
          }
        } catch (error) {
          logger.error('[MCP Server] Failed to parse or handle request', { jsonMessage, error });
          this.writeResponse({ jsonrpc: '2.0', id: null, error: { code: McpErrorCode.ParseError, message: 'Parse error: Invalid JSON' } });
        }
      }

      // BUG FIX: Warn if iteration limit reached
      if (iterations >= MAX_ITERATIONS_PER_CHUNK) {
        logger.warn('[MCP Server] Maximum iterations reached in message processing', {
          iterations,
          bufferSize: buffer.length
        });
      }
    });

    process.stdin.on('end', () => {
        logger.info('[MCP Server] Server stopped (stdin closed)');
        this.cleanup().finally(() => process.exit(0));
    });
    process.on('SIGINT', () => {
        logger.info('[MCP Server] Received SIGINT, shutting down...');
        this.cleanup().finally(() => process.exit(0));
    });
    process.on('SIGTERM', () => {
        logger.info('[MCP Server] Received SIGTERM, shutting down...');
        this.cleanup().finally(() => process.exit(0));
    });

    logger.info('[MCP Server] Server started successfully (Content-Length framing)');
  }
}
