/**
 * MCP Server Composition Root (Bootstrap Module)
 *
 * This is the ONLY place in MCP Server that imports adapter implementations.
 * All other MCP Server code depends on port interfaces from contracts or core.
 *
 * Following Ports & Adapters (Hexagonal Architecture) pattern.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ============================================================================
// Adapter Imports - ONLY allowed in this file
// ============================================================================

import { createProviderRegistry as createRegistry } from '@defai.digital/provider-adapters';
import {
  DATA_DIR_NAME,
  DATABASE_FILENAME,
  ENV_DATA_DIR,
  ENV_STORAGE_MODE,
  STORAGE_MODE_MEMORY,
  EMBEDDING_DIMENSION_DEFAULT,
  SEMANTIC_NAMESPACE_DEFAULT,
  CACHE_HEALTH_CHECK_MS,
} from '@defai.digital/contracts';

// Trace store imports (for workflow tracing)
import {
  createInMemoryTraceStore,
  type TraceStore,
} from '@defai.digital/trace-domain';

// Session store imports (for collaboration sessions)
import {
  createSessionStore,
  createSessionManager,
  DEFAULT_SESSION_DOMAIN_CONFIG,
  type SessionStore,
  type SessionManager,
} from '@defai.digital/session-domain';

// Semantic context imports
import {
  createSemanticManager,
  createEmbeddingProvider,
  InMemorySemanticStore,
  type SemanticManager,
  type SemanticStorePort,
} from '@defai.digital/semantic-context';

// Step executor imports (for workflow execution)
import {
  createRealStepExecutor,
  type StepExecutor,
  type PromptExecutorLike,
  type DiscussionExecutorLike,
  type ToolExecutorLike,
} from '@defai.digital/workflow-engine';
import {
  createProviderPromptExecutor,
  type ProviderPromptExecutorConfig,
} from '@defai.digital/agent-domain';
import {
  createProviderBridge,
  createDiscussionExecutor,
  type ProviderRegistryLike as DiscussionProviderRegistryLike,
} from '@defai.digital/discussion-domain';
import {
  TIMEOUT_AGENT_STEP_DEFAULT,
  PROVIDER_DEFAULT,
  ToolExecutorErrorCodes,
} from '@defai.digital/contracts';

// Import tool handlers for tool executor bridge
// Note: This creates a module dependency cycle, but it's safe because:
// - TOOL_HANDLERS is a static object created at module load time
// - The tool files only call get* functions from this module at runtime
import { TOOL_HANDLERS } from './tools/index.js';
import type { ToolHandler, MCPToolResult } from './types.js';

// ============================================================================
// Types - re-exported for use in MCP Server code
// ============================================================================

export type ProviderRegistry = ReturnType<typeof createRegistry>;
export type { TraceStore } from '@defai.digital/trace-domain';
export type { SessionStore, SessionManager } from '@defai.digital/session-domain';
export type { SemanticManager } from '@defai.digital/semantic-context';

// ============================================================================
// Database Utilities (shared with CLI via same database file)
// ============================================================================

/**
 * Gets the data directory path (same as CLI)
 */
function getDataDirectory(): string {
  const customDir = process.env[ENV_DATA_DIR];
  if (customDir) {
    return customDir;
  }
  return join(homedir(), DATA_DIR_NAME);
}

/**
 * Gets the database file path
 */
function getDatabasePath(): string {
  return join(getDataDirectory(), DATABASE_FILENAME);
}

/**
 * Ensures the data directory exists
 */
function ensureDataDirectory(): void {
  const dir = getDataDirectory();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Gets the configured storage mode
 */
function getStorageMode(): 'sqlite' | 'memory' {
  const mode = process.env[ENV_STORAGE_MODE]?.toLowerCase();
  if (mode === STORAGE_MODE_MEMORY) {
    return 'memory';
  }
  return 'sqlite'; // Default to sqlite
}

// Cached database instance
let _database: unknown = null;

/**
 * Initialize SQLite trace store
 * Returns null if SQLite is unavailable
 */
async function initializeSqliteTraceStore(): Promise<TraceStore | null> {
  const storageMode = getStorageMode();
  if (storageMode === 'memory') {
    return null;
  }

  try {
    // Ensure data directory exists
    ensureDataDirectory();

    // Dynamic import of better-sqlite3
    const BetterSqlite3 = (await import('better-sqlite3')).default;
    const dbPath = getDatabasePath();
    _database = new BetterSqlite3(dbPath);

    // Enable WAL mode for better concurrent access
    // This allows multiple processes (e.g., ax monitor and ax mcp server) to
    // access the database simultaneously without "readonly database" errors
    const db = _database as { pragma: (sql: string) => unknown };
    db.pragma('journal_mode = WAL');

    // Dynamic import of SQLite adapter
    const sqliteModule = await import('@defai.digital/sqlite-adapter');
    const traceStore = sqliteModule.createSqliteTraceStore(_database as Parameters<typeof sqliteModule.createSqliteTraceStore>[0]);

    return traceStore;
  } catch (error) {
    // SQLite not available, will fall back to in-memory
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[MCP] SQLite trace store unavailable (${msg}), using in-memory storage`);
    return null;
  }
}

// ============================================================================
// Dependency Container
// ============================================================================

interface MCPDependencies {
  providerRegistry: ProviderRegistry;
  traceStore: TraceStore;
  sessionStore: SessionStore;
  sessionManager: SessionManager;
  semanticManager: SemanticManager;
  usingSqlite: boolean;
}

let _dependencies: MCPDependencies | null = null;
let _initialized = false;
let _asyncInitialized = false;

// ============================================================================
// Bootstrap Functions
// ============================================================================

/**
 * Create semantic manager with optional SQLite backend
 */
function createSemanticManagerWithStore(sqliteStore: SemanticStorePort | null): SemanticManager {
  const embeddingProvider = createEmbeddingProvider({ dimension: EMBEDDING_DIMENSION_DEFAULT });
  const store = sqliteStore ?? new InMemorySemanticStore(embeddingProvider);
  return createSemanticManager({
    embeddingPort: embeddingProvider,
    storePort: store,
    defaultNamespace: SEMANTIC_NAMESPACE_DEFAULT,
    autoEmbed: true,
  });
}

/**
 * Initialize SQLite semantic store
 * Returns null if SQLite is unavailable
 */
async function initializeSqliteSemanticStore(): Promise<SemanticStorePort | null> {
  if (_database === null) {
    return null;
  }

  try {
    const sqliteModule = await import('@defai.digital/sqlite-adapter');
    return sqliteModule.createSqliteSemanticStore(
      _database as Parameters<typeof sqliteModule.createSqliteSemanticStore>[0]
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[MCP] SQLite semantic store unavailable (${msg}), using in-memory storage`);
    return null;
  }
}

/**
 * Async initialization - call this at server startup to enable SQLite storage
 *
 * This initializes SQLite trace storage so traces persist across processes
 * and can be viewed in the dashboard (ax monitor).
 */
export async function initializeAsync(): Promise<void> {
  if (_asyncInitialized) {
    return;
  }

  // Create provider registry
  const providerRegistry = createRegistry();

  // Try to create SQLite trace store
  const sqliteTraceStore = await initializeSqliteTraceStore();
  const traceStore = sqliteTraceStore ?? createInMemoryTraceStore();
  const usingSqlite = sqliteTraceStore !== null;

  if (usingSqlite) {
    console.error('[MCP] Using SQLite trace storage at ' + getDatabasePath());
  }

  // Create semantic manager (with SQLite if available)
  const sqliteSemanticStore = usingSqlite ? await initializeSqliteSemanticStore() : null;
  const semanticManager = createSemanticManagerWithStore(sqliteSemanticStore);

  // Create shared session store and manager
  const sessionStore = createSessionStore();
  const sessionManager = createSessionManager(sessionStore, DEFAULT_SESSION_DOMAIN_CONFIG);

  // Build dependency container
  _dependencies = {
    providerRegistry,
    traceStore,
    sessionStore,
    sessionManager,
    semanticManager,
    usingSqlite,
  };

  _initialized = true;
  _asyncInitialized = true;
}

/**
 * Synchronous bootstrap - falls back to in-memory storage
 *
 * Called once at server startup. Wires adapters to ports.
 * This is the composition root - the only place that knows about concrete implementations.
 *
 * Prefer calling initializeAsync() first for persistent storage.
 */
export function bootstrap(): MCPDependencies {
  if (_initialized && _dependencies) {
    return _dependencies;
  }

  // Create provider registry
  const providerRegistry = createRegistry();

  // Create in-memory trace store (no SQLite in sync mode)
  const traceStore = createInMemoryTraceStore();

  // Create in-memory semantic manager
  const semanticManager = createSemanticManagerWithStore(null);

  // Create shared session store and manager
  const sessionStore = createSessionStore();
  const sessionManager = createSessionManager(sessionStore, DEFAULT_SESSION_DOMAIN_CONFIG);

  // Build dependency container
  _dependencies = {
    providerRegistry,
    traceStore,
    sessionStore,
    sessionManager,
    semanticManager,
    usingSqlite: false,
  };

  _initialized = true;
  return _dependencies;
}

/**
 * Get initialized dependencies
 * Auto-bootstraps if not already initialized
 */
export function getDependencies(): MCPDependencies {
  if (!_dependencies) {
    return bootstrap();
  }
  return _dependencies;
}

/**
 * Check if bootstrap has been called
 */
export function isBootstrapped(): boolean {
  return _initialized;
}

/**
 * Get provider registry
 */
export function getProviderRegistry(): ProviderRegistry {
  return getDependencies().providerRegistry;
}

/**
 * Get trace store for workflow event tracking
 */
export function getTraceStore(): TraceStore {
  return getDependencies().traceStore;
}

/**
 * Get session store for collaboration sessions
 */
export function getSessionStore(): SessionStore {
  return getDependencies().sessionStore;
}

/**
 * Get session manager for session operations
 */
export function getSessionManager(): SessionManager {
  return getDependencies().sessionManager;
}

/**
 * Get semantic manager for semantic search operations
 */
export function getSemanticManager(): SemanticManager {
  return getDependencies().semanticManager;
}

/**
 * Create a new provider registry instance
 * Use this when you need a fresh registry (e.g., for testing)
 */
export function createProviderRegistry(): ProviderRegistry {
  return createRegistry();
}

// ============================================================================
// Reset (for testing)
// ============================================================================

/**
 * Reset all dependencies (for testing)
 */
export function resetBootstrap(): void {
  // Close database if open
  if (_database !== null) {
    try {
      const db = _database as { close?: () => void };
      if (typeof db.close === 'function') {
        db.close();
      }
    } catch {
      // Ignore close errors
    }
    _database = null;
  }
  _dependencies = null;
  _initialized = false;
  _asyncInitialized = false;
  _stepExecutor = null;
}

// ============================================================================
// Tool Executor Bridge (for workflow tool steps)
// ============================================================================

/**
 * Parse MCPToolResult content into a usable value
 */
function parseToolResultContent(result: MCPToolResult): unknown {
  if (!result.content || result.content.length === 0) {
    return undefined;
  }

  // Get the first text content
  const textContent = result.content.find((c) => c.type === 'text');
  if (textContent?.text === undefined) {
    return undefined;
  }

  // Try to parse as JSON
  try {
    return JSON.parse(textContent.text);
  } catch {
    // Return as string if not JSON
    return textContent.text;
  }
}

/**
 * Result type matching ToolExecutorLike interface from workflow-engine
 */
interface ToolExecutorResult {
  success: boolean;
  output?: unknown;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  durationMs?: number;
}

/**
 * Creates a tool executor bridge that connects workflow tool steps to MCP tool handlers
 *
 * INV-TOOL-001: Validates inputs via TOOL_HANDLERS (which use wrapHandlersWithInputValidation)
 * INV-TOOL-002: Freezes outputs via createToolExecutionSuccess/Failure
 * INV-TOOL-003: Returns errors gracefully for unknown tools
 */
function createToolExecutorBridge(handlers: Record<string, ToolHandler>): ToolExecutorLike {
  const handlerMap = new Map(Object.entries(handlers));

  return {
    async execute(toolName: string, args: Record<string, unknown>): Promise<ToolExecutorResult> {
      const startTime = Date.now();

      const handler = handlerMap.get(toolName);
      if (!handler) {
        // INV-TOOL-003: Unknown tools return error, not throw
        return {
          success: false,
          error: `Tool not found: ${toolName}`,
          errorCode: ToolExecutorErrorCodes.TOOL_NOT_FOUND,
          retryable: false,
          durationMs: Date.now() - startTime,
        };
      }

      try {
        // Execute the handler (already validated by wrapHandlersWithInputValidation)
        const result = await handler(args);

        // Parse the MCPToolResult
        const output = parseToolResultContent(result);

        if (result.isError) {
          return {
            success: false,
            error: typeof output === 'string' ? output : JSON.stringify(output),
            errorCode: ToolExecutorErrorCodes.TOOL_EXECUTION_ERROR,
            retryable: true, // Most tool errors are retryable
            durationMs: Date.now() - startTime,
          };
        }

        return {
          success: true,
          output,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown tool execution error',
          errorCode: ToolExecutorErrorCodes.TOOL_EXECUTION_ERROR,
          retryable: true,
          durationMs: Date.now() - startTime,
        };
      }
    },

    isToolAvailable(toolName: string): boolean {
      return handlerMap.has(toolName);
    },

    getAvailableTools(): string[] {
      return [...handlerMap.keys()];
    },
  };
}

// Cached tool executor instance
let _toolExecutor: ToolExecutorLike | null = null;

/**
 * Get or create the tool executor bridge
 */
function getToolExecutorBridge(): ToolExecutorLike {
  if (_toolExecutor === null) {
    _toolExecutor = createToolExecutorBridge(TOOL_HANDLERS);
  }
  return _toolExecutor;
}

// ============================================================================
// Step Executor Factory (for workflow execution)
// ============================================================================

/**
 * Step executor configuration options
 */
export interface StepExecutorOptions {
  /**
   * Default provider for prompt steps
   */
  defaultProvider?: string;

  /**
   * Default timeout for provider calls in milliseconds
   */
  defaultTimeout?: number;

  /**
   * Whether to check provider health before discussions
   */
  checkProviderHealth?: boolean;
}

// Cached step executor instance
let _stepExecutor: StepExecutor | null = null;

/**
 * Creates a production step executor for workflow execution
 *
 * This wires together:
 * - ProviderPromptExecutor: For prompt steps (real LLM calls)
 * - DiscussionExecutor: For discuss steps (multi-model discussions)
 *
 * Following hexagonal architecture, this is the only place that
 * connects the workflow engine to concrete provider implementations.
 *
 * NOTE: This uses type assertions at boundaries because the workflow-engine's
 * "Like" interfaces don't exactly match the concrete implementations from
 * agent-domain and discussion-domain due to exactOptionalPropertyTypes.
 * The runtime behavior is correct; this is a TypeScript-only issue.
 *
 * @param options - Configuration options
 * @returns A StepExecutor that executes real LLM calls
 */
export function createProductionStepExecutor(
  options: StepExecutorOptions = {}
): StepExecutor {
  // Return cached executor if available
  if (_stepExecutor !== null) {
    return _stepExecutor;
  }

  const {
    defaultProvider = PROVIDER_DEFAULT,
    defaultTimeout = TIMEOUT_AGENT_STEP_DEFAULT,
    checkProviderHealth = false,
  } = options;

  // Get the provider registry
  const registry = getProviderRegistry();

  // Create prompt executor config
  const promptConfig: ProviderPromptExecutorConfig = {
    defaultProvider,
    defaultTimeout,
  };

  // Create prompt executor (for prompt steps)
  // Type assertion needed due to exactOptionalPropertyTypes differences
  const promptExecutor = createProviderPromptExecutor(
    registry,
    promptConfig
  ) as unknown as PromptExecutorLike;

  // Create provider bridge for discussion executor
  // The registry needs type adaptation for the bridge interface
  const registryForBridge = {
    get: (id: string) => registry.get(id),
    getAll: () => registry.getProviderIds()
      .map(id => registry.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined),
    has: (id: string) => registry.get(id) !== undefined,
  } as unknown as DiscussionProviderRegistryLike;

  const providerBridge = createProviderBridge(registryForBridge, {
    defaultTimeoutMs: defaultTimeout,
    performHealthChecks: checkProviderHealth,
    healthCheckCacheMs: CACHE_HEALTH_CHECK_MS,
  });

  // Create discussion executor (for discuss steps)
  // Type assertion needed due to interface differences in result types
  const discussionExecutor = createDiscussionExecutor(providerBridge, {
    defaultTimeoutMs: defaultTimeout,
    checkProviderHealth,
  }) as unknown as DiscussionExecutorLike;

  // Create tool executor bridge for workflow tool steps
  const toolExecutor = getToolExecutorBridge();

  // Create real step executor with wired dependencies
  _stepExecutor = createRealStepExecutor({
    promptExecutor,
    toolExecutor,
    discussionExecutor,
    defaultProvider,
  });

  return _stepExecutor;
}

/**
 * Get the cached step executor or create a new one
 */
export function getStepExecutor(options?: StepExecutorOptions): StepExecutor {
  if (_stepExecutor === null) {
    return createProductionStepExecutor(options);
  }
  return _stepExecutor;
}

/**
 * Reset the step executor (for testing)
 */
export function resetStepExecutor(): void {
  _stepExecutor = null;
  _toolExecutor = null;
}
