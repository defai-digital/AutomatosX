import {
  createTraceEvent,
  createTrace,
  type TraceEventType,
} from '@defai.digital/contracts';
import type {
  TraceWriter,
  ActiveTrace,
  TraceOptions,
  EventOptions,
} from './types.js';
import { TraceErrorCodes } from './types.js';

/**
 * Maximum number of active traces to track
 * INV-TR-007: Active traces map is bounded to prevent memory leaks
 */
const MAX_ACTIVE_TRACES = 1000;

/**
 * Default trace TTL (1 hour)
 * INV-TR-008: Stale traces are automatically cleaned up
 */
const TRACE_TTL_MS = 60 * 60 * 1000;

/**
 * Error thrown by trace recorder
 */
export class TraceRecorderError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'TraceRecorderError';
  }
}

/**
 * Trace recorder for capturing execution traces
 *
 * Invariants enforced:
 * - INV-TR-001: Complete event chain (run.start → ... → run.end)
 * - INV-TR-002: Strict event ordering via sequence numbers
 * - INV-TR-003: Full decision replay - all events captured
 * - INV-TR-004: Trace isolation - each trace is independent
 * - INV-TR-005: Error traceability - errors captured with context
 */
export class TraceRecorder {
  private readonly writer: TraceWriter;
  private activeTraces = new Map<string, ActiveTrace>();

  constructor(writer: TraceWriter) {
    this.writer = writer;
  }

  /**
   * Evict stale traces that have been running longer than TTL
   * INV-TR-008: Automatic cleanup of stale traces
   * INV-TR-009: Collect keys first to avoid modifying map during iteration
   * INV-TR-010: Guard against NaN from malformed timestamps
   */
  private evictStaleTraces(): void {
    const now = Date.now();
    const staleThreshold = now - TRACE_TTL_MS;

    // INV-TR-009: Collect keys first to avoid modifying map during iteration
    const toEvict: string[] = [];

    for (const [traceId, trace] of this.activeTraces.entries()) {
      const startTime = new Date(trace.startTime).getTime();
      // INV-TR-010: Guard against NaN from malformed timestamps
      // NaN < staleThreshold is always false, so we also evict malformed traces
      if (Number.isNaN(startTime) || startTime < staleThreshold) {
        toEvict.push(traceId);
      }
    }

    // Delete after iteration completes
    for (const traceId of toEvict) {
      this.activeTraces.delete(traceId);
    }
  }

  /**
   * Evict oldest traces when limit reached (LRU eviction)
   * INV-TR-007: Bounded active traces map with LRU eviction
   */
  private evictOldestIfNeeded(): void {
    if (this.activeTraces.size < MAX_ACTIVE_TRACES) return;

    // First try to evict stale traces
    this.evictStaleTraces();
    if (this.activeTraces.size < MAX_ACTIVE_TRACES) return;

    // Still at limit - evict oldest 10% by start time
    const evictCount = Math.max(1, Math.floor(MAX_ACTIVE_TRACES * 0.1));
    const traces = Array.from(this.activeTraces.entries())
      .sort((a, b) => {
        const aTime = new Date(a[1].startTime).getTime();
        const bTime = new Date(b[1].startTime).getTime();
        return aTime - bTime; // Oldest first
      });

    for (let i = 0; i < evictCount && i < traces.length; i++) {
      const trace = traces[i];
      if (trace) {
        this.activeTraces.delete(trace[0]);
      }
    }
  }

  /**
   * Starts a new trace
   * INV-TR-001: Emits run.start as first event
   * INV-TR-007: Evicts old traces before adding new one
   */
  async startTrace(
    workflowId: string,
    options?: TraceOptions
  ): Promise<string> {
    // INV-TR-007: Evict old traces before adding new one
    this.evictOldestIfNeeded();

    const { traceId, startTime } = createTrace();

    const activeTrace: ActiveTrace = {
      traceId,
      startTime,
      events: [],
      context: options?.context,
      currentSequence: 0,
      status: 'running',
      parentEventStack: [],
    };

    this.activeTraces.set(traceId, activeTrace);

    // INV-TR-001: First event must be run.start
    await this.recordEvent(traceId, 'run.start', {
      payload: {
        workflowId,
        ...options?.metadata,
      },
      status: 'running',
    });

    return traceId;
  }

  /**
   * Ends a trace
   * INV-TR-001: Emits run.end as last event
   */
  async endTrace(
    traceId: string,
    success: boolean,
    output?: Record<string, unknown>,
    error?: Record<string, unknown>
  ): Promise<void> {
    const trace = this.getActiveTrace(traceId);

    if (trace.status !== 'running') {
      throw new TraceRecorderError(
        TraceErrorCodes.TRACE_ALREADY_ENDED,
        `Trace ${traceId} has already ended`
      );
    }

    const durationMs =
      Date.now() - new Date(trace.startTime).getTime();

    // INV-TR-001: Last event must be run.end
    await this.recordEvent(traceId, 'run.end', {
      payload: {
        success,
        output,
        error,
        totalDurationMs: durationMs,
        stepCount: trace.events.filter((e) => e.type === 'step.execute').length,
      },
      status: success ? 'success' : 'failure',
      durationMs,
    });

    trace.status = success ? 'success' : 'failure';

    // Flush and cleanup
    await this.writer.flush();
    this.activeTraces.delete(traceId);
  }

  /**
   * Records a trace event
   * INV-TR-002: Events are ordered via sequence numbers
   * INV-TR-003: All events captured for replay
   */
  async recordEvent(
    traceId: string,
    type: TraceEventType,
    options?: EventOptions
  ): Promise<string> {
    const trace = this.getActiveTrace(traceId);

    // Get parent from stack or options
    const parentEventId =
      options?.parentEventId ?? trace.parentEventStack[trace.parentEventStack.length - 1];

    // INV-TR-002: Assign sequence number
    const sequence = trace.currentSequence++;

    // Build options object for createTraceEvent
    const eventOptions: Parameters<typeof createTraceEvent>[2] = {
      sequence,
    };

    if (parentEventId !== undefined) {
      eventOptions.parentEventId = parentEventId;
    }
    if (options?.payload !== undefined) {
      eventOptions.payload = options.payload;
    }
    if (trace.context !== undefined) {
      eventOptions.context = trace.context;
    }
    if (options?.status !== undefined) {
      eventOptions.status = options.status;
    }

    const event = createTraceEvent(traceId, type, eventOptions);

    // Add duration if provided
    if (options?.durationMs !== undefined) {
      (event as { durationMs: number }).durationMs = options.durationMs;
    }

    // INV-TR-006: Write to store BEFORE updating local state
    // This ensures consistency - if write fails, local state remains unchanged
    await this.writer.write(event);

    // Only update local state after successful write
    trace.events.push(event);

    return event.eventId;
  }

  /**
   * Records an error event
   * INV-TR-005: Errors captured with full context
   */
  async recordError(
    traceId: string,
    code: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    return this.recordEvent(traceId, 'error', {
      payload: {
        code,
        message,
        context,
        stack: new Error().stack,
      },
      status: 'failure',
    });
  }

  /**
   * Records a routing decision
   * INV-TR-003: Full decision context for replay
   */
  async recordRoutingDecision(
    traceId: string,
    selectedModel: string,
    provider: string,
    reasoning: string
  ): Promise<string> {
    return this.recordEvent(traceId, 'decision.routing', {
      payload: {
        selectedModel,
        provider,
        reasoning,
      },
    });
  }

  /**
   * Records step execution
   */
  async recordStepExecution(
    traceId: string,
    stepId: string,
    stepType: string,
    input?: Record<string, unknown>,
    output?: Record<string, unknown>,
    durationMs?: number
  ): Promise<string> {
    const options: EventOptions = {
      payload: {
        stepId,
        stepType,
        input,
        output,
      },
    };
    if (durationMs !== undefined) {
      options.durationMs = durationMs;
    }
    return this.recordEvent(traceId, 'step.execute', options);
  }

  /**
   * Starts a scoped operation (pushes parent onto stack)
   */
  async startScope(traceId: string, type: TraceEventType): Promise<string> {
    const eventId = await this.recordEvent(traceId, type, {
      status: 'running',
    });

    const trace = this.getActiveTrace(traceId);
    trace.parentEventStack.push(eventId);

    return eventId;
  }

  /**
   * Ends a scoped operation (pops parent from stack)
   */
  async endScope(
    traceId: string,
    type: TraceEventType,
    success: boolean,
    durationMs?: number
  ): Promise<void> {
    const trace = this.getActiveTrace(traceId);
    trace.parentEventStack.pop();

    const options: EventOptions = {
      status: success ? 'success' : 'failure',
    };
    if (durationMs !== undefined) {
      options.durationMs = durationMs;
    }
    await this.recordEvent(traceId, type, options);
  }

  /**
   * Gets an active trace
   */
  private getActiveTrace(traceId: string): ActiveTrace {
    const trace = this.activeTraces.get(traceId);
    if (trace === undefined) {
      throw new TraceRecorderError(
        TraceErrorCodes.TRACE_NOT_FOUND,
        `Trace ${traceId} not found or already ended`
      );
    }
    return trace;
  }

  /**
   * Checks if a trace is active
   */
  isActive(traceId: string): boolean {
    return this.activeTraces.has(traceId);
  }

  /**
   * Gets the current event count for a trace
   */
  getEventCount(traceId: string): number {
    const trace = this.activeTraces.get(traceId);
    return trace?.events.length ?? 0;
  }
}

/**
 * Creates a trace recorder
 */
export function createTraceRecorder(writer: TraceWriter): TraceRecorder {
  return new TraceRecorder(writer);
}
