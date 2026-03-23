// Uses Node.js built-in sqlite (node:sqlite), available from Node 22.5+ / Node 24.
// No native compilation required.

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { TraceRecord, TraceStore } from './index.js';

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
  private readonly db: DatabaseSync;

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
        UNIQUE(trace_id, step_id),
        FOREIGN KEY(trace_id) REFERENCES trace_records(trace_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_steps_trace ON trace_steps(trace_id);
    `);
    this.migrateColumns();
  }

  private migrateColumns(): void {
    const cols = [
      { col: 'parent_trace_id', type: 'TEXT' },
      { col: 'session_id',      type: 'TEXT' },
      { col: 'agent_id',        type: 'TEXT' },
      { col: 'updated_at',      type: 'TEXT' },
    ];
    for (const { col, type } of cols) {
      try {
        this.db.exec(`ALTER TABLE trace_records ADD COLUMN ${col} ${type}`);
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

    if (record.stepResults.length > 0) {
      const upsertStep = this.db.prepare(`
        INSERT INTO trace_steps (trace_id, step_id, success, duration_ms, retry_count, error)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(trace_id, step_id) DO UPDATE SET
          success = excluded.success, duration_ms = excluded.duration_ms,
          retry_count = excluded.retry_count, error = excluded.error
      `);
      if (options.transactionalSteps) {
        this.db.exec('BEGIN');
        try {
          for (const step of record.stepResults) {
            upsertStep.run(record.traceId, step.stepId, step.success ? 1 : 0, step.durationMs, step.retryCount, step.error ?? null);
          }
          this.db.exec('COMMIT');
        } catch (err) {
          this.db.exec('ROLLBACK');
          throw err;
        }
      } else {
        for (const step of record.stepResults) {
          upsertStep.run(record.traceId, step.stepId, step.success ? 1 : 0, step.durationMs, step.retryCount, step.error ?? null);
        }
      }
    }
  }

  async getTrace(traceId: string): Promise<TraceRecord | undefined> {
    const row = asRow<TrRow>(this.db.prepare(`SELECT * FROM trace_records WHERE trace_id = ?`).get(traceId));
    return row ? this.assembleRecord(row) : undefined;
  }

  async listTraces(limit?: number): Promise<TraceRecord[]> {
    const rows = limit !== undefined
      ? asRows<TrRow>(this.db.prepare(`SELECT * FROM trace_records ORDER BY started_at DESC LIMIT ?`).all(limit))
      : asRows<TrRow>(this.db.prepare(`SELECT * FROM trace_records ORDER BY started_at DESC`).all());
    return rows.map((r) => this.assembleRecord(r));
  }

  async closeStuckTraces(maxAgeMs = 86_400_000): Promise<TraceRecord[]> {
    const threshold = new Date(Date.now() - maxAgeMs).toISOString();
    const now = new Date().toISOString();
    const stuck = asRows<TrRow>(
      this.db.prepare(`SELECT * FROM trace_records WHERE status = 'running' AND started_at <= ?`).all(threshold),
    );

    this.db.exec('BEGIN');
    try {
      const update = this.db.prepare(`UPDATE trace_records SET status='failed', completed_at=?, error_code=?, error_message=?, updated_at=? WHERE trace_id=?`);
      for (const row of stuck) {
        update.run(now, 'TRACE_AUTO_CLOSED', 'Auto-closed as stuck trace', now, row.trace_id);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return stuck.map((row) => {
      const assembled = this.assembleRecord(row);
      assembled.status = 'failed';
      assembled.completedAt = now;
      assembled.error = { code: 'TRACE_AUTO_CLOSED', message: 'Auto-closed as stuck trace', failedStepId: assembled.error?.failedStepId };
      return assembled;
    });
  }

  // -------------------------------------------------------------------------
  // Extended v13.5 capabilities
  // -------------------------------------------------------------------------

  listTracesBySession(sessionId: string): TraceRecord[] {
    return asRows<TrRow>(this.db.prepare(`SELECT * FROM trace_records WHERE session_id = ? ORDER BY started_at ASC`).all(sessionId))
      .map((r) => this.assembleRecord(r));
  }

  listChildTraces(parentTraceId: string): TraceRecord[] {
    return asRows<TrRow>(this.db.prepare(`SELECT * FROM trace_records WHERE parent_trace_id = ? ORDER BY started_at ASC`).all(parentTraceId))
      .map((r) => this.assembleRecord(r));
  }

  getTraceTree(traceId: string): TraceTreeNode | undefined {
    const root = asRow<TrRow>(this.db.prepare(`SELECT * FROM trace_records WHERE trace_id = ?`).get(traceId));
    if (!root) return undefined;

    const allRows = this.db.prepare(`SELECT * FROM trace_records WHERE trace_id = ? OR parent_trace_id = ? ORDER BY started_at ASC`)
      .all(traceId, traceId);

    const byId = new Map<string, TraceRecord>();
    for (const row of asRows<TrRow>(allRows)) byId.set(row.trace_id, this.assembleRecord(row));

    const build = (record: TraceRecord, visited: Set<string>): TraceTreeNode => {
      if (visited.has(record.traceId)) return { trace: record, children: [] };
      const seen = new Set(visited); seen.add(record.traceId);
      const children = [...byId.values()]
        .filter((r) => (r.metadata as Record<string, unknown> | undefined)?.['parentTraceId'] === record.traceId)
        .map((child) => build(child, seen));
      return { trace: record, children };
    };

    return build(byId.get(traceId) ?? this.assembleRecord(root), new Set());
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

  private assembleRecord(row: TrRow): TraceRecord {
    const steps = asRows<StepRow>(this.db.prepare(
      `SELECT step_id, success, duration_ms, retry_count, error FROM trace_steps WHERE trace_id = ? ORDER BY id`,
    ).all(row.trace_id));

    const record: TraceRecord = {
      traceId: row.trace_id,
      workflowId: row.workflow_id,
      surface: row.surface as TraceRecord['surface'],
      status: row.status as TraceRecord['status'],
      startedAt: row.started_at,
      stepResults: steps.map((s) => ({
        stepId: s.step_id,
        success: s.success !== 0,
        durationMs: s.duration_ms,
        retryCount: s.retry_count,
        error: s.error ?? undefined,
      })),
    };
    if (row.completed_at) record.completedAt = row.completed_at;
    if (row.input)   record.input   = safeJson(row.input,  undefined);
    if (row.output)  record.output  = safeJson(row.output, undefined);
    if (row.error_code || row.error_message || row.failed_step) {
      record.error = { code: row.error_code ?? undefined, message: row.error_message ?? undefined, failedStepId: row.failed_step ?? undefined };
    }
    if (row.metadata) record.metadata = safeJson(row.metadata, undefined);
    return record;
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
interface StepRow { step_id: string; success: number; duration_ms: number; retry_count: number; error: string | null; }

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
