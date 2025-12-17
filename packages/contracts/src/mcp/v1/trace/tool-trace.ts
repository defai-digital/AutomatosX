/**
 * Tool Trace Event Contracts
 *
 * Zod schemas for MCP tool invocation tracing.
 * Enables observability across all 26 MCP tools.
 */

import { z } from 'zod';

// ============================================================================
// Tool Trace Event Schema
// ============================================================================

/**
 * Tool trace event - records a single MCP tool invocation
 *
 * Invariants:
 * - INV-MCP-007: Every tool call produces exactly one trace
 * - INV-MCP-008: Trace includes input/output/duration/success
 */
export const ToolTraceEventSchema = z.object({
  /** Name of the tool invoked */
  toolName: z.string().min(1),
  /** Input arguments passed to the tool */
  input: z.record(z.unknown()),
  /** Output from the tool (if successful) */
  output: z.unknown().optional(),
  /** Duration of tool execution in milliseconds */
  durationMs: z.number().min(0),
  /** Whether the tool executed successfully */
  success: z.boolean(),
  /** Error code if the tool failed */
  errorCode: z.string().optional(),
  /** Error message if the tool failed */
  errorMessage: z.string().optional(),
  /** Timestamp of tool invocation */
  timestamp: z.string().datetime(),
  /** Trace ID for correlation */
  traceId: z.string().uuid().optional(),
});

export type ToolTraceEvent = z.infer<typeof ToolTraceEventSchema>;

// ============================================================================
// Tool Trace Summary Schema
// ============================================================================

/**
 * Summary of tool trace events for reporting
 */
export const ToolTraceSummarySchema = z.object({
  /** Total number of tool invocations */
  totalInvocations: z.number().int().min(0),
  /** Number of successful invocations */
  successCount: z.number().int().min(0),
  /** Number of failed invocations */
  failureCount: z.number().int().min(0),
  /** Average duration in milliseconds */
  avgDurationMs: z.number().min(0),
  /** Tool invocation counts by name */
  byTool: z.record(z.number().int().min(0)),
});

export type ToolTraceSummary = z.infer<typeof ToolTraceSummarySchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates tool trace event
 */
export function validateToolTraceEvent(data: unknown): ToolTraceEvent {
  return ToolTraceEventSchema.parse(data);
}

/**
 * Safely validates tool trace event
 */
export function safeValidateToolTraceEvent(
  data: unknown
): { success: true; data: ToolTraceEvent } | { success: false; error: z.ZodError } {
  const result = ToolTraceEventSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Creates a tool trace event
 */
export function createToolTraceEvent(
  toolName: string,
  input: Record<string, unknown>,
  durationMs: number,
  success: boolean,
  options?: {
    output?: unknown;
    errorCode?: string;
    errorMessage?: string;
    traceId?: string;
  }
): ToolTraceEvent {
  return {
    toolName,
    input,
    durationMs,
    success,
    timestamp: new Date().toISOString(),
    output: options?.output,
    errorCode: options?.errorCode,
    errorMessage: options?.errorMessage,
    traceId: options?.traceId,
  };
}
