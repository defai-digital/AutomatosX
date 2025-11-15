// Sprint 2 Day 12: Streaming Logger
// Real-time output streaming for long-running CLI operations
import { EventEmitter } from 'events';
/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    success: 2,
    warn: 3,
    error: 4,
};
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
export class StreamingLogger extends EventEmitter {
    buffer = [];
    bufferSize;
    enableColors;
    enableTimestamps;
    minLevel;
    isStreaming;
    constructor(options) {
        super();
        this.bufferSize = options?.bufferSize ?? 1000;
        this.enableColors = options?.enableColors ?? true;
        this.enableTimestamps = options?.enableTimestamps ?? true;
        this.minLevel = options?.minLevel ?? 'debug';
        this.isStreaming = true;
    }
    /**
     * Core logging method
     */
    log(level, message, metadata) {
        // Check log level threshold
        if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
            return;
        }
        const event = {
            level,
            message,
            timestamp: new Date(),
            metadata,
        };
        // Add to buffer with size limit
        this.buffer.push(event);
        if (this.buffer.length > this.bufferSize) {
            this.buffer.shift(); // Remove oldest event
        }
        // Emit event for listeners
        this.emit('log', event);
        this.emit(level, event);
        // Print to console if streaming
        if (this.isStreaming) {
            this.printToConsole(event);
        }
    }
    /**
     * Debug level logging (lowest priority)
     */
    debug(message, metadata) {
        this.log('debug', message, metadata);
    }
    /**
     * Info level logging (normal messages)
     */
    info(message, metadata) {
        this.log('info', message, metadata);
    }
    /**
     * Success level logging (positive outcomes)
     */
    success(message, metadata) {
        this.log('success', message, metadata);
    }
    /**
     * Warning level logging (non-critical issues)
     */
    warn(message, metadata) {
        this.log('warn', message, metadata);
    }
    /**
     * Error level logging (critical issues)
     */
    error(message, metadata) {
        this.log('error', message, metadata);
    }
    /**
     * Print log event to console with formatting
     */
    printToConsole(event) {
        const timestamp = this.enableTimestamps
            ? `[${event.timestamp.toISOString()}] `
            : '';
        const levelStr = event.level.toUpperCase().padEnd(7);
        let message = `${timestamp}${levelStr} ${event.message}`;
        // Apply ANSI colors
        if (this.enableColors) {
            message = this.colorize(event.level, message);
        }
        // Print to appropriate stream
        if (event.level === 'error') {
            console.error(message);
        }
        else {
            console.log(message);
        }
        // Print metadata if present
        if (event.metadata) {
            const metadataStr = JSON.stringify(event.metadata, null, 2);
            const indented = metadataStr
                .split('\n')
                .map((line) => '  ' + line)
                .join('\n');
            if (event.level === 'error') {
                console.error(indented);
            }
            else {
                console.log(indented);
            }
        }
    }
    /**
     * Apply ANSI color codes based on log level
     */
    colorize(level, message) {
        const colors = {
            debug: '\x1b[90m', // Gray
            info: '\x1b[36m', // Cyan
            success: '\x1b[32m', // Green
            warn: '\x1b[33m', // Yellow
            error: '\x1b[31m', // Red
        };
        const reset = '\x1b[0m';
        return `${colors[level]}${message}${reset}`;
    }
    /**
     * Get the current log buffer
     */
    getBuffer() {
        return [...this.buffer];
    }
    /**
     * Get buffer entries by log level
     */
    getBufferByLevel(level) {
        return this.buffer.filter((event) => event.level === level);
    }
    /**
     * Clear the log buffer
     */
    clearBuffer() {
        this.buffer = [];
    }
    /**
     * Start streaming logs to console
     */
    startStreaming() {
        this.isStreaming = true;
    }
    /**
     * Stop streaming logs to console (buffer only)
     */
    stopStreaming() {
        this.isStreaming = false;
    }
    /**
     * Set minimum log level
     */
    setMinLevel(level) {
        this.minLevel = level;
    }
    /**
     * Replay buffered logs to console
     */
    replay() {
        this.buffer.forEach((event) => this.printToConsole(event));
    }
    /**
     * Export buffer as JSON
     */
    exportJSON() {
        return JSON.stringify(this.buffer, null, 2);
    }
    /**
     * Export buffer as plain text
     */
    exportText() {
        return this.buffer
            .map((event) => {
            const timestamp = event.timestamp.toISOString();
            const level = event.level.toUpperCase().padEnd(7);
            const metadata = event.metadata ? ` ${JSON.stringify(event.metadata)}` : '';
            return `[${timestamp}] ${level} ${event.message}${metadata}`;
        })
            .join('\n');
    }
    /**
     * Create a child logger with prefixed messages
     */
    createChild(prefix) {
        return new ChildLogger(this, prefix);
    }
    /**
     * Get log statistics
     */
    getStats() {
        const stats = {
            total: this.buffer.length,
            byLevel: {
                debug: 0,
                info: 0,
                success: 0,
                warn: 0,
                error: 0,
            },
        };
        if (this.buffer.length > 0) {
            stats.oldestTimestamp = this.buffer[0].timestamp;
            stats.newestTimestamp = this.buffer[this.buffer.length - 1].timestamp;
            this.buffer.forEach((event) => {
                stats.byLevel[event.level]++;
            });
        }
        return stats;
    }
}
/**
 * Child logger that prefixes all messages
 */
export class ChildLogger {
    parent;
    prefix;
    constructor(parent, prefix) {
        this.parent = parent;
        this.prefix = prefix;
    }
    debug(message, metadata) {
        this.parent.debug(`[${this.prefix}] ${message}`, metadata);
    }
    info(message, metadata) {
        this.parent.info(`[${this.prefix}] ${message}`, metadata);
    }
    success(message, metadata) {
        this.parent.success(`[${this.prefix}] ${message}`, metadata);
    }
    warn(message, metadata) {
        this.parent.warn(`[${this.prefix}] ${message}`, metadata);
    }
    error(message, metadata) {
        this.parent.error(`[${this.prefix}] ${message}`, metadata);
    }
}
/**
 * Create a progress logger with step tracking
 */
export class ProgressLogger {
    logger;
    currentStep = 0;
    totalSteps;
    constructor(logger, totalSteps) {
        this.logger = logger;
        this.totalSteps = totalSteps;
    }
    step(message, metadata) {
        this.currentStep++;
        const progress = `[${this.currentStep}/${this.totalSteps}]`;
        this.logger.info(`${progress} ${message}`, metadata);
    }
    complete(message) {
        this.logger.success(message || `All ${this.totalSteps} steps completed!`);
    }
    fail(message, metadata) {
        this.logger.error(`Failed at step ${this.currentStep}/${this.totalSteps}: ${message}`, metadata);
    }
}
/**
 * Create a spinner logger for long-running operations
 */
export class SpinnerLogger {
    logger;
    frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    currentFrame = 0;
    intervalId;
    message;
    constructor(logger, initialMessage) {
        this.logger = logger;
        this.message = initialMessage;
    }
    start() {
        this.intervalId = setInterval(() => {
            process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.message}`);
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }, 80);
    }
    update(message) {
        this.message = message;
    }
    succeed(message) {
        this.stop();
        this.logger.success(message || this.message);
    }
    fail(message) {
        this.stop();
        this.logger.error(message || this.message);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            process.stdout.write('\r\x1b[K'); // Clear line
        }
    }
}
//# sourceMappingURL=StreamingLogger.js.map