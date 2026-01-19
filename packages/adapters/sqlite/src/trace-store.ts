import type { TraceEvent, TraceStatus, TraceContext } from '@defai.digital/contracts';
import { getErrorMessage } from '@defai.digital/contracts';
import type { TraceStore, TraceSummary, TraceTreeNode } from '@defai.digital/trace-domain';
import type Database from 'better-sqlite3';
import { isValidTableName, invalidTableNameMessage } from './validation.js';

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
  INVALID_TABLE_NAME: 'SQLITE_TRACE_INVALID_TABLE_NAME',
} as const;

/**
 * SQLite implementation of TraceStore
 * INV-TR-002: Events are strictly ordered by sequence
 * INV-TR-004: Each trace is independent and self-contained
 */
export class SqliteTraceStore implements TraceStore {
  private readonly db: Database.Database;
  private readonly eventsTable: string;
  private readonly summariesTable: string;

  constructor(
    db: Database.Database,
    eventsTable = 'trace_events',
    summariesTable = 'trace_summaries'
  ) {
    // Validate table names to prevent SQL injection
    if (!isValidTableName(eventsTable)) {
      throw new SqliteTraceStoreError(
        SqliteTraceStoreErrorCodes.INVALID_TABLE_NAME,
        invalidTableNameMessage(eventsTable)
      );
    }
    if (!isValidTableName(summariesTable)) {
      throw new SqliteTraceStoreError(
        SqliteTraceStoreErrorCodes.INVALID_TABLE_NAME,
        invalidTableNameMessage(summariesTable)
      );
    }
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
        name TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        status TEXT NOT NULL,
        event_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER,
        -- Hierarchical tracing fields (INV-TR-020 through INV-TR-024)
        parent_trace_id TEXT,
        root_trace_id TEXT,
        trace_depth INTEGER,
        session_id TEXT,
        agent_id TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_${this.summariesTable}_start_time
        ON ${this.summariesTable}(start_time DESC);

      CREATE INDEX IF NOT EXISTS idx_${this.summariesTable}_status
        ON ${this.summariesTable}(status);

      -- Indexes for hierarchical tracing queries
      CREATE INDEX IF NOT EXISTS idx_${this.summariesTable}_parent_trace_id
        ON ${this.summariesTable}(parent_trace_id);

      CREATE INDEX IF NOT EXISTS idx_${this.summariesTable}_root_trace_id
        ON ${this.summariesTable}(root_trace_id);

      CREATE INDEX IF NOT EXISTS idx_${this.summariesTable}_session_id
        ON ${this.summariesTable}(session_id);
    `);

    // Migrate existing tables to add hierarchy columns if they don't exist
    this.migrateHierarchyColumns();
  }

  /**
   * Adds hierarchy columns to existing tables (migration)
   */
  private migrateHierarchyColumns(): void {
    // Check if columns exist and add them if not
    // trace_depth is INTEGER to match schema, others are TEXT
    const columns: Array<{ name: string; type: string }> = [
      { name: 'name', type: 'TEXT' },
      { name: 'parent_trace_id', type: 'TEXT' },
      { name: 'root_trace_id', type: 'TEXT' },
      { name: 'trace_depth', type: 'INTEGER' },
      { name: 'session_id', type: 'TEXT' },
      { name: 'agent_id', type: 'TEXT' },
    ];
    for (const column of columns) {
      try {
        this.db.exec(`ALTER TABLE ${this.summariesTable} ADD COLUMN ${column.name} ${column.type}`);
      } catch (error) {
        // Only ignore "duplicate column" errors, re-throw others
        const message = getErrorMessage(error);
        if (!message.includes('duplicate column')) {
          throw new SqliteTraceStoreError(
            SqliteTraceStoreErrorCodes.DATABASE_ERROR,
            `Failed to add column ${column.name}: ${message}`
          );
        }
      }
    }
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
        `Failed to write trace event: ${getErrorMessage(error)}`
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
      SELECT trace_id, name, start_time, end_time, status,
             event_count, error_count, duration_ms,
             parent_trace_id, root_trace_id, trace_depth, session_id, agent_id
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
    const context = event.context;
    const traceName = event.payload ? this.extractTraceName(event.payload, context) : null;

    // Check if summary exists
    const checkStmt = this.db.prepare(`
      SELECT trace_id, name FROM ${this.summariesTable} WHERE trace_id = ?
    `);
    const existing = checkStmt.get(event.traceId) as { trace_id: string; name: string | null } | undefined;

    if (existing === undefined) {
      // Insert new summary with hierarchy fields (INV-TR-020 through INV-TR-024)
      const insertStmt = this.db.prepare(`
        INSERT INTO ${this.summariesTable} (
          trace_id, name, start_time, status, event_count, error_count,
          parent_trace_id, root_trace_id, trace_depth, session_id, agent_id
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(
        event.traceId,
        traceName,
        event.timestamp,
        event.status ?? 'pending',
        event.type === 'error' ? 1 : 0,
        context?.parentTraceId ?? null,
        context?.rootTraceId ?? null,
        context?.traceDepth ?? null,
        context?.sessionId ?? null,
        context?.agentId ?? null
      );
    } else {
      // Update existing summary
      let updateSql = `
        UPDATE ${this.summariesTable}
        SET event_count = event_count + 1,
            updated_at = datetime('now')
      `;

      const params: (string | number | null)[] = [];

      // Set name if not already set
      if (traceName && !existing.name) {
        updateSql += ', name = ?';
        params.push(traceName);
      }

      if (event.type === 'error') {
        updateSql += ', error_count = error_count + 1';
      }

      if (event.type === 'run.start') {
        updateSql += ', start_time = ?, status = ?';
        params.push(event.timestamp, 'running');
        // Update hierarchy fields on run.start if provided
        if (context?.parentTraceId) {
          updateSql += ', parent_trace_id = COALESCE(parent_trace_id, ?)';
          params.push(context.parentTraceId);
        }
        if (context?.rootTraceId) {
          updateSql += ', root_trace_id = COALESCE(root_trace_id, ?)';
          params.push(context.rootTraceId);
        }
        if (context?.traceDepth !== undefined) {
          updateSql += ', trace_depth = COALESCE(trace_depth, ?)';
          params.push(context.traceDepth);
        }
        if (context?.sessionId) {
          updateSql += ', session_id = COALESCE(session_id, ?)';
          params.push(context.sessionId);
        }
        if (context?.agentId) {
          updateSql += ', agent_id = COALESCE(agent_id, ?)';
          params.push(context.agentId);
        }
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
   * Extracts a human-readable name from event payload
   */
  private extractTraceName(
    payload: Record<string, unknown>,
    context?: TraceContext
  ): string | null {
    // Priority: agentId > topic > command + prompt > command > tool > workflowId

    // Agent execution
    if (payload.agentId) {
      return `ax agent run ${payload.agentId}`;
    }

    if (context?.agentId) {
      return `ax agent run ${context.agentId}`;
    }

    // Discussion
    if (payload.topic) {
      const topic = String(payload.topic);
      const truncated = topic.length > 40 ? `${topic.slice(0, 40)}...` : topic;
      return `ax discuss "${truncated}"`;
    }

    const command = payload.command ? String(payload.command) : undefined;

    // Provider call with prompt
    if (payload.prompt) {
      const prompt = String(payload.prompt);
      const truncated = prompt.length > 40 ? `${prompt.slice(0, 40)}...` : prompt;
      return `${command ?? 'ax call'} "${truncated}"`;
    }

    // Explicit command
    if (command) {
      return command;
    }

    // MCP tool invocation (parallel_run, review_analyze, etc.)
    if (payload.tool) {
      const tool = String(payload.tool);
      // Format tool name nicely: parallel_run -> parallel run
      const formattedTool = tool.replace(/_/g, ' ');
      return `ax ${formattedTool}`;
    }

    // Workflow execution
    if (payload.workflowId) {
      const workflowName = payload.workflowName ? String(payload.workflowName) : String(payload.workflowId);
      return `workflow ${workflowName}`;
    }

    // Check context for workflowId
    if (context?.workflowId) {
      return `workflow ${context.workflowId}`;
    }

    return null;
  }

  /**
   * Gets all traces that share the same root trace ID
   * INV-TR-020: All traces in hierarchy share rootTraceId
   */
  getTracesByRoot(rootTraceId: string): Promise<TraceSummary[]> {
    const stmt = this.db.prepare(`
      SELECT trace_id, name, start_time, end_time, status,
             event_count, error_count, duration_ms,
             parent_trace_id, root_trace_id, trace_depth, session_id, agent_id
      FROM ${this.summariesTable}
      WHERE root_trace_id = ? OR trace_id = ?
      ORDER BY COALESCE(trace_depth, 0) ASC, start_time ASC
    `);

    const rows = stmt.all(rootTraceId, rootTraceId) as TraceSummaryRow[];
    return Promise.resolve(rows.map(rowToTraceSummary));
  }

  /**
   * Gets direct children of a trace
   * INV-TR-021: Child traces reference parentTraceId
   */
  getChildTraces(parentTraceId: string): Promise<TraceSummary[]> {
    const stmt = this.db.prepare(`
      SELECT trace_id, name, start_time, end_time, status,
             event_count, error_count, duration_ms,
             parent_trace_id, root_trace_id, trace_depth, session_id, agent_id
      FROM ${this.summariesTable}
      WHERE parent_trace_id = ?
      ORDER BY start_time ASC
    `);

    const rows = stmt.all(parentTraceId) as TraceSummaryRow[];
    return Promise.resolve(rows.map(rowToTraceSummary));
  }

  /**
   * Gets all traces in a session
   * INV-TR-023: Session trace correlation
   */
  getTracesBySession(sessionId: string): Promise<TraceSummary[]> {
    const stmt = this.db.prepare(`
      SELECT trace_id, name, start_time, end_time, status,
             event_count, error_count, duration_ms,
             parent_trace_id, root_trace_id, trace_depth, session_id, agent_id
      FROM ${this.summariesTable}
      WHERE session_id = ?
      ORDER BY start_time ASC
    `);

    const rows = stmt.all(sessionId) as TraceSummaryRow[];
    return Promise.resolve(rows.map(rowToTraceSummary));
  }

  /**
   * Builds a hierarchical tree from a root trace
   * Returns the complete tree structure for visualization
   */
  async getTraceTree(traceId: string): Promise<TraceTreeNode | undefined> {
    // Get the root summary
    const rootStmt = this.db.prepare(`
      SELECT trace_id, name, start_time, end_time, status,
             event_count, error_count, duration_ms,
             parent_trace_id, root_trace_id, trace_depth, session_id, agent_id
      FROM ${this.summariesTable}
      WHERE trace_id = ?
    `);
    const rootRow = rootStmt.get(traceId) as TraceSummaryRow | undefined;
    if (!rootRow) return undefined;

    const rootSummary = rowToTraceSummary(rootRow);

    // Determine the effective root trace ID
    const effectiveRootId = rootSummary.rootTraceId ?? traceId;

    // Get all traces in this hierarchy
    const allTraces = await this.getTracesByRoot(effectiveRootId);

    // Create a map for quick lookup
    const traceMap = new Map<string, TraceSummary>();
    for (const trace of allTraces) {
      traceMap.set(trace.traceId, trace);
    }

    // Build tree recursively
    const buildNode = (summary: TraceSummary): TraceTreeNode => {
      const children = allTraces
        .filter((t) => t.parentTraceId === summary.traceId)
        .map((childSummary) => buildNode(childSummary));

      const childDuration = children.reduce(
        (sum, child) => sum + (child.totalDurationMs ?? 0),
        0
      );
      const childEventCount = children.reduce(
        (sum, child) => sum + child.totalEventCount,
        0
      );

      return {
        trace: summary,
        children,
        totalDurationMs: (summary.durationMs ?? 0) + childDuration,
        totalEventCount: summary.eventCount + childEventCount,
      };
    };

    // Build tree starting from the requested trace
    const targetSummary = traceMap.get(traceId);
    if (!targetSummary) return undefined;

    return buildNode(targetSummary);
  }

  /**
   * Clears all traces (for testing only)
   */
  clear(): void {
    this.db.exec(`DELETE FROM ${this.eventsTable}`);
    this.db.exec(`DELETE FROM ${this.summariesTable}`);
  }

  /**
   * Closes stuck traces that have been running longer than maxAgeMs
   * Writes a run.end event marking them as failed
   * @param maxAgeMs Maximum age in milliseconds (default: 1 hour)
   * @returns number of traces that were closed
   */
  async closeStuckTraces(maxAgeMs = 3600000): Promise<number> {
    // Input validation
    if (maxAgeMs <= 0) {
      throw new Error('maxAgeMs must be a positive number');
    }

    try {
      const currentTime = Date.now();
      const cutoffDate = new Date(currentTime - maxAgeMs).toISOString();

      // Find all stuck traces (running or pending status and started before cutoff)
      // Note: status may be 'pending' if summary update didn't set to 'running'
      const stuckTracesStmt = this.db.prepare(`
        SELECT trace_id, start_time
        FROM ${this.summariesTable}
        WHERE status IN ('running', 'pending') AND start_time < ?
      `);
      const stuckTraces = stuckTracesStmt.all(cutoffDate) as { trace_id: string; start_time: string }[];

      let closedCount = 0;

      for (const trace of stuckTraces) {
        const startTime = new Date(trace.start_time).getTime();
        const durationMs = currentTime - startTime;

        // Write a run.end event to close the trace
        // Use timestamp in eventId to prevent collisions on repeated cleanup calls
        const endEvent: TraceEvent = {
          eventId: `${trace.trace_id}-auto-close-${currentTime}`,
          traceId: trace.trace_id,
          type: 'run.end',
          timestamp: new Date().toISOString(),
          payload: {
            success: false,
            error: 'Trace closed automatically - exceeded maximum running time',
            autoClose: true,
          },
          status: 'failure',
          durationMs,
        };

        await this.write(endEvent);
        closedCount++;
      }

      return closedCount;
    } catch (error) {
      throw new SqliteTraceStoreError(
        SqliteTraceStoreErrorCodes.DATABASE_ERROR,
        `Failed to close stuck traces: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Deletes a trace and all its events
   * @returns true if trace existed and was deleted
   */
  deleteTrace(traceId: string): Promise<boolean> {
    try {
      // Delete events for this trace
      const deleteEventsStmt = this.db.prepare(`
        DELETE FROM ${this.eventsTable} WHERE trace_id = ?
      `);
      const eventsResult = deleteEventsStmt.run(traceId);

      // Delete summary for this trace
      const deleteSummaryStmt = this.db.prepare(`
        DELETE FROM ${this.summariesTable} WHERE trace_id = ?
      `);
      deleteSummaryStmt.run(traceId);

      // Return true if any events were deleted
      return Promise.resolve(eventsResult.changes > 0);
    } catch (error) {
      throw new SqliteTraceStoreError(
        SqliteTraceStoreErrorCodes.DATABASE_ERROR,
        `Failed to delete trace: ${getErrorMessage(error)}`
      );
    }
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
  name: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  event_count: number;
  error_count: number;
  duration_ms: number | null;
  // Hierarchical tracing fields
  parent_trace_id: string | null;
  root_trace_id: string | null;
  trace_depth: number | null;
  session_id: string | null;
  agent_id: string | null;
}

/**
 * Safely parses JSON with error handling
 */
function safeJsonParse<T>(json: string, fieldName: string, eventId: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new SqliteTraceStoreError(
      SqliteTraceStoreErrorCodes.DATABASE_ERROR,
      `Failed to parse ${fieldName} for event ${eventId}: ${getErrorMessage(error, 'Invalid JSON')}`,
      { eventId, fieldName }
    );
  }
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
    event.payload = safeJsonParse<Record<string, unknown>>(row.payload, 'payload', row.event_id);
  }
  if (row.context !== null) {
    event.context = safeJsonParse<TraceEvent['context']>(row.context, 'context', row.event_id);
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
    // Hierarchical tracing fields (INV-TR-020 through INV-TR-024)
    parentTraceId: row.parent_trace_id ?? undefined,
    rootTraceId: row.root_trace_id ?? undefined,
    traceDepth: row.trace_depth ?? undefined,
    sessionId: row.session_id ?? undefined,
    agentId: row.agent_id ?? undefined,
  };

  if (row.name !== null) {
    summary.name = row.name;
  }
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
