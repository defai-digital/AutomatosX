/**
 * Task Engine Types
 *
 * Type definitions for the Task Engine system including:
 * - Task lifecycle states
 * - Loop prevention context
 * - Task payloads and results
 * - Error types
 *
 * @module core/task-engine/types
 * @version 1.0.0
 */

import { z } from 'zod';

// ============================================================================
// Enums and Constants
// ============================================================================

/**
 * Task status lifecycle
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'expired';

/**
 * Supported task types for routing optimization
 */
export type TaskType = 'web_search' | 'code_review' | 'code_generation' | 'analysis' | 'custom';

/**
 * Supported execution engines
 */
export type TaskEngine = 'auto' | 'gemini' | 'claude' | 'codex' | 'ax-cli';

/**
 * Origin client identifiers
 */
export type OriginClient = 'claude-code' | 'gemini-cli' | 'codex-cli' | 'ax-cli' | 'unknown';

// ============================================================================
// Loop Prevention Types
// ============================================================================

/**
 * Loop prevention context - tracks call chain to prevent recursive loops
 */
export interface TaskContext {
  /** Unique task identifier */
  taskId: string;

  /** Original client that initiated the request */
  originClient: OriginClient;

  /** Call chain showing the path of execution */
  callChain: string[];

  /** Current depth in the call chain */
  depth: number;

  /** Maximum allowed depth */
  maxDepth: number;

  /** Timestamp when context was created */
  createdAt: number;
}

/**
 * Loop guard configuration
 */
export interface LoopGuardConfig {
  /** Maximum depth of nested calls (default: 2) */
  maxDepth: number;

  /** Maximum length of call chain (default: 5) */
  maxChainLength: number;

  /** Block calls that would return to same engine (default: true) */
  blockSelfCalls: boolean;

  /** Regex patterns to block specific call chain patterns */
  blockedPatterns: RegExp[];
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task creation input
 */
export interface CreateTaskInput {
  /** Task type for routing optimization */
  type: TaskType;

  /** Task payload data (max 1MB after JSON serialization) */
  payload: Record<string, unknown>;

  /** Target engine (auto = router decides) */
  engine?: TaskEngine;

  /** Execution priority (1=lowest, 10=highest) */
  priority?: number;

  /** Time-to-live in hours */
  ttlHours?: number;

  /** Loop prevention context from caller */
  context?: Partial<TaskContext>;
}

/**
 * Task creation result
 */
export interface CreateTaskResult {
  /** Generated task ID */
  id: string;

  /** Task status */
  status: TaskStatus;

  /** Estimated engine based on task type */
  estimatedEngine: TaskEngine | null;

  /** When the task will expire */
  expiresAt: number;

  /** Payload size in bytes */
  payloadSize: number;

  /** Compression ratio achieved (original / compressed) */
  compressionRatio: number;
}

/**
 * Full task object
 */
export interface Task {
  /** Unique task identifier */
  id: string;

  /** Task type */
  type: TaskType;

  /** Current status */
  status: TaskStatus;

  /** Assigned engine (null if auto) */
  engine: TaskEngine | null;

  /** Execution priority */
  priority: number;

  /** Original payload */
  payload: Record<string, unknown>;

  /** Payload size in bytes */
  payloadSize: number;

  /** Task result (null if not completed) */
  result: Record<string, unknown> | null;

  /** Loop prevention context */
  context: {
    originClient: OriginClient;
    callChain: string[];
    depth: number;
  };

  /** Creation timestamp */
  createdAt: number;

  /** Execution start timestamp */
  startedAt: number | null;

  /** Completion timestamp */
  completedAt: number | null;

  /** Expiration timestamp */
  expiresAt: number;

  /** Execution metrics */
  metrics: TaskMetrics | null;

  /** Error information (if failed) */
  error: TaskError | null;

  /** Number of retry attempts */
  retryCount: number;
}

/**
 * Task execution metrics
 */
export interface TaskMetrics {
  /** Execution duration in milliseconds */
  durationMs: number;

  /** Prompt tokens used */
  tokensPrompt: number | null;

  /** Completion tokens used */
  tokensCompletion: number | null;
}

/**
 * Task error information
 */
export interface TaskError {
  /** Error code */
  code: string;

  /** Human-readable error message */
  message: string;
}

/**
 * Task filter for listing/querying
 */
export interface TaskFilter {
  /** Filter by status */
  status?: TaskStatus;

  /** Filter by engine */
  engine?: TaskEngine;

  /** Filter by type */
  type?: TaskType;

  /** Filter by origin client */
  originClient?: OriginClient;

  /** Maximum number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Task update for status changes
 */
export interface TaskUpdate {
  /** New status */
  status?: TaskStatus;

  /** Error information */
  error?: TaskError;

  /** Retry count increment */
  incrementRetry?: boolean;
}

/**
 * Options for running a task
 */
export interface RunTaskOptions {
  /** Override auto-routing */
  engineOverride?: Exclude<TaskEngine, 'auto'>;

  /** Execution timeout in milliseconds */
  timeoutMs?: number;

  /** Loop context from caller */
  loopContext?: TaskContext;

  /** Skip cache lookup */
  skipCache?: boolean;
}

/**
 * Task execution result
 */
export interface TaskResult {
  /** Task ID */
  taskId: string;

  /** Final status */
  status: 'completed' | 'failed';

  /** Result data (null if failed) */
  result: Record<string, unknown> | null;

  /** Engine used for execution */
  engine: TaskEngine;

  /** Execution metrics */
  metrics: TaskMetrics | null;

  /** Error information (if failed) */
  error: TaskError | null;

  /** Whether result was from cache */
  cacheHit: boolean;
}

// ============================================================================
// Store Types
// ============================================================================

/**
 * Task store configuration
 */
export interface TaskStoreConfig {
  /** Database file path */
  dbPath: string;

  /** Maximum payload size in bytes (default: 1MB) */
  maxPayloadBytes: number;

  /** Enable payload compression (default: true) */
  compressionEnabled: boolean;

  /** Compression level 1-9 (default: 6) */
  compressionLevel: number;

  /** Default TTL in hours (default: 24) */
  defaultTtlHours: number;

  /** Maximum TTL in hours (default: 168 = 7 days) */
  maxTtlHours: number;

  /** SQLite busy timeout in ms (default: 5000) */
  busyTimeout: number;
}

// ============================================================================
// Engine Types
// ============================================================================

/**
 * Task engine configuration
 */
export interface TaskEngineConfig {
  /** Task store configuration */
  store: Partial<TaskStoreConfig>;

  /** Loop guard configuration */
  loopGuard: Partial<LoopGuardConfig>;

  /** Maximum concurrent task executions */
  maxConcurrent: number;

  /** Default execution timeout in ms */
  defaultTimeoutMs: number;

  /** Maximum retry attempts */
  maxRetries: number;

  /** Initial retry delay in ms */
  retryDelayMs: number;

  /** Enable result caching */
  cacheEnabled: boolean;

  /** Cache TTL in ms */
  cacheTtlMs: number;
}

/**
 * Task engine statistics
 */
export interface TaskEngineStats {
  /** Total tasks created */
  totalCreated: number;

  /** Currently running tasks */
  runningCount: number;

  /** Completed tasks */
  completedCount: number;

  /** Failed tasks */
  failedCount: number;

  /** Expired tasks (cleaned up) */
  expiredCount: number;

  /** Cache statistics */
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };

  /** Average execution time in ms */
  avgDurationMs: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Task engine error codes
 */
export type TaskEngineErrorCode =
  | 'TASK_NOT_FOUND'
  | 'TASK_EXPIRED'
  | 'TASK_ALREADY_RUNNING'
  | 'TASK_ALREADY_COMPLETED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_TASK_TYPE'
  | 'INVALID_ENGINE'
  | 'LOOP_DETECTED'
  | 'DEPTH_EXCEEDED'
  | 'CHAIN_TOO_LONG'
  | 'BLOCKED_PATTERN'
  | 'EXECUTION_TIMEOUT'
  | 'EXECUTION_FAILED'
  | 'STORE_ERROR'
  | 'COMPRESSION_ERROR';

/**
 * Base error class for task engine errors
 */
export class TaskEngineError extends Error {
  constructor(
    message: string,
    public readonly code: TaskEngineErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TaskEngineError';
    Error.captureStackTrace?.(this, TaskEngineError);
  }
}

/**
 * Loop prevention error - thrown when a recursive loop is detected
 */
export class LoopPreventionError extends TaskEngineError {
  constructor(
    message: string,
    public readonly callChain: string[],
    code: TaskEngineErrorCode = 'LOOP_DETECTED'
  ) {
    super(message, code, { callChain });
    this.name = 'LoopPreventionError';
  }
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Task type schema
 */
export const TaskTypeSchema = z.enum([
  'web_search',
  'code_review',
  'code_generation',
  'analysis',
  'custom'
]);

/**
 * Task engine schema
 */
export const TaskEngineSchema = z.enum([
  'auto',
  'gemini',
  'claude',
  'codex',
  'ax-cli'
]);

/**
 * Task status schema
 */
export const TaskStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'expired'
]);

/**
 * Origin client schema
 */
export const OriginClientSchema = z.enum([
  'claude-code',
  'gemini-cli',
  'codex-cli',
  'ax-cli',
  'unknown'
]);

/**
 * Create task input schema
 */
export const CreateTaskInputSchema = z.object({
  type: TaskTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  engine: TaskEngineSchema.default('auto'),
  priority: z.number().int().min(1).max(10).default(5),
  ttlHours: z.number().int().min(1).default(24).transform(v => Math.min(v, 168)),
  context: z.object({
    originClient: OriginClientSchema.optional(),
    callChain: z.array(z.string()).optional(),
    depth: z.number().int().min(0).optional()
  }).optional()
});

/**
 * Task filter schema
 */
export const TaskFilterSchema = z.object({
  status: TaskStatusSchema.optional(),
  engine: TaskEngineSchema.optional(),
  type: TaskTypeSchema.optional(),
  originClient: OriginClientSchema.optional(),
  limit: z.number().int().min(1).max(1000).default(20),
  offset: z.number().int().min(0).default(0)
});

/**
 * Run task options schema
 */
export const RunTaskOptionsSchema = z.object({
  engineOverride: z.enum(['gemini', 'claude', 'codex', 'ax-cli']).optional(),
  timeoutMs: z.number().int().min(5000).max(300000).optional(),
  skipCache: z.boolean().default(false)
});

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a valid task status
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return TaskStatusSchema.safeParse(value).success;
}

/**
 * Check if value is a valid task type
 */
export function isTaskType(value: unknown): value is TaskType {
  return TaskTypeSchema.safeParse(value).success;
}

/**
 * Check if value is a valid task engine
 */
export function isTaskEngine(value: unknown): value is TaskEngine {
  return TaskEngineSchema.safeParse(value).success;
}

/**
 * Check if error is a TaskEngineError
 */
export function isTaskEngineError(error: unknown): error is TaskEngineError {
  return error instanceof TaskEngineError;
}

/**
 * Check if error is a LoopPreventionError
 */
export function isLoopPreventionError(error: unknown): error is LoopPreventionError {
  return error instanceof LoopPreventionError;
}
