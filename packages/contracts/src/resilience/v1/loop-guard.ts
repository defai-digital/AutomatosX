/**
 * Loop Guard Contract
 *
 * Prevents infinite loops and runaway execution that burns resources.
 */

import { z } from 'zod';

// ============================================================================
// Configuration
// ============================================================================

export const LoopGuardConfigSchema = z.object({
  /** Maximum iterations before hard stop */
  maxIterations: z.number().int().min(1).max(10000).default(100),

  /** Iteration count that triggers warning */
  warnAtIterations: z.number().int().min(1).max(10000).default(50),

  /** Maximum execution duration in ms */
  maxDurationMs: z.number().int().min(1000).max(3600000).default(300000), // 5 min

  /** Duration that triggers warning in ms */
  warnAtDurationMs: z.number().int().min(1000).max(3600000).default(120000), // 2 min
});

export type LoopGuardConfig = z.infer<typeof LoopGuardConfigSchema>;

// ============================================================================
// Context
// ============================================================================

export const LoopGuardContextSchema = z.object({
  /** Unique context identifier */
  contextId: z.string(),

  /** Current iteration count */
  iterations: z.number().int().min(0),

  /** Start time */
  startedAt: z.string().datetime(),

  /** Elapsed time in ms */
  elapsedMs: z.number().int().min(0),

  /** Whether warning was already issued */
  warningIssued: z.boolean(),

  /** Context metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type LoopGuardContext = z.infer<typeof LoopGuardContextSchema>;

// ============================================================================
// Check Result
// ============================================================================

export const LoopGuardResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    iteration: z.number().int().min(0),
    elapsedMs: z.number().int().min(0),
  }),
  z.object({
    status: z.literal('warning'),
    iteration: z.number().int().min(0),
    elapsedMs: z.number().int().min(0),
    message: z.string(),
    warningType: z.enum(['iteration', 'duration']),
  }),
  z.object({
    status: z.literal('blocked'),
    iteration: z.number().int().min(0),
    elapsedMs: z.number().int().min(0),
    reason: z.string(),
    blockType: z.enum(['max-iterations', 'max-duration']),
  }),
]);

export type LoopGuardResult = z.infer<typeof LoopGuardResultSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const LoopGuardErrorCodes = {
  MAX_ITERATIONS: 'LOOP_GUARD_MAX_ITERATIONS',
  MAX_DURATION: 'LOOP_GUARD_MAX_DURATION',
  CONTEXT_NOT_FOUND: 'LOOP_GUARD_CONTEXT_NOT_FOUND',
} as const;

export type LoopGuardErrorCode =
  (typeof LoopGuardErrorCodes)[keyof typeof LoopGuardErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateLoopGuardConfig(data: unknown): LoopGuardConfig {
  return LoopGuardConfigSchema.parse(data);
}

export function safeValidateLoopGuardConfig(
  data: unknown
): { success: true; data: LoopGuardConfig } | { success: false; error: z.ZodError } {
  const result = LoopGuardConfigSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDefaultLoopGuardConfig(): LoopGuardConfig {
  return LoopGuardConfigSchema.parse({});
}

export function createLoopGuardContext(contextId: string): LoopGuardContext {
  return {
    contextId,
    iterations: 0,
    startedAt: new Date().toISOString(),
    elapsedMs: 0,
    warningIssued: false,
  };
}
