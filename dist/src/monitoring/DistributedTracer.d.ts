/**
 * DistributedTracer.ts
 *
 * Distributed tracing for workflow execution paths
 * Phase 6 Week 2: Advanced Monitoring & Observability
 */
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { Trace, SpanKind, SpanStatus } from '../types/monitoring.types.js';
/**
 * DistributedTracer - Distributed tracing for workflow execution
 *
 * Features:
 * - Trace workflow execution paths
 * - Create hierarchical spans (parent-child relationships)
 * - Record span events and attributes
 * - Sampling support to reduce overhead
 * - Query traces by execution ID
 * - Performance analysis with span durations
 */
export declare class DistributedTracer extends EventEmitter {
    private db;
    private activeSpans;
    private samplingRate;
    constructor(db?: Database.Database, samplingRate?: number);
    /**
     * Initialize tracing schema
     */
    private initializeSchema;
    /**
     * Start a new trace
     */
    startTrace(workflowExecutionId: string): string;
    /**
     * Complete a trace
     */
    completeTrace(traceId: string): void;
    /**
     * Get trace by ID
     */
    getTrace(traceId: string): Trace | null;
    /**
     * Get traces by workflow execution ID
     */
    getTracesByExecution(workflowExecutionId: string): Trace[];
    /**
     * Start a new span
     */
    startSpan(traceId: string, name: string, kind: SpanKind, options?: {
        parentSpanId?: string;
        attributes?: Record<string, unknown>;
    }): string;
    /**
     * Complete a span
     */
    completeSpan(spanId: string, status?: SpanStatus): void;
    /**
     * Add event to span
     */
    addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void;
    /**
     * Set span attributes
     */
    setSpanAttributes(spanId: string, attributes: Record<string, unknown>): void;
    /**
     * Set span status
     */
    setSpanStatus(spanId: string, status: SpanStatus): void;
    /**
     * Should this trace be sampled?
     */
    private shouldSample;
    /**
     * Set sampling rate (0.0 to 1.0)
     */
    setSamplingRate(rate: number): void;
    /**
     * Get sampling rate
     */
    getSamplingRate(): number;
    /**
     * Cleanup old traces
     */
    cleanup(retentionDays?: number): Promise<number>;
    /**
     * Get trace statistics
     */
    getTraceStats(): {
        totalTraces: number;
        totalSpans: number;
        avgSpansPerTrace: number;
        avgTraceDuration: number;
    };
}
//# sourceMappingURL=DistributedTracer.d.ts.map