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
import { getVersion } from '../shared/helpers/version.js';
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
  McpSession,
  ToolHandler,
  McpResourceListRequest,
  McpResourceReadRequest,
  McpResourceReadResponse,
  McpResourceTemplateListRequest,
  McpResourceTemplateReadRequest,
  McpResourceTemplateReadResponse,
  McpPromptListRequest,
  McpPromptGetRequest
} from './types.js';
import {
  McpErrorCode,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_VERSIONS,
  type SupportedMcpProtocolVersion
} from './types.js';
import { logger, setLogLevel } from '../shared/logging/logger.js';
import { loadConfig } from '../core/config/loader.js';
import { Router } from '../core/router/router.js';
import { LazyMemoryManager } from '../core/memory/lazy-manager.js';
import type { IMemoryManager } from '../types/memory.js';
import { SessionManager } from '../core/session/manager.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { ContextManager } from '../agents/context-manager.js';
import { ProfileLoader } from '../agents/profile-loader.js';
import { AbilitiesManager } from '../agents/abilities-manager.js';
import { TeamManager } from '../core/team-manager.js';
import { PathResolver } from '../shared/validation/path-resolver.js';
import { ConversationContextStore } from '../core/session/context-store.js';

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

// Import tool handlers - v10.5.0: Smart Routing
import { createGetAgentContextHandler } from './tools/get-agent-context.js';

// Import tool handlers - v13.0.0: Enhanced Service Discovery
import { createGetCapabilitiesHandler } from './tools/get-capabilities.js';

// Import tool handlers - v11.3.5: Task Engine
import {
  createCreateTaskHandler,
  createTaskSchema,
  createRunTaskHandler,
  runTaskSchema,
  createGetTaskResultHandler,
  getTaskResultSchema,
  createListTasksHandler,
  listTasksSchema,
  createDeleteTaskHandler,
  deleteTaskSchema
} from './tools/task/index.js';

// v10.6.0: MCP Client Pool for cross-provider execution
import { McpClientPool, getGlobalPool } from '../providers/mcp/pool-manager.js';

// v11.1.0: Unified Event System
import { getGlobalEventBridge, type EventBridge } from '../core/events/event-bridge.js';
import { McpStreamingNotifier, getGlobalStreamingNotifier } from './streaming-notifier.js';
import { ClaudeEventNormalizer } from '../core/events/normalizers/claude-normalizer.js';
import { GeminiEventNormalizer } from '../core/events/normalizers/gemini-normalizer.js';
import { CodexEventNormalizer } from '../core/events/normalizers/codex-normalizer.js';
// v12.0.0: Removed AxCliEventNormalizer (ax-cli deprecated)
import {
  listResourceTemplates,
  resolveResourceTemplate
} from './resource-templates.js';

export interface McpServerOptions {
  debug?: boolean;
  /** v11.1.0: Enable streaming progress notifications */
  enableStreamingNotifications?: boolean;
  /** Allowlist of tool names; if set, only these tools can be invoked */
  toolAllowlist?: string[];
  /** Shared secret token required to call protected tools */
  authToken?: string;
}

/** Client name patterns for provider detection */
const CLIENT_PATTERNS: Array<[string[], McpSession['normalizedProvider']]> = [
  [['claude'], 'claude'],
  [['gemini'], 'gemini'],
  [['codex', 'openai'], 'codex']
  // v12.0.0: Removed ax-cli (deprecated)
];

/** Stdio buffer safety limits (prevent infinite loops and memory exhaustion) */
const STDIO_MAX_ITERATIONS = 100;
const STDIO_MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB
const STDIO_MAX_MESSAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Normalize MCP client name to provider identifier
 */
function normalizeClientProvider(clientName: string): McpSession['normalizedProvider'] {
  const name = clientName.toLowerCase();
  for (const [patterns, provider] of CLIENT_PATTERNS) {
    if (patterns.some(p => name.includes(p))) return provider;
  }
  return 'unknown';
}

export class McpServer {
  // Use 'any' for heterogeneous tool handlers to avoid unsafe type casts
  // Runtime validation via validateToolInput provides type safety
  private tools: Map<string, ToolHandler<any, any>> = new Map();
  private toolSchemas: McpTool[] = [];
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private initializationMutex = new Mutex(); // BUG FIX (v9.0.1): Prevent concurrent initialization
  private stdinMutex = new Mutex(); // BUG FIX: Prevent race conditions in stdin message processing
  private version: string;
  private ajv: Ajv;
  private compiledValidators = new Map<string, ValidateFunction>();
  private cancelledRequests = new Set<string | number>(); // Track client-initiated cancellations
  private requestControllers = new Map<string | number, AbortController>(); // Abort long-running handlers
  private toolAllowlist?: Set<string>;
  private authToken?: string;

  // v10.5.0: MCP Session for Smart Routing
  private session: McpSession | null = null;

  // v10.6.0: MCP Client Pool for cross-provider execution
  private mcpPool: McpClientPool | null = null;

  // v11.1.0: Unified Event System
  private eventBridge: EventBridge | null = null;
  private streamingNotifier: McpStreamingNotifier | null = null;
  private enableStreamingNotifications = true;
  private negotiatedProtocolVersion: SupportedMcpProtocolVersion = MCP_PROTOCOL_VERSION;

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
    if (options.toolAllowlist?.length) {
      this.toolAllowlist = new Set(options.toolAllowlist);
    }
    if (options.authToken) {
      this.authToken = options.authToken;
    }

    // v11.1.0: Configure streaming notifications
    this.enableStreamingNotifications = options.enableStreamingNotifications ?? true;

    this.version = getVersion();
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);

    logger.info('[MCP Server] Initializing AutomatosX MCP Server', {
      version: this.version,
      streamingNotifications: this.enableStreamingNotifications
    });
  }

  /** Determine if negotiated protocol is v2 */
  private isV2Protocol(): boolean {
    return this.negotiatedProtocolVersion === MCP_SUPPORTED_VERSIONS[0];
  }

  /** Build capability set based on negotiated protocol */
  private buildCapabilities(): McpInitializeResponse['capabilities'] {
    const base = { tools: {} as Record<string, unknown> };
    if (this.isV2Protocol()) {
      return {
        ...base,
        resources: {},
        prompts: {},
        resourceTemplates: {},
        experimental: {}
      };
    }
    return base;
  }

  /**
   * Get static tool schemas (no initialization required)
   * Returns tool schemas that can be provided during MCP handshake
   * before services are initialized.
   */
  private static getStaticToolSchemas(): McpTool[] {
    return [
      {
        name: 'run_agent',
        description: 'Execute an AutomatosX agent with a specific task. Uses Smart Routing: returns context for same-provider calls, spawns cross-provider execution.',
        inputSchema: {
          type: 'object',
          properties: {
            agent: { type: 'string', description: 'The name of the agent to run (e.g., backend, Paris, Bob)' },
            task: { type: 'string', description: 'The task for the agent to perform' },
            provider: { type: 'string', description: 'Optional: Override the AI provider', enum: ['claude', 'gemini', 'openai'] },
            no_memory: { type: 'boolean', description: 'Optional: Skip memory injection', default: false },
            mode: { type: 'string', description: 'Optional: Execution mode - auto (default), context (always return context), execute (always spawn)', enum: ['auto', 'context', 'execute'], default: 'auto' }
          },
          required: ['agent', 'task']
        }
      },
      {
        name: 'list_agents',
        description: 'List all available AutomatosX agents',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'search_memory',
        description: 'Search AutomatosX memory for relevant information',
        inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' }, limit: { type: 'number', description: 'Maximum number of results', default: 10 } }, required: ['query'] }
      },
      {
        name: 'get_status',
        description: 'Get AutomatosX system status and configuration',
        inputSchema: { type: 'object', properties: {} }
      },
      // v13.0.0: Enhanced Service Discovery
      {
        name: 'get_capabilities',
        description: `Get comprehensive AutomatosX capabilities for service discovery.

Returns:
- providers: All AI providers with execution modes (cli/sdk/hybrid)
- agents: All available agent profiles with roles and abilities
- tools: All MCP tools organized by category
- memory: Memory system status (entries, limits)
- sessions: Session management status
- features: Enabled features (smart routing, streaming, etc.)

Use this tool first to understand what AutomatosX offers.`,
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'session_create',
        description: 'Create a new multi-agent session',
        inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Session name/task description' }, agent: { type: 'string', description: 'Initiating agent name' } }, required: ['name', 'agent'] }
      },
      {
        name: 'session_list',
        description: 'List all active sessions',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'session_status',
        description: 'Get detailed status of a specific session',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Session ID' } }, required: ['id'] }
      },
      {
        name: 'session_complete',
        description: 'Mark a session as completed',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Session ID' } }, required: ['id'] }
      },
      {
        name: 'session_fail',
        description: 'Mark a session as failed with an error reason',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Session ID' }, reason: { type: 'string', description: 'Failure reason' } }, required: ['id', 'reason'] }
      },
      {
        name: 'memory_add',
        description: 'Add a new memory entry to the system',
        inputSchema: { type: 'object', properties: { content: { type: 'string', description: 'Memory content' }, metadata: { type: 'object', description: 'Optional metadata (agent, timestamp, etc.)', properties: { agent: { type: 'string' }, timestamp: { type: 'string' } } } }, required: ['content'] }
      },
      {
        name: 'memory_list',
        description: 'List memory entries with optional filtering',
        inputSchema: { type: 'object', properties: { agent: { type: 'string', description: 'Filter by agent name' }, limit: { type: 'number', description: 'Maximum number of entries', default: 50 } } }
      },
      {
        name: 'memory_delete',
        description: 'Delete a specific memory entry by ID',
        inputSchema: { type: 'object', properties: { id: { type: 'number', description: 'Memory entry ID' } }, required: ['id'] }
      },
      {
        name: 'memory_export',
        description: 'Export all memory entries to a JSON file',
        inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Export file path' } }, required: ['path'] }
      },
      {
        name: 'memory_import',
        description: 'Import memory entries from a JSON file',
        inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Import file path' } }, required: ['path'] }
      },
      {
        name: 'memory_stats',
        description: 'Get detailed memory statistics',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'memory_clear',
        description: 'Clear all memory entries from the database',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'get_conversation_context',
        description: 'Retrieve conversation context from the shared context store',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Optional: Context ID to retrieve' }, source: { type: 'string', description: 'Optional: Filter by source (e.g., gemini-cli)' }, limit: { type: 'number', description: 'Optional: Max results (default: 10)', default: 10 } } }
      },
      {
        name: 'inject_conversation_context',
        description: 'Inject conversation context into the shared context store',
        inputSchema: { type: 'object', properties: { source: { type: 'string', description: 'Source assistant (e.g., gemini-cli, claude-code)' }, content: { type: 'string', description: 'Context content' }, metadata: { type: 'object', description: 'Optional metadata', properties: { topic: { type: 'string' }, participants: { type: 'array', items: { type: 'string' } }, tags: { type: 'array', items: { type: 'string' } } } } }, required: ['source', 'content'] }
      },
      {
        name: 'implement_and_document',
        description: 'Implement code and generate documentation atomically to prevent documentation drift',
        inputSchema: { type: 'object', properties: { task: { type: 'string', description: 'Task description' }, agent: { type: 'string', description: 'Optional: Agent to use (default: backend)' }, documentation: { type: 'object', description: 'Documentation options', properties: { format: { type: 'string', enum: ['markdown', 'jsdoc'], description: 'Doc format (default: markdown)' }, outputPath: { type: 'string', description: 'Optional: Custom doc output path' }, updateChangelog: { type: 'boolean', description: 'Update CHANGELOG.md (default: true)', default: true } } }, provider: { type: 'string', enum: ['claude', 'gemini', 'openai'], description: 'Optional: AI provider override' } }, required: ['task'] }
      },
      // v10.5.0: Smart Routing - Explicit context retrieval
      {
        name: 'get_agent_context',
        description: 'Get agent context without executing. Returns profile, relevant memory, and enhanced prompt for AI assistant to execute directly.',
        inputSchema: {
          type: 'object',
          properties: {
            agent: { type: 'string', description: 'The name of the agent (e.g., backend, Paris, Bob)' },
            task: { type: 'string', description: 'The task description for context building' },
            includeMemory: { type: 'boolean', description: 'Include relevant memory entries (default: true)', default: true },
            maxMemoryResults: { type: 'number', description: 'Maximum memory entries to return (default: 5)', default: 5 }
          },
          required: ['agent', 'task']
        }
      },
      // v11.3.5: Task Engine tools
      createTaskSchema as McpTool,
      runTaskSchema as McpTool,
      getTaskResultSchema as McpTool,
      listTasksSchema as McpTool,
      deleteTaskSchema as McpTool
    ];
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

    // v10.6.0: Initialize MCP Client Pool for cross-provider execution
    // Uses global singleton pool with default config (defined in pool-manager.ts)
    this.mcpPool = getGlobalPool();

    // v11.1.0: Initialize Unified Event System
    this.eventBridge = getGlobalEventBridge({
      throttleMs: 100,
      throttledTypes: ['execution.token', 'execution.progress'],
      debug: process.env.AUTOMATOSX_LOG_LEVEL === 'debug'
    });

    // Register provider-specific normalizers
    this.eventBridge.registerNormalizer(new ClaudeEventNormalizer());
    this.eventBridge.registerNormalizer(new GeminiEventNormalizer());
    this.eventBridge.registerNormalizer(new CodexEventNormalizer());

    // Start streaming notifier if enabled
    if (this.enableStreamingNotifications) {
      this.streamingNotifier = getGlobalStreamingNotifier({
        enabled: true,
        eventBridge: this.eventBridge,
        debug: process.env.AUTOMATOSX_LOG_LEVEL === 'debug'
      });
      this.streamingNotifier.start();
      logger.info('[MCP Server] Streaming notifications enabled');
    }

    logger.info('[MCP Server] Services initialized successfully');
  }

  /**
   * Cleanup resources before shutdown
   */
  private async cleanup(): Promise<void> {
    logger.info('[MCP Server] Performing cleanup...');

    // v11.1.0: Stop streaming notifier
    if (this.streamingNotifier) {
      this.streamingNotifier.stop();
    }

    // Stop router health checks and provider timers
    if (this.router) {
      this.router.destroy();
    }

    // Clear request controllers
    this.requestControllers.clear();

    // Flush sessions to disk
    if (this.sessionManager) {
      await this.sessionManager.destroy();
    }

    // Close context store
    if (this.contextStore) {
      this.contextStore.destroy();
    }

    // v11.1.0: Destroy event bridge
    if (this.eventBridge) {
      this.eventBridge.destroy();
    }

    if (this.memoryManager) await this.memoryManager.close();
    // v10.6.0: Drain MCP Client Pool
    if (this.mcpPool) await this.mcpPool.drain();
    logger.info('[MCP Server] Cleanup completed');
  }

  /**
   * v11.1.0: Get the event bridge for external event publishing
   */
  getEventBridge(): EventBridge | null {
    return this.eventBridge;
  }

  /**
   * Register Phase 1 tools
   */
  private registerTools(): void {
    logger.info('[MCP Server] Registering tools...');

    // Use static schemas as single source of truth
    const staticSchemas = McpServer.getStaticToolSchemas();
    const schemaByName = new Map(staticSchemas.map(s => [s.name, s]));

    const register = (name: string, handler: ToolHandler<any, any>) => {
      const schema = schemaByName.get(name);
      if (!schema) {
        throw new Error(`No static schema found for tool: ${name}`);
      }
      this.tools.set(name, handler);
      this.toolSchemas.push(schema);
      this.compiledValidators.set(name, this.ajv.compile(schema.inputSchema));
    };

    // Phase 1: Core tools
    register('run_agent', createRunAgentHandler({
      contextManager: this.contextManager,
      executorConfig: {
        sessionManager: this.sessionManager,
        workspaceManager: this.workspaceManager,
        contextManager: this.contextManager,
        profileLoader: this.profileLoader
      },
      getSession: () => this.session,
      router: this.router,
      profileLoader: this.profileLoader,
      memoryManager: this.memoryManager,
      mcpPool: this.mcpPool ?? undefined,
      crossProviderMode: 'auto'
    }));

    register('list_agents', createListAgentsHandler({ profileLoader: this.profileLoader }));
    register('search_memory', createSearchMemoryHandler({ memoryManager: this.memoryManager }));
    register('get_status', createGetStatusHandler({ memoryManager: this.memoryManager, sessionManager: this.sessionManager, router: this.router }));

    // Phase 2: Session tools
    register('session_create', createSessionCreateHandler({ sessionManager: this.sessionManager }));
    register('session_list', createSessionListHandler({ sessionManager: this.sessionManager }));
    register('session_status', createSessionStatusHandler({ sessionManager: this.sessionManager }));
    register('session_complete', createSessionCompleteHandler({ sessionManager: this.sessionManager }));
    register('session_fail', createSessionFailHandler({ sessionManager: this.sessionManager }));

    // Phase 2: Memory tools
    register('memory_add', createMemoryAddHandler({ memoryManager: this.memoryManager }));
    register('memory_list', createMemoryListHandler({ memoryManager: this.memoryManager }));
    register('memory_delete', createMemoryDeleteHandler({ memoryManager: this.memoryManager }));
    register('memory_export', createMemoryExportHandler({ memoryManager: this.memoryManager, pathResolver: this.pathResolver }));
    register('memory_import', createMemoryImportHandler({ memoryManager: this.memoryManager, pathResolver: this.pathResolver }));
    register('memory_stats', createMemoryStatsHandler({ memoryManager: this.memoryManager }));
    register('memory_clear', createMemoryClearHandler({ memoryManager: this.memoryManager }));

    // Phase 3.1: Context Sharing
    register('get_conversation_context', createGetConversationContextHandler({ contextStore: this.contextStore }));
    register('inject_conversation_context', createInjectConversationContextHandler({ contextStore: this.contextStore }));

    // Phase 3.1: Tool Chaining
    register('implement_and_document', createImplementAndDocumentHandler({
      contextManager: this.contextManager,
      executorConfig: {
        sessionManager: this.sessionManager,
        workspaceManager: this.workspaceManager,
        contextManager: this.contextManager,
        profileLoader: this.profileLoader
      }
    }));

    // v10.5.0: Smart Routing - Explicit context retrieval
    register('get_agent_context', createGetAgentContextHandler({
      profileLoader: this.profileLoader,
      memoryManager: this.memoryManager
    }));

    // v13.0.0: Enhanced Service Discovery
    register('get_capabilities', createGetCapabilitiesHandler({
      memoryManager: this.memoryManager,
      sessionManager: this.sessionManager,
      router: this.router,
      profileLoader: this.profileLoader,
      toolSchemas: staticSchemas
    }));

    // v11.3.5: Task Engine tools
    register('create_task', createCreateTaskHandler({
      getSession: () => this.session
    }));
    register('run_task', createRunTaskHandler({
      getSession: () => this.session
    }));
    register('get_task_result', createGetTaskResultHandler());
    register('list_tasks', createListTasksHandler());
    register('delete_task', createDeleteTaskHandler());

    logger.info('[MCP Server] Registered tools', {
      count: this.tools.size,
      tools: Array.from(this.tools.keys())
    });
  }

  /**
   * v10.5.0: Get current MCP session for Smart Routing
   * Used by tools to detect caller provider and implement same-provider optimization
   */
  getSession(): McpSession | null {
    return this.session;
  }

  /**
   * Handle MCP protocol messages
   */
  private async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, id } = request;
    const responseId = id ?? null;
    logger.debug('[MCP Server] Handling request', { method, id });

    try {
      switch (method) {
        case 'initialize':
          return await this.handleInitialize(request as McpInitializeRequest, responseId);
        case 'tools/list':
          return this.handleToolsList(request as McpToolListRequest, responseId);
        case 'tools/call':
          return await this.handleToolCall(request as McpToolCallRequest, responseId);
        case 'resources/list':
          return await this.handleResourcesList(request as McpResourceListRequest, responseId);
        case 'resources/read':
          return await this.handleResourceRead(request as McpResourceReadRequest, responseId);
        case 'resources/templates/list':
          return await this.handleResourceTemplatesList(request as McpResourceTemplateListRequest, responseId);
        case 'resources/templates/read':
          return await this.handleResourceTemplateRead(request as McpResourceTemplateReadRequest, responseId);
        case 'prompts/list':
          return await this.handlePromptsList(request as McpPromptListRequest, responseId);
        case 'prompts/get':
          return await this.handlePromptGet(request as McpPromptGetRequest, responseId);
        case '$/cancelRequest':
          return this.handleCancelRequest(request, responseId);
        default:
          return this.createErrorResponse(responseId, McpErrorCode.MethodNotFound, `Method not found: ${method}`);
      }
    } catch (error) {
      logger.error('[MCP Server] Request handling failed', { method, error });
      return this.createErrorResponse(responseId, McpErrorCode.InternalError, `Internal error: ${(error as Error).message}`);
    }
  }

  /**
   * Handle initialize request
   * BUG FIX (v9.0.1): Added mutex to prevent concurrent initialization race conditions
   * v10.5.0: Capture clientInfo for Smart Routing
   */
  private async handleInitialize(request: McpInitializeRequest, id: string | number | null): Promise<JsonRpcResponse> {
    // BUG FIX: Validate clientInfo exists before accessing fields
    // Previously threw internal error for malformed requests instead of proper MCP error
    const clientInfo = request.params?.clientInfo;
    if (!clientInfo || typeof clientInfo.name !== 'string' || typeof clientInfo.version !== 'string') {
      logger.warn('[MCP Server] Invalid initialize request: missing or invalid clientInfo', {
        hasParams: !!request.params,
        hasClientInfo: !!clientInfo,
        clientInfo
      });
      return this.createErrorResponse(id, McpErrorCode.InvalidRequest, 'Invalid initialize request: clientInfo with name and version is required');
    }
    logger.info('[MCP Server] Initialize request received (fast handshake mode)', { clientInfo });

    // v10.5.0: Store session info for Smart Routing
    // This allows us to detect caller and return context instead of spawning same provider
    this.session = {
      clientInfo: {
        name: clientInfo.name,
        version: clientInfo.version,
      },
      normalizedProvider: normalizeClientProvider(clientInfo.name),
      initTime: Date.now(),
    };

    logger.info('[MCP Server] Session established', {
      clientName: clientInfo.name,
      normalizedProvider: this.session.normalizedProvider,
    });

    // v2: Negotiate protocol version (prefer client request if supported)
    const requestedProtocol = request.params?.protocolVersion;
    const negotiated = MCP_SUPPORTED_VERSIONS.find(version => version === requestedProtocol) ?? MCP_SUPPORTED_VERSIONS[0];
    this.negotiatedProtocolVersion = negotiated;

    // OPTIMIZATION (v10.3.1): Fast handshake - no blocking initialization!
    // Services are initialized lazily on first tool call instead of during handshake.
    // This reduces MCP startup time from 18s to < 10ms.

    const response: McpInitializeResponse = {
      protocolVersion: negotiated,
      capabilities: this.buildCapabilities(),
      serverInfo: { name: 'automatosx', version: this.version }
    };

    logger.info('[MCP Server] Initialize handshake complete (< 1ms)');
    return { jsonrpc: '2.0', id, result: response };
  }

  /**
   * Handle tools/list request
   *
   * OPTIMIZATION (v10.3.1): Use static tool schemas (no initialization required)
   * Returns tool schemas immediately without waiting for services to initialize.
   */
  private handleToolsList(_request: McpToolListRequest, id: string | number | null): JsonRpcResponse {
    logger.debug('[MCP Server] Tools list requested (static schemas)');

    // Return static schemas - no initialization required!
    const tools = McpServer.getStaticToolSchemas().map(schema => ({
      ...schema,
      // If allowlist is set, hide tools not allowed
      ...(this.toolAllowlist && !this.toolAllowlist.has(schema.name) ? { hidden: true } : {})
    }));
    return { jsonrpc: '2.0', id, result: { tools } };
  }

  /**
   * Handle resources/list request (exposes agent profiles as MCP resources)
   */
  private async handleResourcesList(_request: McpResourceListRequest, id: string | number | null): Promise<JsonRpcResponse> {
    await this.ensureInitialized();

    const agents = await this.profileLoader.listProfiles();
    const resources = agents.map(agent => ({
      uri: `agent/${agent}`,
      name: `Agent: ${agent}`,
      description: `AutomatosX agent profile for ${agent}`,
      mimeType: 'text/markdown'
    }));

    return { jsonrpc: '2.0', id, result: { resources } };
  }

  /**
   * Handle resources/templates/list request (v2 capability)
   */
  private async handleResourceTemplatesList(_request: McpResourceTemplateListRequest, id: string | number | null): Promise<JsonRpcResponse> {
    if (!this.isV2Protocol()) {
      return this.createErrorResponse(id, McpErrorCode.MethodNotFound, 'resources/templates/list is only available in MCP v2');
    }

    await this.ensureInitialized();
    const resourceTemplates = listResourceTemplates();
    return { jsonrpc: '2.0', id, result: { resourceTemplates } };
  }

  /**
   * Handle prompts/list request (expose common starter prompts)
   */
  private async handlePromptsList(_request: McpPromptListRequest, id: string | number | null): Promise<JsonRpcResponse> {
    await this.ensureInitialized();

    const prompts = [
      {
        name: 'agent_context',
        description: 'Get agent context and system prompt for a given agent name',
        arguments: [{ name: 'agent', required: true, description: 'Agent name' }]
      },
      {
        name: 'status',
        description: 'Get AutomatosX MCP status summary'
      }
    ];

    return { jsonrpc: '2.0', id, result: { prompts } };
  }

  /**
   * Handle prompts/get request
   */
  private async handlePromptGet(request: McpPromptGetRequest, id: string | number | null): Promise<JsonRpcResponse> {
    await this.ensureInitialized();
    const name = request.params?.name;

    if (!name) {
      return this.createErrorResponse(id, McpErrorCode.InvalidParams, 'Prompt name is required');
    }

    switch (name) {
      case 'agent_context': {
        const agent = request.params?.arguments?.agent;
        if (!agent) {
          return this.createErrorResponse(id, McpErrorCode.InvalidParams, 'agent argument is required');
        }
        try {
          const profile = await this.profileLoader.loadProfile(agent);
          const content = [
            { type: 'text', text: `System prompt for ${agent}:\n${profile.systemPrompt || 'No system prompt defined.'}` },
            { type: 'application/json', json: profile }
          ];
          return { jsonrpc: '2.0', id, result: { prompt: { name, description: 'Agent context', arguments: [{ name: 'agent', required: true }] }, content } };
        } catch (error) {
          return this.createErrorResponse(id, McpErrorCode.InternalError, `Failed to load agent: ${(error as Error).message}`);
        }
      }
      case 'status': {
        const summary = {
          version: this.version,
          providerCount: this.router?.providerCount ?? 0,
          streamingNotifications: this.enableStreamingNotifications
        };
        const content = [
          { type: 'text', text: `AutomatosX MCP status:\nVersion: ${summary.version}\nProviders: ${summary.providerCount}\nStreaming: ${summary.streamingNotifications}` },
          { type: 'application/json', json: summary }
        ];
        return { jsonrpc: '2.0', id, result: { prompt: { name, description: 'AutomatosX status' }, content } };
      }
      default:
        return this.createErrorResponse(id, McpErrorCode.MethodNotFound, `Prompt not found: ${name}`);
    }
  }

  /**
   * Handle resources/read request
   */
  private async handleResourceRead(request: McpResourceReadRequest, id: string | number | null): Promise<JsonRpcResponse> {
    await this.ensureInitialized();
    const uri = request.params?.uri;

    if (!uri || !uri.startsWith('agent/')) {
      return this.createErrorResponse(id, McpErrorCode.InvalidParams, 'Invalid resource URI. Expected agent/{name}.');
    }

    const agentName = uri.replace('agent/', '');
    try {
      const profile = await this.profileLoader.loadProfile(agentName);
      const summary = [
        `# ${agentName}`,
        profile.role ? `**Role:** ${profile.role}` : '',
        profile.abilities?.length ? `**Abilities:** ${profile.abilities.join(', ')}` : '',
        '',
        profile.systemPrompt || 'No system prompt defined.'
      ].filter(Boolean).join('\n');

      const contents: McpResourceReadResponse['contents'] = [
        { type: 'text', text: summary },
        { type: 'application/json', json: profile }
      ];

      return { jsonrpc: '2.0', id, result: { uri, mimeType: 'text/markdown', contents } };
    } catch (error) {
      return this.createErrorResponse(id, McpErrorCode.InternalError, `Failed to read resource: ${(error as Error).message}`);
    }
  }

  /**
   * Handle resources/templates/read request (v2 capability)
   */
  private async handleResourceTemplateRead(request: McpResourceTemplateReadRequest, id: string | number | null): Promise<JsonRpcResponse> {
    if (!this.isV2Protocol()) {
      return this.createErrorResponse(id, McpErrorCode.MethodNotFound, 'resources/templates/read is only available in MCP v2');
    }

    await this.ensureInitialized();
    const uri = request.params?.uri;
    try {
      if (!uri) {
        return this.createErrorResponse(id, McpErrorCode.InvalidParams, 'Missing resource template URI');
      }
      const resolved: McpResourceTemplateReadResponse = await resolveResourceTemplate(
        uri,
        request.params?.variables,
        this.profileLoader,
        this.workspaceManager
      );
      return { jsonrpc: '2.0', id, result: resolved };
    } catch (error) {
      return this.createErrorResponse(id, McpErrorCode.InternalError, `Failed to read resource template: ${(error as Error).message}`);
    }
  }

  /**
   * Validate tool input against its JSON schema.
   * Returns null if valid, or error message string if invalid.
   */
  private validateToolInput(toolName: string, input: Record<string, unknown>): string | null {
    const validate = this.compiledValidators.get(toolName);
    if (!validate) return `No validator found for tool: ${toolName}`;
    if (validate(input)) return null;
    return this.ajv.errorsText(validate.errors);
  }

  /** Create MCP tool response wrapper */
  private createToolResponse(id: string | number | null, result: unknown, isError = false): JsonRpcResponse {
    let content: McpToolCallResponse['content'];

    if (typeof result === 'string') {
      content = [{ type: 'text', text: result }];
    } else {
      content = [
        { type: 'application/json', json: result },
        { type: 'text', text: JSON.stringify(result, null, 2) }
      ];
    }

    const response: McpToolCallResponse = { content, ...(isError && { isError }) };
    return { jsonrpc: '2.0', id, result: response };
  }

  /**
   * Handle client cancellation ($/cancelRequest)
   */
  private handleCancelRequest(request: JsonRpcRequest, id: string | number | null): JsonRpcResponse {
    const params = (request as { params?: { id?: string | number; requestId?: string | number } }).params;
    const cancelId = params?.id ?? params?.requestId;

    if (cancelId === undefined || cancelId === null) {
      return this.createErrorResponse(id, McpErrorCode.InvalidParams, 'cancelRequest requires an id to cancel');
    }

    this.cancelledRequests.add(cancelId);
    logger.info('[MCP Server] Cancellation requested', { cancelId });

    // Abort handler if running
    const controller = this.requestControllers.get(cancelId);
    controller?.abort();

    // Respond with null result to acknowledge cancellation
    return { jsonrpc: '2.0', id, result: null };
  }

  /**
   * Ensure services are initialized (lazy initialization on first call)
   * OPTIMIZATION (v10.3.1): Moves 15-20s initialization from handshake to first request
   */
  private async ensureInitialized(): Promise<void> {
    await this.initializationMutex.runExclusive(async () => {
      if (this.initialized) return;

      if (!this.initializationPromise) {
        logger.info('[MCP Server] First tool call - initializing services (lazy loading)...');
        this.initializationPromise = (async () => {
          try {
            const startTime = Date.now();
            await this.initializeServices();
            this.registerTools();
            this.initialized = true;
            logger.info('[MCP Server] Services initialized successfully', { duration: `${Date.now() - startTime}ms` });
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
    });
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(request: McpToolCallRequest, id: string | number | null): Promise<JsonRpcResponse> {
    const { name, arguments: args } = request.params;
    logger.info('[MCP Server] Tool call', { tool: name });
    const requestId = id ?? null;

    // Allowlist enforcement
    if (this.toolAllowlist && !this.toolAllowlist.has(name)) {
      return this.createErrorResponse(id, McpErrorCode.InvalidRequest, `Tool not allowed: ${name}`);
    }

    // Auth enforcement for tools marked requiresAuth
    const schema = this.toolSchemas.find(t => t.name === name);
    if (schema?.requiresAuth && this.authToken) {
      const provided = (args as Record<string, unknown>)?.auth_token;
      if (provided !== this.authToken) {
        return this.createErrorResponse(id, McpErrorCode.InvalidRequest, 'Unauthorized: invalid auth token');
      }
    }

    // Create abort controller for this request (if id provided)
    const abortController = requestId !== null ? new AbortController() : null;
    if (requestId !== null && abortController) {
      this.requestControllers.set(requestId, abortController);
    }

    // If client already cancelled this request, short-circuit
    if (requestId !== null && this.cancelledRequests.has(requestId)) {
      this.cancelledRequests.delete(requestId);
      this.requestControllers.delete(requestId);
      return this.createErrorResponse(requestId, McpErrorCode.RequestCancelled, 'Request was cancelled');
    }

    await this.ensureInitialized();

    const handler = this.tools.get(name);
    if (!handler) {
      return this.createErrorResponse(id, McpErrorCode.ToolNotFound, `Tool not found: ${name}`);
    }

    const validationError = this.validateToolInput(name, args || {});
    if (validationError) {
      return this.createErrorResponse(id, McpErrorCode.InvalidParams, validationError);
    }

    try {
      const result = await handler(args || {}, { signal: abortController?.signal });
      // If a cancellation arrived while running, honor it
      if (requestId !== null && this.cancelledRequests.has(requestId)) {
        this.cancelledRequests.delete(requestId);
        this.requestControllers.delete(requestId);
        return this.createErrorResponse(requestId, McpErrorCode.RequestCancelled, 'Request was cancelled');
      }
      return this.createToolResponse(id, result);
    } catch (error) {
      const err = error as Error;
      const cancelled = err?.name === 'AbortError' || err?.message?.toLowerCase().includes('cancel');

      if (cancelled) {
        logger.info('[MCP Server] Tool execution cancelled', { tool: name, id: requestId ?? undefined });
        return this.createErrorResponse(id, McpErrorCode.RequestCancelled, 'Request was cancelled');
      }

      logger.error('[MCP Server] Tool execution failed', { tool: name, error });
      return this.createToolResponse(id, `Error: ${err?.message ?? String(error)}`, true);
    } finally {
      if (requestId !== null) {
        this.cancelledRequests.delete(requestId);
        this.requestControllers.delete(requestId);
      }
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(id: string | number | null, code: McpErrorCode, message: string): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }

  /**
   * Write MCP-compliant response using newline-delimited framing
   *
   * v12.2.0: Changed from Content-Length to newline-delimited framing
   * per official MCP specification: https://spec.modelcontextprotocol.io/specification/basic/transports/
   *
   * Format: JSON message followed by newline character
   * Reference: @modelcontextprotocol/sdk serializeMessage() uses: JSON.stringify(message) + '\n'
   */
  private writeResponse(response: JsonRpcResponse): void {
    const json = JSON.stringify(response);
    // Official MCP spec: messages are newline-delimited, no Content-Length header
    process.stdout.write(json + '\n');
    logger.debug('[MCP Server] Response sent', { id: response.id, length: json.length });
  }

  /**
   * Start stdio server with newline-delimited framing
   *
   * v12.2.0: Changed from Content-Length to newline-delimited framing
   * per official MCP specification: https://spec.modelcontextprotocol.io/specification/basic/transports/
   *
   * Format: Each JSON-RPC message is terminated by a newline character.
   * Messages MUST NOT contain embedded newlines.
   * Reference: @modelcontextprotocol/sdk ReadBuffer uses: buffer.indexOf('\n')
   *
   * BUG FIX (v9.0.1): Added iteration limit and buffer size checks to prevent infinite loops
   */
  async start(): Promise<void> {
    logger.info('[MCP Server] Starting stdio JSON-RPC server...');
    let buffer = '';

    process.stdin.on('data', (chunk: Buffer) => {
      // BUG FIX: Use mutex to serialize stdin chunk processing
      // Prevents race conditions when multiple data events fire rapidly
      void this.stdinMutex.runExclusive(async () => {
        buffer += chunk.toString('utf-8');

        // BUG FIX: Check buffer size to prevent memory exhaustion
        if (buffer.length > STDIO_MAX_BUFFER_SIZE) {
          logger.error('[MCP Server] Buffer size exceeded maximum', {
            bufferSize: buffer.length,
            maxSize: STDIO_MAX_BUFFER_SIZE
          });
          buffer = ''; // Reset buffer
          return;
        }

        // BUG FIX: Add iteration counter to prevent infinite loops
        let iterations = 0;

        // Process all complete messages (newline-delimited)
        while (iterations < STDIO_MAX_ITERATIONS) {
          iterations++;

          // Find newline delimiter (support both \n and \r\n)
          const newlineIndex = buffer.indexOf('\n');
          if (newlineIndex === -1) break; // No complete message yet

          // Extract the message (strip trailing \r if present for Windows compatibility)
          let jsonMessage = buffer.slice(0, newlineIndex);
          if (jsonMessage.endsWith('\r')) {
            jsonMessage = jsonMessage.slice(0, -1);
          }
          buffer = buffer.slice(newlineIndex + 1);

          // Skip empty lines
          if (jsonMessage.trim() === '') continue;

          // Validate message size
          if (jsonMessage.length > STDIO_MAX_MESSAGE_SIZE) {
            logger.error('[MCP Server] Message size exceeded maximum', {
              messageSize: jsonMessage.length,
              maxSize: STDIO_MAX_MESSAGE_SIZE
            });
            this.writeResponse({
              jsonrpc: '2.0',
              id: null,
              error: {
                code: McpErrorCode.InvalidRequest,
                message: `Message too large: ${jsonMessage.length} bytes`
              }
            });
            continue;
          }

          try {
            const request = JSON.parse(jsonMessage) as JsonRpcRequest;
            logger.debug('[MCP Server] Request received', { method: request.method, id: request.id });
            const response = await this.handleRequest(request);
            if (request.id !== undefined && request.id !== null) {
              this.writeResponse(response);
            }
          } catch (error) {
            logger.error('[MCP Server] Failed to parse or handle request', { error: (error as Error).message });
            this.writeResponse({ jsonrpc: '2.0', id: null, error: { code: McpErrorCode.ParseError, message: 'Parse error: Invalid JSON' } });
          }
        }

        // BUG FIX: Warn if iteration limit reached
        if (iterations >= STDIO_MAX_ITERATIONS) {
          logger.warn('[MCP Server] Maximum iterations reached in message processing', {
            iterations,
            bufferSize: buffer.length
          });
        }
      });
    });

    // Common shutdown handler
    const shutdown = (reason: string) => {
      logger.info(`[MCP Server] ${reason}`);
      this.cleanup().finally(() => process.exit(0));
    };

    process.stdin.on('end', () => shutdown('Server stopped (stdin closed)'));
    process.on('SIGINT', () => shutdown('Received SIGINT, shutting down...'));
    process.on('SIGTERM', () => shutdown('Received SIGTERM, shutting down...'));

    logger.info('[MCP Server] Server started successfully (newline-delimited framing)');
  }
}
