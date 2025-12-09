/**
 * MCP Lifecycle Event Logger
 *
 * Logs lifecycle events for MCP servers to support observability
 * and debugging. Events are written to both standard logger and
 * optional JSON file for analysis.
 *
 * Phase 4A: Server Lifecycle Management
 *
 * @module mcp/lifecycle-logger
 */

import { writeFile, appendFile, mkdir, rename, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../shared/logging/logger.js';
import type { MCPHealthCheckResult } from './types-common.js';

/**
 * Lifecycle Event Types
 */
export type LifecycleEventType =
  | 'server_start'
  | 'server_stop'
  | 'server_restart'
  | 'server_crash'
  | 'health_check_passed'
  | 'health_check_failed'
  | 'auto_restart'
  | 'manual_intervention';

/**
 * Lifecycle Event
 */
export interface LifecycleEvent {
  /** Event type */
  type: LifecycleEventType;

  /** Server name */
  serverName: string;

  /** Event timestamp */
  timestamp: Date;

  /** Event details */
  details?: {
    pid?: number;
    exitCode?: number;
    signal?: string;
    reason?: string;
    duration?: number;
    error?: string;
    metrics?: {
      memoryUsageMB?: number;
      cpuUsagePercent?: number;
      uptime?: number;
    };
  };

  /** Session context */
  session?: {
    sessionId?: string;
    userId?: string;
  };
}

/**
 * Lifecycle Logger Options
 */
export interface LifecycleLoggerOptions {
  /** Enable file logging */
  enableFileLogging?: boolean;

  /** Log file directory */
  logDir?: string;

  /** Log file name pattern */
  logFileName?: string;

  /** Maximum log file size (MB) */
  maxLogSizeMB?: number;

  /** Enable metrics collection */
  collectMetrics?: boolean;
}

/**
 * MCP Lifecycle Logger
 *
 * Logs all MCP server lifecycle events for observability.
 */
export class LifecycleLogger {
  private logDir: string;
  private logFileName: string;
  private maxLogSizeMB: number;
  private collectMetrics: boolean;
  private enableFileLogging: boolean;

  constructor(options: LifecycleLoggerOptions = {}) {
    this.enableFileLogging = options.enableFileLogging ?? true;
    this.logDir = options.logDir ?? join(process.cwd(), '.automatosx', 'logs', 'mcp');
    this.logFileName = options.logFileName ?? 'lifecycle-events.jsonl';
    this.maxLogSizeMB = options.maxLogSizeMB ?? 100;
    this.collectMetrics = options.collectMetrics ?? true;
  }

  /**
   * Initialize logger
   *
   * Creates log directory if it doesn't exist.
   */
  async initialize(): Promise<void> {
    if (!this.enableFileLogging) {
      logger.debug('LifecycleLogger: File logging disabled');
      return;
    }

    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true });
      logger.info('LifecycleLogger: Created log directory', {
        path: this.logDir,
      });
    }
  }

  /**
   * Log server start event
   */
  async logServerStart(serverName: string, pid: number): Promise<void> {
    const event: LifecycleEvent = {
      type: 'server_start',
      serverName,
      timestamp: new Date(),
      details: { pid },
    };

    await this.writeEvent(event);
  }

  /**
   * Log server stop event
   */
  async logServerStop(
    serverName: string,
    duration: number,
    reason?: string
  ): Promise<void> {
    const event: LifecycleEvent = {
      type: 'server_stop',
      serverName,
      timestamp: new Date(),
      details: { duration, reason },
    };

    await this.writeEvent(event);
  }

  /**
   * Log server restart event
   */
  async logServerRestart(serverName: string, reason?: string): Promise<void> {
    const event: LifecycleEvent = {
      type: 'server_restart',
      serverName,
      timestamp: new Date(),
      details: { reason },
    };

    await this.writeEvent(event);
  }

  /**
   * Log server crash event
   */
  async logServerCrash(
    serverName: string,
    exitCode?: number,
    signal?: string,
    error?: string
  ): Promise<void> {
    const event: LifecycleEvent = {
      type: 'server_crash',
      serverName,
      timestamp: new Date(),
      details: {
        exitCode,
        signal,
        error,
      },
    };

    await this.writeEvent(event);
  }

  /**
   * Log health check event
   */
  async logHealthCheck(result: MCPHealthCheckResult): Promise<void> {
    const event: LifecycleEvent = {
      type: result.healthy ? 'health_check_passed' : 'health_check_failed',
      serverName: result.serverName,
      timestamp: new Date(),
      details: {
        error: result.error,
        metrics: this.collectMetrics ? result.metrics : undefined,
      },
    };

    await this.writeEvent(event);
  }

  /**
   * Log auto-restart event
   */
  async logAutoRestart(serverName: string, reason: string): Promise<void> {
    const event: LifecycleEvent = {
      type: 'auto_restart',
      serverName,
      timestamp: new Date(),
      details: { reason },
    };

    await this.writeEvent(event);
  }

  /**
   * Log manual intervention event
   */
  async logManualIntervention(serverName: string, reason: string): Promise<void> {
    const event: LifecycleEvent = {
      type: 'manual_intervention',
      serverName,
      timestamp: new Date(),
      details: { reason },
    };

    await this.writeEvent(event);
  }

  /**
   * Get event history for server
   *
   * @param serverName - Server name
   * @param limit - Maximum number of events to return
   * @returns Array of lifecycle events
   */
  async getEventHistory(
    serverName?: string,
    limit: number = 100
  ): Promise<LifecycleEvent[]> {
    if (!this.enableFileLogging) {
      return [];
    }

    try {
      const logPath = join(this.logDir, this.logFileName);
      if (!existsSync(logPath)) {
        return [];
      }

      // TODO: Implement efficient log file reading
      // For now, return empty array
      // Future: Read JSONL file, filter by serverName, return last N events
      return [];
    } catch (error) {
      logger.error('LifecycleLogger: Failed to read event history', { error });
      return [];
    }
  }

  /**
   * Clear event history
   */
  async clearHistory(): Promise<void> {
    if (!this.enableFileLogging) {
      return;
    }

    try {
      const logPath = join(this.logDir, this.logFileName);
      if (existsSync(logPath)) {
        await writeFile(logPath, '');
        logger.info('LifecycleLogger: Cleared event history');
      }
    } catch (error) {
      logger.error('LifecycleLogger: Failed to clear event history', { error });
    }
  }

  // ========== Private Methods ==========

  /**
   * Write event to log
   */
  private async writeEvent(event: LifecycleEvent): Promise<void> {
    // Always log to standard logger
    logger.info(`MCP Lifecycle: ${event.type}`, {
      serverName: event.serverName,
      details: event.details,
    });

    // Write to file if enabled
    if (this.enableFileLogging) {
      await this.writeEventToFile(event);
    }
  }

  /**
   * Write event to file (JSONL format)
   */
  private async writeEventToFile(event: LifecycleEvent): Promise<void> {
    try {
      const logPath = join(this.logDir, this.logFileName);

      // Check file size and rotate if needed
      await this.rotateLogIfNeeded(logPath);

      // Append event as JSON line
      const line = JSON.stringify(event) + '\n';
      await appendFile(logPath, line, 'utf-8');
    } catch (error) {
      logger.error('LifecycleLogger: Failed to write event to file', {
        error,
        event,
      });
    }
  }

  /**
   * Rotate log file if it exceeds size limit
   *
   * BUG FIX: Previously used dynamic imports for fs/fs.promises which are already
   * imported at module level, causing unnecessary overhead. Also had a TOCTOU race
   * between existsSync and statSync - now uses async stat() which handles ENOENT
   * gracefully without the race condition.
   */
  private async rotateLogIfNeeded(logPath: string): Promise<void> {
    try {
      // BUG FIX: Use async stat() instead of existsSync + statSync to avoid
      // TOCTOU race condition where file could be deleted between checks
      const stats = await stat(logPath);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB > this.maxLogSizeMB) {
        // Rotate: rename current file with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archivePath = logPath.replace('.jsonl', `-${timestamp}.jsonl`);

        // BUG FIX: Use already-imported rename instead of dynamic import
        await rename(logPath, archivePath);

        logger.info('LifecycleLogger: Rotated log file', {
          oldPath: logPath,
          newPath: archivePath,
          sizeMB: sizeMB.toFixed(2),
        });
      }
    } catch (error) {
      // ENOENT means file doesn't exist - that's fine, nothing to rotate
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      logger.error('LifecycleLogger: Failed to rotate log file', { error });
    }
  }
}

/**
 * Default lifecycle logger instance
 */
let defaultLogger: LifecycleLogger | undefined;

/**
 * Get default lifecycle logger
 */
export function getLifecycleLogger(): LifecycleLogger {
  if (!defaultLogger) {
    defaultLogger = new LifecycleLogger();
  }
  return defaultLogger;
}

/**
 * Initialize default lifecycle logger
 */
export async function initializeLifecycleLogger(): Promise<void> {
  const logger = getLifecycleLogger();
  await logger.initialize();
}
