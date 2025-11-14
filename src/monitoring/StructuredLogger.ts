/**
 * StructuredLogger.ts
 *
 * Centralized structured logging with query capabilities
 * Phase 6 Week 2: Advanced Monitoring & Observability
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  LogEntry,
  LogLevel,
  LogQuery,
} from '../types/monitoring.types.js';
import { getDatabase } from '../database/connection.js';

/**
 * StructuredLogger - Centralized structured logging
 *
 * Features:
 * - Structured log entries with metadata
 * - Log levels (debug, info, warn, error, fatal)
 * - Context propagation (traceId, spanId, executionId)
 * - Multi-tenant support
 * - Full-text search on log messages
 * - Query logs with filters (level, source, time range)
 * - Log buffering for performance
 */
export class StructuredLogger extends EventEmitter {
  private db: Database.Database;
  private logBuffer: LogEntry[] = [];
  private bufferSize: number = 50;
  private flushInterval: NodeJS.Timeout | null = null;
  private minLevel: LogLevel;

  constructor(db?: Database.Database, bufferSize: number = 50, minLevel: LogLevel = 'info') {
    super();
    this.db = db || getDatabase();
    this.bufferSize = bufferSize;
    this.minLevel = minLevel;
    this.initializeSchema();
    this.startAutoFlush();
  }

  /**
   * Initialize logging schema
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        source TEXT NOT NULL,
        execution_id TEXT,
        trace_id TEXT,
        span_id TEXT,
        tenant_id TEXT,
        user_id TEXT,
        metadata TEXT,
        stack_trace TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
      CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);
      CREATE INDEX IF NOT EXISTS idx_logs_execution ON logs(execution_id);
      CREATE INDEX IF NOT EXISTS idx_logs_trace ON logs(trace_id);
      CREATE INDEX IF NOT EXISTS idx_logs_tenant ON logs(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);

      -- Full-text search on log messages
      CREATE VIRTUAL TABLE IF NOT EXISTS logs_fts USING fts5(
        message,
        content=logs,
        content_rowid=rowid
      );

      -- Triggers to keep FTS5 in sync
      CREATE TRIGGER IF NOT EXISTS logs_ai AFTER INSERT ON logs BEGIN
        INSERT INTO logs_fts(rowid, message) VALUES (new.rowid, new.message);
      END;

      CREATE TRIGGER IF NOT EXISTS logs_ad AFTER DELETE ON logs BEGIN
        INSERT INTO logs_fts(logs_fts, rowid, message) VALUES ('delete', old.rowid, old.message);
      END;

      CREATE TRIGGER IF NOT EXISTS logs_au AFTER UPDATE ON logs BEGIN
        INSERT INTO logs_fts(logs_fts, rowid, message) VALUES ('delete', old.rowid, old.message);
        INSERT INTO logs_fts(rowid, message) VALUES (new.rowid, new.message);
      END;
    `);
  }

  // ============================================================================
  // Logging Methods
  // ============================================================================

  /**
   * Log a debug message
   */
  debug(
    message: string,
    source: string,
    options?: {
      executionId?: string;
      traceId?: string;
      spanId?: string;
      tenantId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    }
  ): void {
    this.log('debug', message, source, options);
  }

  /**
   * Log an info message
   */
  info(
    message: string,
    source: string,
    options?: {
      executionId?: string;
      traceId?: string;
      spanId?: string;
      tenantId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    }
  ): void {
    this.log('info', message, source, options);
  }

  /**
   * Log a warning message
   */
  warn(
    message: string,
    source: string,
    options?: {
      executionId?: string;
      traceId?: string;
      spanId?: string;
      tenantId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    }
  ): void {
    this.log('warn', message, source, options);
  }

  /**
   * Log an error message
   */
  error(
    message: string,
    source: string,
    options?: {
      executionId?: string;
      traceId?: string;
      spanId?: string;
      tenantId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
      stackTrace?: string;
      error?: Error;
    }
  ): void {
    const stackTrace = options?.error?.stack || options?.stackTrace;
    this.log('error', message, source, { ...options, stackTrace });
  }

  /**
   * Log a fatal error message
   */
  fatal(
    message: string,
    source: string,
    options?: {
      executionId?: string;
      traceId?: string;
      spanId?: string;
      tenantId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
      stackTrace?: string;
      error?: Error;
    }
  ): void {
    const stackTrace = options?.error?.stack || options?.stackTrace;
    this.log('fatal', message, source, { ...options, stackTrace });
  }

  /**
   * Generic log method
   */
  private log(
    level: LogLevel,
    message: string,
    source: string,
    options?: {
      executionId?: string;
      traceId?: string;
      spanId?: string;
      tenantId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
      stackTrace?: string;
    }
  ): void {
    // Check if level meets minimum threshold
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      id: randomUUID(),
      timestamp: Date.now(),
      level,
      message,
      source,
      executionId: options?.executionId,
      traceId: options?.traceId,
      spanId: options?.spanId,
      tenantId: options?.tenantId,
      userId: options?.userId,
      metadata: options?.metadata,
      stackTrace: options?.stackTrace,
    };

    this.logBuffer.push(entry);

    // Auto-flush if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      this.flush();
    }

    this.emit('log', entry);

    // Also emit console log for errors and fatal
    if (level === 'error' || level === 'fatal') {
      console.error(`[${level.toUpperCase()}] ${source}: ${message}`);
      if (options?.stackTrace) {
        console.error(options.stackTrace);
      }
    }
  }

  /**
   * Flush log buffer to database
   */
  flush(): void {
    if (this.logBuffer.length === 0) return;

    const transaction = this.db.transaction((logs: LogEntry[]) => {
      const stmt = this.db.prepare(`
        INSERT INTO logs (
          id, timestamp, level, message, source,
          execution_id, trace_id, span_id, tenant_id, user_id,
          metadata, stack_trace
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const log of logs) {
        stmt.run(
          log.id,
          log.timestamp,
          log.level,
          log.message,
          log.source,
          log.executionId || null,
          log.traceId || null,
          log.spanId || null,
          log.tenantId || null,
          log.userId || null,
          log.metadata ? JSON.stringify(log.metadata) : null,
          log.stackTrace || null
        );
      }
    });

    try {
      transaction(this.logBuffer);
      this.logBuffer = [];
    } catch (error) {
      this.emit('flush_error', error);
      console.error('Failed to flush logs:', error);
    }
  }

  /**
   * Start auto-flush interval
   */
  private startAutoFlush(): void {
    // Flush every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5000);
  }

  /**
   * Stop auto-flush
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush(); // Final flush
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Query logs with filters
   */
  queryLogs(query: LogQuery): LogEntry[] {
    let sql = `SELECT * FROM logs WHERE 1=1`;
    const params: any[] = [];

    if (query.level) {
      sql += ` AND level = ?`;
      params.push(query.level);
    }

    if (query.source) {
      sql += ` AND source = ?`;
      params.push(query.source);
    }

    if (query.executionId) {
      sql += ` AND execution_id = ?`;
      params.push(query.executionId);
    }

    if (query.tenantId) {
      sql += ` AND tenant_id = ?`;
      params.push(query.tenantId);
    }

    if (query.startTime) {
      sql += ` AND timestamp >= ?`;
      params.push(query.startTime);
    }

    if (query.endTime) {
      sql += ` AND timestamp <= ?`;
      params.push(query.endTime);
    }

    // Full-text search
    if (query.search) {
      sql = `
        SELECT logs.* FROM logs
        INNER JOIN logs_fts ON logs.rowid = logs_fts.rowid
        WHERE logs_fts MATCH ?
      `;
      params.unshift(query.search);

      // Add other filters
      if (query.level) {
        sql += ` AND logs.level = ?`;
        params.push(query.level);
      }
      if (query.source) {
        sql += ` AND logs.source = ?`;
        params.push(query.source);
      }
      if (query.executionId) {
        sql += ` AND logs.execution_id = ?`;
        params.push(query.executionId);
      }
      if (query.tenantId) {
        sql += ` AND logs.tenant_id = ?`;
        params.push(query.tenantId);
      }
      if (query.startTime) {
        sql += ` AND logs.timestamp >= ?`;
        params.push(query.startTime);
      }
      if (query.endTime) {
        sql += ` AND logs.timestamp <= ?`;
        params.push(query.endTime);
      }
    }

    sql += ` ORDER BY timestamp DESC`;

    if (query.limit) {
      sql += ` LIMIT ?`;
      params.push(query.limit);
    }

    if (query.offset) {
      sql += ` OFFSET ?`;
      params.push(query.offset);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(row => this.rowToLogEntry(row));
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 100, level?: LogLevel): LogEntry[] {
    return this.queryLogs({ level, limit });
  }

  /**
   * Get logs by execution ID
   */
  getExecutionLogs(executionId: string): LogEntry[] {
    return this.queryLogs({ executionId });
  }

  /**
   * Get logs by trace ID
   */
  getTraceLogs(traceId: string): LogEntry[] {
    const rows = this.db.prepare(`
      SELECT * FROM logs WHERE trace_id = ? ORDER BY timestamp ASC
    `).all(traceId) as any[];

    return rows.map(row => this.rowToLogEntry(row));
  }

  /**
   * Get error logs
   */
  getErrorLogs(limit: number = 100): LogEntry[] {
    const rows = this.db.prepare(`
      SELECT * FROM logs WHERE level IN ('error', 'fatal')
      ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => this.rowToLogEntry(row));
  }

  /**
   * Get log count by level
   */
  getLogCountByLevel(): Record<LogLevel, number> {
    const rows = this.db.prepare(`
      SELECT level, COUNT(*) as count
      FROM logs
      GROUP BY level
    `).all() as any[];

    const counts: Record<string, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0,
    };

    for (const row of rows) {
      counts[row.level] = row.count;
    }

    return counts as Record<LogLevel, number>;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if log level meets minimum threshold
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    const levelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.minLevel);
    return levelIndex >= minLevelIndex;
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Get minimum log level
   */
  getMinLevel(): LogLevel {
    return this.minLevel;
  }

  /**
   * Convert database row to LogEntry
   */
  private rowToLogEntry(row: any): LogEntry {
    return {
      id: row.id,
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
      source: row.source,
      executionId: row.execution_id,
      traceId: row.trace_id,
      spanId: row.span_id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      stackTrace: row.stack_trace,
    };
  }

  /**
   * Cleanup old logs
   */
  async cleanup(retentionDays: number = 30): Promise<number> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const result = this.db.prepare(`
      DELETE FROM logs WHERE timestamp < ?
    `).run(cutoff);

    return result.changes;
  }

  /**
   * Get total log count
   */
  getLogCount(): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count FROM logs
    `).get() as any;

    return row.count;
  }
}
