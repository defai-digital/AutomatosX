/**
 * Structured Event Logging
 *
 * Provides structured, timestamped logging for all CLI events
 * to improve observability and debugging.
 *
 * Phase 4 P2: Structured event logging with timestamps
 */

import chalk from 'chalk';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

export type EventCategory =
  | 'command'
  | 'ai_response'
  | 'file_operation'
  | 'agent_delegation'
  | 'approval'
  | 'session'
  | 'memory'
  | 'provider'
  | 'error';

export interface StructuredLogEntry {
  timestamp: Date;
  level: LogLevel;
  category: EventCategory;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  userId?: string;
  duration?: number;
}

export interface LoggingOptions {
  enableConsole?: boolean;
  enableFile?: boolean;
  logFilePath?: string;
  minLevel?: LogLevel;
  includeMetadata?: boolean;
  colorize?: boolean;
}

/**
 * Structured Logger for CLI events
 */
export class StructuredLogger {
  private options: Required<LoggingOptions>;
  private sessionId: string;
  private eventBuffer: StructuredLogEntry[] = [];
  private maxBufferSize = 100;

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    success: 1
  };

  constructor(sessionId: string, options: LoggingOptions = {}) {
    this.sessionId = sessionId;
    this.options = {
      enableConsole: options.enableConsole ?? true,
      enableFile: options.enableFile ?? true,
      logFilePath: options.logFilePath ?? join(process.cwd(), '.automatosx', 'logs', 'cli-events.jsonl'),
      minLevel: options.minLevel ?? 'info',
      includeMetadata: options.includeMetadata ?? true,
      colorize: options.colorize ?? true
    };

    // Ensure log directory exists
    if (this.options.enableFile) {
      const logDir = join(process.cwd(), '.automatosx', 'logs');
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
    }
  }

  /**
   * Log a structured event
   */
  log(
    level: LogLevel,
    category: EventCategory,
    event: string,
    message: string,
    metadata?: Record<string, unknown>,
    duration?: number
  ): void {
    const entry: StructuredLogEntry = {
      timestamp: new Date(),
      level,
      category,
      event,
      message,
      metadata: this.options.includeMetadata ? metadata : undefined,
      sessionId: this.sessionId,
      duration
    };

    // Check if level meets minimum threshold
    if (this.levelPriority[level] < this.levelPriority[this.options.minLevel]) {
      return;
    }

    // Add to buffer
    this.eventBuffer.push(entry);
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift(); // Remove oldest
    }

    // Log to console
    if (this.options.enableConsole) {
      this.logToConsole(entry);
    }

    // Log to file
    if (this.options.enableFile) {
      this.logToFile(entry);
    }
  }

  /**
   * Convenience methods
   */
  debug(category: EventCategory, event: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', category, event, message, metadata);
  }

  info(category: EventCategory, event: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('info', category, event, message, metadata);
  }

  warn(category: EventCategory, event: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', category, event, message, metadata);
  }

  error(category: EventCategory, event: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('error', category, event, message, metadata);
  }

  success(category: EventCategory, event: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('success', category, event, message, metadata);
  }

  /**
   * Log with duration tracking
   */
  startTimer(): () => void {
    const start = Date.now();
    return () => Date.now() - start;
  }

  /**
   * Log command execution
   */
  logCommand(command: string, args?: string[], exitCode?: number, duration?: number): void {
    this.log(
      exitCode === 0 ? 'success' : 'error',
      'command',
      'command_executed',
      `Executed: ${command}`,
      { command, args, exitCode },
      duration
    );
  }

  /**
   * Log AI response
   */
  logAIResponse(provider: string, tokens?: number, cost?: number, duration?: number): void {
    this.log(
      'info',
      'ai_response',
      'ai_response_received',
      `AI response from ${provider}`,
      { provider, tokens, cost },
      duration
    );
  }

  /**
   * Log file operation
   */
  logFileOperation(operation: string, path: string, success: boolean, duration?: number): void {
    this.log(
      success ? 'success' : 'error',
      'file_operation',
      'file_operation_completed',
      `${operation}: ${path}`,
      { operation, path, success },
      duration
    );
  }

  /**
   * Log agent delegation
   */
  logAgentDelegation(agent: string, task: string, status: 'started' | 'completed' | 'failed', duration?: number): void {
    this.log(
      status === 'failed' ? 'error' : 'info',
      'agent_delegation',
      `agent_${status}`,
      `Agent @${agent}: ${task}`,
      { agent, task, status },
      duration
    );
  }

  /**
   * Log approval event
   */
  logApproval(operation: string, approved: boolean, reason?: string): void {
    this.log(
      'info',
      'approval',
      approved ? 'approval_granted' : 'approval_denied',
      `${operation}: ${approved ? 'Approved' : 'Denied'}`,
      { operation, approved, reason }
    );
  }

  /**
   * Log session event
   */
  logSession(event: 'started' | 'resumed' | 'saved' | 'ended', metadata?: Record<string, unknown>): void {
    this.log(
      'info',
      'session',
      `session_${event}`,
      `Session ${event}`,
      metadata
    );
  }

  /**
   * Log memory operation
   */
  logMemory(operation: 'search' | 'add' | 'delete', query?: string, results?: number): void {
    this.log(
      'debug',
      'memory',
      `memory_${operation}`,
      `Memory ${operation}${query ? `: ${query}` : ''}`,
      { operation, query, results }
    );
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count: number = 20): StructuredLogEntry[] {
    return this.eventBuffer.slice(-count);
  }

  /**
   * Filter logs by category
   */
  getLogsByCategory(category: EventCategory): StructuredLogEntry[] {
    return this.eventBuffer.filter(entry => entry.category === category);
  }

  /**
   * Filter logs by level
   */
  getLogsByLevel(level: LogLevel): StructuredLogEntry[] {
    return this.eventBuffer.filter(entry => entry.level === level);
  }

  /**
   * Clear event buffer
   */
  clearBuffer(): void {
    this.eventBuffer = [];
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(entry: StructuredLogEntry): void {
    const timestamp = this.formatTimestamp(entry.timestamp);
    const level = this.formatLevel(entry.level);
    const category = this.formatCategory(entry.category);
    const message = entry.message;
    const duration = entry.duration ? chalk.dim(` (${entry.duration}ms)`) : '';

    const line = `${timestamp} ${level} ${category} ${message}${duration}`;

    if (entry.level === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }

    // Show metadata if debug level
    if (entry.metadata && this.options.minLevel === 'debug') {
      console.log(chalk.dim('  Metadata:'), entry.metadata);
    }
  }

  /**
   * Log to file in JSONL format
   */
  private logToFile(entry: StructuredLogEntry): void {
    try {
      const json = JSON.stringify(entry);
      appendFileSync(this.options.logFilePath, json + '\n', 'utf8');
    } catch (error) {
      // Fail silently to avoid infinite loop
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Format timestamp
   */
  private formatTimestamp(date: Date): string {
    const time = date.toLocaleTimeString('en-US', { hour12: false });
    return this.options.colorize ? chalk.dim(time) : time;
  }

  /**
   * Format log level
   */
  private formatLevel(level: LogLevel): string {
    const colors: Record<LogLevel, (text: string) => string> = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
      success: chalk.green
    };

    const labels: Record<LogLevel, string> = {
      debug: 'DBG',
      info: 'INF',
      warn: 'WRN',
      error: 'ERR',
      success: 'SUC'
    };

    const label = labels[level];
    const color = colors[level];

    return this.options.colorize ? color(`[${label}]`) : `[${label}]`;
  }

  /**
   * Format category
   */
  private formatCategory(category: EventCategory): string {
    const icons: Record<EventCategory, string> = {
      command: '⚡',
      ai_response: '🤖',
      file_operation: '📁',
      agent_delegation: '👤',
      approval: '✓',
      session: '📋',
      memory: '💾',
      provider: '🔌',
      error: '❌'
    };

    const icon = icons[category] || '•';
    const label = category.replace('_', ' ');

    return this.options.colorize
      ? `${icon} ${chalk.cyan(label)}`
      : `${icon} ${label}`;
  }
}

/**
 * Global logger instance (singleton)
 */
let globalLogger: StructuredLogger | null = null;

/**
 * Initialize global logger
 */
export function initLogger(sessionId: string, options?: LoggingOptions): StructuredLogger {
  globalLogger = new StructuredLogger(sessionId, options);
  return globalLogger;
}

/**
 * Get global logger instance
 */
export function getLogger(): StructuredLogger | null {
  return globalLogger;
}

/**
 * Render event timeline
 */
export function renderEventTimeline(entries: StructuredLogEntry[], maxEntries: number = 20): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Event Timeline'));
  lines.push('');

  const recent = entries.slice(-maxEntries);

  recent.forEach((entry, idx) => {
    const time = entry.timestamp.toLocaleTimeString('en-US', { hour12: false });
    const level = getLevelIcon(entry.level);
    const category = getCategoryIcon(entry.category);
    const duration = entry.duration ? chalk.dim(` ${entry.duration}ms`) : '';

    const connector = idx < recent.length - 1 ? '│' : '└';

    lines.push(`${chalk.dim(connector)} ${chalk.dim(time)} ${level} ${category} ${chalk.white(entry.message)}${duration}`);

    if (entry.metadata) {
      const metaKeys = Object.keys(entry.metadata).slice(0, 2);
      if (metaKeys.length > 0) {
        lines.push(`${chalk.dim('│')}   ${chalk.dim(metaKeys.map(k => `${k}: ${entry.metadata![k]}`).join(', '))}`);
      }
    }
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Render event summary
 */
export function renderEventSummary(entries: StructuredLogEntry[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Event Summary'));
  lines.push('');

  // Count by category
  const byCategory: Record<string, number> = {};
  const byLevel: Record<string, number> = {};

  entries.forEach(entry => {
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
  });

  lines.push(chalk.bold.white('By Category:'));
  Object.entries(byCategory).forEach(([category, count]) => {
    const icon = getCategoryIcon(category as EventCategory);
    lines.push(`  ${icon} ${chalk.white(category)}: ${chalk.cyan(count.toString())}`);
  });

  lines.push('');
  lines.push(chalk.bold.white('By Level:'));
  Object.entries(byLevel).forEach(([level, count]) => {
    const icon = getLevelIcon(level as LogLevel);
    lines.push(`  ${icon} ${chalk.white(level)}: ${chalk.cyan(count.toString())}`);
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Get level icon
 */
function getLevelIcon(level: LogLevel): string {
  const icons: Record<LogLevel, string> = {
    debug: chalk.gray('•'),
    info: chalk.blue('ℹ'),
    warn: chalk.yellow('⚠'),
    error: chalk.red('✗'),
    success: chalk.green('✓')
  };
  return icons[level] || '•';
}

/**
 * Get category icon
 */
function getCategoryIcon(category: EventCategory): string {
  const icons: Record<EventCategory, string> = {
    command: '⚡',
    ai_response: '🤖',
    file_operation: '📁',
    agent_delegation: '👤',
    approval: '✓',
    session: '📋',
    memory: '💾',
    provider: '🔌',
    error: '❌'
  };
  return icons[category] || '•';
}
