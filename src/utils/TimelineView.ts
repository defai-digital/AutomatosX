// Sprint 2 Day 18: CLI Progress Timeline View
// Visual timeline for tracking multi-step operations

import { EventEmitter } from 'events'

/**
 * Timeline entry
 */
export interface TimelineEntry {
  id: string
  label: string
  startTime: number
  endTime?: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  duration?: number
  metadata?: Record<string, unknown>
  children?: TimelineEntry[]
}

/**
 * Timeline options
 */
export interface TimelineOptions {
  showDuration?: boolean
  showTimestamps?: boolean
  showProgress?: boolean
  maxWidth?: number
  enableColors?: boolean
  stream?: NodeJS.WriteStream
}

/**
 * Timeline View
 *
 * Visualizes operation progress as a timeline
 *
 * @example
 * ```typescript
 * const timeline = new TimelineView({
 *   showDuration: true,
 *   showProgress: true
 * })
 *
 * const taskId = timeline.start('Indexing codebase')
 * const subTask1 = timeline.start('Parsing files', taskId)
 * timeline.complete(subTask1, 'Parsed 100 files')
 * const subTask2 = timeline.start('Building index', taskId)
 * timeline.complete(subTask2, 'Index built')
 * timeline.complete(taskId, 'Indexing complete')
 *
 * timeline.render()
 * ```
 */
export class TimelineView extends EventEmitter {
  private entries: Map<string, TimelineEntry>
  private options: Required<TimelineOptions>
  private rootEntries: string[]
  private startTimestamp: number

  constructor(options: TimelineOptions = {}) {
    super()
    this.entries = new Map()
    this.options = {
      showDuration: options.showDuration ?? true,
      showTimestamps: options.showTimestamps ?? false,
      showProgress: options.showProgress ?? true,
      maxWidth: options.maxWidth || 80,
      enableColors: options.enableColors ?? true,
      stream: options.stream || process.stderr,
    }
    this.rootEntries = []
    this.startTimestamp = Date.now()
  }

  /**
   * Start a timeline entry
   */
  start(label: string, parentId?: string, metadata?: Record<string, unknown>): string {
    const id = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const entry: TimelineEntry = {
      id,
      label,
      startTime: Date.now(),
      status: 'running',
      metadata,
    }

    this.entries.set(id, entry)

    if (parentId) {
      const parent = this.entries.get(parentId)
      if (parent) {
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(entry)
      }
    } else {
      this.rootEntries.push(id)
    }

    this.emit('entry-started', { id, label })
    return id
  }

  /**
   * Complete a timeline entry
   */
  complete(id: string, message?: string): void {
    const entry = this.entries.get(id)
    if (!entry) return

    entry.endTime = Date.now()
    entry.duration = entry.endTime - entry.startTime
    entry.status = 'completed'

    if (message) {
      entry.label = message
    }

    this.emit('entry-completed', { id, duration: entry.duration })
  }

  /**
   * Fail a timeline entry
   */
  fail(id: string, error?: string): void {
    const entry = this.entries.get(id)
    if (!entry) return

    entry.endTime = Date.now()
    entry.duration = entry.endTime - entry.startTime
    entry.status = 'failed'

    if (error) {
      entry.metadata = { ...entry.metadata, error }
    }

    this.emit('entry-failed', { id, error })
  }

  /**
   * Skip a timeline entry
   */
  skip(id: string, reason?: string): void {
    const entry = this.entries.get(id)
    if (!entry) return

    entry.endTime = entry.startTime
    entry.duration = 0
    entry.status = 'skipped'

    if (reason) {
      entry.metadata = { ...entry.metadata, reason }
    }

    this.emit('entry-skipped', { id, reason })
  }

  /**
   * Update entry label
   */
  updateLabel(id: string, label: string): void {
    const entry = this.entries.get(id)
    if (entry) {
      entry.label = label
    }
  }

  /**
   * Render timeline to console
   */
  render(): void {
    const output = this.generateOutput()
    this.options.stream.write(output)
  }

  /**
   * Get timeline as string
   */
  toString(): string {
    return this.generateOutput()
  }

  /**
   * Generate timeline output
   */
  private generateOutput(): string {
    const lines: string[] = []

    // Header
    lines.push(this.colorize('\n╔═══════════════════════════════════════════╗', 'cyan'))
    lines.push(this.colorize('║          Operation Timeline               ║', 'cyan'))
    lines.push(this.colorize('╚═══════════════════════════════════════════╝\n', 'cyan'))

    // Render root entries
    for (const rootId of this.rootEntries) {
      const entry = this.entries.get(rootId)
      if (entry) {
        this.renderEntry(entry, 0, lines)
      }
    }

    // Summary
    if (this.options.showDuration) {
      const totalDuration = Date.now() - this.startTimestamp
      lines.push('')
      lines.push(
        this.colorize(
          `Total Duration: ${this.formatDuration(totalDuration)}`,
          'cyan'
        )
      )
    }

    return lines.join('\n') + '\n'
  }

  /**
   * Render single entry
   */
  private renderEntry(entry: TimelineEntry, depth: number, lines: string[]): void {
    const indent = '  '.repeat(depth)
    const symbol = this.getStatusSymbol(entry.status)
    const label = entry.label

    let line = `${indent}${symbol} ${label}`

    // Add duration
    if (this.options.showDuration && entry.duration !== undefined) {
      line += this.colorize(` (${this.formatDuration(entry.duration)})`, 'gray')
    }

    // Add timestamp
    if (this.options.showTimestamps && entry.startTime) {
      const elapsed = entry.startTime - this.startTimestamp
      line += this.colorize(` [+${this.formatDuration(elapsed)}]`, 'gray')
    }

    lines.push(line)

    // Render children
    if (entry.children && entry.children.length > 0) {
      for (const child of entry.children) {
        this.renderEntry(child, depth + 1, lines)
      }
    }
  }

  /**
   * Get status symbol
   */
  private getStatusSymbol(status: TimelineEntry['status']): string {
    const symbols = {
      pending: this.colorize('○', 'gray'),
      running: this.colorize('⏵', 'yellow'),
      completed: this.colorize('✓', 'green'),
      failed: this.colorize('✗', 'red'),
      skipped: this.colorize('⊘', 'gray'),
    }

    return symbols[status]
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`
    } else {
      const minutes = Math.floor(ms / 60000)
      const seconds = Math.floor((ms % 60000) / 1000)
      return `${minutes}m ${seconds}s`
    }
  }

  /**
   * Colorize text
   */
  private colorize(text: string, color: string): string {
    if (!this.options.enableColors) {
      return text
    }

    const colors: Record<string, string> = {
      gray: '\x1b[90m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      reset: '\x1b[0m',
    }

    return `${colors[color] || ''}${text}${colors.reset}`
  }

  /**
   * Get all entries
   */
  getEntries(): TimelineEntry[] {
    return Array.from(this.entries.values())
  }

  /**
   * Get entry by ID
   */
  getEntry(id: string): TimelineEntry | undefined {
    return this.entries.get(id)
  }

  /**
   * Get completed entries
   */
  getCompletedEntries(): TimelineEntry[] {
    return Array.from(this.entries.values()).filter(e => e.status === 'completed')
  }

  /**
   * Get failed entries
   */
  getFailedEntries(): TimelineEntry[] {
    return Array.from(this.entries.values()).filter(e => e.status === 'failed')
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number
    completed: number
    failed: number
    skipped: number
    running: number
    totalDuration: number
    averageDuration: number
  } {
    const entries = Array.from(this.entries.values())
    const completed = entries.filter(e => e.status === 'completed')
    const failed = entries.filter(e => e.status === 'failed')
    const skipped = entries.filter(e => e.status === 'skipped')
    const running = entries.filter(e => e.status === 'running')

    const completedDurations = completed
      .filter(e => e.duration !== undefined)
      .map(e => e.duration!)

    const totalDuration =
      completedDurations.length > 0
        ? completedDurations.reduce((a, b) => a + b, 0)
        : 0

    const averageDuration =
      completedDurations.length > 0
        ? totalDuration / completedDurations.length
        : 0

    return {
      total: entries.length,
      completed: completed.length,
      failed: failed.length,
      skipped: skipped.length,
      running: running.length,
      totalDuration,
      averageDuration,
    }
  }

  /**
   * Clear timeline
   */
  clear(): void {
    this.entries.clear()
    this.rootEntries = []
    this.startTimestamp = Date.now()
  }

  /**
   * Export timeline as JSON
   */
  export(): string {
    const data = {
      startTimestamp: this.startTimestamp,
      entries: Array.from(this.entries.values()),
      rootEntries: this.rootEntries,
      stats: this.getStats(),
    }

    return JSON.stringify(data, null, 2)
  }
}

/**
 * Create timeline with auto-render
 */
export function createAutoRenderTimeline(
  options: TimelineOptions = {}
): TimelineView {
  const timeline = new TimelineView(options)

  // Auto-render on entry completion
  timeline.on('entry-completed', () => {
    if (options.showProgress) {
      timeline.render()
    }
  })

  timeline.on('entry-failed', () => {
    if (options.showProgress) {
      timeline.render()
    }
  })

  return timeline
}
