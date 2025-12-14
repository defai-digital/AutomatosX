import { z } from 'zod';

/**
 * Trace event types
 */
export const TraceEventTypeSchema = z.enum([
  'run.start',
  'run.end',
  'decision.routing',
  'step.start',
  'step.execute',
  'step.end',
  'tool.invoke',
  'tool.result',
  'memory.write',
  'memory.read',
  'error',
]);

export type TraceEventType = z.infer<typeof TraceEventTypeSchema>;

/**
 * Trace event status
 */
export const TraceStatusSchema = z.enum([
  'pending',
  'running',
  'success',
  'failure',
  'skipped',
]);

export type TraceStatus = z.infer<typeof TraceStatusSchema>;

/**
 * Trace context for contextual information
 */
export const TraceContextSchema = z.object({
  workflowId: z.string().optional(),
  stepId: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  userId: z.string().optional(),
});

export type TraceContext = z.infer<typeof TraceContextSchema>;

/**
 * Payload for run.start event
 */
export const RunStartPayloadSchema = z.object({
  workflowId: z.string(),
  workflowVersion: z.string().optional(),
  input: z.record(z.unknown()).optional(),
});

export type RunStartPayload = z.infer<typeof RunStartPayloadSchema>;

/**
 * Payload for run.end event
 */
export const RunEndPayloadSchema = z.object({
  success: z.boolean(),
  output: z.record(z.unknown()).optional(),
  error: z.record(z.unknown()).optional(),
  totalDurationMs: z.number().int().min(0).optional(),
  stepCount: z.number().int().min(0).optional(),
});

export type RunEndPayload = z.infer<typeof RunEndPayloadSchema>;

/**
 * Payload for decision.routing event
 */
export const RoutingDecisionPayloadSchema = z.object({
  selectedModel: z.string(),
  provider: z.string(),
  reasoning: z.string(),
  estimatedCostUsd: z.number().optional(),
});

export type RoutingDecisionPayload = z.infer<typeof RoutingDecisionPayloadSchema>;

/**
 * Payload for step.execute event
 */
export const StepExecutePayloadSchema = z.object({
  stepId: z.string(),
  stepType: z.string(),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  retryCount: z.number().int().min(0).optional(),
});

export type StepExecutePayload = z.infer<typeof StepExecutePayloadSchema>;

/**
 * Payload for error event
 */
export const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

/**
 * Trace event schema
 */
export const TraceEventSchema = z.object({
  traceId: z.string().uuid(),
  eventId: z.string().uuid(),
  parentEventId: z.string().uuid().optional(),
  type: TraceEventTypeSchema,
  timestamp: z.string().datetime(),
  durationMs: z.number().int().min(0).optional(),
  sequence: z.number().int().min(0).optional(),
  payload: z.record(z.unknown()).optional(),
  context: TraceContextSchema.optional(),
  status: TraceStatusSchema.optional(),
});

export type TraceEvent = z.infer<typeof TraceEventSchema>;

/**
 * Complete trace (collection of events)
 */
export const TraceSchema = z.object({
  traceId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  events: z.array(TraceEventSchema),
  status: TraceStatusSchema,
  summary: z
    .object({
      totalDurationMs: z.number().int().min(0),
      eventCount: z.number().int().min(0),
      errorCount: z.number().int().min(0),
    })
    .optional(),
});

export type Trace = z.infer<typeof TraceSchema>;

/**
 * Creates a new trace event
 */
export function createTraceEvent(
  traceId: string,
  type: TraceEventType,
  options?: {
    parentEventId?: string;
    payload?: Record<string, unknown>;
    context?: TraceContext;
    status?: TraceStatus;
    sequence?: number;
  }
): TraceEvent {
  return {
    traceId,
    eventId: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    ...options,
  };
}

/**
 * Creates a new trace
 */
export function createTrace(): { traceId: string; startTime: string } {
  return {
    traceId: crypto.randomUUID(),
    startTime: new Date().toISOString(),
  };
}

/**
 * Validates a trace event
 */
export function validateTraceEvent(data: unknown): TraceEvent {
  return TraceEventSchema.parse(data);
}

/**
 * Safely validates a trace event
 */
export function safeValidateTraceEvent(
  data: unknown
): z.SafeParseReturnType<unknown, TraceEvent> {
  return TraceEventSchema.safeParse(data);
}

/**
 * Validates a complete trace
 */
export function validateTrace(data: unknown): Trace {
  return TraceSchema.parse(data);
}

/**
 * Checks if a trace is complete (has run.start and run.end)
 */
export function isTraceComplete(events: TraceEvent[]): boolean {
  const hasStart = events.some((e) => e.type === 'run.start');
  const hasEnd = events.some((e) => e.type === 'run.end');
  return hasStart && hasEnd;
}

/**
 * Gets events in sequence order
 */
export function getOrderedEvents(events: TraceEvent[]): TraceEvent[] {
  return [...events].sort((a, b) => {
    // First by sequence if available
    if (a.sequence !== undefined && b.sequence !== undefined) {
      return a.sequence - b.sequence;
    }
    // Then by timestamp
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
}
