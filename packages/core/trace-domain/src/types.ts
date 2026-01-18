import type {
  TraceEvent,
  TraceStatus,
  TraceContext,
} from '@defai.digital/contracts';

/**
 * Trace writer interface for persistence
 */
export interface TraceWriter {
  /**
   * Writes a trace event
   */
  write(event: TraceEvent): Promise<void>;

  /**
   * Flushes pending writes
   */
  flush(): Promise<void>;
}

/**
 * Trace reader interface for querying
 */
export interface TraceReader {
  /**
   * Gets all events for a trace
   */
  getTrace(traceId: string): Promise<TraceEvent[]>;

  /**
   * Gets a specific event
   */
  getEvent(traceId: string, eventId: string): Promise<TraceEvent | undefined>;

  /**
   * Lists recent traces
   */
  listTraces(limit?: number): Promise<TraceSummary[]>;

  // Hierarchical query methods (INV-TR-020 through INV-TR-024)

  /**
   * Gets all traces that share the same root trace ID
   * INV-TR-020: All traces in hierarchy share rootTraceId
   */
  getTracesByRoot(rootTraceId: string): Promise<TraceSummary[]>;

  /**
   * Gets direct children of a trace
   * INV-TR-021: Child traces reference parentTraceId
   */
  getChildTraces(parentTraceId: string): Promise<TraceSummary[]>;

  /**
   * Gets all traces in a session
   * INV-TR-023: Session trace correlation
   */
  getTracesBySession(sessionId: string): Promise<TraceSummary[]>;

  /**
   * Builds a hierarchical tree from a root trace
   * Returns the complete tree structure for visualization
   */
  getTraceTree(traceId: string): Promise<TraceTreeNode | undefined>;
}

/**
 * Trace store interface with delete capability (for cleanup operations)
 */
export interface TraceStore extends TraceWriter, TraceReader {
  /**
   * Deletes a trace and all its events
   * @returns true if trace existed and was deleted
   */
  deleteTrace(traceId: string): Promise<boolean>;

  /**
   * Closes stuck traces that have been running longer than maxAgeMs
   * Writes a run.end event marking them as failed
   * @param maxAgeMs Maximum age in milliseconds before a trace is considered stuck (default: 1 hour)
   * @returns number of traces that were closed
   */
  closeStuckTraces(maxAgeMs?: number): Promise<number>;
}

/**
 * Summary of a trace
 */
export interface TraceSummary {
  traceId: string;
  startTime: string;
  endTime?: string;
  status: TraceStatus;
  eventCount: number;
  errorCount: number;
  durationMs?: number;

  // Hierarchical tracing fields (INV-TR-020 through INV-TR-024)
  /** Parent trace that spawned this trace */
  parentTraceId: string | undefined;
  /** Root trace of the hierarchy */
  rootTraceId: string | undefined;
  /** Depth in the trace hierarchy (0 = root) */
  traceDepth: number | undefined;
  /** Session this trace belongs to */
  sessionId: string | undefined;
  /** Agent that was executed (if applicable) */
  agentId: string | undefined;
}

/**
 * Tree node representing a trace in a hierarchy
 * Used for trace_tree visualization
 */
export interface TraceTreeNode {
  /** The trace summary for this node */
  trace: TraceSummary;
  /** Child traces (delegations from this trace) */
  children: TraceTreeNode[];
  /** Total duration including all children */
  totalDurationMs?: number;
  /** Total event count including all children */
  totalEventCount: number;
}

/**
 * Active trace being recorded
 */
export interface ActiveTrace {
  traceId: string;
  startTime: string;
  events: TraceEvent[];
  context?: TraceContext | undefined;
  currentSequence: number;
  status: TraceStatus;
  parentEventStack: string[];
}

/**
 * Options for creating a trace
 */
export interface TraceOptions {
  context?: TraceContext | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Options for recording an event
 */
export interface EventOptions {
  parentEventId?: string | undefined;
  durationMs?: number | undefined;
  payload?: Record<string, unknown> | undefined;
  status?: TraceStatus | undefined;
}

/**
 * Error codes for trace domain
 */
export const TraceErrorCodes = {
  TRACE_NOT_FOUND: 'TRACE_NOT_FOUND',
  TRACE_ALREADY_ENDED: 'TRACE_ALREADY_ENDED',
  TRACE_NOT_STARTED: 'TRACE_NOT_STARTED',
  INVALID_EVENT_ORDER: 'TRACE_INVALID_EVENT_ORDER',
} as const;

export type TraceErrorCode =
  (typeof TraceErrorCodes)[keyof typeof TraceErrorCodes];
