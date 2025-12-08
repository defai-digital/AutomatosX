/**
 * Task Engine Module
 *
 * Provides task orchestration with:
 * - Loop prevention (LoopGuard)
 * - Persistent storage (TaskStore)
 * - Core orchestration (TaskEngine)
 * - Payload compression
 *
 * @module core/task-engine
 * @version 1.0.0
 */

// Types
export {
  // Enums and basic types
  type TaskStatus,
  type TaskType,
  type TaskEngine as TaskEngineType,
  type OriginClient,

  // Core interfaces
  type TaskContext,
  type LoopGuardConfig,
  type CreateTaskInput,
  type CreateTaskResult,
  type Task,
  type TaskMetrics,
  type TaskError,
  type TaskFilter,
  type TaskUpdate,
  type RunTaskOptions,
  type TaskResult,
  type TaskStoreConfig,
  type TaskEngineConfig,
  type TaskEngineStats,

  // Error classes
  TaskEngineError,
  LoopPreventionError,
  type TaskEngineErrorCode,

  // Zod schemas
  TaskTypeSchema,
  TaskEngineSchema,
  TaskStatusSchema,
  OriginClientSchema,
  CreateTaskInputSchema,
  TaskFilterSchema,
  RunTaskOptionsSchema,

  // Type guards
  isTaskStatus,
  isTaskType,
  isTaskEngine,
  isTaskEngineError,
  isLoopPreventionError
} from './types.js';

// Loop Guard
export {
  LoopGuard,
  getLoopGuard,
  resetLoopGuard,
  createLoopGuard
} from './loop-guard.js';

// Compression
export {
  compressPayload,
  decompressPayload,
  compressWithInfo,
  decompressWithInfo,
  estimateCompressedSize,
  isGzipCompressed,
  calculateCompressionRatio,
  getCompressionLevel,
  DEFAULT_COMPRESSION_LEVEL,
  MIN_COMPRESSION_THRESHOLD,
  type CompressionResult
} from './compression.js';

// Task Store
export {
  TaskStore,
  InMemoryTaskStore,
  createTaskStore,
  type TaskStoreLike
} from './store.js';

// Task Engine
export {
  TaskEngine,
  getTaskEngine,
  resetTaskEngine,
  createTaskEngine,
  type TaskEngineEvents
} from './engine.js';

// Task Cache
export {
  TaskCache,
  getTaskCache,
  resetTaskCache,
  createTaskCache,
  generateCacheKey,
  DEFAULT_CACHE_CONFIG,
  type CacheEntry,
  type CacheStats,
  type TaskCacheConfig
} from './cache.js';

// Write Batcher (Phase 3)
export {
  WriteBatcher,
  createWriteBatcher,
  type WriteOperation,
  type WriteBatcherConfig,
  type WriteBatcherStats
} from './write-batcher.js';

// Request Coalescer (Phase 3)
export {
  RequestCoalescer,
  createRequestCoalescer,
  generateCoalesceKey,
  type RequestCoalescerConfig,
  type RequestCoalescerStats
} from './request-coalescer.js';

// Rate Limiter (Phase 4)
export {
  TaskRateLimiter,
  createRateLimiter,
  type RateLimiterConfig,
  type RateLimitResult,
  type RateLimiterStats
} from './rate-limiter.js';

// Audit Logger (Phase 4)
export {
  TaskAuditLogger,
  createAuditLogger,
  type AuditEventType,
  type AuditEvent,
  type AuditLogEntry,
  type AuditLoggerConfig,
  type AuditLoggerStats
} from './audit-logger.js';

// Circuit Breaker (Phase 4)
export {
  TaskCircuitBreaker,
  createCircuitBreaker,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats
} from './circuit-breaker.js';

// Write Pool (Phase 5)
export {
  WritePool,
  createWritePool,
  type WritePoolConfig,
  type WritePoolStats
} from './write-pool.js';

// Task Queue (Phase 5)
export {
  TaskQueueManager,
  createTaskQueueManager,
  type QueuedTask,
  type TaskQueueConfig,
  type TaskQueueStats
} from './task-queue.js';
