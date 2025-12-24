/**
 * MCP Server Composition Root (Bootstrap Module)
 *
 * This is the ONLY place in MCP Server that imports adapter implementations.
 * All other MCP Server code depends on port interfaces from contracts or core.
 *
 * Following Ports & Adapters (Hexagonal Architecture) pattern.
 */

// ============================================================================
// Adapter Imports - ONLY allowed in this file
// ============================================================================

import { createProviderRegistry as createRegistry } from '@automatosx/provider-adapters';

// Step executor imports (for workflow execution)
import {
  createRealStepExecutor,
  type StepExecutor,
  type PromptExecutorLike,
  type DiscussionExecutorLike,
} from '@automatosx/workflow-engine';
import {
  createProviderPromptExecutor,
  type ProviderPromptExecutorConfig,
} from '@automatosx/agent-domain';
import {
  createProviderBridge,
  createDiscussionExecutor,
  type ProviderRegistryLike as DiscussionProviderRegistryLike,
} from '@automatosx/discussion-domain';
import {
  TIMEOUT_PROVIDER_DEFAULT,
  PROVIDER_DEFAULT,
} from '@automatosx/contracts';

// ============================================================================
// Types - re-exported for use in MCP Server code
// ============================================================================

export type ProviderRegistry = ReturnType<typeof createRegistry>;

// ============================================================================
// Dependency Container
// ============================================================================

interface MCPDependencies {
  providerRegistry: ProviderRegistry;
}

let _dependencies: MCPDependencies | null = null;
let _initialized = false;

// ============================================================================
// Bootstrap Function
// ============================================================================

/**
 * Initialize all MCP Server dependencies
 *
 * Called once at server startup. Wires adapters to ports.
 * This is the composition root - the only place that knows about concrete implementations.
 */
export function bootstrap(): MCPDependencies {
  if (_initialized && _dependencies) {
    return _dependencies;
  }

  // Create provider registry
  const providerRegistry = createRegistry();

  // Build dependency container
  _dependencies = {
    providerRegistry,
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
  _dependencies = null;
  _initialized = false;
  _stepExecutor = null;
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
    defaultTimeout = TIMEOUT_PROVIDER_DEFAULT,
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
