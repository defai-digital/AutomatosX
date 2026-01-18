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
// trace_tree Tool (INV-TR-020 through INV-TR-024)
// ============================================================================

export const TraceTreeInputSchema = z.object({
  traceId: z.string().uuid(),
});

export type TraceTreeInput = z.infer<typeof TraceTreeInputSchema>;

export const TraceTreeOutputSchema = z.object({
  root: z.object({
    traceId: z.string(),
    agentId: z.string().optional(),
    status: z.string(),
    depth: z.number().int().min(0),
    durationMs: z.number().optional(),
    children: z.array(z.unknown()), // Recursive structure
  }),
  totalNodes: z.number().int().min(1),
  maxDepth: z.number().int().min(0),
});

export type TraceTreeOutput = z.infer<typeof TraceTreeOutputSchema>;

// ============================================================================
// trace_by_session Tool (INV-TR-023)
// ============================================================================

export const TraceBySessionInputSchema = z.object({
  sessionId: z.string().uuid(),
});

export type TraceBySessionInput = z.infer<typeof TraceBySessionInputSchema>;

export const TraceBySessionOutputSchema = z.object({
  sessionId: z.string(),
  traces: z.array(z.object({
    traceId: z.string(),
    agentId: z.string().optional(),
    status: z.string(),
    startTime: z.string(),
    durationMs: z.number().optional(),
  })),
  totalCount: z.number().int().min(0),
});

export type TraceBySessionOutput = z.infer<typeof TraceBySessionOutputSchema>;

// ============================================================================
// trace_close_stuck Tool
// ============================================================================

export const TraceCloseStuckInputSchema = z.object({
  maxAgeMs: z.number().int().min(60000).max(86400000).optional().default(3600000),
});

export type TraceCloseStuckInput = z.infer<typeof TraceCloseStuckInputSchema>;

export const TraceCloseStuckOutputSchema = z.object({
  closedCount: z.number().int().min(0),
  maxAgeMs: z.number(),
  maxAgeHours: z.number(),
});

export type TraceCloseStuckOutput = z.infer<typeof TraceCloseStuckOutputSchema>;

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

export function validateTraceTreeInput(data: unknown): TraceTreeInput {
  return TraceTreeInputSchema.parse(data);
}

export function validateTraceBySessionInput(data: unknown): TraceBySessionInput {
  return TraceBySessionInputSchema.parse(data);
}

export function validateTraceCloseStuckInput(data: unknown): TraceCloseStuckInput {
  return TraceCloseStuckInputSchema.parse(data);
}
