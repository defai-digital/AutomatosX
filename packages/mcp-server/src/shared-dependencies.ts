/**
 * Shared Dependencies Module
 *
 * This module provides access to shared singleton dependencies (TraceStore,
 * SessionStore, SemanticManager, ProviderRegistry) without creating circular
 * dependencies with the tools module.
 *
 * Tool files should import from this module, NOT from bootstrap.ts.
 * bootstrap.ts imports from tools/index.ts for the step executor bridge,
 * so having tools import from bootstrap would create a circular dependency.
 *
 * Architecture:
 *   bootstrap.ts  -->  shared-dependencies.ts (setDependencies, setStepExecutorFactory)
 *        |                      ^
 *        |                      |
 *        v (dynamic)            |
 *   tools/index.ts  -->  tools/*.ts (getDependencies)
 *
 * This breaks the cycle by ensuring tools don't import from bootstrap.
 *
 * IMPORTANT: This file MUST NOT import from adapters (sqlite-adapter, provider-adapters).
 * Only bootstrap.ts is allowed to import adapters. Dependencies are injected via setDependencies().
 */

// Imports from core domains (NOT adapters) for lazy initialization
import {
  createInMemoryTraceStore,
  type TraceStore,
} from '@defai.digital/trace-domain';
import {
  createSessionStore,
  createSessionManager,
  DEFAULT_SESSION_DOMAIN_CONFIG,
  type SessionStore,
  type SessionManager,
} from '@defai.digital/session-domain';
import {
  createSemanticManager,
  createEmbeddingProvider,
  InMemorySemanticStore,
  type SemanticManager,
} from '@defai.digital/semantic-context';
import {
  EMBEDDING_DIMENSION_DEFAULT,
  SEMANTIC_NAMESPACE_DEFAULT,
} from '@defai.digital/contracts';
import type { StepExecutor } from '@defai.digital/workflow-engine';

// ============================================================================
// Types - re-exported for use in MCP Server code
// ============================================================================

// Completion response type for tool code
// These mirror the actual types from provider-adapters
export interface CompletionResponseLike {
  success: boolean;
  requestId: string;
  content?: string;
  error?: { message: string; category: string };
  usage?: { promptTokens: number; completionTokens: number };
  model?: string;
  latencyMs?: number;
}

// Minimal LLM Provider interface - mirrors the actual LLMProvider from provider-adapters
// We define it here to avoid importing from adapters
// Uses 'unknown' for request type to allow type compatibility with actual implementation
export interface LLMProviderLike {
  readonly providerId: string;
  readonly config: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  complete(request: any): Promise<CompletionResponseLike>;
  checkHealth(): Promise<unknown>;
}

// Note: This is a minimal interface that matches the actual ProviderRegistry class
// from provider-adapters. We define it here to avoid importing from adapters.
// Uses 'unknown' for the provider type to allow assignment from actual ProviderRegistry
export interface ProviderRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(providerId: string): any;
  getProviderIds(): string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(provider: any): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  complete(request: any): Promise<any>;
}

export type { TraceStore } from '@defai.digital/trace-domain';
export type { SessionStore, SessionManager } from '@defai.digital/session-domain';
export type { SemanticManager } from '@defai.digital/semantic-context';

// ============================================================================
// Dependency Container (set by bootstrap.ts)
// ============================================================================

interface SharedDependencies {
  providerRegistry: ProviderRegistry;
  traceStore: TraceStore;
  sessionStore: SessionStore;
  sessionManager: SessionManager;
  semanticManager: SemanticManager;
  usingSqlite: boolean;
}

let _dependencies: SharedDependencies | null = null;
let _initialized = false;

// ============================================================================
// Dependency Injection (called by bootstrap.ts)
// ============================================================================

/**
 * Set the shared dependencies
 * Called by bootstrap.ts after creating all dependencies
 */
export function setDependencies(deps: SharedDependencies): void {
  _dependencies = deps;
  _initialized = true;
}

/**
 * Create in-memory dependencies for lazy initialization
 * Used when bootstrap() hasn't been called (e.g., in tests)
 */
function createInMemoryDependencies(): SharedDependencies {
  // Create in-memory trace store
  const traceStore = createInMemoryTraceStore();

  // Create in-memory semantic manager
  const embeddingProvider = createEmbeddingProvider({ dimension: EMBEDDING_DIMENSION_DEFAULT });
  const semanticStore = new InMemorySemanticStore(embeddingProvider);
  const semanticManager = createSemanticManager({
    embeddingPort: embeddingProvider,
    storePort: semanticStore,
    defaultNamespace: SEMANTIC_NAMESPACE_DEFAULT,
    autoEmbed: true,
  });

  // Create session store and manager
  const sessionStore = createSessionStore();
  const sessionManager = createSessionManager(sessionStore, DEFAULT_SESSION_DOMAIN_CONFIG);

  // Create stub provider registry (no real providers in lazy init mode)
  const providerRegistry: ProviderRegistry = {
    get: () => undefined,
    getProviderIds: () => [],
    register: () => { /* noop */ },
    complete: () => Promise.reject(new Error('No providers registered in lazy init mode')),
  };

  return {
    providerRegistry,
    traceStore,
    sessionStore,
    sessionManager,
    semanticManager,
    usingSqlite: false,
  };
}

/**
 * Get initialized dependencies
 * Lazily initializes with in-memory stores if not explicitly set
 */
function getDependencies(): SharedDependencies {
  if (!_dependencies) {
    // Lazy initialization with in-memory stores
    // This maintains backward compatibility with code that doesn't call bootstrap()
    _dependencies = createInMemoryDependencies();
    _initialized = true;
  }
  return _dependencies;
}

// ============================================================================
// Public Accessors (used by tool files)
// ============================================================================

/**
 * Check if bootstrap has been called
 */
export function isInitialized(): boolean {
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

// ============================================================================
// Step Executor Registration (set by bootstrap, used by workflow.ts)
// ============================================================================

// Step executor factory - set by bootstrap.ts, called by workflow.ts
let _stepExecutorFactory: (() => Promise<StepExecutor>) | null = null;

/**
 * Register a step executor factory
 * Called by bootstrap.ts after initialization
 */
export function setStepExecutorFactory(factory: () => Promise<StepExecutor>): void {
  _stepExecutorFactory = factory;
}

/**
 * Get the step executor
 * Used by workflow.ts to get the production step executor
 */
export async function getStepExecutor(): Promise<StepExecutor> {
  if (_stepExecutorFactory === null) {
    throw new Error(
      'Step executor factory not registered. Call bootstrap() or initializeAsync() first.'
    );
  }
  return _stepExecutorFactory();
}

// ============================================================================
// Reset (for testing)
// ============================================================================

/**
 * Reset all dependencies (for testing)
 */
export function resetSharedDependencies(): void {
  _dependencies = null;
  _initialized = false;
  _stepExecutorFactory = null;
}
