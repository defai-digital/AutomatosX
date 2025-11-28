export { MemoryManager, MemoryManagerOptions } from './memory/index.js';
export { ConfigLoaderOptions, LoadedConfig, getDefaultConfig, isValidConfig, loadConfig, loadConfigSync } from './config/index.js';
export { ProviderRouter, ProviderRouterEvents, ProviderRouterOptions, RouteOptions, RoutingMetrics, createProviderRouter } from './router/index.js';
export { SessionFilter, SessionManager, SessionManagerEvents, SessionManagerOptions, createSessionManager } from './session/index.js';
export { AGENT_KEYWORDS, AgentExecutor, AgentExecutorEvents, AgentExecutorOptions, AgentFilter, AgentLoadError, AgentLoader, AgentLoaderOptions, AgentRegistry, AgentRegistryEvents, AgentRegistryOptions, AgentSelectionResult, ExecuteOptions, ExecutionResult, LoadedAgent, RouterOptions, createAgentExecutor, createAgentLoader, createAgentRegistry, findAgentsByKeyword, getAgentKeywords, getAllKeywords, selectAgent, selectAgentWithReason } from './agent/index.js';
export { AgentProfile, BYTES_PER_GB, BYTES_PER_KB, BYTES_PER_MB, CleanupStrategy, Config, DEFAULT_CONFIG, DIR_AGENTS, DIR_AUTOMATOSX, DIR_CHECKPOINTS, DIR_MEMORY, DIR_SESSIONS, DISPLAY_ID_LENGTH, DISPLAY_PREVIEW_LONG, ExecutionRequest, ExecutionResponse, FILE_CONFIG, FILE_MEMORY_DB, LIST_PREVIEW_LIMIT, LIST_SEARCH_LIMIT, LIST_TOP_TAGS, MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND, MemoryEntry, MemorySearchOptions, ProviderType, Session, SessionState, SessionTask, VERSION } from '@ax/schemas';
import '@ax/algorithms';
import '@ax/providers';

/**
 * AutomatosX Error Classes
 *
 * Provides structured error types with helpful suggestions for users.
 *
 * @module @ax/core/errors
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Base error class for all AutomatosX errors
 */
declare class AutomatosXError extends Error {
    /** Error code for programmatic handling */
    readonly code: string;
    /** Suggestion for how to fix the error */
    readonly suggestion: string | undefined;
    /** Additional context data */
    readonly context: Record<string, unknown> | undefined;
    constructor(message: string, code: string, options?: {
        suggestion?: string;
        context?: Record<string, unknown>;
        cause?: Error;
    });
    /**
     * Get formatted error message with suggestion
     */
    toUserMessage(): string;
}
/**
 * Error thrown when an agent is not found
 */
declare class AgentNotFoundError extends AutomatosXError {
    constructor(agentId: string, options?: {
        availableAgents?: string[];
        similarAgents?: string[];
    });
}
/**
 * Error thrown when agent execution fails
 */
declare class AgentExecutionError extends AutomatosXError {
    constructor(agentId: string, reason: string, options?: {
        cause?: Error;
        timeout?: boolean;
        provider?: string;
    });
}
/**
 * Error thrown when no provider is available
 */
declare class ProviderUnavailableError extends AutomatosXError {
    constructor(provider?: string);
}
/**
 * Error thrown when provider authentication fails
 */
declare class ProviderAuthError extends AutomatosXError {
    constructor(provider: string, reason?: string);
}
/**
 * Error thrown when memory operations fail
 */
declare class MemoryError extends AutomatosXError {
    constructor(message: string, operation?: string);
}
/**
 * Error thrown when configuration is invalid
 */
declare class ConfigurationError extends AutomatosXError {
    constructor(message: string, field?: string);
}
/**
 * Error thrown when setup has not been completed
 */
declare class NotInitializedError extends AutomatosXError {
    constructor(what?: string);
}
/**
 * Error thrown when session is not found
 */
declare class SessionNotFoundError extends AutomatosXError {
    constructor(sessionId: string);
}
/**
 * Calculate Levenshtein distance between two strings
 */
declare function levenshteinDistance(a: string, b: string): number;
/**
 * Find similar strings to the input
 */
declare function findSimilar(input: string, options: string[], maxDistance?: number): string[];

export { AgentExecutionError, AgentNotFoundError, AutomatosXError, ConfigurationError, MemoryError, NotInitializedError, ProviderAuthError, ProviderUnavailableError, SessionNotFoundError, findSimilar, levenshteinDistance };
