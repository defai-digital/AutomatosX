// Uses Node.js built-in sqlite (node:sqlite), available from Node 22.5+ / Node 24.
// No native compilation required.

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from './node-sqlite.js';
import type { HourlyMetricBucket, TraceRecord, TraceStatusCounts, TraceStore } from './index.js';

function asRow<T>(value: unknown): T | undefined {
  return value as T | undefined;
}

function asRows<T>(value: unknown): T[] {
  return value as T[];
}

export interface SqliteTraceStoreConfig {
  basePath?: string;
  dbFile?: string;
}

const DEFAULT_DB_FILE = join('.automatosx', 'runtime', 'traces.db');
const JOURNAL_MODE_SETUP_ATTEMPTS = 20;
const JOURNAL_MODE_SETUP_INITIAL_DELAY_MS = 5;

const atomicsWaitState = new Int32Array(new SharedArrayBuffer(4));

function isDatabaseLocked(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('database is locked') || error.message.includes('database is busy');
}

function sleepBlocking(milliseconds: number): void {
  Atomics.wait(atomicsWaitState, 0, 0, milliseconds);
}

function withJournalModeRetry<T>(operation: () => T): T {
  let lastError: unknown;
  for (let attempt = 0; attempt < JOURNAL_MODE_SETUP_ATTEMPTS; attempt += 1) {
    try {
      return operation();
    } catch (error) {
      if (!isDatabaseLocked(error) || attempt + 1 >= JOURNAL_MODE_SETUP_ATTEMPTS) {
        throw error;
      }

      lastError = error;
      const delayMs = JOURNAL_MODE_SETUP_INITIAL_DELAY_MS * Math.pow(2, attempt);
      sleepBlocking(delayMs);
    }
  }

  throw lastError;
}

export class SqliteTraceStore implements TraceStore {
  private readonly db: InstanceType<typeof DatabaseSync>;

  constructor(config: SqliteTraceStoreConfig = {}) {
    const dbFile = config.dbFile ?? join(config.basePath ?? process.cwd(), DEFAULT_DB_FILE);
    mkdirSync(dirname(dbFile), { recursive: true });
    this.db = new DatabaseSync(dbFile);
    this.db.prepare(`PRAGMA busy_timeout = 10000`).run();
    withJournalModeRetry(() => this.db.prepare(`PRAGMA journal_mode = WAL`).get());
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trace_records (
        trace_id        TEXT PRIMARY KEY,
        workflow_id     TEXT NOT NULL,
        surface         TEXT NOT NULL DEFAULT 'cli',
        status          TEXT NOT NULL DEFAULT 'running',
        started_at      TEXT NOT NULL,
        completed_at    TEXT,
        input           TEXT,
        output          TEXT,
        error_code      TEXT,
        error_message   TEXT,
        failed_step     TEXT,
        metadata        TEXT,
        parent_trace_id TEXT,
        session_id      TEXT,
        agent_id        TEXT,
        updated_at      TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tr_started  ON trace_records(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tr_status   ON trace_records(status);
      CREATE INDEX IF NOT EXISTS idx_tr_workflow  ON trace_records(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_tr_session   ON trace_records(session_id);
      CREATE INDEX IF NOT EXISTS idx_tr_parent    ON trace_records(parent_trace_id);

      CREATE TABLE IF NOT EXISTS trace_steps (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id    TEXT NOT NULL,
        step_id     TEXT NOT NULL,
        success     INTEGER NOT NULL DEFAULT 1,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        retry_count INTEGER NOT NULL DEFAULT 0,
        error       TEXT,
        started_at  TEXT,
        completed_at TEXT,
        UNIQUE(trace_id, step_id),
        FOREIGN KEY(trace_id) REFERENCES trace_records(trace_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_steps_trace ON trace_steps(trace_id);
    `);
    this.migrateColumns();
  }

  private migrateColumns(): void {
    const traceCols = [
      { col: 'parent_trace_id', type: 'TEXT' },
      { col: 'session_id',      type: 'TEXT' },
      { col: 'agent_id',        type: 'TEXT' },
      { col: 'updated_at',      type: 'TEXT' },
    ];
    for (const { col, type } of traceCols) {
      try {
        this.db.exec(`ALTER TABLE trace_records ADD COLUMN ${col} ${type}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('duplicate column')) throw err;
      }
    }
    const stepCols = [
      { col: 'started_at',   type: 'TEXT' },
      { col: 'completed_at', type: 'TEXT' },
    ];
    for (const { col, type } of stepCols) {
      try {
        this.db.exec(`ALTER TABLE trace_steps ADD COLUMN ${col} ${type}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('duplicate column')) throw err;
      }
    }
  }

  // -------------------------------------------------------------------------
  // TraceStore interface
  // -------------------------------------------------------------------------

  async upsertTrace(record: TraceRecord): Promise<TraceRecord> {
    this.writeTrace(record, { transactionalSteps: true });
    return record;
  }

  private writeTrace(record: TraceRecord, options: { transactionalSteps: boolean }): void {
    const now = new Date().toISOString();
    const meta = record.metadata as Record<string, unknown> | undefined;

    this.db.prepare(`
      INSERT INTO trace_records (
        trace_id, workflow_id, surface, status, started_at, completed_at,
        input, output, error_code, error_message, failed_step, metadata,
        parent_trace_id, session_id, agent_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(trace_id) DO UPDATE SET
        workflow_id = excluded.workflow_id, surface = excluded.surface, status = excluded.status,
        completed_at = excluded.completed_at, input = excluded.input, output = excluded.output,
        error_code = excluded.error_code, error_message = excluded.error_message, failed_step = excluded.failed_step,
        metadata = excluded.metadata, parent_trace_id = excluded.parent_trace_id,
        session_id = excluded.session_id, agent_id = excluded.agent_id, updated_at = excluded.updated_at
    `).run(
      record.traceId, record.workflowId, record.surface, record.status, record.startedAt,
      record.completedAt ?? null,
      record.input ? JSON.stringify(record.input) : null,
      record.output !== undefined ? JSON.stringify(record.output) : null,
      record.error?.code ?? null, record.error?.message ?? null, record.error?.failedStepId ?? null,
      record.metadata ? JSON.stringify(record.metadata) : null,
      (meta?.['parentTraceId'] as string) ?? null,
      (meta?.['sessionId'] as string) ?? null,
      (meta?.['agentId'] as string) ?? null,
      now,
    );

    const deleteSteps = this.db.prepare(`DELETE FROM trace_steps WHERE trace_id = ?`);
    if (record.stepResults.length > 0) {
      const insertStep = this.db.prepare(`
        INSERT INTO trace_steps (trace_id, step_id, success, duration_ms, retry_count, error, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      if (options.transactionalSteps) {
        this.db.exec('BEGIN');
        try {
          deleteSteps.run(record.traceId);
          for (const step of record.stepResults) {
            insertStep.run(record.traceId, step.stepId, step.success ? 1 : 0, step.durationMs, step.retryCount, step.error ?? null, step.startedAt ?? null, step.completedAt ?? null);
          }
          this.db.exec('COMMIT');
        } catch (err) {
          this.db.exec('ROLLBACK');
          throw err;
        }
      } else {
        deleteSteps.run(record.traceId);
        for (const step of record.stepResults) {
          insertStep.run(record.traceId, step.stepId, step.success ? 1 : 0, step.durationMs, step.retryCount, step.error ?? null, step.startedAt ?? null, step.completedAt ?? null);
        }
      }
    } else {
      deleteSteps.run(record.traceId);
    }
  }

  async getTrace(traceId: string): Promise<TraceRecord | undefined> {
    const row = asRow<TrRow>(this.db.prepare(`SELECT * FROM trace_records WHERE trace_id = ?`).get(traceId));
    return row ? this.assembleRecords([row])[0] : undefined;
  }

  async listTraces(limit?: number): Promise<TraceRecord[]> {
    const rows = limit !== undefined
      ? asRows<TrRow>(this.db.prepare(`SELECT * FROM trace_records ORDER BY started_at DESC LIMIT ?`).all(limit))
      : asRows<TrRow>(this.db.prepare(`SELECT * FROM trace_records ORDER BY started_at DESC`).all());
    return this.assembleRecords(rows);
  }

  async getTraceStatusCounts(): Promise<TraceStatusCounts> {
    const row = asRow<{
      total: number;
      running: number;
      completed: number;
      failed: number;
    }>(this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM trace_records
    `).get());

    return {
      total: row?.total ?? 0,
      running: row?.running ?? 0,
      completed: row?.completed ?? 0,
      failed: row?.failed ?? 0,
    };
  }

  async countTraces(status?: TraceRecord['status']): Promise<number> {
    const row = status !== undefined
      ? asRow<{ count: number }>(this.db.prepare(`SELECT COUNT(*) as count FROM trace_records WHERE status = ?`).get(status))
      : asRow<{ count: number }>(this.db.prepare(`SELECT COUNT(*) as count FROM trace_records`).get());
    return row?.count ?? 0;
  }

  async listTracesByStatus(status: TraceRecord['status'], limit?: number): Promise<TraceRecord[]> {
    const rows = limit !== undefined
      ? asRows<TrRow>(
        this.db.prepare(`SELECT * FROM trace_records WHERE status = ? ORDER BY started_at DESC LIMIT ?`).all(status, limit),
      )
      : asRows<TrRow>(
        this.db.prepare(`SELECT * FROM trace_records WHERE status = ? ORDER BY started_at DESC`).all(status),
      );
    return this.assembleRecords(rows);
  }

  async listTracesByWorkflow(workflowId: string, limit?: number): Promise<TraceRecord[]> {
    const rows = limit !== undefined
      ? asRows<TrRow>(
        this.db.prepare(`SELECT * FROM trace_records WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?`).all(workflowId, limit),
      )
      : asRows<TrRow>(
        this.db.prepare(`SELECT * FROM trace_records WHERE workflow_id = ? ORDER BY started_at DESC`).all(workflowId),
      );
    return this.assembleRecords(rows);
  }

  async getHourlyMetrics(hours = 24): Promise<HourlyMetricBucket[]> {
    const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
    const rows = asRows<{ hour: string; total: number; completed: number; failed: number }>(
      this.db.prepare(`
        SELECT
          strftime('%Y-%m-%dT%H:00:00.000Z', started_at) AS hour,
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
        FROM trace_records
        WHERE started_at >= ?
        GROUP BY hour
        ORDER BY hour ASC
      `).all(cutoff),
    );
    return rows.map((row) => ({
      hour: row.hour,
      total: row.total,
      completed: row.completed,
      failed: row.failed,
    }));
  }

  async closeStuckTraces(maxAgeMs = 86_400_000): Promise<TraceRecord[]> {
    const threshold = new Date(Date.now() - maxAgeMs).toISOString();
    const now = new Date().toISOString();

    this.db.exec('BEGIN');
    try {
      const stuck = asRows<TrRow>(
        this.db.prepare(`SELECT * FROM trace_records WHERE status = 'running' AND started_at <= ?`).all(threshold),
      );
      const update = this.db.prepare(`UPDATE trace_records SET status='failed', completed_at=?, error_code=?, error_message=?, updated_at=? WHERE trace_id=?`);
      for (const row of stuck) {
        update.run(now, 'TRACE_AUTO_CLOSED', 'Auto-closed as stuck trace', now, row.trace_id);
      }
      this.db.exec('COMMIT');

      return this.assembleRecords(stuck).map((assembled) => {
        assembled.status = 'failed';
        assembled.completedAt = now;
        assembled.error = { code: 'TRACE_AUTO_CLOSED', message: 'Auto-closed as stuck trace', failedStepId: assembled.error?.failedStepId };
        return assembled;
      });
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Extended v13.5 capabilities
  // -------------------------------------------------------------------------

  async listTracesBySession(sessionId: string, limit?: number): Promise<TraceRecord[]> {
    const rows = limit !== undefined
      ? asRows<TrRow>(
        this.db.prepare(`SELECT * FROM trace_records WHERE session_id = ? ORDER BY started_at DESC LIMIT ?`).all(sessionId, limit),
      )
      : asRows<TrRow>(
        this.db.prepare(`SELECT * FROM trace_records WHERE session_id = ? ORDER BY started_at DESC`).all(sessionId),
      );
    return this.assembleRecords(rows);
  }

  listChildTraces(parentTraceId: string): TraceRecord[] {
    const rows = asRows<TrRow>(
      this.db.prepare(`SELECT * FROM trace_records WHERE parent_trace_id = ? ORDER BY started_at ASC`).all(parentTraceId),
    );
    return this.assembleRecords(rows);
  }

  async getTraceTree(traceId: string): Promise<TraceTreeNode | undefined> {
    const anchor = asRow<TrRow>(this.db.prepare(`SELECT * FROM trace_records WHERE trace_id = ?`).get(traceId));
    if (anchor === undefined) {
      return undefined;
    }

    const root = this.resolveRootRow(anchor);
    const rows = asRows<TrRow>(this.db.prepare(`
      WITH RECURSIVE trace_tree AS (
        SELECT * FROM trace_records WHERE trace_id = ?
        UNION ALL
        SELECT child.*
        FROM trace_records child
        JOIN trace_tree parent ON child.parent_trace_id = parent.trace_id
      )
      SELECT * FROM trace_tree ORDER BY started_at ASC
    `).all(root.trace_id));

    return this.buildTraceTree(this.assembleRecords(rows), root.trace_id);
  }

  async importFromJson(records: TraceRecord[]): Promise<void> {
    this.db.exec('BEGIN');
    try {
      for (const record of records) {
        this.writeTrace(record, { transactionalSteps: false });
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  close(): void {
    this.db.close();
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private resolveRootRow(anchor: TrRow): TrRow {
    if (anchor.parent_trace_id !== null) {
      const root = asRow<TrRow>(this.db.prepare(`
        WITH RECURSIVE ancestors AS (
          SELECT *, 0 AS depth FROM trace_records WHERE trace_id = ?
          UNION ALL
          SELECT parent.*, ancestors.depth + 1
          FROM trace_records parent
          JOIN ancestors ON ancestors.parent_trace_id = parent.trace_id
        )
        SELECT * FROM ancestors ORDER BY depth DESC LIMIT 1
      `).get(anchor.trace_id));
      if (root !== undefined) {
        return root;
      }
    }

    const metadata = anchor.metadata ? safeJson<Record<string, unknown>>(anchor.metadata, {}) : {};
    const rootTraceId = typeof metadata.rootTraceId === 'string' ? metadata.rootTraceId : undefined;
    if (rootTraceId !== undefined && rootTraceId !== anchor.trace_id) {
      const root = asRow<TrRow>(this.db.prepare(`SELECT * FROM trace_records WHERE trace_id = ?`).get(rootTraceId));
      if (root !== undefined) {
        return root;
      }
    }

    return anchor;
  }

  private assembleRecords(rows: TrRow[]): TraceRecord[] {
    if (rows.length === 0) {
      return [];
    }

    const stepRowsByTraceId = this.loadStepRows(rows.map((row) => row.trace_id));
    return rows.map((row) => {
      const steps = stepRowsByTraceId.get(row.trace_id) ?? [];
      const record: TraceRecord = {
        traceId: row.trace_id,
        workflowId: row.workflow_id,
        surface: row.surface as TraceRecord['surface'],
        status: row.status as TraceRecord['status'],
        startedAt: row.started_at,
        stepResults: steps.map((step) => ({
          stepId: step.step_id,
          success: step.success !== 0,
          durationMs: step.duration_ms,
          retryCount: step.retry_count,
          error: step.error ?? undefined,
          startedAt: step.started_at ?? undefined,
          completedAt: step.completed_at ?? undefined,
        })),
      };

      if (row.completed_at) {
        record.completedAt = row.completed_at;
      }
      if (row.input) {
        record.input = safeJson(row.input, undefined);
      }
      if (row.output) {
        record.output = safeJson(row.output, undefined);
      }
      if (row.error_code || row.error_message || row.failed_step) {
        record.error = {
          code: row.error_code ?? undefined,
          message: row.error_message ?? undefined,
          failedStepId: row.failed_step ?? undefined,
        };
      }
      if (row.metadata) {
        record.metadata = safeJson(row.metadata, undefined);
      }

      return record;
    });
  }

  private loadStepRows(traceIds: string[]): Map<string, StepRow[]> {
    if (traceIds.length === 0) {
      return new Map<string, StepRow[]>();
    }

    const placeholders = traceIds.map(() => '?').join(', ');
    const rows = asRows<StepRow>(this.db.prepare(`
      SELECT trace_id, step_id, success, duration_ms, retry_count, error, started_at, completed_at
      FROM trace_steps
      WHERE trace_id IN (${placeholders})
      ORDER BY trace_id, id
    `).all(...traceIds));

    const grouped = new Map<string, StepRow[]>();
    for (const row of rows) {
      const steps = grouped.get(row.trace_id) ?? [];
      steps.push(row);
      grouped.set(row.trace_id, steps);
    }

    return grouped;
  }

  private buildTraceTree(records: TraceRecord[], rootTraceId: string): TraceTreeNode | undefined {
    const byId = new Map(records.map((record) => [record.traceId, record] as const));
    const root = byId.get(rootTraceId);
    if (root === undefined) {
      return undefined;
    }

    const childMap = new Map<string, TraceRecord[]>();
    for (const record of records) {
      const parentId = typeof record.metadata?.parentTraceId === 'string'
        ? record.metadata.parentTraceId
        : undefined;
      if (parentId === undefined) {
        continue;
      }

      const children = childMap.get(parentId) ?? [];
      children.push(record);
      childMap.set(parentId, children);
    }

    return this.toTraceTreeNode(root, childMap, new Set<string>());
  }

  private toTraceTreeNode(
    record: TraceRecord,
    childMap: Map<string, TraceRecord[]>,
    visited: Set<string>,
  ): TraceTreeNode {
    if (visited.has(record.traceId)) {
      return { trace: record, children: [] };
    }

    visited.add(record.traceId);
    return {
      trace: record,
      children: (childMap.get(record.traceId) ?? [])
        .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
        .map((child) => this.toTraceTreeNode(child, childMap, visited)),
    };
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TraceTreeNode {
  trace: TraceRecord;
  children: TraceTreeNode[];
}

interface TrRow {
  trace_id: string; workflow_id: string; surface: string; status: string;
  started_at: string; completed_at: string | null; input: string | null; output: string | null;
  error_code: string | null; error_message: string | null; failed_step: string | null;
  metadata: string | null; parent_trace_id: string | null; session_id: string | null;
  agent_id: string | null; updated_at: string | null;
}
interface StepRow {
  trace_id: string;
  step_id: string;
  success: number;
  duration_ms: number;
  retry_count: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

function safeJson<T>(json: string | null | undefined, fallback: T): T {
  if (json == null) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSqliteTraceStore(config?: SqliteTraceStoreConfig): SqliteTraceStore {
  return new SqliteTraceStore(config);
}
