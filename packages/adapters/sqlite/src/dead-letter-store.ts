/**
 * SQLite Dead Letter Storage Implementation
 *
 * Persistent storage for dead letter queue entries.
 *
 * Invariants:
 * - INV-DLQ-001: Failed events captured with full context
 * - INV-DLQ-002: Retries respect maxRetries limit
 * - INV-DLQ-003: Exhausted entries marked appropriately
 */

import type { DeadLetterEntry, DeadLetterStatus } from '@automatosx/contracts';
import type { DeadLetterStorage } from '@automatosx/cross-cutting';
import type Database from 'better-sqlite3';

/**
 * Error thrown by SQLite dead letter store operations
 */
export class SqliteDeadLetterStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SqliteDeadLetterStoreError';
  }
}

/**
 * Error codes for SQLite dead letter store
 */
export const SqliteDeadLetterStoreErrorCodes = {
  DATABASE_ERROR: 'SQLITE_DLQ_DATABASE_ERROR',
  INVALID_ENTRY: 'SQLITE_DLQ_INVALID_ENTRY',
  SERIALIZATION_ERROR: 'SQLITE_DLQ_SERIALIZATION_ERROR',
} as const;

/**
 * SQLite implementation of DeadLetterStorage
 *
 * Invariants:
 * - INV-DLQ-001: All entry data is serialized and stored
 * - INV-DLQ-002: Status transitions tracked via updates
 * - INV-DLQ-003: countByStatus provides accurate status breakdown
 */
export class SqliteDeadLetterStorage implements DeadLetterStorage {
  private readonly db: Database.Database;
  private readonly tableName: string;

  constructor(db: Database.Database, tableName = 'dead_letter_entries') {
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
        entry_id TEXT NOT NULL UNIQUE,
        original_event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_payload TEXT,
        error TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL,
        last_retry_at TEXT,
        next_retry_at TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        correlation_id TEXT,
        source TEXT NOT NULL,
        context TEXT,
        resolution_notes TEXT,
        resolved_by TEXT,
        resolved_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_status
        ON ${this.tableName}(status);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_source
        ON ${this.tableName}(source);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_event_type
        ON ${this.tableName}(event_type);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_created_at
        ON ${this.tableName}(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_next_retry_at
        ON ${this.tableName}(next_retry_at);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_status_next_retry
        ON ${this.tableName}(status, next_retry_at);
    `);
  }

  /**
   * Add entry to DLQ
   * INV-DLQ-001: All context captured
   */
  async add(entry: DeadLetterEntry): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ${this.tableName} (
          entry_id, original_event_id, event_type, event_payload,
          error, retry_count, max_retries, last_retry_at, next_retry_at,
          status, created_at, correlation_id, source, context,
          resolution_notes, resolved_by, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        entry.entryId,
        entry.originalEventId,
        entry.eventType,
        entry.eventPayload !== undefined ? JSON.stringify(entry.eventPayload) : null,
        JSON.stringify(entry.error),
        entry.retryCount,
        entry.maxRetries,
        entry.lastRetryAt ?? null,
        entry.nextRetryAt ?? null,
        entry.status,
        entry.createdAt,
        entry.correlationId ?? null,
        entry.source,
        entry.context !== undefined ? JSON.stringify(entry.context) : null,
        entry.resolutionNotes ?? null,
        entry.resolvedBy ?? null,
        entry.resolvedAt ?? null
      );
    } catch (error) {
      throw new SqliteDeadLetterStoreError(
        SqliteDeadLetterStoreErrorCodes.DATABASE_ERROR,
        `Failed to add DLQ entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { entryId: entry.entryId }
      );
    }
  }

  /**
   * Get entry by ID
   */
  async get(entryId: string): Promise<DeadLetterEntry | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT entry_id, original_event_id, event_type, event_payload,
               error, retry_count, max_retries, last_retry_at, next_retry_at,
               status, created_at, correlation_id, source, context,
               resolution_notes, resolved_by, resolved_at
        FROM ${this.tableName}
        WHERE entry_id = ?
      `);

      const row = stmt.get(entryId) as DeadLetterRow | undefined;
      return row !== undefined ? rowToDeadLetterEntry(row) : null;
    } catch (error) {
      throw new SqliteDeadLetterStoreError(
        SqliteDeadLetterStoreErrorCodes.DATABASE_ERROR,
        `Failed to get DLQ entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { entryId }
      );
    }
  }

  /**
   * List entries with optional status filter
   */
  async list(status?: DeadLetterStatus): Promise<DeadLetterEntry[]> {
    try {
      let sql = `
        SELECT entry_id, original_event_id, event_type, event_payload,
               error, retry_count, max_retries, last_retry_at, next_retry_at,
               status, created_at, correlation_id, source, context,
               resolution_notes, resolved_by, resolved_at
        FROM ${this.tableName}
      `;

      const params: string[] = [];

      if (status !== undefined) {
        sql += ' WHERE status = ?';
        params.push(status);
      }

      sql += ' ORDER BY created_at DESC';

      const stmt = this.db.prepare(sql);
      const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as DeadLetterRow[];
      return rows.map(rowToDeadLetterEntry);
    } catch (error) {
      throw new SqliteDeadLetterStoreError(
        SqliteDeadLetterStoreErrorCodes.DATABASE_ERROR,
        `Failed to list DLQ entries: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { status }
      );
    }
  }

  /**
   * Update entry
   * INV-DLQ-002, INV-DLQ-003: Status transitions handled
   */
  async update(entry: DeadLetterEntry): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE ${this.tableName} SET
          original_event_id = ?,
          event_type = ?,
          event_payload = ?,
          error = ?,
          retry_count = ?,
          max_retries = ?,
          last_retry_at = ?,
          next_retry_at = ?,
          status = ?,
          correlation_id = ?,
          source = ?,
          context = ?,
          resolution_notes = ?,
          resolved_by = ?,
          resolved_at = ?
        WHERE entry_id = ?
      `);

      stmt.run(
        entry.originalEventId,
        entry.eventType,
        entry.eventPayload !== undefined ? JSON.stringify(entry.eventPayload) : null,
        JSON.stringify(entry.error),
        entry.retryCount,
        entry.maxRetries,
        entry.lastRetryAt ?? null,
        entry.nextRetryAt ?? null,
        entry.status,
        entry.correlationId ?? null,
        entry.source,
        entry.context !== undefined ? JSON.stringify(entry.context) : null,
        entry.resolutionNotes ?? null,
        entry.resolvedBy ?? null,
        entry.resolvedAt ?? null,
        entry.entryId
      );
    } catch (error) {
      throw new SqliteDeadLetterStoreError(
        SqliteDeadLetterStoreErrorCodes.DATABASE_ERROR,
        `Failed to update DLQ entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { entryId: entry.entryId }
      );
    }
  }

  /**
   * Delete entry
   */
  async delete(entryId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM ${this.tableName} WHERE entry_id = ?
      `);

      const result = stmt.run(entryId);
      return result.changes > 0;
    } catch (error) {
      throw new SqliteDeadLetterStoreError(
        SqliteDeadLetterStoreErrorCodes.DATABASE_ERROR,
        `Failed to delete DLQ entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { entryId }
      );
    }
  }

  /**
   * Count entries by status
   */
  async countByStatus(): Promise<Record<DeadLetterStatus, number>> {
    try {
      const stmt = this.db.prepare(`
        SELECT status, COUNT(*) as count
        FROM ${this.tableName}
        GROUP BY status
      `);

      const rows = stmt.all() as { status: string; count: number }[];

      const counts: Record<DeadLetterStatus, number> = {
        pending: 0,
        retrying: 0,
        exhausted: 0,
        resolved: 0,
        discarded: 0,
      };

      for (const row of rows) {
        const status = row.status as DeadLetterStatus;
        if (status in counts) {
          counts[status] = row.count;
        }
      }

      return counts;
    } catch (error) {
      throw new SqliteDeadLetterStoreError(
        SqliteDeadLetterStoreErrorCodes.DATABASE_ERROR,
        `Failed to count DLQ entries by status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clears all entries (for testing only)
   */
  clear(): void {
    this.db.exec(`DELETE FROM ${this.tableName}`);
  }
}

/**
 * Row type from dead_letter_entries table
 */
interface DeadLetterRow {
  entry_id: string;
  original_event_id: string;
  event_type: string;
  event_payload: string | null;
  error: string;
  retry_count: number;
  max_retries: number;
  last_retry_at: string | null;
  next_retry_at: string | null;
  status: string;
  created_at: string;
  correlation_id: string | null;
  source: string;
  context: string | null;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
}

/**
 * Converts a database row to a DeadLetterEntry
 */
function rowToDeadLetterEntry(row: DeadLetterRow): DeadLetterEntry {
  const entry: DeadLetterEntry = {
    entryId: row.entry_id,
    originalEventId: row.original_event_id,
    eventType: row.event_type,
    eventPayload: row.event_payload !== null ? JSON.parse(row.event_payload) : undefined,
    error: JSON.parse(row.error),
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    status: row.status as DeadLetterStatus,
    createdAt: row.created_at,
    source: row.source,
  };

  if (row.last_retry_at !== null) {
    entry.lastRetryAt = row.last_retry_at;
  }
  if (row.next_retry_at !== null) {
    entry.nextRetryAt = row.next_retry_at;
  }
  if (row.correlation_id !== null) {
    entry.correlationId = row.correlation_id;
  }
  if (row.context !== null) {
    entry.context = JSON.parse(row.context);
  }
  if (row.resolution_notes !== null) {
    entry.resolutionNotes = row.resolution_notes;
  }
  if (row.resolved_by !== null) {
    entry.resolvedBy = row.resolved_by;
  }
  if (row.resolved_at !== null) {
    entry.resolvedAt = row.resolved_at;
  }

  return entry;
}

/**
 * Creates a SQLite dead letter storage
 */
export function createSqliteDeadLetterStorage(
  db: Database.Database,
  tableName?: string
): SqliteDeadLetterStorage {
  return new SqliteDeadLetterStorage(db, tableName);
}
