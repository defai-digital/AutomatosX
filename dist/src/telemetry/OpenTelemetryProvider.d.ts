/**
 * OpenTelemetry Provider
 * Sprint 5 Day 42: OTLP integration for distributed tracing and metrics
 */
import { EventEmitter } from 'events';
/**
 * Span context
 */
export interface SpanContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
}
/**
 * Span
 */
export interface Span {
    name: string;
    context: SpanContext;
    startTime: number;
    endTime?: number;
    duration?: number;
    attributes: Record<string, any>;
    events: SpanEvent[];
    status: 'ok' | 'error';
    error?: Error;
}
/**
 * Span event
 */
export interface SpanEvent {
    name: string;
    timestamp: number;
    attributes?: Record<string, any>;
}
/**
 * Metric
 */
export interface Metric {
    name: string;
    type: 'counter' | 'gauge' | 'histogram';
    value: number;
    timestamp: number;
    labels?: Record<string, string>;
}
/**
 * OpenTelemetry Configuration
 */
export interface OTelConfig {
    serviceName: string;
    serviceVersion?: string;
    endpoint?: string;
    enabled?: boolean;
    sampleRate?: number;
}
/**
 * OpenTelemetry Provider
 */
export declare class OpenTelemetryProvider extends EventEmitter {
    private config;
    private activeSpans;
    private completedSpans;
    private metrics;
    private enabled;
    constructor(config: OTelConfig);
    /**
     * Start a new span
     */
    startSpan(name: string, attributes?: Record<string, any>): Span;
    /**
     * Start a child span
     */
    startChildSpan(parent: Span, name: string, attributes?: Record<string, any>): Span;
    /**
     * End a span
     */
    endSpan(span: Span): void;
    /**
     * Add event to span
     */
    addSpanEvent(span: Span, name: string, attributes?: Record<string, any>): void;
    /**
     * Set span attribute
     */
    setSpanAttribute(span: Span, key: string, value: any): void;
    /**
     * Set span status
     */
    setSpanStatus(span: Span, status: 'ok' | 'error', error?: Error): void;
    /**
     * Record metric
     */
    recordMetric(name: string, type: 'counter' | 'gauge' | 'histogram', value: number, labels?: Record<string, string>): void;
    /**
     * Get active spans
     */
    getActiveSpans(): Span[];
    /**
     * Get completed spans
     */
    getCompletedSpans(): Span[];
    /**
     * Get metrics
     */
    getMetrics(): Metric[];
    /**
     * Clear completed spans
     */
    clearCompletedSpans(): void;
    /**
     * Clear metrics
     */
    clearMetrics(): void;
    /**
     * Enable telemetry
     */
    enable(): void;
    /**
     * Disable telemetry
     */
    disable(): void;
    /**
     * Check if enabled
     */
    isEnabled(): boolean;
    /**
     * Flush all data
     */
    flush(): Promise<void>;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Create no-op span
     */
    private createNoOpSpan;
    /**
     * Export span to OTLP endpoint
     */
    private exportSpan;
    /**
     * Export metric to OTLP endpoint
     */
    private exportMetric;
    /**
     * Wrap function with span
     */
    withSpan<T>(name: string, fn: (span: Span) => Promise<T>, attributes?: Record<string, any>): Promise<T>;
}
/**
 * Create OpenTelemetry provider
 */
export declare function createOTelProvider(config: OTelConfig): OpenTelemetryProvider;
/**
 * Get global provider
 */
export declare function getOTelProvider(): OpenTelemetryProvider;
/**
 * Set global provider
 */
export declare function setOTelProvider(provider: OpenTelemetryProvider): void;
/**
 * Reset global provider
 */
export declare function resetOTelProvider(): void;
//# sourceMappingURL=OpenTelemetryProvider.d.ts.map