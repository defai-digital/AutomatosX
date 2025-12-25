/**
 * SQLite Checkpoint Storage Implementation
 *
 * Persistent storage for agent execution checkpoints.
 *
 * Invariants:
 * - INV-CP-001: Checkpoint contains all data needed to resume
 * - INV-CP-002: Resumed execution starts from step after checkpoint
 */

import type { Checkpoint } from '@defai.digital/contracts';
import type { CheckpointStorage } from '@defai.digital/agent-execution';
import type Database from 'better-sqlite3';

/**
 * Error thrown by SQLite checkpoint store operations
 */
export class SqliteCheckpointStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SqliteCheckpointStoreError';
  }
}

/**
 * Error codes for SQLite checkpoint store
 */
export const SqliteCheckpointStoreErrorCodes = {
  DATABASE_ERROR: 'SQLITE_CHECKPOINT_DATABASE_ERROR',
  INVALID_CHECKPOINT: 'SQLITE_CHECKPOINT_INVALID',
  SERIALIZATION_ERROR: 'SQLITE_CHECKPOINT_SERIALIZATION_ERROR',
  INVALID_TABLE_NAME: 'SQLITE_CHECKPOINT_INVALID_TABLE_NAME',
} as const;

/**
 * Validates a SQL table name to prevent SQL injection
 * Only allows alphanumeric characters and underscores, must start with letter or underscore
 */
function isValidTableName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name.length <= 64;
}

/**
 * SQLite implementation of CheckpointStorage
 *
 * Invariants:
 * - INV-CP-001: All checkpoint data is serialized and stored
 * - INV-CP-002: Checkpoints are retrieved in creation order for latest lookup
 */
export class SqliteCheckpointStorage implements CheckpointStorage {
  private readonly db: Database.Database;
  private readonly tableName: string;

  constructor(db: Database.Database, tableName = 'checkpoints') {
    // Validate table name to prevent SQL injection
    if (!isValidTableName(tableName)) {
      throw new SqliteCheckpointStoreError(
        SqliteCheckpointStoreErrorCodes.INVALID_TABLE_NAME,
        `Invalid table name: ${tableName}. Must start with letter or underscore, contain only alphanumeric and underscores, max 64 chars.`
      );
    }
    this.db = db;
    this.tableName = tableName;
    this.initialize();
  }

  /**
   * Initializes the database schema
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        checkpoint_id TEXT NOT NULL UNIQUE,
        agent_id TEXT NOT NULL,
        session_id TEXT,
        workflow_id TEXT,
        step_index INTEGER NOT NULL,
        completed_step_id TEXT NOT NULL,
        step_outputs TEXT NOT NULL,
        context TEXT NOT NULL,
        memory_snapshot TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_agent_id
        ON ${this.tableName}(agent_id);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_agent_session
        ON ${this.tableName}(agent_id, session_id);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_created_at
        ON ${this.tableName}(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_expires_at
        ON ${this.tableName}(expires_at);
    `);
  }

  /**
   * Save a checkpoint
   * INV-CP-001: All data needed to resume is stored
   */
  async save(checkpoint: Checkpoint): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ${this.tableName} (
          checkpoint_id, agent_id, session_id, workflow_id,
          step_index, completed_step_id, step_outputs, context,
          memory_snapshot, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        checkpoint.checkpointId,
        checkpoint.agentId,
        checkpoint.sessionId ?? null,
        checkpoint.workflowId ?? null,
        checkpoint.stepIndex,
        checkpoint.completedStepId,
        JSON.stringify(checkpoint.stepOutputs),
        JSON.stringify(checkpoint.context),
        checkpoint.memorySnapshot !== undefined
          ? JSON.stringify(checkpoint.memorySnapshot)
          : null,
        checkpoint.createdAt,
        checkpoint.expiresAt ?? null
      );
    } catch (error) {
      throw new SqliteCheckpointStoreError(
        SqliteCheckpointStoreErrorCodes.DATABASE_ERROR,
        `Failed to save checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { checkpointId: checkpoint.checkpointId }
      );
    }
  }

  /**
   * Load a checkpoint by ID
   */
  async load(checkpointId: string): Promise<Checkpoint | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT checkpoint_id, agent_id, session_id, workflow_id,
               step_index, completed_step_id, step_outputs, context,
               memory_snapshot, created_at, expires_at
        FROM ${this.tableName}
        WHERE checkpoint_id = ?
      `);

      const row = stmt.get(checkpointId) as CheckpointRow | undefined;
      return row !== undefined ? rowToCheckpoint(row) : null;
    } catch (error) {
      throw new SqliteCheckpointStoreError(
        SqliteCheckpointStoreErrorCodes.DATABASE_ERROR,
        `Failed to load checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { checkpointId }
      );
    }
  }

  /**
   * Load latest checkpoint for an agent
   * INV-CP-002: Returns most recent checkpoint for proper resume
   */
  async loadLatest(
    agentId: string,
    sessionId?: string
  ): Promise<Checkpoint | null> {
    try {
      let sql = `
        SELECT checkpoint_id, agent_id, session_id, workflow_id,
               step_index, completed_step_id, step_outputs, context,
               memory_snapshot, created_at, expires_at
        FROM ${this.tableName}
        WHERE agent_id = ?
      `;

      const params: (string | null)[] = [agentId];

      if (sessionId !== undefined) {
        sql += ' AND session_id = ?';
        params.push(sessionId);
      }

      sql += ' ORDER BY created_at DESC LIMIT 1';

      const stmt = this.db.prepare(sql);
      const row = stmt.get(...params) as CheckpointRow | undefined;
      return row !== undefined ? rowToCheckpoint(row) : null;
    } catch (error) {
      throw new SqliteCheckpointStoreError(
        SqliteCheckpointStoreErrorCodes.DATABASE_ERROR,
        `Failed to load latest checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { agentId, sessionId }
      );
    }
  }

  /**
   * List checkpoints for an agent
   */
  async list(agentId: string, sessionId?: string): Promise<Checkpoint[]> {
    try {
      let sql = `
        SELECT checkpoint_id, agent_id, session_id, workflow_id,
               step_index, completed_step_id, step_outputs, context,
               memory_snapshot, created_at, expires_at
        FROM ${this.tableName}
        WHERE agent_id = ?
      `;

      const params: (string | null)[] = [agentId];

      if (sessionId !== undefined) {
        sql += ' AND session_id = ?';
        params.push(sessionId);
      }

      sql += ' ORDER BY created_at DESC';

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as CheckpointRow[];
      return rows.map(rowToCheckpoint);
    } catch (error) {
      throw new SqliteCheckpointStoreError(
        SqliteCheckpointStoreErrorCodes.DATABASE_ERROR,
        `Failed to list checkpoints: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { agentId, sessionId }
      );
    }
  }

  /**
   * Delete a checkpoint
   */
  async delete(checkpointId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM ${this.tableName} WHERE checkpoint_id = ?
      `);

      const result = stmt.run(checkpointId);
      return result.changes > 0;
    } catch (error) {
      throw new SqliteCheckpointStoreError(
        SqliteCheckpointStoreErrorCodes.DATABASE_ERROR,
        `Failed to delete checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { checkpointId }
      );
    }
  }

  /**
   * Delete expired checkpoints
   */
  async deleteExpired(): Promise<number> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        DELETE FROM ${this.tableName}
        WHERE expires_at IS NOT NULL AND expires_at < ?
      `);

      const result = stmt.run(now);
      return result.changes;
    } catch (error) {
      throw new SqliteCheckpointStoreError(
        SqliteCheckpointStoreErrorCodes.DATABASE_ERROR,
        `Failed to delete expired checkpoints: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clears all checkpoints (for testing only)
   */
  clear(): void {
    this.db.exec(`DELETE FROM ${this.tableName}`);
  }
}

/**
 * Row type from checkpoints table
 */
interface CheckpointRow {
  checkpoint_id: string;
  agent_id: string;
  session_id: string | null;
  workflow_id: string | null;
  step_index: number;
  completed_step_id: string;
  step_outputs: string;
  context: string;
  memory_snapshot: string | null;
  created_at: string;
  expires_at: string | null;
}

/**
 * Safely parses JSON with error handling
 */
function safeJsonParse<T>(json: string, fieldName: string, checkpointId: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new SqliteCheckpointStoreError(
      SqliteCheckpointStoreErrorCodes.SERIALIZATION_ERROR,
      `Failed to parse ${fieldName} for checkpoint ${checkpointId}: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
      { checkpointId, fieldName }
    );
  }
}

function rowToCheckpoint(row: CheckpointRow): Checkpoint {
  const checkpoint: Checkpoint = {
    checkpointId: row.checkpoint_id,
    agentId: row.agent_id,
    stepIndex: row.step_index,
    completedStepId: row.completed_step_id,
    stepOutputs: safeJsonParse<Record<string, unknown>>(row.step_outputs, 'stepOutputs', row.checkpoint_id),
    context: safeJsonParse<Record<string, unknown>>(row.context, 'context', row.checkpoint_id),
    createdAt: row.created_at,
  };

  if (row.session_id !== null) {
    checkpoint.sessionId = row.session_id;
  }
  if (row.workflow_id !== null) {
    checkpoint.workflowId = row.workflow_id;
  }
  if (row.memory_snapshot !== null) {
    checkpoint.memorySnapshot = safeJsonParse<{ key: string; value?: unknown; namespace?: string }[]>(row.memory_snapshot, 'memorySnapshot', row.checkpoint_id);
  }
  if (row.expires_at !== null) {
    checkpoint.expiresAt = row.expires_at;
  }

  return checkpoint;
}

/**
 * Creates a SQLite checkpoint storage
 */
export function createSqliteCheckpointStorage(
  db: Database.Database,
  tableName?: string
): SqliteCheckpointStorage {
  return new SqliteCheckpointStorage(db, tableName);
}
