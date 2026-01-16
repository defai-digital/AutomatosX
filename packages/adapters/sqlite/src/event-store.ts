import type { MemoryEvent, MemoryEventType } from '@defai.digital/contracts';
import type { EventStore } from '@defai.digital/memory-domain';
import type Database from 'better-sqlite3';
import { isValidTableName, invalidTableNameMessage } from './validation.js';

/**
 * Error thrown by SQLite event store operations
 */
export class SqliteEventStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SqliteEventStoreError';
  }
}

/**
 * Error codes for SQLite event store
 */
export const SqliteEventStoreErrorCodes = {
  VERSION_CONFLICT: 'SQLITE_VERSION_CONFLICT',
  INVALID_EVENT: 'SQLITE_INVALID_EVENT',
  DATABASE_ERROR: 'SQLITE_DATABASE_ERROR',
  INVALID_TABLE_NAME: 'SQLITE_INVALID_TABLE_NAME',
} as const;

/**
 * SQLite implementation of EventStore
 * INV-MEM-001: Events are immutable - stored as read-only rows
 * INV-MEM-003: Adapter does not accept domain objects directly (uses MemoryEvent contract)
 * INV-MEM-004: Events are ordered by version within aggregate
 */
export class SqliteEventStore implements EventStore {
  private readonly db: Database.Database;
  private readonly tableName: string;

  constructor(db: Database.Database, tableName = 'memory_events') {
    // Validate table name to prevent SQL injection
    if (!isValidTableName(tableName)) {
      throw new SqliteEventStoreError(
        SqliteEventStoreErrorCodes.INVALID_TABLE_NAME,
        invalidTableNameMessage(tableName)
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
        event_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        aggregate_id TEXT,
        version INTEGER,
        timestamp TEXT NOT NULL,
        payload TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_aggregate_id
        ON ${this.tableName}(aggregate_id);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_type
        ON ${this.tableName}(type);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_correlation_id
        ON ${this.tableName}(json_extract(metadata, '$.correlationId'));

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_aggregate_version
        ON ${this.tableName}(aggregate_id, version);
    `);
  }

  /**
   * Appends an event to the store
   * INV-MEM-001: Events are immutable once stored
   * INV-MEM-004: Version ordering enforced via constraint
   */
  async append(event: MemoryEvent): Promise<void> {
    // Validate event
    if (event.eventId === '') {
      throw new SqliteEventStoreError(
        SqliteEventStoreErrorCodes.INVALID_EVENT,
        'Event must have an eventId'
      );
    }

    const aggregateId = event.aggregateId ?? 'global';

    // Use a transaction to atomically check version and insert
    // This prevents TOCTOU race conditions between version check and insert
    const transaction = this.db.transaction(() => {
      // Check version ordering if version is specified (INV-MEM-004)
      if (event.version !== undefined) {
        const versionStmt = this.db.prepare(`
          SELECT MAX(version) as max_version, COUNT(*) as count
          FROM ${this.tableName}
          WHERE aggregate_id = ?
        `);
        const row = versionStmt.get(aggregateId) as { max_version: number | null; count: number };
        const currentVersion = row.count === 0 ? 0 : (row.max_version ?? row.count);

        if (event.version !== currentVersion + 1) {
          throw new SqliteEventStoreError(
            SqliteEventStoreErrorCodes.VERSION_CONFLICT,
            `Version conflict: expected ${String(currentVersion + 1)}, got ${String(event.version)}`,
            { expected: currentVersion + 1, actual: event.version }
          );
        }
      }

      const stmt = this.db.prepare(`
        INSERT INTO ${this.tableName} (
          event_id, type, aggregate_id, version, timestamp, payload, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        event.eventId,
        event.type,
        aggregateId,
        event.version ?? null,
        event.timestamp,
        JSON.stringify(event.payload),
        event.metadata !== undefined ? JSON.stringify(event.metadata) : null
      );
    });

    try {
      transaction();
    } catch (error) {
      if (error instanceof SqliteEventStoreError) {
        throw error;
      }
      if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint failed')
      ) {
        throw new SqliteEventStoreError(
          SqliteEventStoreErrorCodes.INVALID_EVENT,
          `Event with ID ${event.eventId} already exists`
        );
      }
      throw new SqliteEventStoreError(
        SqliteEventStoreErrorCodes.DATABASE_ERROR,
        `Failed to append event: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets all events for an aggregate
   * INV-MEM-004: Events returned in version order
   */
  getEvents(aggregateId: string): Promise<MemoryEvent[]> {
    const stmt = this.db.prepare(`
      SELECT event_id, type, aggregate_id, version, timestamp, payload, metadata
      FROM ${this.tableName}
      WHERE aggregate_id = ?
      ORDER BY COALESCE(version, id)
    `);

    const rows = stmt.all(aggregateId) as EventRow[];
    return Promise.resolve(rows.map(rowToEvent));
  }

  /**
   * Gets events by type
   */
  getEventsByType(type: MemoryEventType): Promise<MemoryEvent[]> {
    const stmt = this.db.prepare(`
      SELECT event_id, type, aggregate_id, version, timestamp, payload, metadata
      FROM ${this.tableName}
      WHERE type = ?
      ORDER BY id
    `);

    const rows = stmt.all(type) as EventRow[];
    return Promise.resolve(rows.map(rowToEvent));
  }

  /**
   * Gets events by correlation ID
   * INV-MEM-005: Support correlation tracing
   */
  getEventsByCorrelation(correlationId: string): Promise<MemoryEvent[]> {
    const stmt = this.db.prepare(`
      SELECT event_id, type, aggregate_id, version, timestamp, payload, metadata
      FROM ${this.tableName}
      WHERE json_extract(metadata, '$.correlationId') = ?
      ORDER BY id
    `);

    const rows = stmt.all(correlationId) as EventRow[];
    return Promise.resolve(rows.map(rowToEvent));
  }

  /**
   * Gets the current version for an aggregate
   */
  getVersion(aggregateId: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT MAX(version) as max_version, COUNT(*) as count
      FROM ${this.tableName}
      WHERE aggregate_id = ?
    `);

    const row = stmt.get(aggregateId) as { max_version: number | null; count: number };

    if (row.count === 0) {
      return Promise.resolve(0);
    }

    return Promise.resolve(row.max_version ?? row.count);
  }

  /**
   * Clears all events (for testing only)
   */
  clear(): void {
    this.db.exec(`DELETE FROM ${this.tableName}`);
  }
}

/**
 * Row type from the database
 */
interface EventRow {
  event_id: string;
  type: string;
  aggregate_id: string | null;
  version: number | null;
  timestamp: string;
  payload: string;
  metadata: string | null;
}

/**
 * Safely parses JSON with error handling
 */
function safeJsonParse<T>(json: string, fieldName: string, eventId: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new SqliteEventStoreError(
      SqliteEventStoreErrorCodes.DATABASE_ERROR,
      `Failed to parse ${fieldName} for event ${eventId}: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
      { eventId, fieldName }
    );
  }
}

/**
 * Converts a database row to a MemoryEvent
 */
function rowToEvent(row: EventRow): MemoryEvent {
  const event: MemoryEvent = {
    eventId: row.event_id,
    type: row.type as MemoryEventType,
    timestamp: row.timestamp,
    payload: safeJsonParse<Record<string, unknown>>(row.payload, 'payload', row.event_id),
  };

  if (row.aggregate_id !== null) {
    event.aggregateId = row.aggregate_id;
  }
  if (row.version !== null) {
    event.version = row.version;
  }
  if (row.metadata !== null) {
    event.metadata = safeJsonParse<MemoryEvent['metadata']>(row.metadata, 'metadata', row.event_id);
  }

  return event;
}

/**
 * Creates a SQLite event store
 */
export function createSqliteEventStore(
  db: Database.Database,
  tableName?: string
): SqliteEventStore {
  return new SqliteEventStore(db, tableName);
}
