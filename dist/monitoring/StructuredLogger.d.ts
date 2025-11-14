/**
 * StructuredLogger.ts
 *
 * Centralized structured logging with query capabilities
 * Phase 6 Week 2: Advanced Monitoring & Observability
 */
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { LogEntry, LogLevel, LogQuery } from '../types/monitoring.types.js';
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
export declare class StructuredLogger extends EventEmitter {
    private db;
    private logBuffer;
    private bufferSize;
    private flushInterval;
    private minLevel;
    constructor(db?: Database.Database, bufferSize?: number, minLevel?: LogLevel);
    /**
     * Initialize logging schema
     */
    private initializeSchema;
    /**
     * Log a debug message
     */
    debug(message: string, source: string, options?: {
        executionId?: string;
        traceId?: string;
        spanId?: string;
        tenantId?: string;
        userId?: string;
        metadata?: Record<string, unknown>;
    }): void;
    /**
     * Log an info message
     */
    info(message: string, source: string, options?: {
        executionId?: string;
        traceId?: string;
        spanId?: string;
        tenantId?: string;
        userId?: string;
        metadata?: Record<string, unknown>;
    }): void;
    /**
     * Log a warning message
     */
    warn(message: string, source: string, options?: {
        executionId?: string;
        traceId?: string;
        spanId?: string;
        tenantId?: string;
        userId?: string;
        metadata?: Record<string, unknown>;
    }): void;
    /**
     * Log an error message
     */
    error(message: string, source: string, options?: {
        executionId?: string;
        traceId?: string;
        spanId?: string;
        tenantId?: string;
        userId?: string;
        metadata?: Record<string, unknown>;
        stackTrace?: string;
        error?: Error;
    }): void;
    /**
     * Log a fatal error message
     */
    fatal(message: string, source: string, options?: {
        executionId?: string;
        traceId?: string;
        spanId?: string;
        tenantId?: string;
        userId?: string;
        metadata?: Record<string, unknown>;
        stackTrace?: string;
        error?: Error;
    }): void;
    /**
     * Generic log method
     */
    private log;
    /**
     * Flush log buffer to database
     */
    flush(): void;
    /**
     * Start auto-flush interval
     */
    private startAutoFlush;
    /**
     * Stop auto-flush
     */
    stop(): void;
    /**
     * Query logs with filters
     */
    queryLogs(query: LogQuery): LogEntry[];
    /**
     * Get recent logs
     */
    getRecentLogs(limit?: number, level?: LogLevel): LogEntry[];
    /**
     * Get logs by execution ID
     */
    getExecutionLogs(executionId: string): LogEntry[];
    /**
     * Get logs by trace ID
     */
    getTraceLogs(traceId: string): LogEntry[];
    /**
     * Get error logs
     */
    getErrorLogs(limit?: number): LogEntry[];
    /**
     * Get log count by level
     */
    getLogCountByLevel(): Record<LogLevel, number>;
    /**
     * Check if log level meets minimum threshold
     */
    private shouldLog;
    /**
     * Set minimum log level
     */
    setMinLevel(level: LogLevel): void;
    /**
     * Get minimum log level
     */
    getMinLevel(): LogLevel;
    /**
     * Convert database row to LogEntry
     */
    private rowToLogEntry;
    /**
     * Cleanup old logs
     */
    cleanup(retentionDays?: number): Promise<number>;
    /**
     * Get total log count
     */
    getLogCount(): number;
}
//# sourceMappingURL=StructuredLogger.d.ts.map