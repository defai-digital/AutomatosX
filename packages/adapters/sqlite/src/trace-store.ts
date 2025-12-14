import type { TraceEvent, TraceStatus } from '@automatosx/contracts';
import type { TraceWriter, TraceReader, TraceSummary } from '@automatosx/trace-domain';
import type Database from 'better-sqlite3';

/**
 * Error thrown by SQLite trace store operations
 */
export class SqliteTraceStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SqliteTraceStoreError';
  }
}

/**
 * Error codes for SQLite trace store
 */
export const SqliteTraceStoreErrorCodes = {
  DATABASE_ERROR: 'SQLITE_TRACE_DATABASE_ERROR',
  INVALID_EVENT: 'SQLITE_TRACE_INVALID_EVENT',
} as const;

/**
 * SQLite implementation of TraceWriter and TraceReader
 * INV-TR-002: Events are strictly ordered by sequence
 * INV-TR-004: Each trace is independent and self-contained
 */
export class SqliteTraceStore implements TraceWriter, TraceReader {
  private readonly db: Database.Database;
  private readonly eventsTable: string;
  private readonly summariesTable: string;

  constructor(
    db: Database.Database,
    eventsTable = 'trace_events',
    summariesTable = 'trace_summaries'
  ) {
    this.db = db;
    this.eventsTable = eventsTable;
    this.summariesTable = summariesTable;
    this.initialize();
  }

  /**
   * Initializes the database schema
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.eventsTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        trace_id TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        sequence INTEGER,
        parent_event_id TEXT,
        payload TEXT,
        context TEXT,
        status TEXT,
        duration_ms INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_${this.eventsTable}_trace_id
        ON ${this.eventsTable}(trace_id);

      CREATE INDEX IF NOT EXISTS idx_${this.eventsTable}_trace_sequence
        ON ${this.eventsTable}(trace_id, sequence);

      CREATE INDEX IF NOT EXISTS idx_${this.eventsTable}_type
        ON ${this.eventsTable}(type);

      CREATE TABLE IF NOT EXISTS ${this.summariesTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT NOT NULL UNIQUE,
        start_time TEXT NOT NULL,
        end_time TEXT,
        status TEXT NOT NULL,
        event_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_${this.summariesTable}_start_time
        ON ${this.summariesTable}(start_time DESC);

      CREATE INDEX IF NOT EXISTS idx_${this.summariesTable}_status
        ON ${this.summariesTable}(status);
    `);
  }

  /**
   * Writes a trace event
   * INV-TR-002: Events must be strictly ordered
   */
  write(event: TraceEvent): Promise<void> {
    try {
      // Insert event
      const eventStmt = this.db.prepare(`
        INSERT INTO ${this.eventsTable} (
          event_id, trace_id, type, timestamp, sequence,
          parent_event_id, payload, context, status, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      eventStmt.run(
        event.eventId,
        event.traceId,
        event.type,
        event.timestamp,
        event.sequence ?? null,
        event.parentEventId ?? null,
        event.payload !== undefined ? JSON.stringify(event.payload) : null,
        event.context !== undefined ? JSON.stringify(event.context) : null,
        event.status ?? null,
        event.durationMs ?? null
      );

      // Update summary
      this.updateSummary(event);

      return Promise.resolve();
    } catch (error) {
      throw new SqliteTraceStoreError(
        SqliteTraceStoreErrorCodes.DATABASE_ERROR,
        `Failed to write trace event: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Flushes pending writes
   * For SQLite, this is a no-op since we write immediately
   */
  flush(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Gets all events for a trace
   * INV-TR-002: Events returned in sequence order
   */
  getTrace(traceId: string): Promise<TraceEvent[]> {
    const stmt = this.db.prepare(`
      SELECT event_id, trace_id, type, timestamp, sequence,
             parent_event_id, payload, context, status, duration_ms
      FROM ${this.eventsTable}
      WHERE trace_id = ?
      ORDER BY COALESCE(sequence, id)
    `);

    const rows = stmt.all(traceId) as TraceEventRow[];
    return Promise.resolve(rows.map(rowToTraceEvent));
  }

  /**
   * Gets a specific event
   */
  getEvent(traceId: string, eventId: string): Promise<TraceEvent | undefined> {
    const stmt = this.db.prepare(`
      SELECT event_id, trace_id, type, timestamp, sequence,
             parent_event_id, payload, context, status, duration_ms
      FROM ${this.eventsTable}
      WHERE trace_id = ? AND event_id = ?
    `);

    const row = stmt.get(traceId, eventId) as TraceEventRow | undefined;
    return Promise.resolve(row !== undefined ? rowToTraceEvent(row) : undefined);
  }

  /**
   * Lists recent traces
   */
  listTraces(limit = 100): Promise<TraceSummary[]> {
    const stmt = this.db.prepare(`
      SELECT trace_id, start_time, end_time, status,
             event_count, error_count, duration_ms
      FROM ${this.summariesTable}
      ORDER BY id DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as TraceSummaryRow[];
    return Promise.resolve(rows.map(rowToTraceSummary));
  }

  /**
   * Updates trace summary based on event
   */
  private updateSummary(event: TraceEvent): void {
    // Check if summary exists
    const checkStmt = this.db.prepare(`
      SELECT trace_id FROM ${this.summariesTable} WHERE trace_id = ?
    `);
    const existing = checkStmt.get(event.traceId);

    if (existing === undefined) {
      // Insert new summary
      const insertStmt = this.db.prepare(`
        INSERT INTO ${this.summariesTable} (
          trace_id, start_time, status, event_count, error_count
        ) VALUES (?, ?, ?, 1, ?)
      `);
      insertStmt.run(
        event.traceId,
        event.timestamp,
        event.status ?? 'pending',
        event.type === 'error' ? 1 : 0
      );
    } else {
      // Update existing summary
      let updateSql = `
        UPDATE ${this.summariesTable}
        SET event_count = event_count + 1,
            updated_at = datetime('now')
      `;

      const params: (string | number | null)[] = [];

      if (event.type === 'error') {
        updateSql += ', error_count = error_count + 1';
      }

      if (event.type === 'run.start') {
        updateSql += ', start_time = ?, status = ?';
        params.push(event.timestamp, 'running');
      }

      if (event.type === 'run.end') {
        updateSql += ', end_time = ?, status = ?';
        params.push(event.timestamp);
        const payload = event.payload as { success?: boolean } | undefined;
        params.push(payload?.success === true ? 'success' : 'failure');
        if (event.durationMs !== undefined) {
          updateSql += ', duration_ms = ?';
          params.push(event.durationMs);
        }
      } else if (event.status !== undefined) {
        updateSql += ', status = ?';
        params.push(event.status);
      }

      updateSql += ' WHERE trace_id = ?';
      params.push(event.traceId);

      const updateStmt = this.db.prepare(updateSql);
      updateStmt.run(...params);
    }
  }

  /**
   * Clears all traces (for testing only)
   */
  clear(): void {
    this.db.exec(`DELETE FROM ${this.eventsTable}`);
    this.db.exec(`DELETE FROM ${this.summariesTable}`);
  }
}

/**
 * Row type from trace_events table
 */
interface TraceEventRow {
  event_id: string;
  trace_id: string;
  type: string;
  timestamp: string;
  sequence: number | null;
  parent_event_id: string | null;
  payload: string | null;
  context: string | null;
  status: string | null;
  duration_ms: number | null;
}

/**
 * Row type from trace_summaries table
 */
interface TraceSummaryRow {
  trace_id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  event_count: number;
  error_count: number;
  duration_ms: number | null;
}

/**
 * Converts a database row to a TraceEvent
 */
function rowToTraceEvent(row: TraceEventRow): TraceEvent {
  const event: TraceEvent = {
    eventId: row.event_id,
    traceId: row.trace_id,
    type: row.type as TraceEvent['type'],
    timestamp: row.timestamp,
  };

  if (row.sequence !== null) {
    event.sequence = row.sequence;
  }
  if (row.parent_event_id !== null) {
    event.parentEventId = row.parent_event_id;
  }
  if (row.payload !== null) {
    event.payload = JSON.parse(row.payload) as Record<string, unknown>;
  }
  if (row.context !== null) {
    event.context = JSON.parse(row.context) as TraceEvent['context'];
  }
  if (row.status !== null) {
    event.status = row.status as TraceStatus;
  }
  if (row.duration_ms !== null) {
    event.durationMs = row.duration_ms;
  }

  return event;
}

/**
 * Converts a database row to a TraceSummary
 */
function rowToTraceSummary(row: TraceSummaryRow): TraceSummary {
  const summary: TraceSummary = {
    traceId: row.trace_id,
    startTime: row.start_time,
    status: row.status as TraceStatus,
    eventCount: row.event_count,
    errorCount: row.error_count,
  };

  if (row.end_time !== null) {
    summary.endTime = row.end_time;
  }
  if (row.duration_ms !== null) {
    summary.durationMs = row.duration_ms;
  }

  return summary;
}

/**
 * Creates a SQLite trace store
 */
export function createSqliteTraceStore(
  db: Database.Database,
  eventsTable?: string,
  summariesTable?: string
): SqliteTraceStore {
  return new SqliteTraceStore(db, eventsTable, summariesTable);
}
