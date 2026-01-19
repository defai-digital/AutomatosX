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
  // Discussion-specific events
  'discussion.start',
  'discussion.round',
  'discussion.provider',
  'discussion.consensus',
  'discussion.end',
  // Workflow-specific events
  'workflow.start',
  'workflow.step',
  'workflow.end',
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
 * Token usage tracking for cost analysis
 * INV-TR-012: Provider completion events SHOULD include tokenUsage when available
 */
export const TokenUsageSchema = z.object({
  input: z.number().int().min(0).optional(),
  output: z.number().int().min(0).optional(),
  total: z.number().int().min(0).optional(),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/**
 * Trace context for contextual information
 * INV-TR-010: Provider calls MUST include providerId
 * INV-TR-011: Agent executions MUST include agentId
 */
export const TraceContextSchema = z.object({
  workflowId: z.string().optional(),
  stepId: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  userId: z.string().optional(),
  // NEW: Enable provider drill-down (INV-TR-010)
  providerId: z.string().optional(),
  // NEW: Enable agent drill-down (INV-TR-011)
  agentId: z.string().optional(),
  // NEW: Enable cost tracking (INV-TR-012)
  tokenUsage: TokenUsageSchema.optional(),

  // Hierarchical tracing fields (INV-TR-020 through INV-TR-024)
  /**
   * Parent trace that spawned this trace (INV-TR-021)
   * Used to establish parent-child relationships between traces
   */
  parentTraceId: z.string().uuid().optional(),
  /**
   * Original user-initiated trace at the root of the hierarchy (INV-TR-020)
   * All traces in a delegation chain share the same rootTraceId
   */
  rootTraceId: z.string().uuid().optional(),
  /**
   * Depth in the trace hierarchy (INV-TR-022)
   * 0 = root trace (user-initiated), 1+ = child traces (delegations)
   */
  traceDepth: z.number().int().min(0).optional(),
  /**
   * Session correlation for grouping related traces (INV-TR-023)
   * Traces in the same session can be viewed together
   */
  sessionId: z.string().uuid().optional(),
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

// ============================================================================
// Discussion Trace Event Payloads
// ============================================================================

/**
 * Payload for discussion.start event
 */
export const DiscussionStartPayloadSchema = z.object({
  pattern: z.string(),
  providers: z.array(z.string()),
  rounds: z.number().int().min(1),
  topic: z.string(),
  consensusMethod: z.string(),
});

export type DiscussionStartPayload = z.infer<typeof DiscussionStartPayloadSchema>;

/**
 * Payload for discussion.round event
 */
export const DiscussionRoundPayloadSchema = z.object({
  roundNumber: z.number().int().min(1),
  participatingProviders: z.array(z.string()),
  failedProviders: z.array(z.string()).optional(),
  responseCount: z.number().int().min(0),
  durationMs: z.number().int().min(0),
});

export type DiscussionRoundPayload = z.infer<typeof DiscussionRoundPayloadSchema>;

/**
 * Payload for discussion.provider event
 */
export const DiscussionProviderPayloadSchema = z.object({
  providerId: z.string(),
  roundNumber: z.number().int().min(1),
  success: z.boolean(),
  durationMs: z.number().int().min(0),
  tokenCount: z.number().int().min(0).optional(),
  role: z.string().optional(),
  error: z.string().optional(),
});

export type DiscussionProviderPayload = z.infer<typeof DiscussionProviderPayloadSchema>;

/**
 * Payload for discussion.consensus event
 */
export const DiscussionConsensusPayloadSchema = z.object({
  method: z.string(),
  success: z.boolean(),
  winner: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  votes: z.record(z.number()).optional(),
  durationMs: z.number().int().min(0),
});

export type DiscussionConsensusPayload = z.infer<typeof DiscussionConsensusPayloadSchema>;

/**
 * Payload for discussion.end event
 */
export const DiscussionEndPayloadSchema = z.object({
  success: z.boolean(),
  pattern: z.string(),
  participatingProviders: z.array(z.string()),
  failedProviders: z.array(z.string()),
  totalRounds: z.number().int().min(0),
  totalDurationMs: z.number().int().min(0),
  synthesisLength: z.number().int().min(0).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});

export type DiscussionEndPayload = z.infer<typeof DiscussionEndPayloadSchema>;

// ============================================================================
// Workflow Trace Event Payloads
// ============================================================================

/**
 * Payload for workflow.start event
 */
export const WorkflowStartPayloadSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string().optional(),
  workflowVersion: z.string().optional(),
  stepCount: z.number().int().min(0),
  input: z.record(z.unknown()).optional(),
});

export type WorkflowStartPayload = z.infer<typeof WorkflowStartPayloadSchema>;

/**
 * Payload for workflow.step event
 */
export const WorkflowStepPayloadSchema = z.object({
  stepId: z.string(),
  stepName: z.string().optional(),
  stepType: z.string(),
  stepIndex: z.number().int().min(0),
  success: z.boolean(),
  durationMs: z.number().int().min(0),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
  retryCount: z.number().int().min(0).optional(),
});

export type WorkflowStepPayload = z.infer<typeof WorkflowStepPayloadSchema>;

/**
 * Payload for workflow.end event
 */
export const WorkflowEndPayloadSchema = z.object({
  workflowId: z.string(),
  success: z.boolean(),
  totalSteps: z.number().int().min(0),
  completedSteps: z.number().int().min(0),
  failedSteps: z.number().int().min(0),
  totalDurationMs: z.number().int().min(0),
  output: z.record(z.unknown()).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    failedStepId: z.string().optional(),
  }).optional(),
});

export type WorkflowEndPayload = z.infer<typeof WorkflowEndPayloadSchema>;

/**
 * Trace event schema
 * Schema strictness rejects unknown fields
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
}).strict();

export type TraceEvent = z.infer<typeof TraceEventSchema>;

/**
 * Complete trace (collection of events)
 * Schema strictness rejects unknown fields
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
}).strict();

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
 * Trace hierarchy context for propagating hierarchy information
 * INV-TR-020: All traces in hierarchy share rootTraceId
 * INV-TR-021: Child traces reference parentTraceId
 * INV-TR-022: Depth increases by 1 for each level
 */
export interface TraceHierarchy {
  parentTraceId: string | undefined;
  rootTraceId: string | undefined;
  traceDepth: number;
  sessionId: string | undefined;
}

/**
 * Creates hierarchy context for a root trace (user-initiated)
 * INV-TR-020: Root trace becomes the rootTraceId for all descendants
 * INV-TR-022: Root depth is 0
 *
 * @param traceId - The trace ID of the root trace
 * @param sessionId - Optional session ID for correlation
 * @returns Hierarchy context for the root trace
 */
export function createRootTraceHierarchy(
  traceId: string,
  sessionId?: string
): TraceHierarchy {
  return {
    parentTraceId: undefined,
    rootTraceId: traceId,
    traceDepth: 0,
    sessionId,
  };
}

/**
 * Creates hierarchy context for a child trace (delegation)
 * INV-TR-020: Child inherits rootTraceId from parent
 * INV-TR-021: Child references parent's traceId
 * INV-TR-022: Child depth = parent depth + 1
 * INV-TR-023: Child inherits sessionId from parent
 *
 * @param parentTraceId - The trace ID of the parent trace
 * @param parentHierarchy - The hierarchy context of the parent trace
 * @returns Hierarchy context for the child trace
 */
export function createChildTraceHierarchy(
  parentTraceId: string,
  parentHierarchy: TraceHierarchy
): TraceHierarchy {
  return {
    parentTraceId,
    rootTraceId: parentHierarchy.rootTraceId ?? parentTraceId,
    traceDepth: parentHierarchy.traceDepth + 1,
    sessionId: parentHierarchy.sessionId,
  };
}

/**
 * Extracts hierarchy information from trace context
 * INV-TR-024: Missing fields indicate a root trace or legacy trace
 *
 * @param context - Trace context that may contain hierarchy fields
 * @returns Hierarchy context, defaulting to root if fields missing
 */
export function extractTraceHierarchy(
  context: TraceContext | undefined,
  traceId: string
): TraceHierarchy {
  if (!context) {
    return createRootTraceHierarchy(traceId);
  }

  return {
    parentTraceId: context.parentTraceId,
    rootTraceId: context.rootTraceId ?? traceId,
    traceDepth: context.traceDepth ?? 0,
    sessionId: context.sessionId,
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
