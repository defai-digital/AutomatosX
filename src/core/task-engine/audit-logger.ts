/**
 * Task Audit Logger
 *
 * Logs all task operations for security auditing and compliance.
 * Writes to JSONL format for easy parsing and analysis.
 *
 * Features:
 * - Append-only JSONL logging
 * - Automatic payload redaction
 * - Rotation support
 * - Async write queue
 *
 * Part of Phase 4: Production Hardening
 *
 * @module core/task-engine/audit-logger
 * @version 1.0.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../../shared/logging/logger.js';

/**
 * Audit event types
 */
export type AuditEventType =
  | 'TASK_CREATED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_DELETED'
  | 'TASK_EXPIRED'
  | 'RATE_LIMITED'
  | 'LOOP_PREVENTED'
  | 'CIRCUIT_OPENED'
  | 'CIRCUIT_CLOSED'
  | 'AUTH_FAILED'
  | 'CONFIG_CHANGED';

/**
 * Audit event data
 */
export interface AuditEvent {
  /** Event type */
  type: AuditEventType;
  /** Task ID (if applicable) */
  taskId?: string;
  /** Client ID */
  clientId: string;
  /** Task type (if applicable) */
  taskType?: string;
  /** Target engine (if applicable) */
  engine?: string;
  /** Event-specific details */
  details?: Record<string, unknown>;
  /** Payload (will be redacted) */
  payload?: Record<string, unknown>;
  /** Error information (if applicable) */
  error?: {
    code: string;
    message: string;
  };
  /** Duration in ms (for completion events) */
  durationMs?: number;
  /** Source IP (if available) */
  sourceIp?: string;
  /** User agent (if available) */
  userAgent?: string;
}

/**
 * Logged audit entry (with timestamp and redaction)
 */
export interface AuditLogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Unix timestamp in ms */
  timestampMs: number;
  /** Event type */
  type: AuditEventType;
  /** Task ID */
  taskId?: string;
  /** Client ID */
  clientId: string;
  /** Task type */
  taskType?: string;
  /** Target engine */
  engine?: string;
  /** Event details */
  details?: Record<string, unknown>;
  /** Payload indicator (redacted) */
  hasPayload: boolean;
  /** Payload size in bytes (if present) */
  payloadSizeBytes?: number;
  /** Error information */
  error?: {
    code: string;
    message: string;
  };
  /** Duration in ms */
  durationMs?: number;
  /** Source IP */
  sourceIp?: string;
  /** User agent */
  userAgent?: string;
}

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  /** Log file path (default: .automatosx/logs/task-audit.jsonl) */
  logPath?: string;
  /** Enable async writes (default: true) */
  asyncWrites?: boolean;
  /** Max write queue size (default: 1000) */
  maxQueueSize?: number;
  /** Flush interval in ms (default: 1000) */
  flushIntervalMs?: number;
  /** Enable log rotation (default: true) */
  enableRotation?: boolean;
  /** Max file size before rotation in bytes (default: 10MB) */
  maxFileSizeBytes?: number;
  /** Max rotated files to keep (default: 5) */
  maxRotatedFiles?: number;
}

/**
 * Audit logger statistics
 */
export interface AuditLoggerStats {
  /** Total events logged */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<string, number>;
  /** Current file size in bytes */
  currentFileSizeBytes: number;
  /** Pending writes in queue */
  pendingWrites: number;
  /** Total bytes written */
  totalBytesWritten: number;
  /** Rotations performed */
  rotationsPerformed: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<AuditLoggerConfig> = {
  logPath: '.automatosx/logs/task-audit.jsonl',
  asyncWrites: true,
  maxQueueSize: 1000,
  flushIntervalMs: 1000,
  enableRotation: true,
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  maxRotatedFiles: 5
};

/**
 * TaskAuditLogger - Security audit logging
 *
 * @example
 * ```typescript
 * const auditLogger = new TaskAuditLogger({
 *   logPath: '.automatosx/logs/task-audit.jsonl'
 * });
 *
 * // Log task creation
 * auditLogger.log({
 *   type: 'TASK_CREATED',
 *   taskId: 'task_abc123',
 *   clientId: 'claude-code',
 *   taskType: 'web_search',
 *   payload: { query: 'sensitive data' }  // Will be redacted
 * });
 *
 * // Shutdown
 * await auditLogger.shutdown();
 * ```
 */
export class TaskAuditLogger {
  private readonly config: Required<AuditLoggerConfig>;
  private writeQueue: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private currentFileSize = 0;
  private closed = false;

  // Statistics
  private stats = {
    totalEvents: 0,
    eventsByType: {} as Record<string, number>,
    totalBytesWritten: 0,
    rotationsPerformed: 0
  };

  constructor(config: AuditLoggerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Ensure log directory exists
    this.ensureLogDirectory();

    // Get current file size
    this.updateCurrentFileSize();

    // Start flush timer if async
    if (this.config.asyncWrites) {
      this.startFlushTimer();
    }

    logger.debug('[TaskAuditLogger] Initialized', {
      logPath: this.config.logPath,
      asyncWrites: this.config.asyncWrites
    });
  }

  /**
   * Log an audit event
   */
  log(event: AuditEvent): void {
    if (this.closed) {
      logger.warn('[TaskAuditLogger] Attempted to log after shutdown');
      return;
    }

    const entry = this.createLogEntry(event);
    const line = JSON.stringify(entry) + '\n';

    this.stats.totalEvents++;
    this.stats.eventsByType[event.type] = (this.stats.eventsByType[event.type] ?? 0) + 1;

    if (this.config.asyncWrites) {
      this.enqueueWrite(line);
    } else {
      this.writeSync(line);
    }
  }

  /**
   * Get audit logger statistics
   */
  getStats(): AuditLoggerStats {
    return {
      totalEvents: this.stats.totalEvents,
      eventsByType: { ...this.stats.eventsByType },
      currentFileSizeBytes: this.currentFileSize,
      pendingWrites: this.writeQueue.length,
      totalBytesWritten: this.stats.totalBytesWritten,
      rotationsPerformed: this.stats.rotationsPerformed
    };
  }

  /**
   * Force flush pending writes
   */
  flush(): void {
    if (this.writeQueue.length === 0) return;

    const lines = this.writeQueue.splice(0);
    const data = lines.join('');

    try {
      fs.appendFileSync(this.config.logPath, data);
      this.currentFileSize += Buffer.byteLength(data);
      this.stats.totalBytesWritten += Buffer.byteLength(data);

      // Check for rotation
      if (this.config.enableRotation && this.currentFileSize >= this.config.maxFileSizeBytes) {
        this.rotateLog();
      }
    } catch (error) {
      logger.error('[TaskAuditLogger] Failed to flush', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Re-queue failed writes at the front
      this.writeQueue.unshift(...lines);
    }
  }

  /**
   * Shutdown the audit logger
   */
  async shutdown(): Promise<void> {
    if (this.closed) return;

    this.closed = true;

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    this.flush();

    logger.debug('[TaskAuditLogger] Shutdown complete', {
      totalEvents: this.stats.totalEvents
    });
  }

  /**
   * Create a log entry from an event
   */
  private createLogEntry(event: AuditEvent): AuditLogEntry {
    const now = Date.now();

    return {
      timestamp: new Date(now).toISOString(),
      timestampMs: now,
      type: event.type,
      taskId: event.taskId,
      clientId: event.clientId,
      taskType: event.taskType,
      engine: event.engine,
      details: event.details,
      hasPayload: !!event.payload,
      payloadSizeBytes: event.payload
        ? Buffer.byteLength(JSON.stringify(event.payload))
        : undefined,
      error: event.error,
      durationMs: event.durationMs,
      sourceIp: event.sourceIp,
      userAgent: event.userAgent
    };
  }

  /**
   * Enqueue a write for async processing
   */
  private enqueueWrite(line: string): void {
    if (this.writeQueue.length >= this.config.maxQueueSize) {
      // Drop oldest entries if queue is full
      this.writeQueue.shift();
      logger.warn('[TaskAuditLogger] Write queue full, dropping oldest entry');
    }
    this.writeQueue.push(line);
  }

  /**
   * Write synchronously
   */
  private writeSync(line: string): void {
    try {
      fs.appendFileSync(this.config.logPath, line);
      const bytes = Buffer.byteLength(line);
      this.currentFileSize += bytes;
      this.stats.totalBytesWritten += bytes;

      // Check for rotation
      if (this.config.enableRotation && this.currentFileSize >= this.config.maxFileSizeBytes) {
        this.rotateLog();
      }
    } catch (error) {
      logger.error('[TaskAuditLogger] Failed to write', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);

    // Don't prevent process exit
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /**
   * Rotate the log file
   */
  private rotateLog(): void {
    try {
      // Rotate existing files
      for (let i = this.config.maxRotatedFiles - 1; i >= 1; i--) {
        const oldPath = `${this.config.logPath}.${i}`;
        const newPath = `${this.config.logPath}.${i + 1}`;
        if (fs.existsSync(oldPath)) {
          if (i === this.config.maxRotatedFiles - 1) {
            fs.unlinkSync(oldPath);
          } else {
            fs.renameSync(oldPath, newPath);
          }
        }
      }

      // Rotate current file
      if (fs.existsSync(this.config.logPath)) {
        fs.renameSync(this.config.logPath, `${this.config.logPath}.1`);
      }

      this.currentFileSize = 0;
      this.stats.rotationsPerformed++;

      logger.debug('[TaskAuditLogger] Log rotated', {
        rotationsPerformed: this.stats.rotationsPerformed
      });
    } catch (error) {
      logger.error('[TaskAuditLogger] Failed to rotate log', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Ensure the log directory exists
   */
  private ensureLogDirectory(): void {
    const dir = path.dirname(this.config.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Update current file size
   */
  private updateCurrentFileSize(): void {
    try {
      if (fs.existsSync(this.config.logPath)) {
        const stats = fs.statSync(this.config.logPath);
        this.currentFileSize = stats.size;
      }
    } catch {
      this.currentFileSize = 0;
    }
  }
}

/**
 * Create an audit logger instance
 */
export function createAuditLogger(config?: AuditLoggerConfig): TaskAuditLogger {
  return new TaskAuditLogger(config);
}
