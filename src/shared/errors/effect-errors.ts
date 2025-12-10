/**
 * Effect-TS Error Types for AutomatosX
 *
 * Typed errors for use with Effect-TS.
 * Provides better error handling and type safety.
 */

import { Data } from 'effect';

// ========================================
// Configuration Errors
// ========================================

/**
 * Config file not found
 */
export class ConfigNotFoundError extends Data.TaggedError('ConfigNotFoundError')<{
  readonly path: string;
}> {}

/**
 * Config file parse error
 */
export class ConfigParseError extends Data.TaggedError('ConfigParseError')<{
  readonly path: string;
  readonly cause: unknown;
}> {}

/**
 * Config validation error
 */
export class ConfigValidationError extends Data.TaggedError('ConfigValidationError')<{
  readonly path: string;
  readonly errors: readonly string[];
}> {}

/**
 * Config write error
 */
export class ConfigWriteError extends Data.TaggedError('ConfigWriteError')<{
  readonly path: string;
  readonly cause: unknown;
}> {}

// ========================================
// Provider Errors
// ========================================

/**
 * Provider not found
 */
export class ProviderNotFoundError extends Data.TaggedError('ProviderNotFoundError')<{
  readonly provider: string;
}> {}

/**
 * Provider execution error
 */
export class ProviderExecutionError extends Data.TaggedError('ProviderExecutionError')<{
  readonly provider: string;
  readonly cause: unknown;
}> {}

/**
 * Provider timeout error
 */
export class ProviderTimeoutError extends Data.TaggedError('ProviderTimeoutError')<{
  readonly provider: string;
  readonly timeoutMs: number;
}> {}

/**
 * Provider rate limit error
 */
export class ProviderRateLimitError extends Data.TaggedError('ProviderRateLimitError')<{
  readonly provider: string;
  readonly resetAtMs: number;
}> {}

/**
 * Invalid execution request
 */
export class InvalidExecutionRequestError extends Data.TaggedError('InvalidExecutionRequestError')<{
  readonly errors: readonly string[];
}> {}

/**
 * Invalid execution response
 */
export class InvalidExecutionResponseError extends Data.TaggedError('InvalidExecutionResponseError')<{
  readonly provider: string;
  readonly errors: readonly string[];
}> {}

// ========================================
// Agent Errors
// ========================================

/**
 * Agent not found
 */
export class AgentNotFoundError extends Data.TaggedError('AgentNotFoundError')<{
  readonly agent: string;
}> {}

/**
 * Agent profile validation error
 */
export class AgentProfileValidationError extends Data.TaggedError('AgentProfileValidationError')<{
  readonly agent: string;
  readonly errors: readonly string[];
}> {}

/**
 * Agent execution error
 */
export class AgentExecutionError extends Data.TaggedError('AgentExecutionError')<{
  readonly agent: string;
  readonly task: string;
  readonly cause: unknown;
}> {}

/**
 * Agent profile load error
 */
export class AgentProfileLoadError extends Data.TaggedError('AgentProfileLoadError')<{
  readonly agent: string;
  readonly path: string;
  readonly cause: unknown;
}> {}

// ========================================
// Memory Errors
// ========================================

/**
 * Memory database error
 */
export class MemoryDatabaseError extends Data.TaggedError('MemoryDatabaseError')<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

/**
 * Memory search error
 */
export class MemorySearchError extends Data.TaggedError('MemorySearchError')<{
  readonly query: string;
  readonly cause: unknown;
}> {}

/**
 * Memory entry not found
 */
export class MemoryEntryNotFoundError extends Data.TaggedError('MemoryEntryNotFoundError')<{
  readonly id: string;
}> {}

/**
 * Memory validation error
 */
export class MemoryValidationError extends Data.TaggedError('MemoryValidationError')<{
  readonly errors: readonly string[];
}> {}

// ========================================
// Session Errors
// ========================================

/**
 * Session not found
 */
export class SessionNotFoundError extends Data.TaggedError('SessionNotFoundError')<{
  readonly sessionId: string;
}> {}

/**
 * Session creation error
 */
export class SessionCreationError extends Data.TaggedError('SessionCreationError')<{
  readonly cause: unknown;
}> {}

/**
 * Session save error
 */
export class SessionSaveError extends Data.TaggedError('SessionSaveError')<{
  readonly sessionId: string;
  readonly cause: unknown;
}> {}

/**
 * Session load error
 */
export class SessionLoadError extends Data.TaggedError('SessionLoadError')<{
  readonly sessionId: string;
  readonly cause: unknown;
}> {}

// ========================================
// Router Errors
// ========================================

/**
 * No providers available
 */
 
export class NoProvidersAvailableError extends Data.TaggedError('NoProvidersAvailableError')<Record<string, never>> {}

/**
 * No suitable provider found
 */
export class NoSuitableProviderError extends Data.TaggedError('NoSuitableProviderError')<{
  readonly reason: string;
}> {}

/**
 * Router selection error
 */
export class RouterSelectionError extends Data.TaggedError('RouterSelectionError')<{
  readonly cause: unknown;
}> {}

// ========================================
// File System Errors
// ========================================

/**
 * File not found error
 */
export class FileNotFoundError extends Data.TaggedError('FileNotFoundError')<{
  readonly path: string;
}> {}

/**
 * File read error
 */
export class FileReadError extends Data.TaggedError('FileReadError')<{
  readonly path: string;
  readonly cause: unknown;
}> {}

/**
 * File write error
 */
export class FileWriteError extends Data.TaggedError('FileWriteError')<{
  readonly path: string;
  readonly cause: unknown;
}> {}

/**
 * Directory not found error
 */
export class DirectoryNotFoundError extends Data.TaggedError('DirectoryNotFoundError')<{
  readonly path: string;
}> {}

/**
 * Permission denied error
 */
export class PermissionDeniedError extends Data.TaggedError('PermissionDeniedError')<{
  readonly path: string;
  readonly operation: string;
}> {}

// ========================================
// Validation Errors
// ========================================

/**
 * Path validation error
 */
export class PathValidationError extends Data.TaggedError('PathValidationError')<{
  readonly path: string;
  readonly reason: string;
}> {}

/**
 * Command injection error
 */
export class CommandInjectionError extends Data.TaggedError('CommandInjectionError')<{
  readonly command: string;
}> {}

/**
 * Resource limit exceeded error
 */
export class ResourceLimitExceededError extends Data.TaggedError('ResourceLimitExceededError')<{
  readonly resource: string;
  readonly limit: number;
  readonly actual: number;
}> {}

// ========================================
// Network Errors
// ========================================

/**
 * Network timeout error
 */
export class NetworkTimeoutError extends Data.TaggedError('NetworkTimeoutError')<{
  readonly url: string;
  readonly timeoutMs: number;
}> {}

/**
 * Network connection error
 */
export class NetworkConnectionError extends Data.TaggedError('NetworkConnectionError')<{
  readonly url: string;
  readonly cause: unknown;
}> {}

// ========================================
// Generic Errors
// ========================================

/**
 * Unknown error (catch-all)
 */
export class UnknownError extends Data.TaggedError('UnknownError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Timeout error
 */
export class TimeoutError extends Data.TaggedError('TimeoutError')<{
  readonly operation: string;
  readonly timeoutMs: number;
}> {}

/**
 * Retry exhausted error
 */
export class RetryExhaustedError extends Data.TaggedError('RetryExhaustedError')<{
  readonly operation: string;
  readonly attempts: number;
  readonly lastError: unknown;
}> {}
