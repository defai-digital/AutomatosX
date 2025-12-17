/**
 * Trace MCP Tool Contracts
 *
 * Zod schemas for trace tool inputs and outputs.
 */

import { z } from 'zod';

// ============================================================================
// trace_list Tool
// ============================================================================

export const TraceListInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(10),
  status: z.enum(['success', 'failure', 'running']).optional(),
});

export type TraceListInput = z.infer<typeof TraceListInputSchema>;

export const TraceListOutputSchema = z.object({
  traces: z.array(z.object({
    traceId: z.string(),
    workflowId: z.string(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime().optional(),
    status: z.string(),
    eventCount: z.number().int().min(0),
    durationMs: z.number().min(0),
  })),
});

export type TraceListOutput = z.infer<typeof TraceListOutputSchema>;

// ============================================================================
// trace_get Tool
// ============================================================================

export const TraceGetInputSchema = z.object({
  traceId: z.string().min(1).max(100),
});

export type TraceGetInput = z.infer<typeof TraceGetInputSchema>;

export const TraceGetOutputSchema = z.object({
  traceId: z.string(),
  workflowId: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  status: z.string(),
  durationMs: z.number().min(0),
  events: z.array(z.object({
    eventId: z.string(),
    type: z.string(),
    sequence: z.number().int().min(0),
    timestamp: z.string().datetime(),
    payload: z.unknown().optional(),
    status: z.string().optional(),
    durationMs: z.number().optional(),
  })),
});

export type TraceGetOutput = z.infer<typeof TraceGetOutputSchema>;

// ============================================================================
// trace_analyze Tool
// ============================================================================

export const TraceAnalyzeInputSchema = z.object({
  traceId: z.string().min(1).max(100),
});

export type TraceAnalyzeInput = z.infer<typeof TraceAnalyzeInputSchema>;

export const TraceAnalyzeOutputSchema = z.object({
  traceId: z.string(),
  summary: z.string(),
  performance: z.object({
    totalDuration: z.number(),
    averageStepDuration: z.number(),
    slowestStep: z.object({
      stepId: z.string(),
      stepName: z.string(),
      durationMs: z.number(),
    }).optional(),
  }),
  issues: z.array(z.object({
    type: z.string(),
    message: z.string(),
    severity: z.string(),
  })),
  recommendations: z.array(z.object({
    type: z.string(),
    message: z.string(),
    severity: z.string(),
  })),
  metrics: z.object({
    stepCount: z.number().int().min(0),
    successRate: z.number().min(0).max(1),
    errorCount: z.number().int().min(0),
  }),
});

export type TraceAnalyzeOutput = z.infer<typeof TraceAnalyzeOutputSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export function validateTraceListInput(data: unknown): TraceListInput {
  return TraceListInputSchema.parse(data);
}

export function validateTraceGetInput(data: unknown): TraceGetInput {
  return TraceGetInputSchema.parse(data);
}

export function validateTraceAnalyzeInput(data: unknown): TraceAnalyzeInput {
  return TraceAnalyzeInputSchema.parse(data);
}
