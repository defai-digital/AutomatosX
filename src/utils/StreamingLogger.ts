// Sprint 2 Day 12: Streaming Logger
// Real-time output streaming for long-running CLI operations

import { EventEmitter } from 'events'

/**
 * Log level severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success'

/**
 * Log event structure
 */
export interface LogEvent {
  level: LogLevel
  message: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

/**
 * Logger configuration options
 */
export interface StreamingLoggerOptions {
  bufferSize?: number
  enableColors?: boolean
  enableTimestamps?: boolean
  minLevel?: LogLevel
}

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 2,
  warn: 3,
  error: 4,
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
export class StreamingLogger extends EventEmitter {
  private buffer: LogEvent[] = []
  private bufferSize: number
  private enableColors: boolean
  private enableTimestamps: boolean
  private minLevel: LogLevel
  private isStreaming: boolean

  constructor(options?: StreamingLoggerOptions) {
    super()
    this.bufferSize = options?.bufferSize ?? 1000
    this.enableColors = options?.enableColors ?? true
    this.enableTimestamps = options?.enableTimestamps ?? true
    this.minLevel = options?.minLevel ?? 'debug'
    this.isStreaming = true
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    // Check log level threshold
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return
    }

    const event: LogEvent = {
      level,
      message,
      timestamp: new Date(),
      metadata,
    }

    // Add to buffer with size limit
    this.buffer.push(event)
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift() // Remove oldest event
    }

    // Emit event for listeners
    this.emit('log', event)
    this.emit(level, event)

    // Print to console if streaming
    if (this.isStreaming) {
      this.printToConsole(event)
    }
  }

  /**
   * Debug level logging (lowest priority)
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata)
  }

  /**
   * Info level logging (normal messages)
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata)
  }

  /**
   * Success level logging (positive outcomes)
   */
  success(message: string, metadata?: Record<string, unknown>): void {
    this.log('success', message, metadata)
  }

  /**
   * Warning level logging (non-critical issues)
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata)
  }

  /**
   * Error level logging (critical issues)
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata)
  }

  /**
   * Print log event to console with formatting
   */
  private printToConsole(event: LogEvent): void {
    const timestamp = this.enableTimestamps
      ? `[${event.timestamp.toISOString()}] `
      : ''

    const levelStr = event.level.toUpperCase().padEnd(7)

    let message = `${timestamp}${levelStr} ${event.message}`

    // Apply ANSI colors
    if (this.enableColors) {
      message = this.colorize(event.level, message)
    }

    // Print to appropriate stream
    if (event.level === 'error') {
      console.error(message)
    } else {
      console.log(message)
    }

    // Print metadata if present
    if (event.metadata) {
      const metadataStr = JSON.stringify(event.metadata, null, 2)
      const indented = metadataStr
        .split('\n')
        .map((line) => '  ' + line)
        .join('\n')

      if (event.level === 'error') {
        console.error(indented)
      } else {
        console.log(indented)
      }
    }
  }

  /**
   * Apply ANSI color codes based on log level
   */
  private colorize(level: LogLevel, message: string): string {
    const colors = {
      debug: '\x1b[90m', // Gray
      info: '\x1b[36m', // Cyan
      success: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
    }
    const reset = '\x1b[0m'

    return `${colors[level]}${message}${reset}`
  }

  /**
   * Get the current log buffer
   */
  getBuffer(): LogEvent[] {
    return [...this.buffer]
  }

  /**
   * Get buffer entries by log level
   */
  getBufferByLevel(level: LogLevel): LogEvent[] {
    return this.buffer.filter((event) => event.level === level)
  }

  /**
   * Clear the log buffer
   */
  clearBuffer(): void {
    this.buffer = []
  }

  /**
   * Start streaming logs to console
   */
  startStreaming(): void {
    this.isStreaming = true
  }

  /**
   * Stop streaming logs to console (buffer only)
   */
  stopStreaming(): void {
    this.isStreaming = false
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level
  }

  /**
   * Replay buffered logs to console
   */
  replay(): void {
    this.buffer.forEach((event) => this.printToConsole(event))
  }

  /**
   * Export buffer as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.buffer, null, 2)
  }

  /**
   * Export buffer as plain text
   */
  exportText(): string {
    return this.buffer
      .map((event) => {
        const timestamp = event.timestamp.toISOString()
        const level = event.level.toUpperCase().padEnd(7)
        const metadata = event.metadata ? ` ${JSON.stringify(event.metadata)}` : ''
        return `[${timestamp}] ${level} ${event.message}${metadata}`
      })
      .join('\n')
  }

  /**
   * Create a child logger with prefixed messages
   */
  createChild(prefix: string): ChildLogger {
    return new ChildLogger(this, prefix)
  }

  /**
   * Get log statistics
   */
  getStats(): {
    total: number
    byLevel: Record<LogLevel, number>
    oldestTimestamp?: Date
    newestTimestamp?: Date
  } {
    const stats: {
      total: number
      byLevel: Record<LogLevel, number>
      oldestTimestamp?: Date
      newestTimestamp?: Date
    } = {
      total: this.buffer.length,
      byLevel: {
        debug: 0,
        info: 0,
        success: 0,
        warn: 0,
        error: 0,
      },
    }

    if (this.buffer.length > 0) {
      stats.oldestTimestamp = this.buffer[0].timestamp
      stats.newestTimestamp = this.buffer[this.buffer.length - 1].timestamp

      this.buffer.forEach((event) => {
        stats.byLevel[event.level]++
      })
    }

    return stats
  }
}

/**
 * Child logger that prefixes all messages
 */
export class ChildLogger {
  constructor(
    private parent: StreamingLogger,
    private prefix: string
  ) {}

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.parent.debug(`[${this.prefix}] ${message}`, metadata)
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.parent.info(`[${this.prefix}] ${message}`, metadata)
  }

  success(message: string, metadata?: Record<string, unknown>): void {
    this.parent.success(`[${this.prefix}] ${message}`, metadata)
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.parent.warn(`[${this.prefix}] ${message}`, metadata)
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.parent.error(`[${this.prefix}] ${message}`, metadata)
  }
}

/**
 * Create a progress logger with step tracking
 */
export class ProgressLogger {
  private currentStep = 0
  private totalSteps: number

  constructor(
    private logger: StreamingLogger,
    totalSteps: number
  ) {
    this.totalSteps = totalSteps
  }

  step(message: string, metadata?: Record<string, unknown>): void {
    this.currentStep++
    const progress = `[${this.currentStep}/${this.totalSteps}]`
    this.logger.info(`${progress} ${message}`, metadata)
  }

  complete(message?: string): void {
    this.logger.success(message || `All ${this.totalSteps} steps completed!`)
  }

  fail(message: string, metadata?: Record<string, unknown>): void {
    this.logger.error(`Failed at step ${this.currentStep}/${this.totalSteps}: ${message}`, metadata)
  }
}

/**
 * Create a spinner logger for long-running operations
 */
export class SpinnerLogger {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  private currentFrame = 0
  private intervalId?: NodeJS.Timeout
  private message: string

  constructor(
    private logger: StreamingLogger,
    initialMessage: string
  ) {
    this.message = initialMessage
  }

  start(): void {
    this.intervalId = setInterval(() => {
      process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.message}`)
      this.currentFrame = (this.currentFrame + 1) % this.frames.length
    }, 80)
  }

  update(message: string): void {
    this.message = message
  }

  succeed(message?: string): void {
    this.stop()
    this.logger.success(message || this.message)
  }

  fail(message?: string): void {
    this.stop()
    this.logger.error(message || this.message)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      process.stdout.write('\r\x1b[K') // Clear line
    }
  }
}
