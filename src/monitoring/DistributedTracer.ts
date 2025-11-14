/**
 * DistributedTracer.ts
 *
 * Distributed tracing for workflow execution paths
 * Phase 6 Week 2: Advanced Monitoring & Observability
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  Trace,
  Span,
  SpanKind,
  SpanStatus,
  SpanEvent,
} from '../types/monitoring.types.js';
import { getDatabase } from '../database/connection.js';

/**
 * DistributedTracer - Distributed tracing for workflow execution
 *
 * Features:
 * - Trace workflow execution paths
 * - Create hierarchical spans (parent-child relationships)
 * - Record span events and attributes
 * - Sampling support to reduce overhead
 * - Query traces by execution ID
 * - Performance analysis with span durations
 */
export class DistributedTracer extends EventEmitter {
  private db: Database.Database;
  private activeSpans: Map<string, Span> = new Map();
  private samplingRate: number;

  constructor(db?: Database.Database, samplingRate: number = 1.0) {
    super();
    this.db = db || getDatabase();
    this.samplingRate = Math.max(0, Math.min(1, samplingRate));
    this.initializeSchema();
  }

  /**
   * Initialize tracing schema
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS traces (
        trace_id TEXT PRIMARY KEY,
        workflow_execution_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration INTEGER,
        span_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS spans (
        span_id TEXT PRIMARY KEY,
        trace_id TEXT NOT NULL,
        parent_span_id TEXT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration INTEGER,
        status TEXT NOT NULL,
        attributes TEXT NOT NULL,
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
      );

      CREATE TABLE IF NOT EXISTS span_events (
        id TEXT PRIMARY KEY,
        span_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        name TEXT NOT NULL,
        attributes TEXT,
        FOREIGN KEY (span_id) REFERENCES spans(span_id)
      );

      CREATE INDEX IF NOT EXISTS idx_traces_execution ON traces(workflow_execution_id);
      CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
      CREATE INDEX IF NOT EXISTS idx_spans_parent ON spans(parent_span_id);
      CREATE INDEX IF NOT EXISTS idx_span_events_span ON span_events(span_id);
    `);
  }

  // ============================================================================
  // Trace Management
  // ============================================================================

  /**
   * Start a new trace
   */
  startTrace(workflowExecutionId: string): string {
    // Check sampling
    if (!this.shouldSample()) {
      return ''; // Empty trace ID means not sampled
    }

    const traceId = randomUUID();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO traces (trace_id, workflow_execution_id, started_at)
      VALUES (?, ?, ?)
    `).run(traceId, workflowExecutionId, now);

    this.emit('trace.started', { traceId, workflowExecutionId });

    return traceId;
  }

  /**
   * Complete a trace
   */
  completeTrace(traceId: string): void {
    if (!traceId) return; // Not sampled

    const now = Date.now();

    const row = this.db.prepare(`
      SELECT started_at FROM traces WHERE trace_id = ?
    `).get(traceId) as any;

    if (!row) return;

    const duration = now - row.started_at;

    // Count spans
    const spanCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM spans WHERE trace_id = ?
    `).get(traceId) as any;

    this.db.prepare(`
      UPDATE traces
      SET completed_at = ?, duration = ?, span_count = ?
      WHERE trace_id = ?
    `).run(now, duration, spanCount.count, traceId);

    this.emit('trace.completed', { traceId, duration });
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): Trace | null {
    const traceRow = this.db.prepare(`
      SELECT * FROM traces WHERE trace_id = ?
    `).get(traceId) as any;

    if (!traceRow) return null;

    const spanRows = this.db.prepare(`
      SELECT * FROM spans WHERE trace_id = ? ORDER BY started_at ASC
    `).all(traceId) as any[];

    const spans: Span[] = [];

    for (const spanRow of spanRows) {
      const eventRows = this.db.prepare(`
        SELECT * FROM span_events WHERE span_id = ? ORDER BY timestamp ASC
      `).all(spanRow.span_id) as any[];

      const events: SpanEvent[] = eventRows.map(e => ({
        timestamp: e.timestamp,
        name: e.name,
        attributes: e.attributes ? JSON.parse(e.attributes) : undefined,
      }));

      spans.push({
        spanId: spanRow.span_id,
        traceId: spanRow.trace_id,
        parentSpanId: spanRow.parent_span_id,
        name: spanRow.name,
        kind: spanRow.kind,
        startedAt: spanRow.started_at,
        completedAt: spanRow.completed_at,
        duration: spanRow.duration,
        status: spanRow.status,
        attributes: JSON.parse(spanRow.attributes),
        events,
      });
    }

    return {
      traceId: traceRow.trace_id,
      workflowExecutionId: traceRow.workflow_execution_id,
      startedAt: traceRow.started_at,
      completedAt: traceRow.completed_at,
      duration: traceRow.duration,
      spans,
    };
  }

  /**
   * Get traces by workflow execution ID
   */
  getTracesByExecution(workflowExecutionId: string): Trace[] {
    const traceRows = this.db.prepare(`
      SELECT trace_id FROM traces WHERE workflow_execution_id = ?
    `).all(workflowExecutionId) as any[];

    return traceRows
      .map(row => this.getTrace(row.trace_id))
      .filter(trace => trace !== null) as Trace[];
  }

  // ============================================================================
  // Span Management
  // ============================================================================

  /**
   * Start a new span
   */
  startSpan(
    traceId: string,
    name: string,
    kind: SpanKind,
    options?: {
      parentSpanId?: string;
      attributes?: Record<string, unknown>;
    }
  ): string {
    if (!traceId) return ''; // Not sampled

    const spanId = randomUUID();
    const now = Date.now();

    const span: Span = {
      spanId,
      traceId,
      parentSpanId: options?.parentSpanId,
      name,
      kind,
      startedAt: now,
      status: 'unset',
      attributes: options?.attributes || {},
      events: [],
    };

    // Store in memory for fast access
    this.activeSpans.set(spanId, span);

    // Persist to database
    this.db.prepare(`
      INSERT INTO spans (
        span_id, trace_id, parent_span_id, name, kind,
        started_at, status, attributes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      spanId,
      traceId,
      options?.parentSpanId || null,
      name,
      kind,
      now,
      'unset',
      JSON.stringify(span.attributes)
    );

    this.emit('span.started', span);

    return spanId;
  }

  /**
   * Complete a span
   */
  completeSpan(spanId: string, status: SpanStatus = 'ok'): void {
    if (!spanId) return; // Not sampled

    const span = this.activeSpans.get(spanId);
    if (!span) {
      // Try to get from database
      const row = this.db.prepare(`
        SELECT started_at FROM spans WHERE span_id = ?
      `).get(spanId) as any;

      if (!row) return;

      const now = Date.now();
      const duration = now - row.started_at;

      this.db.prepare(`
        UPDATE spans
        SET completed_at = ?, duration = ?, status = ?
        WHERE span_id = ?
      `).run(now, duration, status, spanId);

      this.emit('span.completed', { spanId, duration, status });
      return;
    }

    const now = Date.now();
    span.completedAt = now;
    span.duration = now - span.startedAt;
    span.status = status;

    this.db.prepare(`
      UPDATE spans
      SET completed_at = ?, duration = ?, status = ?
      WHERE span_id = ?
    `).run(now, span.duration, status, spanId);

    this.activeSpans.delete(spanId);

    this.emit('span.completed', { spanId, duration: span.duration, status });
  }

  /**
   * Add event to span
   */
  addSpanEvent(
    spanId: string,
    name: string,
    attributes?: Record<string, unknown>
  ): void {
    if (!spanId) return; // Not sampled

    const eventId = randomUUID();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO span_events (id, span_id, timestamp, name, attributes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      eventId,
      spanId,
      now,
      name,
      attributes ? JSON.stringify(attributes) : null
    );

    // Update in-memory span if active
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.events.push({
        timestamp: now,
        name,
        attributes,
      });
    }

    this.emit('span.event', { spanId, name, attributes });
  }

  /**
   * Set span attributes
   */
  setSpanAttributes(spanId: string, attributes: Record<string, unknown>): void {
    if (!spanId) return; // Not sampled

    const span = this.activeSpans.get(spanId);
    if (span) {
      Object.assign(span.attributes, attributes);
    }

    // Merge with existing attributes in database
    const row = this.db.prepare(`
      SELECT attributes FROM spans WHERE span_id = ?
    `).get(spanId) as any;

    if (row) {
      const existingAttrs = JSON.parse(row.attributes);
      const mergedAttrs = { ...existingAttrs, ...attributes };

      this.db.prepare(`
        UPDATE spans SET attributes = ? WHERE span_id = ?
      `).run(JSON.stringify(mergedAttrs), spanId);
    }
  }

  /**
   * Set span status
   */
  setSpanStatus(spanId: string, status: SpanStatus): void {
    if (!spanId) return; // Not sampled

    const span = this.activeSpans.get(spanId);
    if (span) {
      span.status = status;
    }

    this.db.prepare(`
      UPDATE spans SET status = ? WHERE span_id = ?
    `).run(status, spanId);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Should this trace be sampled?
   */
  private shouldSample(): boolean {
    return Math.random() < this.samplingRate;
  }

  /**
   * Set sampling rate (0.0 to 1.0)
   */
  setSamplingRate(rate: number): void {
    this.samplingRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Get sampling rate
   */
  getSamplingRate(): number {
    return this.samplingRate;
  }

  /**
   * Cleanup old traces
   */
  async cleanup(retentionDays: number = 7): Promise<number> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const result = this.db.prepare(`
      DELETE FROM traces WHERE started_at < ?
    `).run(cutoff);

    return result.changes;
  }

  /**
   * Get trace statistics
   */
  getTraceStats(): {
    totalTraces: number;
    totalSpans: number;
    avgSpansPerTrace: number;
    avgTraceDuration: number;
  } {
    const traceStats = this.db.prepare(`
      SELECT
        COUNT(*) as totalTraces,
        AVG(span_count) as avgSpansPerTrace,
        AVG(duration) as avgTraceDuration
      FROM traces
      WHERE completed_at IS NOT NULL
    `).get() as any;

    const spanStats = this.db.prepare(`
      SELECT COUNT(*) as totalSpans FROM spans
    `).get() as any;

    return {
      totalTraces: traceStats.totalTraces || 0,
      totalSpans: spanStats.totalSpans || 0,
      avgSpansPerTrace: traceStats.avgSpansPerTrace || 0,
      avgTraceDuration: traceStats.avgTraceDuration || 0,
    };
  }
}
