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
