/**
 * OpenTelemetry Provider
 * Sprint 5 Day 42: OTLP integration for distributed tracing and metrics
 */
import { EventEmitter } from 'events';
/**
 * OpenTelemetry Provider
 */
export class OpenTelemetryProvider extends EventEmitter {
    config;
    activeSpans = new Map();
    completedSpans = [];
    metrics = [];
    enabled;
    constructor(config) {
        super();
        this.config = config;
        this.enabled = config.enabled ?? true;
    }
    /**
     * Start a new span
     */
    startSpan(name, attributes) {
        if (!this.enabled) {
            return this.createNoOpSpan(name);
        }
        const context = {
            traceId: this.generateId(),
            spanId: this.generateId(),
        };
        const span = {
            name,
            context,
            startTime: Date.now(),
            attributes: attributes || {},
            events: [],
            status: 'ok',
        };
        this.activeSpans.set(context.spanId, span);
        this.emit('span-started', span);
        return span;
    }
    /**
     * Start a child span
     */
    startChildSpan(parent, name, attributes) {
        if (!this.enabled) {
            return this.createNoOpSpan(name);
        }
        const context = {
            traceId: parent.context.traceId,
            spanId: this.generateId(),
            parentSpanId: parent.context.spanId,
        };
        const span = {
            name,
            context,
            startTime: Date.now(),
            attributes: attributes || {},
            events: [],
            status: 'ok',
        };
        this.activeSpans.set(context.spanId, span);
        this.emit('span-started', span);
        return span;
    }
    /**
     * End a span
     */
    endSpan(span) {
        if (!this.enabled)
            return;
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        this.activeSpans.delete(span.context.spanId);
        this.completedSpans.push(span);
        this.emit('span-ended', span);
        // Export if needed
        if (this.config.endpoint) {
            this.exportSpan(span);
        }
    }
    /**
     * Add event to span
     */
    addSpanEvent(span, name, attributes) {
        if (!this.enabled)
            return;
        const event = {
            name,
            timestamp: Date.now(),
            attributes,
        };
        span.events.push(event);
        this.emit('span-event', { span, event });
    }
    /**
     * Set span attribute
     */
    setSpanAttribute(span, key, value) {
        if (!this.enabled)
            return;
        span.attributes[key] = value;
    }
    /**
     * Set span status
     */
    setSpanStatus(span, status, error) {
        if (!this.enabled)
            return;
        span.status = status;
        if (error) {
            span.error = error;
            span.attributes.error = error.message;
            span.attributes.errorStack = error.stack;
        }
    }
    /**
     * Record metric
     */
    recordMetric(name, type, value, labels) {
        if (!this.enabled)
            return;
        const metric = {
            name,
            type,
            value,
            timestamp: Date.now(),
            labels,
        };
        this.metrics.push(metric);
        this.emit('metric-recorded', metric);
        // Export if needed
        if (this.config.endpoint) {
            this.exportMetric(metric);
        }
    }
    /**
     * Get active spans
     */
    getActiveSpans() {
        return Array.from(this.activeSpans.values());
    }
    /**
     * Get completed spans
     */
    getCompletedSpans() {
        return [...this.completedSpans];
    }
    /**
     * Get metrics
     */
    getMetrics() {
        return [...this.metrics];
    }
    /**
     * Clear completed spans
     */
    clearCompletedSpans() {
        this.completedSpans = [];
    }
    /**
     * Clear metrics
     */
    clearMetrics() {
        this.metrics = [];
    }
    /**
     * Enable telemetry
     */
    enable() {
        this.enabled = true;
    }
    /**
     * Disable telemetry
     */
    disable() {
        this.enabled = false;
    }
    /**
     * Check if enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Flush all data
     */
    async flush() {
        if (!this.config.endpoint)
            return;
        // Export all remaining spans and metrics
        for (const span of this.completedSpans) {
            await this.exportSpan(span);
        }
        for (const metric of this.metrics) {
            await this.exportMetric(metric);
        }
        this.clearCompletedSpans();
        this.clearMetrics();
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }
    /**
     * Create no-op span
     */
    createNoOpSpan(name) {
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
        };
    }
    /**
     * Export span to OTLP endpoint
     */
    async exportSpan(span) {
        // Mock export - in real implementation would use OTLP exporter
        this.emit('span-exported', span);
    }
    /**
     * Export metric to OTLP endpoint
     */
    async exportMetric(metric) {
        // Mock export - in real implementation would use OTLP exporter
        this.emit('metric-exported', metric);
    }
    /**
     * Wrap function with span
     */
    withSpan(name, fn, attributes) {
        const span = this.startSpan(name, attributes);
        return fn(span)
            .then((result) => {
            this.setSpanStatus(span, 'ok');
            this.endSpan(span);
            return result;
        })
            .catch((error) => {
            this.setSpanStatus(span, 'error', error);
            this.endSpan(span);
            throw error;
        });
    }
}
/**
 * Create OpenTelemetry provider
 */
export function createOTelProvider(config) {
    return new OpenTelemetryProvider(config);
}
/**
 * Global provider instance
 */
let globalProvider = null;
/**
 * Get global provider
 */
export function getOTelProvider() {
    if (!globalProvider) {
        globalProvider = createOTelProvider({
            serviceName: 'automatosx',
            enabled: false,
        });
    }
    return globalProvider;
}
/**
 * Set global provider
 */
export function setOTelProvider(provider) {
    globalProvider = provider;
}
/**
 * Reset global provider
 */
export function resetOTelProvider() {
    globalProvider = null;
}
//# sourceMappingURL=OpenTelemetryProvider.js.map