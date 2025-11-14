// Sprint 2 Day 15: Spinner Logger
// Visual progress indicators for CLI operations

import { EventEmitter } from 'events'

/**
 * Spinner frame types
 */
export type SpinnerType = 'dots' | 'line' | 'arrow' | 'circle' | 'box'

/**
 * Spinner frames for different types
 */
const SPINNER_FRAMES: Record<SpinnerType, string[]> = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['|', '/', '-', '\\'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  circle: ['◴', '◷', '◶', '◵'],
  box: ['◰', '◳', '◲', '◱'],
}

/**
 * Spinner state
 */
export type SpinnerState = 'spinning' | 'success' | 'error' | 'warning' | 'info' | 'stopped'

/**
 * Spinner options
 */
export interface SpinnerOptions {
  type?: SpinnerType
  text?: string
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'
  interval?: number
  stream?: NodeJS.WriteStream
}

/**
 * Spinner state symbols
 */
const STATE_SYMBOLS: Record<Exclude<SpinnerState, 'spinning' | 'stopped'>, string> = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
}

/**
 * ANSI color codes
 */
const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
}

/**
 * Spinner Logger
 *
 * Visual progress indicator for CLI operations
 *
 * @example
 * ```typescript
 * const spinner = new SpinnerLogger({ text: 'Loading...', type: 'dots' })
 *
 * spinner.start()
 * await doWork()
 * spinner.success('Complete!')
 * ```
 */
export class SpinnerLogger extends EventEmitter {
  private type: SpinnerType
  private text: string
  private color: string
  private interval: number
  private stream: NodeJS.WriteStream
  private frameIndex: number
  private timer: NodeJS.Timeout | null
  private state: SpinnerState
  private isEnabled: boolean

  constructor(options: SpinnerOptions = {}) {
    super()
    this.type = options.type || 'dots'
    this.text = options.text || ''
    this.color = COLORS[options.color || 'cyan']
    this.interval = options.interval || 80
    this.stream = options.stream || process.stderr
    this.frameIndex = 0
    this.timer = null
    this.state = 'stopped'
    this.isEnabled = this.stream.isTTY ?? false
  }

  /**
   * Start the spinner
   */
  start(text?: string): this {
    if (text) {
      this.text = text
    }

    if (!this.isEnabled) {
      // Non-TTY: just print the message
      this.stream.write(`${this.text}\n`)
      return this
    }

    this.state = 'spinning'
    this.frameIndex = 0

    // Hide cursor
    this.stream.write('\x1b[?25l')

    this.timer = setInterval(() => {
      this.render()
      this.frameIndex = (this.frameIndex + 1) % this.getFrames().length
    }, this.interval)

    this.render()
    this.emit('start', { text: this.text })

    return this
  }

  /**
   * Stop the spinner
   */
  stop(): this {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    this.state = 'stopped'

    if (this.isEnabled) {
      // Show cursor
      this.stream.write('\x1b[?25h')
      // Clear line
      this.stream.write('\r\x1b[K')
    }

    this.emit('stop')

    return this
  }

  /**
   * Stop with success
   */
  success(text?: string): this {
    this.stop()
    this.state = 'success'

    const message = text || this.text
    const symbol = STATE_SYMBOLS.success

    if (this.isEnabled) {
      this.stream.write(`${COLORS.green}${symbol}${COLORS.reset} ${message}\n`)
    } else {
      this.stream.write(`${symbol} ${message}\n`)
    }

    this.emit('success', { text: message })

    return this
  }

  /**
   * Stop with error
   */
  error(text?: string): this {
    this.stop()
    this.state = 'error'

    const message = text || this.text
    const symbol = STATE_SYMBOLS.error

    if (this.isEnabled) {
      this.stream.write(`${COLORS.red}${symbol}${COLORS.reset} ${message}\n`)
    } else {
      this.stream.write(`${symbol} ${message}\n`)
    }

    this.emit('error', { text: message })

    return this
  }

  /**
   * Stop with warning
   */
  warn(text?: string): this {
    this.stop()
    this.state = 'warning'

    const message = text || this.text
    const symbol = STATE_SYMBOLS.warning

    if (this.isEnabled) {
      this.stream.write(`${COLORS.yellow}${symbol}${COLORS.reset} ${message}\n`)
    } else {
      this.stream.write(`${symbol} ${message}\n`)
    }

    this.emit('warning', { text: message })

    return this
  }

  /**
   * Stop with info
   */
  info(text?: string): this {
    this.stop()
    this.state = 'info'

    const message = text || this.text
    const symbol = STATE_SYMBOLS.info

    if (this.isEnabled) {
      this.stream.write(`${COLORS.blue}${symbol}${COLORS.reset} ${message}\n`)
    } else {
      this.stream.write(`${symbol} ${message}\n`)
    }

    this.emit('info', { text: message })

    return this
  }

  /**
   * Update spinner text
   */
  updateText(text: string): this {
    this.text = text
    if (this.state === 'spinning') {
      this.render()
    }
    return this
  }

  /**
   * Change spinner type
   */
  setType(type: SpinnerType): this {
    this.type = type
    this.frameIndex = 0
    return this
  }

  /**
   * Change spinner color
   */
  setColor(color: 'green' | 'red' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'): this {
    this.color = COLORS[color]
    return this
  }

  /**
   * Check if spinning
   */
  isSpinning(): boolean {
    return this.state === 'spinning'
  }

  /**
   * Get current state
   */
  getState(): SpinnerState {
    return this.state
  }

  /**
   * Render current frame
   */
  private render(): void {
    if (!this.isEnabled || this.state !== 'spinning') {
      return
    }

    const frames = this.getFrames()
    const frame = frames[this.frameIndex]
    const line = `${this.color}${frame}${COLORS.reset} ${this.text}`

    // Clear line and write
    this.stream.write(`\r\x1b[K${line}`)
  }

  /**
   * Get frames for current type
   */
  private getFrames(): string[] {
    return SPINNER_FRAMES[this.type]
  }
}

/**
 * Multi-step progress tracker
 */
export interface ProgressStep {
  name: string
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped'
  message?: string
}

/**
 * Progress tracker for multi-step operations
 *
 * @example
 * ```typescript
 * const progress = new ProgressTracker([
 *   { name: 'Validate input', status: 'pending' },
 *   { name: 'Process data', status: 'pending' },
 *   { name: 'Save results', status: 'pending' },
 * ])
 *
 * progress.start('Validate input')
 * await validate()
 * progress.complete('Validate input', 'Input valid')
 *
 * progress.start('Process data')
 * await process()
 * progress.complete('Process data', 'Processed 100 items')
 * ```
 */
export class ProgressTracker extends EventEmitter {
  private steps: Map<string, ProgressStep>
  private currentStep: string | null
  private spinner: SpinnerLogger | null
  private stream: NodeJS.WriteStream

  constructor(steps: ProgressStep[], stream?: NodeJS.WriteStream) {
    super()
    this.steps = new Map(steps.map(step => [step.name, step]))
    this.currentStep = null
    this.spinner = null
    this.stream = stream || process.stderr
  }

  /**
   * Start a step
   */
  start(stepName: string, message?: string): this {
    const step = this.steps.get(stepName)
    if (!step) {
      throw new Error(`Step not found: ${stepName}`)
    }

    // Complete previous step if any
    if (this.currentStep && this.spinner) {
      this.spinner.stop()
    }

    step.status = 'running'
    step.message = message

    this.currentStep = stepName
    this.spinner = new SpinnerLogger({
      text: message || stepName,
      type: 'dots',
      stream: this.stream,
    })

    this.spinner.start()
    this.emit('step-start', { step: stepName, message })

    return this
  }

  /**
   * Complete current step with success
   */
  complete(stepName: string, message?: string): this {
    const step = this.steps.get(stepName)
    if (!step) {
      throw new Error(`Step not found: ${stepName}`)
    }

    if (this.spinner && this.currentStep === stepName) {
      this.spinner.success(message || step.message || stepName)
      this.spinner = null
    }

    step.status = 'success'
    step.message = message || step.message

    this.emit('step-complete', { step: stepName, message })

    return this
  }

  /**
   * Fail current step
   */
  fail(stepName: string, message?: string): this {
    const step = this.steps.get(stepName)
    if (!step) {
      throw new Error(`Step not found: ${stepName}`)
    }

    if (this.spinner && this.currentStep === stepName) {
      this.spinner.error(message || step.message || stepName)
      this.spinner = null
    }

    step.status = 'error'
    step.message = message || step.message

    this.emit('step-fail', { step: stepName, message })

    return this
  }

  /**
   * Skip a step
   */
  skip(stepName: string, message?: string): this {
    const step = this.steps.get(stepName)
    if (!step) {
      throw new Error(`Step not found: ${stepName}`)
    }

    step.status = 'skipped'
    step.message = message || step.message

    this.emit('step-skip', { step: stepName, message })

    return this
  }

  /**
   * Update current step message
   */
  updateMessage(message: string): this {
    if (this.spinner) {
      this.spinner.updateText(message)
    }

    if (this.currentStep) {
      const step = this.steps.get(this.currentStep)
      if (step) {
        step.message = message
      }
    }

    return this
  }

  /**
   * Get all steps
   */
  getSteps(): ProgressStep[] {
    return Array.from(this.steps.values())
  }

  /**
   * Get step by name
   */
  getStep(name: string): ProgressStep | undefined {
    return this.steps.get(name)
  }

  /**
   * Check if all steps complete
   */
  isComplete(): boolean {
    return Array.from(this.steps.values()).every(
      step => step.status === 'success' || step.status === 'skipped'
    )
  }

  /**
   * Check if any step failed
   */
  hasFailed(): boolean {
    return Array.from(this.steps.values()).some(step => step.status === 'error')
  }

  /**
   * Get completion percentage
   */
  getProgress(): number {
    const total = this.steps.size
    const completed = Array.from(this.steps.values()).filter(
      step => step.status === 'success' || step.status === 'error' || step.status === 'skipped'
    ).length

    return total > 0 ? (completed / total) * 100 : 0
  }

  /**
   * Stop all spinners
   */
  stopAll(): this {
    if (this.spinner) {
      this.spinner.stop()
      this.spinner = null
    }

    return this
  }
}
