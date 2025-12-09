/**
 * Task Store - SQLite-based Task Persistence
 *
 * Provides persistent storage for tasks with:
 * - Gzip compression for payloads
 * - Automatic TTL expiration
 * - Efficient querying with indexes
 * - Prepared statements for performance
 *
 * @module core/task-engine/store
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import { createHash, randomBytes } from 'crypto';
import { DatabaseFactory } from '../database/factory.js';
import { logger } from '../../shared/logging/logger.js';
import { AX_PATHS, DATABASE } from '../validation-limits.js';
import {
  decompressPayload,
  compressWithInfo,
  isGzipCompressed
} from './compression.js';
import {
  type Task,
  type TaskStatus,
  type TaskType,
  type TaskEngine,
  type TaskFilter,
  type TaskMetrics,
  type TaskError,
  type TaskStoreConfig,
  type CreateTaskInput,
  type CreateTaskResult,
  type OriginClient,
  TaskEngineError,
  CreateTaskInputSchema,
  TaskFilterSchema
} from './types.js';

// Error messages that indicate the native better-sqlite3 module is incompatible
const NATIVE_MODULE_ERROR_PATTERNS = [
  'NODE_MODULE_VERSION',
  'was compiled against a different Node.js version',
  'better_sqlite3.node'
];

/**
 * Default store configuration
 */
const DEFAULT_CONFIG: Required<TaskStoreConfig> = {
  dbPath: `${AX_PATHS.TASKS}/tasks.db`,
  maxPayloadBytes: 1024 * 1024, // 1MB
  compressionEnabled: true,
  compressionLevel: 6,
  defaultTtlHours: 24,
  maxTtlHours: 168, // 7 days
  busyTimeout: DATABASE.BUSY_TIMEOUT
};

/**
 * SQL statements for task operations
 */
const SQL = {
  CREATE_TABLE: `
    CREATE TABLE IF NOT EXISTS task_store (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('web_search', 'code_review', 'code_generation', 'analysis', 'custom')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'expired')),
      engine TEXT CHECK (engine IN ('gemini', 'claude', 'codex', 'glm', 'grok', NULL)),
      priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),

      payload_compressed BLOB NOT NULL,
      payload_size_bytes INTEGER NOT NULL,
      payload_hash TEXT NOT NULL,
      is_compressed INTEGER NOT NULL DEFAULT 1,

      result_compressed BLOB,
      result_size_bytes INTEGER,
      result_is_compressed INTEGER,

      origin_client TEXT NOT NULL,
      call_chain TEXT NOT NULL,
      depth INTEGER NOT NULL DEFAULT 0,

      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      expires_at INTEGER NOT NULL,

      duration_ms INTEGER,
      tokens_prompt INTEGER,
      tokens_completion INTEGER,
      retry_count INTEGER NOT NULL DEFAULT 0,

      error_code TEXT,
      error_message TEXT
    )
  `,

  CREATE_INDEXES: `
    CREATE INDEX IF NOT EXISTS idx_task_status ON task_store(status);
    CREATE INDEX IF NOT EXISTS idx_task_status_priority ON task_store(status, priority DESC);
    CREATE INDEX IF NOT EXISTS idx_task_expires ON task_store(expires_at);
    CREATE INDEX IF NOT EXISTS idx_task_engine ON task_store(engine);
    CREATE INDEX IF NOT EXISTS idx_task_created ON task_store(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_task_payload_hash ON task_store(payload_hash);
    CREATE INDEX IF NOT EXISTS idx_task_origin ON task_store(origin_client);
  `,

  INSERT_TASK: `
    INSERT INTO task_store (
      id, type, status, engine, priority,
      payload_compressed, payload_size_bytes, payload_hash, is_compressed,
      origin_client, call_chain, depth,
      created_at, expires_at
    ) VALUES (
      :id, :type, :status, :engine, :priority,
      :payload_compressed, :payload_size_bytes, :payload_hash, :is_compressed,
      :origin_client, :call_chain, :depth,
      :created_at, :expires_at
    )
  `,

  GET_BY_ID: `
    SELECT * FROM task_store WHERE id = ?
  `,

  UPDATE_STATUS: `
    UPDATE task_store SET
      status = :status,
      started_at = COALESCE(:started_at, started_at),
      completed_at = COALESCE(:completed_at, completed_at),
      error_code = COALESCE(:error_code, error_code),
      error_message = COALESCE(:error_message, error_message)
    WHERE id = :id
  `,

  UPDATE_RESULT: `
    UPDATE task_store SET
      status = 'completed',
      result_compressed = :result_compressed,
      result_size_bytes = :result_size_bytes,
      result_is_compressed = :result_is_compressed,
      completed_at = :completed_at,
      duration_ms = :duration_ms,
      tokens_prompt = :tokens_prompt,
      tokens_completion = :tokens_completion
    WHERE id = :id
  `,

  UPDATE_FAILED: `
    UPDATE task_store SET
      status = 'failed',
      completed_at = :completed_at,
      duration_ms = :duration_ms,
      error_code = :error_code,
      error_message = :error_message,
      retry_count = retry_count + 1
    WHERE id = :id
  `,

  INCREMENT_RETRY: `
    UPDATE task_store SET retry_count = retry_count + 1 WHERE id = ?
  `,

  DELETE_TASK: `
    DELETE FROM task_store WHERE id = ?
  `,

  CLEANUP_EXPIRED: `
    DELETE FROM task_store WHERE expires_at < ? AND status NOT IN ('running')
  `,

  CLEANUP_ZOMBIE_RUNNING: `
    UPDATE task_store SET
      status = 'failed',
      completed_at = :completed_at,
      error_code = 'ZOMBIE_TASK',
      error_message = 'Task was stuck in running state past expiry'
    WHERE status = 'running' AND expires_at < :now
  `,

  COUNT_BY_STATUS: `
    SELECT status, COUNT(*) as count FROM task_store GROUP BY status
  `,

  FIND_BY_HASH: `
    SELECT id FROM task_store WHERE payload_hash = ? AND status = 'completed' LIMIT 1
  `
};

/**
 * Utility: generate a task ID
 */
function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `task_${timestamp}${random}`;
}

/**
 * Utility: hash payload for caching
 */
function hashPayload(json: string): string {
  return createHash('sha256').update(json).digest('hex').substring(0, 16);
}

/**
 * Utility: estimate engine from task type
 */
function estimateEngine(type: TaskType): TaskEngine {
  switch (type) {
    case 'web_search':
      return 'gemini';
    case 'code_review':
    case 'code_generation':
      return 'claude';
    case 'analysis':
      return 'claude';
    case 'custom':
    default:
      return 'auto';
  }
}

/**
 * Shared interface for task stores (SQLite and in-memory fallback)
 */
export interface TaskStoreLike {
  createTask(input: CreateTaskInput): CreateTaskResult;
  getTask(taskId: string): Task | null;
  updateTaskStatus(taskId: string, status: TaskStatus, error?: TaskError): void;
  updateTaskResult(taskId: string, result: Record<string, unknown>, metrics: Partial<TaskMetrics>): void;
  updateTaskFailed(taskId: string, error: TaskError, durationMs?: number): void;
  incrementRetry(taskId: string): void;
  deleteTask(taskId: string): boolean;
  listTasks(filter?: TaskFilter): Task[];
  countTasks(filter?: TaskFilter): number;
  findByPayloadHash(payloadHash: string): string | null;
  cleanupExpired(): number;
  cleanupZombieRunning(): number;
  cleanupAll(): { expired: number; zombies: number };
  getStats(): { totalTasks: number; byStatus: Record<TaskStatus, number>; dbSizeBytes: number };
  close(): void;
}

/**
 * TaskStore - SQLite-based task persistence
 *
 * @example
 * ```typescript
 * const store = new TaskStore({ dbPath: '.automatosx/tasks/tasks.db' });
 *
 * // Create a task
 * const result = await store.createTask({
 *   type: 'web_search',
 *   payload: { query: 'AI news' },
 *   context: { originClient: 'claude-code' }
 * });
 *
 * // Get the task
 * const task = store.getTask(result.id);
 *
 * // Update with result
 * store.updateTaskResult(result.id, { results: [...] }, { durationMs: 1500 });
 * ```
 */
export class TaskStore implements TaskStoreLike {
  private db: Database.Database;
  private config: Required<TaskStoreConfig>;
  private closed = false;

  // Prepared statements
  private stmtInsert!: Database.Statement;
  private stmtGetById!: Database.Statement;
  private stmtUpdateStatus!: Database.Statement;
  private stmtUpdateResult!: Database.Statement;
  private stmtUpdateFailed!: Database.Statement;
  private stmtIncrementRetry!: Database.Statement;
  private stmtDelete!: Database.Statement;
  private stmtCleanup!: Database.Statement;
  private stmtCleanupZombies!: Database.Statement;
  private stmtCountByStatus!: Database.Statement;
  private stmtFindByHash!: Database.Statement;

  constructor(config: Partial<TaskStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create database connection
    this.db = DatabaseFactory.create(this.config.dbPath, {
      busyTimeout: this.config.busyTimeout,
      enableWal: true
    });

    // Initialize schema and prepared statements
    this.initializeSchema();
    this.prepareStatements();

    logger.debug('TaskStore initialized', {
      dbPath: this.config.dbPath,
      maxPayloadBytes: this.config.maxPayloadBytes,
      compressionEnabled: this.config.compressionEnabled
    });
  }

  /**
   * Create a new task
   */
  createTask(input: CreateTaskInput): CreateTaskResult {
    this.ensureOpen();

    // Validate input
    const validated = CreateTaskInputSchema.parse(input);

    // Serialize and validate size
    const payloadJson = JSON.stringify(validated.payload);
    const payloadSize = Buffer.byteLength(payloadJson, 'utf-8');

    if (payloadSize > this.config.maxPayloadBytes) {
      throw new TaskEngineError(
        `Payload size ${payloadSize} exceeds limit ${this.config.maxPayloadBytes}`,
        'PAYLOAD_TOO_LARGE',
        { payloadSize, limit: this.config.maxPayloadBytes }
      );
    }

    // Compress payload
    let payloadBuffer: Buffer;
    let isCompressed: boolean;
    let compressionRatio: number;

    if (this.config.compressionEnabled) {
      const result = compressWithInfo(validated.payload, {
        level: this.config.compressionLevel
      });
      payloadBuffer = result.data;
      isCompressed = result.compressed;
      compressionRatio = result.ratio;
    } else {
      payloadBuffer = Buffer.from(payloadJson, 'utf-8');
      isCompressed = false;
      compressionRatio = 1;
    }

    // Generate task ID and hash
    const taskId = generateTaskId();
    const payloadHash = hashPayload(payloadJson);

    // Calculate expiration
    const now = Date.now();
    const ttlHours = Math.min(
      validated.ttlHours ?? this.config.defaultTtlHours,
      this.config.maxTtlHours
    );
    const expiresAt = now + ttlHours * 60 * 60 * 1000;

    // Determine estimated engine
    const estimatedEngine = validated.engine === 'auto'
      ? estimateEngine(validated.type)
      : validated.engine;

    // Insert task
    try {
      this.stmtInsert.run({
        id: taskId,
        type: validated.type,
        status: 'pending',
        engine: validated.engine === 'auto' ? null : validated.engine,
        priority: validated.priority ?? 5,
        payload_compressed: payloadBuffer,
        payload_size_bytes: payloadSize,
        payload_hash: payloadHash,
        is_compressed: isCompressed ? 1 : 0,
        origin_client: validated.context?.originClient ?? 'unknown',
        call_chain: JSON.stringify(validated.context?.callChain ?? []),
        depth: validated.context?.depth ?? 0,
        created_at: now,
        expires_at: expiresAt
      });
    } catch (error) {
      throw new TaskEngineError(
        `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORE_ERROR',
        { originalError: error }
      );
    }

    logger.debug('Task created', {
      taskId,
      type: validated.type,
      payloadSize,
      compressedSize: payloadBuffer.length,
      compressionRatio: compressionRatio.toFixed(2)
    });

    return {
      id: taskId,
      status: 'pending',
      estimatedEngine: estimatedEngine ?? null,
      expiresAt,
      payloadSize,
      compressionRatio
    };
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | null {
    this.ensureOpen();

    const row = this.stmtGetById.get(taskId) as TaskRow | undefined;
    if (!row) {
      return null;
    }

    return this.rowToTask(row);
  }

  /**
   * Update task status
   */
  updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    error?: TaskError
  ): void {
    this.ensureOpen();

    const now = Date.now();
    const params: Record<string, unknown> = {
      id: taskId,
      status,
      started_at: status === 'running' ? now : null,
      completed_at: status === 'completed' || status === 'failed' ? now : null,
      error_code: error?.code ?? null,
      error_message: error?.message ?? null
    };

    const result = this.stmtUpdateStatus.run(params);
    if (result.changes === 0) {
      throw new TaskEngineError(
        `Task not found: ${taskId}`,
        'TASK_NOT_FOUND'
      );
    }

    logger.debug('Task status updated', { taskId, status });
  }

  /**
   * Update task with successful result
   */
  updateTaskResult(
    taskId: string,
    result: Record<string, unknown>,
    metrics: Partial<TaskMetrics>
  ): void {
    this.ensureOpen();

    const now = Date.now();
    const resultJson = JSON.stringify(result);
    const resultSize = Buffer.byteLength(resultJson, 'utf-8');

    let resultBuffer: Buffer;
    let resultIsCompressed: boolean;

    if (this.config.compressionEnabled) {
      const compressed = compressWithInfo(result, {
        level: this.config.compressionLevel
      });
      resultBuffer = compressed.data;
      resultIsCompressed = compressed.compressed;
    } else {
      resultBuffer = Buffer.from(resultJson, 'utf-8');
      resultIsCompressed = false;
    }

    const dbResult = this.stmtUpdateResult.run({
      id: taskId,
      result_compressed: resultBuffer,
      result_size_bytes: resultSize,
      result_is_compressed: resultIsCompressed ? 1 : 0,
      completed_at: now,
      duration_ms: metrics.durationMs ?? null,
      tokens_prompt: metrics.tokensPrompt ?? null,
      tokens_completion: metrics.tokensCompletion ?? null
    });

    if (dbResult.changes === 0) {
      throw new TaskEngineError(
        `Task not found: ${taskId}`,
        'TASK_NOT_FOUND'
      );
    }

    logger.debug('Task result updated', {
      taskId,
      resultSize,
      durationMs: metrics.durationMs
    });
  }

  /**
   * Update task with failure
   */
  updateTaskFailed(
    taskId: string,
    error: TaskError,
    durationMs?: number
  ): void {
    this.ensureOpen();

    const now = Date.now();

    const result = this.stmtUpdateFailed.run({
      id: taskId,
      completed_at: now,
      duration_ms: durationMs ?? null,
      error_code: error.code,
      error_message: error.message
    });

    if (result.changes === 0) {
      throw new TaskEngineError(
        `Task not found: ${taskId}`,
        'TASK_NOT_FOUND'
      );
    }

    logger.debug('Task marked as failed', { taskId, error: error.code });
  }

  /**
   * Increment retry count
   */
  incrementRetry(taskId: string): void {
    this.ensureOpen();
    this.stmtIncrementRetry.run(taskId);
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): boolean {
    this.ensureOpen();

    const result = this.stmtDelete.run(taskId);
    const deleted = result.changes > 0;

    if (deleted) {
      logger.debug('Task deleted', { taskId });
    }

    return deleted;
  }

  /**
   * List tasks with optional filtering
   */
  listTasks(filter: TaskFilter = {}): Task[] {
    this.ensureOpen();

    const validated = TaskFilterSchema.parse(filter);

    // Build dynamic query
    const conditions: string[] = ['1=1'];
    const params: Record<string, unknown> = {};

    if (validated.status) {
      conditions.push('status = :status');
      params.status = validated.status;
    }

    if (validated.engine) {
      conditions.push('engine = :engine');
      params.engine = validated.engine;
    }

    if (validated.type) {
      conditions.push('type = :type');
      params.type = validated.type;
    }

    if (validated.originClient) {
      conditions.push('origin_client = :origin_client');
      params.origin_client = validated.originClient;
    }

    const query = `
      SELECT * FROM task_store
      WHERE ${conditions.join(' AND ')}
      ORDER BY priority DESC, created_at ASC
      LIMIT :limit OFFSET :offset
    `;

    params.limit = validated.limit ?? 20;
    params.offset = validated.offset ?? 0;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(params) as TaskRow[];

    return rows.map(row => this.rowToTask(row));
  }

  /**
   * Count tasks by status
   */
  countByStatus(): Record<TaskStatus, number> {
    this.ensureOpen();

    const rows = this.stmtCountByStatus.all() as Array<{ status: TaskStatus; count: number }>;

    const counts: Record<TaskStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      expired: 0
    };

    for (const row of rows) {
      counts[row.status] = row.count;
    }

    return counts;
  }

  /**
   * Count tasks matching filter (for pagination)
   */
  countTasks(filter: TaskFilter = {}): number {
    this.ensureOpen();

    const validated = TaskFilterSchema.parse(filter);

    // Build dynamic query
    const conditions: string[] = ['1=1'];
    const params: Record<string, unknown> = {};

    if (validated.status) {
      conditions.push('status = :status');
      params.status = validated.status;
    }

    if (validated.engine) {
      conditions.push('engine = :engine');
      params.engine = validated.engine;
    }

    if (validated.type) {
      conditions.push('type = :type');
      params.type = validated.type;
    }

    if (validated.originClient) {
      conditions.push('origin_client = :origin_client');
      params.origin_client = validated.originClient;
    }

    const query = `SELECT COUNT(*) as count FROM task_store WHERE ${conditions.join(' AND ')}`;
    const stmt = this.db.prepare(query);
    const row = stmt.get(params) as { count: number };

    return row.count;
  }

  /**
   * Find a completed task with the same payload (for caching)
   */
  findByPayloadHash(payloadHash: string): string | null {
    this.ensureOpen();

    const row = this.stmtFindByHash.get(payloadHash) as { id: string } | undefined;
    return row?.id ?? null;
  }

  /**
   * Cleanup expired tasks
   */
  cleanupExpired(): number {
    this.ensureOpen();

    const now = Date.now();
    const result = this.stmtCleanup.run(now);

    if (result.changes > 0) {
      logger.debug('Expired tasks cleaned up', { count: result.changes });
    }

    return result.changes;
  }

  /**
   * Mark zombie running tasks as failed.
   * These are tasks that have been in 'running' state past their expiry time,
   * likely due to process crashes or other failures.
   */
  cleanupZombieRunning(): number {
    this.ensureOpen();

    const now = Date.now();
    const result = this.stmtCleanupZombies.run({
      now,
      completed_at: now
    });

    if (result.changes > 0) {
      logger.warn('Zombie running tasks marked as failed', { count: result.changes });
    }

    return result.changes;
  }

  /**
   * Full cleanup: handles both expired non-running tasks and zombie running tasks.
   * Call this periodically to prevent resource leaks.
   */
  cleanupAll(): { expired: number; zombies: number } {
    const zombies = this.cleanupZombieRunning();
    const expired = this.cleanupExpired();

    return { expired, zombies };
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalTasks: number;
    byStatus: Record<TaskStatus, number>;
    dbSizeBytes: number;
  } {
    this.ensureOpen();

    const counts = this.countByStatus();
    const totalTasks = Object.values(counts).reduce((a, b) => a + b, 0);

    // Get database size
    let dbSizeBytes = 0;
    try {
      const pageCount = this.db.pragma('page_count', { simple: true }) as number;
      const pageSize = this.db.pragma('page_size', { simple: true }) as number;
      dbSizeBytes = pageCount * pageSize;
    } catch {
      // Ignore errors getting db size
    }

    return {
      totalTasks,
      byStatus: counts,
      dbSizeBytes
    };
  }

  /**
   * Close the store
   */
  close(): void {
    if (this.closed) return;

    DatabaseFactory.close(this.db);
    this.closed = true;
    logger.debug('TaskStore closed');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private initializeSchema(): void {
    this.db.exec(SQL.CREATE_TABLE);

    // Create indexes separately (SQLite doesn't support multiple in one exec)
    const indexStatements = SQL.CREATE_INDEXES.split(';').filter(s => s.trim());
    for (const stmt of indexStatements) {
      this.db.exec(stmt);
    }
  }

  private prepareStatements(): void {
    this.stmtInsert = this.db.prepare(SQL.INSERT_TASK);
    this.stmtGetById = this.db.prepare(SQL.GET_BY_ID);
    this.stmtUpdateStatus = this.db.prepare(SQL.UPDATE_STATUS);
    this.stmtUpdateResult = this.db.prepare(SQL.UPDATE_RESULT);
    this.stmtUpdateFailed = this.db.prepare(SQL.UPDATE_FAILED);
    this.stmtIncrementRetry = this.db.prepare(SQL.INCREMENT_RETRY);
    this.stmtDelete = this.db.prepare(SQL.DELETE_TASK);
    this.stmtCleanup = this.db.prepare(SQL.CLEANUP_EXPIRED);
    this.stmtCleanupZombies = this.db.prepare(SQL.CLEANUP_ZOMBIE_RUNNING);
    this.stmtCountByStatus = this.db.prepare(SQL.COUNT_BY_STATUS);
    this.stmtFindByHash = this.db.prepare(SQL.FIND_BY_HASH);
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new TaskEngineError('TaskStore is closed', 'STORE_ERROR');
    }
  }

  private rowToTask(row: TaskRow): Task {
    // Decompress payload with error handling
    let payload: Record<string, unknown>;
    try {
      if (row.is_compressed) {
        payload = decompressPayload(row.payload_compressed);
      } else {
        payload = JSON.parse(row.payload_compressed.toString('utf-8'));
      }
    } catch (error) {
      // Log error and return empty payload rather than crashing
      logger.error('Failed to decompress task payload', {
        taskId: row.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new TaskEngineError(
        `Failed to decompress task payload for task ${row.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORE_ERROR',
        { taskId: row.id, originalError: error }
      );
    }

    // Decompress result if present with error handling
    let result: Record<string, unknown> | null = null;
    if (row.result_compressed) {
      try {
        if (row.result_is_compressed) {
          result = decompressPayload(row.result_compressed);
        } else {
          result = JSON.parse(row.result_compressed.toString('utf-8'));
        }
      } catch (error) {
        // Log error but don't crash - result can be null
        logger.warn('Failed to decompress task result, returning null', {
          taskId: row.id,
          error: error instanceof Error ? error.message : String(error)
        });
        result = null;
      }
    }

    return {
      id: row.id,
      type: row.type as TaskType,
      status: row.status as TaskStatus,
      engine: row.engine as TaskEngine | null,
      priority: row.priority,
      payload,
      payloadSize: row.payload_size_bytes,
      result,
      context: {
        originClient: row.origin_client as OriginClient,
        callChain: JSON.parse(row.call_chain),
        depth: row.depth
      },
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      expiresAt: row.expires_at,
      metrics: row.duration_ms != null ? {
        durationMs: row.duration_ms,
        tokensPrompt: row.tokens_prompt,
        tokensCompletion: row.tokens_completion
      } : null,
      error: row.error_code ? {
        code: row.error_code,
        message: row.error_message ?? ''
      } : null,
      retryCount: row.retry_count
    };
  }
}

/**
 * Database row type (internal)
 */
interface TaskRow {
  id: string;
  type: string;
  status: string;
  engine: string | null;
  priority: number;
  payload_compressed: Buffer;
  payload_size_bytes: number;
  payload_hash: string;
  is_compressed: number;
  result_compressed: Buffer | null;
  result_size_bytes: number | null;
  result_is_compressed: number | null;
  origin_client: string;
  call_chain: string;
  depth: number;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  expires_at: number;
  duration_ms: number | null;
  tokens_prompt: number | null;
  tokens_completion: number | null;
  retry_count: number;
  error_code: string | null;
  error_message: string | null;
}

interface InMemoryTask extends Task {
  payloadHash: string;
  compressionRatio: number;
}

/**
 * In-memory fallback for environments where the native SQLite module
 * cannot be loaded (e.g., Node.js version mismatch).
 *
 * Provides functional parity for MCP task tools without persistence.
 */
export class InMemoryTaskStore implements TaskStoreLike {
  private tasks = new Map<string, InMemoryTask>();
  private config: Required<TaskStoreConfig>;
  private closed = false;

  constructor(config: Partial<TaskStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.warn('Using in-memory task store fallback (SQLite unavailable)', {
      nodeVersion: process.version
    });
  }

  createTask(input: CreateTaskInput): CreateTaskResult {
    this.ensureOpen();

    const validated = CreateTaskInputSchema.parse(input);
    const payloadJson = JSON.stringify(validated.payload);
    const payloadSize = Buffer.byteLength(payloadJson, 'utf-8');

    if (payloadSize > this.config.maxPayloadBytes) {
      throw new TaskEngineError(
        `Payload size ${payloadSize} exceeds limit ${this.config.maxPayloadBytes}`,
        'PAYLOAD_TOO_LARGE',
        { payloadSize, limit: this.config.maxPayloadBytes }
      );
    }

    const id = generateTaskId();
    const now = Date.now();
    const ttlHours = Math.min(
      validated.ttlHours ?? this.config.defaultTtlHours,
      this.config.maxTtlHours
    );
    const expiresAt = now + ttlHours * 60 * 60 * 1000;
    const estimatedEngine = validated.engine === 'auto'
      ? estimateEngine(validated.type)
      : validated.engine;

    const task: InMemoryTask = {
      id,
      type: validated.type,
      status: 'pending',
      engine: validated.engine === 'auto' ? null : validated.engine,
      priority: validated.priority ?? 5,
      payload: validated.payload,
      payloadSize,
      result: null,
      context: {
        originClient: validated.context?.originClient ?? 'unknown',
        callChain: validated.context?.callChain ?? [],
        depth: validated.context?.depth ?? 0
      },
      createdAt: now,
      startedAt: null,
      completedAt: null,
      expiresAt,
      metrics: null,
      error: null,
      retryCount: 0,
      payloadHash: hashPayload(payloadJson),
      compressionRatio: 1
    };

    this.tasks.set(id, task);

    return {
      id,
      status: 'pending',
      estimatedEngine: estimatedEngine ?? null,
      expiresAt,
      payloadSize,
      compressionRatio: 1
    };
  }

  getTask(taskId: string): Task | null {
    this.ensureOpen();
    const task = this.tasks.get(taskId);
    return task ? structuredClone(task) : null;
  }

  updateTaskStatus(taskId: string, status: TaskStatus, error?: TaskError): void {
    this.ensureOpen();
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new TaskEngineError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    const now = Date.now();
    task.status = status;
    task.startedAt = status === 'running' ? now : task.startedAt;
    if (status === 'completed' || status === 'failed') {
      task.completedAt = now;
    }
    task.error = error ?? null;
  }

  updateTaskResult(taskId: string, result: Record<string, unknown>, metrics: Partial<TaskMetrics>): void {
    this.ensureOpen();
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new TaskEngineError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    task.status = 'completed';
    task.result = result;
    task.metrics = {
      durationMs: metrics.durationMs ?? 0,
      tokensPrompt: metrics.tokensPrompt ?? null,
      tokensCompletion: metrics.tokensCompletion ?? null
    };
    task.completedAt = Date.now();
    task.error = null;
  }

  updateTaskFailed(taskId: string, error: TaskError, durationMs?: number): void {
    this.ensureOpen();
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new TaskEngineError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    task.status = 'failed';
    task.error = error;
    task.metrics = task.metrics ?? {
      durationMs: durationMs ?? 0,
      tokensPrompt: null,
      tokensCompletion: null
    };
    task.completedAt = Date.now();
  }

  incrementRetry(taskId: string): void {
    this.ensureOpen();
    const task = this.tasks.get(taskId);
    if (task) {
      task.retryCount += 1;
    }
  }

  deleteTask(taskId: string): boolean {
    this.ensureOpen();
    return this.tasks.delete(taskId);
  }

  listTasks(filter: TaskFilter = {}): Task[] {
    this.ensureOpen();
    const validated = TaskFilterSchema.parse(filter);

    const filtered = Array.from(this.tasks.values()).filter(task => {
      if (validated.status && task.status !== validated.status) return false;
      if (validated.engine && task.engine !== validated.engine) return false;
      if (validated.type && task.type !== validated.type) return false;
      if (validated.originClient && task.context.originClient !== validated.originClient) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.createdAt - b.createdAt;
    });

    const start = validated.offset ?? 0;
    const end = start + (validated.limit ?? 20);
    return filtered.slice(start, end).map(task => structuredClone(task));
  }

  countTasks(filter: TaskFilter = {}): number {
    this.ensureOpen();
    const validated = TaskFilterSchema.parse(filter);

    return Array.from(this.tasks.values()).filter(task => {
      if (validated.status && task.status !== validated.status) return false;
      if (validated.engine && task.engine !== validated.engine) return false;
      if (validated.type && task.type !== validated.type) return false;
      if (validated.originClient && task.context.originClient !== validated.originClient) return false;
      return true;
    }).length;
  }

  findByPayloadHash(payloadHash: string): string | null {
    this.ensureOpen();
    for (const task of this.tasks.values()) {
      if (task.status === 'completed' && task.payloadHash === payloadHash) {
        return task.id;
      }
    }
    return null;
  }

  cleanupExpired(): number {
    this.ensureOpen();
    const now = Date.now();
    let removed = 0;

    for (const [id, task] of this.tasks) {
      if (task.expiresAt < now && task.status !== 'running') {
        this.tasks.delete(id);
        removed++;
      }
    }

    return removed;
  }

  cleanupZombieRunning(): number {
    this.ensureOpen();
    const now = Date.now();
    let converted = 0;

    for (const task of this.tasks.values()) {
      if (task.status === 'running' && task.expiresAt < now) {
        task.status = 'failed';
        task.error = {
          code: 'ZOMBIE_TASK',
          message: 'Task was stuck in running state past expiry'
        };
        task.completedAt = now;
        converted++;
      }
    }

    return converted;
  }

  cleanupAll(): { expired: number; zombies: number } {
    const zombies = this.cleanupZombieRunning();
    const expired = this.cleanupExpired();
    return { expired, zombies };
  }

  getStats(): { totalTasks: number; byStatus: Record<TaskStatus, number>; dbSizeBytes: number } {
    this.ensureOpen();

    const byStatus: Record<TaskStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      expired: 0
    };

    for (const task of this.tasks.values()) {
      byStatus[task.status]++;
    }

    return {
      totalTasks: this.tasks.size,
      byStatus,
      dbSizeBytes: 0
    };
  }

  close(): void {
    this.closed = true;
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new TaskEngineError('TaskStore is closed', 'STORE_ERROR');
    }
  }
}

function isNativeModuleError(error: unknown): error is Error {
  if (!(error instanceof Error)) return false;
  const message = error.message ?? '';
  return NATIVE_MODULE_ERROR_PATTERNS.some(pattern => message.includes(pattern));
}

/**
 * Create a TaskStore with default configuration
 */
export function createTaskStore(config?: Partial<TaskStoreConfig>): TaskStoreLike {
  try {
    return new TaskStore(config);
  } catch (error) {
    if (isNativeModuleError(error)) {
      logger.warn('Falling back to in-memory task store (native SQLite unavailable)', {
        nodeVersion: process.version,
        error: error instanceof Error ? error.message : String(error)
      });
      return new InMemoryTaskStore(config);
    }
    throw error;
  }
}
