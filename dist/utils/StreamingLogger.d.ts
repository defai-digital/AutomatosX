import { EventEmitter } from 'events';
/**
 * Log level severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';
/**
 * Log event structure
 */
export interface LogEvent {
    level: LogLevel;
    message: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}
/**
 * Logger configuration options
 */
export interface StreamingLoggerOptions {
    bufferSize?: number;
    enableColors?: boolean;
    enableTimestamps?: boolean;
    minLevel?: LogLevel;
}
/**
 * StreamingLogger - Real-time output with event buffering
 *
 * Features:
 * - Event-based logging with EventEmitter
 * - ANSI color support for terminal output
 * - In-memory buffer for log replay
 * - Configurable log levels
 * - Structured metadata support
 *
 * @example
 * ```typescript
 * const logger = new StreamingLogger({ bufferSize: 100 })
 *
 * logger.info('Starting agent execution...')
 * logger.debug('Loading configuration', { configPath: './config.json' })
 * logger.success('Task completed successfully!')
 *
 * // Listen to log events
 * logger.on('log', (event) => {
 *   console.log(`[${event.level}] ${event.message}`)
 * })
 * ```
 */
export declare class StreamingLogger extends EventEmitter {
    private buffer;
    private bufferSize;
    private enableColors;
    private enableTimestamps;
    private minLevel;
    private isStreaming;
    constructor(options?: StreamingLoggerOptions);
    /**
     * Core logging method
     */
    private log;
    /**
     * Debug level logging (lowest priority)
     */
    debug(message: string, metadata?: Record<string, unknown>): void;
    /**
     * Info level logging (normal messages)
     */
    info(message: string, metadata?: Record<string, unknown>): void;
    /**
     * Success level logging (positive outcomes)
     */
    success(message: string, metadata?: Record<string, unknown>): void;
    /**
     * Warning level logging (non-critical issues)
     */
    warn(message: string, metadata?: Record<string, unknown>): void;
    /**
     * Error level logging (critical issues)
     */
    error(message: string, metadata?: Record<string, unknown>): void;
    /**
     * Print log event to console with formatting
     */
    private printToConsole;
    /**
     * Apply ANSI color codes based on log level
     */
    private colorize;
    /**
     * Get the current log buffer
     */
    getBuffer(): LogEvent[];
    /**
     * Get buffer entries by log level
     */
    getBufferByLevel(level: LogLevel): LogEvent[];
    /**
     * Clear the log buffer
     */
    clearBuffer(): void;
    /**
     * Start streaming logs to console
     */
    startStreaming(): void;
    /**
     * Stop streaming logs to console (buffer only)
     */
    stopStreaming(): void;
    /**
     * Set minimum log level
     */
    setMinLevel(level: LogLevel): void;
    /**
     * Replay buffered logs to console
     */
    replay(): void;
    /**
     * Export buffer as JSON
     */
    exportJSON(): string;
    /**
     * Export buffer as plain text
     */
    exportText(): string;
    /**
     * Create a child logger with prefixed messages
     */
    createChild(prefix: string): ChildLogger;
    /**
     * Get log statistics
     */
    getStats(): {
        total: number;
        byLevel: Record<LogLevel, number>;
        oldestTimestamp?: Date;
        newestTimestamp?: Date;
    };
}
/**
 * Child logger that prefixes all messages
 */
export declare class ChildLogger {
    private parent;
    private prefix;
    constructor(parent: StreamingLogger, prefix: string);
    debug(message: string, metadata?: Record<string, unknown>): void;
    info(message: string, metadata?: Record<string, unknown>): void;
    success(message: string, metadata?: Record<string, unknown>): void;
    warn(message: string, metadata?: Record<string, unknown>): void;
    error(message: string, metadata?: Record<string, unknown>): void;
}
/**
 * Create a progress logger with step tracking
 */
export declare class ProgressLogger {
    private logger;
    private currentStep;
    private totalSteps;
    constructor(logger: StreamingLogger, totalSteps: number);
    step(message: string, metadata?: Record<string, unknown>): void;
    complete(message?: string): void;
    fail(message: string, metadata?: Record<string, unknown>): void;
}
/**
 * Create a spinner logger for long-running operations
 */
export declare class SpinnerLogger {
    private logger;
    private frames;
    private currentFrame;
    private intervalId?;
    private message;
    constructor(logger: StreamingLogger, initialMessage: string);
    start(): void;
    update(message: string): void;
    succeed(message?: string): void;
    fail(message?: string): void;
    stop(): void;
}
//# sourceMappingURL=StreamingLogger.d.ts.map