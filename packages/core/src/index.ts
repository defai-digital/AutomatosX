/**
 * AutomatosX Core
 *
 * Core orchestration engine for the AutomatosX AI agent platform.
 * Provides memory management, configuration loading, provider routing,
 * session management, and agent execution.
 *
 * @packageDocumentation
 * @module @ax/core
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// Memory system
export { MemoryManager, type MemoryManagerOptions } from './memory/index.js';

// Configuration
export {
  loadConfig,
  loadConfigSync,
  getDefaultConfig,
  isValidConfig,
  type ConfigLoaderOptions,
  type LoadedConfig,
} from './config/index.js';

// Router
export {
  ProviderRouter,
  createProviderRouter,
  type ProviderRouterOptions,
  type RouteOptions,
  type RoutingMetrics,
  type ProviderRouterEvents,
} from './router/index.js';

// Session management
export {
  SessionManager,
  createSessionManager,
  type SessionManagerOptions,
  type SessionFilter,
  type SessionManagerEvents,
} from './session/index.js';

// Agent system
export {
  AgentLoader,
  createAgentLoader,
  AgentRegistry,
  createAgentRegistry,
  AgentExecutor,
  createAgentExecutor,
  selectAgent,
  selectAgentWithReason,
  getAgentKeywords,
  getAllKeywords,
  findAgentsByKeyword,
  AGENT_KEYWORDS,
  type AgentLoaderOptions,
  type LoadedAgent,
  type AgentLoadError,
  type AgentFilter,
  type AgentRegistryOptions,
  type AgentRegistryEvents,
  type AgentExecutorOptions,
  type ExecuteOptions,
  type ExecutionResult,
  type AgentExecutorEvents,
  type AgentSelectionResult,
  type RouterOptions,
} from './agent/index.js';

// Error classes
export {
  AutomatosXError,
  AgentNotFoundError,
  AgentExecutionError,
  ProviderUnavailableError,
  ProviderAuthError,
  MemoryError,
  ConfigurationError,
  NotInitializedError,
  SessionNotFoundError,
  levenshteinDistance,
  findSimilar,
} from './errors.js';

// Re-export commonly used schemas for convenience
export {
  type Config,
  type MemoryEntry,
  type MemorySearchOptions,
  type CleanupStrategy,
  type Session,
  type SessionTask,
  type SessionState,
  type AgentProfile,
  type ExecutionRequest,
  type ExecutionResponse,
  type ProviderType,
  DEFAULT_CONFIG,
  // Re-export constants
  VERSION,
  DIR_AUTOMATOSX,
  DIR_AGENTS,
  DIR_SESSIONS,
  DIR_MEMORY,
  DIR_CHECKPOINTS,
  FILE_MEMORY_DB,
  FILE_CONFIG,
  DISPLAY_ID_LENGTH,
  DISPLAY_PREVIEW_LONG,
  LIST_PREVIEW_LIMIT,
  LIST_SEARCH_LIMIT,
  LIST_TOP_TAGS,
  BYTES_PER_KB,
  BYTES_PER_MB,
  BYTES_PER_GB,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
} from '@ax/schemas';
