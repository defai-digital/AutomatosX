/**
 * OpenTelemetry Provider
 * Sprint 5 Day 42: OTLP integration for distributed tracing and metrics
 */

import { EventEmitter } from 'events'

/**
 * Span context
 */
export interface SpanContext {
  traceId: string
  spanId: string
  parentSpanId?: string
}

/**
 * Span
 */
export interface Span {
  name: string
  context: SpanContext
  startTime: number
  endTime?: number
  duration?: number
  attributes: Record<string, any>
  events: SpanEvent[]
  status: 'ok' | 'error'
  error?: Error
}

/**
 * Span event
 */
export interface SpanEvent {
  name: string
  timestamp: number
  attributes?: Record<string, any>
}

/**
 * Metric
 */
export interface Metric {
  name: string
  type: 'counter' | 'gauge' | 'histogram'
  value: number
  timestamp: number
  labels?: Record<string, string>
}

/**
 * OpenTelemetry Configuration
 */
export interface OTelConfig {
  serviceName: string
  serviceVersion?: string
  endpoint?: string
  enabled?: boolean
  sampleRate?: number
}

/**
 * OpenTelemetry Provider
 */
export class OpenTelemetryProvider extends EventEmitter {
  private config: OTelConfig
  private activeSpans = new Map<string, Span>()
  private completedSpans: Span[] = []
  private metrics: Metric[] = []
  private enabled: boolean

  constructor(config: OTelConfig) {
    super()
    this.config = config
    this.enabled = config.enabled ?? true
  }

  /**
   * Start a new span
   */
  startSpan(name: string, attributes?: Record<string, any>): Span {
    if (!this.enabled) {
      return this.createNoOpSpan(name)
    }

    const context: SpanContext = {
      traceId: this.generateId(),
      spanId: this.generateId(),
    }

    const span: Span = {
      name,
      context,
      startTime: Date.now(),
      attributes: attributes || {},
      events: [],
      status: 'ok',
    }

    this.activeSpans.set(context.spanId, span)
    this.emit('span-started', span)

    return span
  }

  /**
   * Start a child span
   */
  startChildSpan(
    parent: Span,
    name: string,
    attributes?: Record<string, any>
  ): Span {
    if (!this.enabled) {
      return this.createNoOpSpan(name)
    }

    const context: SpanContext = {
      traceId: parent.context.traceId,
      spanId: this.generateId(),
      parentSpanId: parent.context.spanId,
    }

    const span: Span = {
      name,
      context,
      startTime: Date.now(),
      attributes: attributes || {},
      events: [],
      status: 'ok',
    }

    this.activeSpans.set(context.spanId, span)
    this.emit('span-started', span)

    return span
  }

  /**
   * End a span
   */
  endSpan(span: Span): void {
    if (!this.enabled) return

    span.endTime = Date.now()
    span.duration = span.endTime - span.startTime

    this.activeSpans.delete(span.context.spanId)
    this.completedSpans.push(span)

    this.emit('span-ended', span)

    // Export if needed
    if (this.config.endpoint) {
      this.exportSpan(span)
    }
  }

  /**
   * Add event to span
   */
  addSpanEvent(span: Span, name: string, attributes?: Record<string, any>): void {
    if (!this.enabled) return

    const event: SpanEvent = {
      name,
      timestamp: Date.now(),
      attributes,
    }

    span.events.push(event)
    this.emit('span-event', { span, event })
  }

  /**
   * Set span attribute
   */
  setSpanAttribute(span: Span, key: string, value: any): void {
    if (!this.enabled) return

    span.attributes[key] = value
  }

  /**
   * Set span status
   */
  setSpanStatus(span: Span, status: 'ok' | 'error', error?: Error): void {
    if (!this.enabled) return

    span.status = status
    if (error) {
      span.error = error
      span.attributes.error = error.message
      span.attributes.errorStack = error.stack
    }
  }

  /**
   * Record metric
   */
  recordMetric(
    name: string,
    type: 'counter' | 'gauge' | 'histogram',
    value: number,
    labels?: Record<string, string>
  ): void {
    if (!this.enabled) return

    const metric: Metric = {
      name,
      type,
      value,
      timestamp: Date.now(),
      labels,
    }

    this.metrics.push(metric)
    this.emit('metric-recorded', metric)

    // Export if needed
    if (this.config.endpoint) {
      this.exportMetric(metric)
    }
  }

  /**
   * Get active spans
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values())
  }

  /**
   * Get completed spans
   */
  getCompletedSpans(): Span[] {
    return [...this.completedSpans]
  }

  /**
   * Get metrics
   */
  getMetrics(): Metric[] {
    return [...this.metrics]
  }

  /**
   * Clear completed spans
   */
  clearCompletedSpans(): void {
    this.completedSpans = []
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = []
  }

  /**
   * Enable telemetry
   */
  enable(): void {
    this.enabled = true
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.enabled = false
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Flush all data
   */
  async flush(): Promise<void> {
    if (!this.config.endpoint) return

    // Export all remaining spans and metrics
    for (const span of this.completedSpans) {
      await this.exportSpan(span)
    }

    for (const metric of this.metrics) {
      await this.exportMetric(metric)
    }

    this.clearCompletedSpans()
    this.clearMetrics()
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
  }

  /**
   * Create no-op span
   */
  private createNoOpSpan(name: string): Span {
    return {
      name,
      context: {
        traceId: '',
        spanId: '',
      },
      startTime: Date.now(),
      attributes: {},
      events: [],
      status: 'ok',
    }
  }

  /**
   * Export span to OTLP endpoint
   */
  private async exportSpan(span: Span): Promise<void> {
    // Mock export - in real implementation would use OTLP exporter
    this.emit('span-exported', span)
  }

  /**
   * Export metric to OTLP endpoint
   */
  private async exportMetric(metric: Metric): Promise<void> {
    // Mock export - in real implementation would use OTLP exporter
    this.emit('metric-exported', metric)
  }

  /**
   * Wrap function with span
   */
  withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    const span = this.startSpan(name, attributes)

    return fn(span)
      .then((result) => {
        this.setSpanStatus(span, 'ok')
        this.endSpan(span)
        return result
      })
      .catch((error) => {
        this.setSpanStatus(span, 'error', error)
        this.endSpan(span)
        throw error
      })
  }
}

/**
 * Create OpenTelemetry provider
 */
export function createOTelProvider(config: OTelConfig): OpenTelemetryProvider {
  return new OpenTelemetryProvider(config)
}

/**
 * Global provider instance
 */
let globalProvider: OpenTelemetryProvider | null = null

/**
 * Get global provider
 */
export function getOTelProvider(): OpenTelemetryProvider {
  if (!globalProvider) {
    globalProvider = createOTelProvider({
      serviceName: 'automatosx',
      enabled: false,
    })
  }
  return globalProvider
}

/**
 * Set global provider
 */
export function setOTelProvider(provider: OpenTelemetryProvider): void {
  globalProvider = provider
}

/**
 * Reset global provider
 */
export function resetOTelProvider(): void {
  globalProvider = null
}
