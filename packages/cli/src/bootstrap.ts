/**
 * CLI Composition Root (Bootstrap Module)
 *
 * This is the ONLY place in CLI that imports adapter implementations.
 * All other CLI code depends on port interfaces from contracts.
 *
 * Following Ports & Adapters (Hexagonal Architecture) pattern.
 *
 * Storage Mode (AX_STORAGE environment variable):
 * - 'sqlite' (default): Persistent storage using SQLite at ~/.automatosx/data.db
 * - 'memory': In-memory storage (data lost between invocations)
 */

// ============================================================================
// Adapter Imports - ONLY allowed in this file
// ============================================================================

// Provider adapter imports
import {
  createProviderRegistry,
  createCLIAdapter,
  claudeConfig,
  geminiConfig,
  codexConfig,
  qwenConfig,
  glmConfig,
  grokConfig,
} from '@defai.digital/provider-adapters';
import type {
  ProviderRegistry,
  LLMProvider,
  CLIProviderConfig,
} from '@defai.digital/provider-adapters';

// Storage adapter imports (dynamic to avoid hard dependency)
// SQLite adapters imported dynamically in initializeStorage()

// In-memory storage imports (from core domains - allowed)
import {
  createInMemoryCheckpointStorage,
  type CheckpointStorage,
} from '@defai.digital/agent-execution';
import {
  createInMemoryTraceStore,
  type TraceStore,
} from '@defai.digital/trace-domain';
import {
  createDeadLetterQueue,
  createInMemoryDeadLetterStorage,
  type DeadLetterQueue,
} from '@defai.digital/cross-cutting';

// Step executor imports (for workflow execution)
import {
  createRealStepExecutor,
  type StepExecutor,
  type PromptExecutorLike,
  type DiscussionExecutorLike,
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

// Database utilities
import { getDatabase, getDatabaseConfig } from './utils/database.js';

// ============================================================================
// Port Interface Re-exports (for type safety)
// ============================================================================

export type { CheckpointStorage } from '@defai.digital/agent-execution';
export type { TraceStore } from '@defai.digital/trace-domain';
export type { DeadLetterQueue } from '@defai.digital/cross-cutting';
export type { StepExecutor } from '@defai.digital/workflow-engine';
// Provider types re-exported directly for use by CLI modules
export type {
  ProviderRegistry,
  LLMProvider,
  CLIProviderConfig,
  CompletionRequest,
  CompletionResponse,
} from '@defai.digital/provider-adapters';

// ============================================================================
// Provider Configurations
// ============================================================================

/**
 * Provider configurations - centralized here
 */
export const PROVIDER_CONFIGS: Record<string, CLIProviderConfig> = {
  claude: claudeConfig,
  gemini: geminiConfig,
  codex: codexConfig,
  qwen: qwenConfig,
  glm: glmConfig,
  grok: grokConfig,
};

// ============================================================================
// Dependency Container
// ============================================================================

interface CLIDependencies {
  checkpointStorage: CheckpointStorage;
  traceStore: TraceStore;
  dlq: DeadLetterQueue;
  providerRegistry: ProviderRegistry;
  usingSqlite: boolean;
}

let _dependencies: CLIDependencies | null = null;
let _initialized = false;

// ============================================================================
// Bootstrap Function
// ============================================================================

/**
 * Initialize all CLI dependencies
 *
 * Called once at application startup. Wires adapters to ports.
 * This is the composition root - the only place that knows about concrete implementations.
 */
export async function bootstrap(): Promise<CLIDependencies> {
  if (_initialized && _dependencies) {
    return _dependencies;
  }

  // Initialize storage
  const storage = await initializeStorage();

  // Create provider registry
  const providerRegistry = createProviderRegistry();

  // Build dependency container
  _dependencies = {
    checkpointStorage: storage.checkpointStorage,
    traceStore: storage.traceStore,
    dlq: storage.dlq,
    providerRegistry,
    usingSqlite: storage.usingSqlite,
  };

  _initialized = true;
  return _dependencies;
}

/**
 * Synchronous bootstrap with in-memory storage only
 * Used when async initialization is not possible
 */
export function bootstrapSync(): CLIDependencies {
  if (_initialized && _dependencies) {
    return _dependencies;
  }

  // Create in-memory storage
  const checkpointStorage = createInMemoryCheckpointStorage();
  const traceStore = createInMemoryTraceStore();
  const dlq = createDeadLetterQueue(createInMemoryDeadLetterStorage());

  // Create provider registry
  const providerRegistry = createProviderRegistry();

  _dependencies = {
    checkpointStorage,
    traceStore,
    dlq,
    providerRegistry,
    usingSqlite: false,
  };

  _initialized = true;
  return _dependencies;
}

// ============================================================================
// Storage Initialization
// ============================================================================

interface StorageResult {
  checkpointStorage: CheckpointStorage;
  traceStore: TraceStore;
  dlq: DeadLetterQueue;
  usingSqlite: boolean;
}

/**
 * Initialize storage with SQLite if available
 */
async function initializeStorage(): Promise<StorageResult> {
  const config = await getDatabaseConfig();
  const db = await getDatabase();

  if (db && config.storageMode === 'sqlite') {
    try {
      // Dynamic import of SQLite stores
      const sqliteModule = await import('@defai.digital/sqlite-adapter');

      // Create SQLite-backed stores
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sqliteDb = db as any;
      const checkpointStorage = sqliteModule.createSqliteCheckpointStorage(sqliteDb);
      const traceStore = sqliteModule.createSqliteTraceStore(sqliteDb);
      const dlqStorage = sqliteModule.createSqliteDeadLetterStorage(sqliteDb);
      const dlq = createDeadLetterQueue(dlqStorage);

      return {
        checkpointStorage,
        traceStore,
        dlq,
        usingSqlite: true,
      };
    } catch (error) {
      // SQLite stores not available, fall back to in-memory
      console.warn(
        `[WARN] Failed to initialize SQLite storage: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          'Using in-memory storage.'
      );
    }
  }

  // Fall back to in-memory storage
  return {
    checkpointStorage: createInMemoryCheckpointStorage(),
    traceStore: createInMemoryTraceStore(),
    dlq: createDeadLetterQueue(createInMemoryDeadLetterStorage()),
    usingSqlite: false,
  };
}

// ============================================================================
// Dependency Accessors
// ============================================================================

/**
 * Get initialized dependencies
 * Throws if bootstrap() not called
 */
export function getDependencies(): CLIDependencies {
  if (!_dependencies) {
    // Auto-bootstrap with sync method if not initialized
    return bootstrapSync();
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
 * Get checkpoint storage
 */
export function getCheckpointStorage(): CheckpointStorage {
  return getDependencies().checkpointStorage;
}

/**
 * Get trace store
 */
export function getTraceStore(): TraceStore {
  return getDependencies().traceStore;
}

/**
 * Get dead letter queue
 */
export function getDLQ(): DeadLetterQueue {
  return getDependencies().dlq;
}

/**
 * Get provider registry
 */
export function getProviderRegistry(): ProviderRegistry {
  return getDependencies().providerRegistry;
}

/**
 * Check if using SQLite storage
 */
export function isUsingSqlite(): boolean {
  return getDependencies().usingSqlite;
}

// ============================================================================
// Provider Helpers
// ============================================================================

/**
 * Create a CLI adapter for a provider
 * This wraps the adapter creation to keep adapter imports centralized
 */
export function createProvider(config: CLIProviderConfig): LLMProvider {
  return createCLIAdapter(config);
}

/**
 * Get provider configuration by ID
 */
export function getProviderConfig(providerId: string): CLIProviderConfig | undefined {
  return PROVIDER_CONFIGS[providerId];
}

/**
 * Get all provider IDs
 */
export function getProviderIds(): string[] {
  return Object.keys(PROVIDER_CONFIGS);
}

// ============================================================================
// Storage Info
// ============================================================================

/**
 * Get storage info for diagnostics
 */
export async function getStorageInfo(): Promise<{
  mode: 'sqlite' | 'memory';
  path?: string | undefined;
  initialized: boolean;
}> {
  const config = await getDatabaseConfig();
  const deps = getDependencies();

  const result: {
    mode: 'sqlite' | 'memory';
    path?: string | undefined;
    initialized: boolean;
  } = {
    mode: deps.usingSqlite ? 'sqlite' : 'memory',
    initialized: _initialized,
  };

  if (deps.usingSqlite) {
    result.path = config.path;
  }

  return result;
}

// ============================================================================
// Reset (for testing)
// ============================================================================

/**
 * Reset all dependencies (for testing)
 */
export function resetBootstrap(): void {
  _dependencies = null;
  _initialized = false;
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
    defaultProvider = 'claude',
    defaultTimeout = 120000,
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
    healthCheckCacheMs: 60000,
  });

  // Create discussion executor (for discuss steps)
  // Type assertion needed due to interface differences in result types
  const discussionExecutor = createDiscussionExecutor(providerBridge, {
    defaultTimeoutMs: defaultTimeout,
    checkProviderHealth,
  }) as unknown as DiscussionExecutorLike;

  // Create real step executor with wired dependencies
  _stepExecutor = createRealStepExecutor({
    promptExecutor,
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
}
