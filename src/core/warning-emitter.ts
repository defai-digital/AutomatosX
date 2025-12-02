/**
 * Timeout Warning Emitter
 *
 * Event emitter for timeout warnings. Extends Node.js EventEmitter
 * to provide timeout warning events when execution approaches timeout.
 *
 * @module warning-emitter
 * @since 5.4.0
 */

import { EventEmitter } from 'events';
import { TimeoutWarningEvent } from '../types/timeout.js';
import { logger } from '../utils/logger.js';

/**
 * Warning emitter for timeout events
 *
 * Emits 'timeout-warning' events when execution time approaches the configured timeout.
 * Provides a default warning handler that logs to console.
 *
 * @example
 * ```typescript
 * const emitter = new WarningEmitter();
 *
 * emitter.on('timeout-warning', (event) => {
 *   console.log(`Warning: ${event.agentName} approaching timeout`);
 * });
 *
 * emitter.emit('timeout-warning', {
 *   agentName: 'backend',
 *   taskDescription: 'Complex task',
 *   elapsedMs: 1440000,
 *   remainingMs: 360000,
 *   timeoutMs: 1800000
 * });
 * ```
 */
export class WarningEmitter extends EventEmitter {
  constructor() {
    super();
    this.setupDefaultHandler();
  }

  /**
   * Setup default warning handler
   *
   * Registers a default handler that logs timeout warnings to console.
   * This handler is always registered and cannot be removed.
   *
   * @private
   */
  private setupDefaultHandler(): void {
    this.on('timeout-warning', (event: TimeoutWarningEvent) => {
      this.logWarning(event);
    });
  }

  /**
   * Log timeout warning
   *
   * Formats and logs a timeout warning message with relevant details.
   *
   * @param event - Timeout warning event data
   * @private
   */
  private logWarning(event: TimeoutWarningEvent): void {
    const elapsedSeconds = Math.floor(event.elapsedMs / 1000);
    const remainingSeconds = Math.floor(event.remainingMs / 1000);
    const totalSeconds = Math.floor(event.timeoutMs / 1000);

    const message = [
      `⚠️  Timeout Warning: Agent "${event.agentName}" has been running for ${elapsedSeconds}s`,
      `   Task: ${this.truncateTask(event.taskDescription)}`,
      `   Remaining time: ${remainingSeconds}s (${this.formatTime(remainingSeconds)})`,
      `   Total timeout: ${totalSeconds}s (${this.formatTime(totalSeconds)})`,
    ].join('\n');

    logger.warn(message);
  }

  /**
   * Truncate task description
   *
   * Truncates long task descriptions to keep warning messages concise.
   *
   * @param task - Task description
   * @param maxLength - Maximum length (default: 80)
   * @returns Truncated task description
   * @private
   */
  private truncateTask(task: string, maxLength: number = 80): string {
    if (task.length <= maxLength) {
      return task;
    }
    return task.substring(0, maxLength - 3) + '...';
  }

  /**
   * Format time in human-readable format
   *
   * Converts seconds to a human-readable format (e.g., "5m 30s", "1h 15m").
   *
   * @param seconds - Time in seconds
   * @returns Formatted time string
   * @private
   */
  private formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  /**
   * Emit timeout warning
   *
   * Convenience method to emit a timeout warning event.
   *
   * @param event - Timeout warning event data
   */
  emitWarning(event: TimeoutWarningEvent): void {
    this.emit('timeout-warning', event);
  }

  /**
   * Destroy warning emitter
   *
   * CRITICAL FIX (v5.6.18): Remove all event listeners to prevent memory leak.
   * Must be called when WarningEmitter instance is no longer needed.
   *
   * @since 5.6.18
   */
  destroy(): void {
    this.removeAllListeners('timeout-warning');
    logger.debug('WarningEmitter destroyed');
  }
}
