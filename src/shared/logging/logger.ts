/**
 * Enhanced Logger for AutomatosX
 *
 * Features:
 * - Structured logging (JSON mode)
 * - File output with rotation
 * - Secrets sanitization
 * - Multiple log levels
 * - Performance profiling
 */

import type { Logger, LogEntry, LoggerConfig } from '../../types/logger.js';
import { LogLevel } from '../../types/logger.js';
import { writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4
};

const COLORS = {
  trace: '\x1b[90m', // Gray
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m'
};

// Sensitive field names to redact
const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'apikey',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'credential',
  'credentials',
  'auth',
  'authorization'
];

/**
 * Sanitize object by redacting sensitive fields
 */
function sanitizeObject(obj: any, maxDepth = 5, currentDepth = 0): any {
  // Prevent infinite recursion
  if (currentDepth > maxDepth) {
    return '[Max Depth Reached]';
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth, currentDepth + 1));
  }

  // Handle objects
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains sensitive keywords
    const isSensitive = SENSITIVE_KEYS.some(sensitiveKey =>
      lowerKey.includes(sensitiveKey.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value, maxDepth, currentDepth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export class SimpleLogger implements Logger {
  private config: LoggerConfig;
  private jsonMode: boolean;

  constructor(config: Partial<LoggerConfig> = {}) {
    // Support AUTOMATOSX_LOG_LEVEL environment variable
    const envLogLevel = process.env.AUTOMATOSX_LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
    const validLevels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];
    const level = (envLogLevel && validLevels.includes(envLogLevel))
      ? envLogLevel
      : (config.level || 'warn');  // Changed default from 'info' to 'warn' to reduce token usage

    this.config = {
      level,
      console: config.console ?? true,
      file: config.file
    };
    this.jsonMode = false;
  }

  /**
   * Enable JSON output mode
   */
  enableJSONMode(): void {
    this.jsonMode = true;
  }

  /**
   * Disable JSON output mode
   */
  disableJSONMode(): void {
    this.jsonMode = false;
  }

  /**
   * Check if JSON mode is enabled
   */
  isJSONMode(): boolean {
    return this.jsonMode;
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.log('trace', message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    // Check if this log level should be output
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    // Sanitize context to remove sensitive data
    const sanitizedContext = context ? sanitizeObject(context) : undefined;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: sanitizedContext
    };

    // Console output
    if (this.config.console) {
      this.logToConsole(entry);
    }

    // File output
    if (this.config.file) {
      this.logToFile(entry).catch(err => {
        // Silently fail to avoid infinite loop
        if (this.config.console) {
          console.error(`Failed to write to log file: ${err.message}`);
        }
      });
    }
  }

  private logToConsole(entry: LogEntry): void {
    // JSON mode - output raw JSON
    if (this.jsonMode) {
      const json = JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        message: entry.message,
        context: entry.context
      });

      if (entry.level === 'error') {
        console.error(json);
      } else {
        console.log(json);
      }
      return;
    }

    // Human-readable mode
    const timestamp = entry.timestamp.toISOString();
    const color = COLORS[entry.level];
    const reset = COLORS.reset;
    const levelStr = entry.level.toUpperCase().padEnd(5);

    let logMessage = `${color}[${timestamp}] ${levelStr}${reset} ${entry.message}`;

    if (entry.context) {
      logMessage += `\n${JSON.stringify(entry.context, null, 2)}`;
    }

    // Output to stderr to avoid polluting stdout (especially for JSON output)
    // This ensures CLI commands can output clean JSON to stdout
    if (entry.level === 'error') {
      console.error(logMessage);
    } else if (entry.level === 'warn') {
      console.warn(logMessage);
    } else {
      // info and debug also go to stderr
      console.error(logMessage);
    }
  }

  /**
   * Write log entry to file
   */
  private async logToFile(entry: LogEntry): Promise<void> {
    if (!this.config.file) {
      return;
    }

    // Ensure directory exists
    const dir = dirname(this.config.file);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Format entry as JSON (one line per entry)
    const json = JSON.stringify({
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      context: entry.context
    });

    // Append to file
    await appendFile(this.config.file, json + '\n', 'utf-8');
  }
}

// Default logger instance
export const logger = new SimpleLogger();

// Create logger with custom config
export function createLogger(config: Partial<LoggerConfig>): Logger {
  return new SimpleLogger(config);
}

// Set log level on default logger
export function setLogLevel(level: LogLevel): void {
  logger.setLevel(level);
}

// Get current log level
export function getLogLevel(): LogLevel {
  return logger.getLevel();
}

// Re-export LogLevel for convenience
export type { LogLevel };
