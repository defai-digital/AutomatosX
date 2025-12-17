/**
 * Guard MCP Tool Contracts
 *
 * Zod schemas for guard tool inputs and outputs.
 */

import { z } from 'zod';

// ============================================================================
// guard_check Tool
// ============================================================================

/**
 * Input schema for guard_check tool
 */
export const GuardCheckInputSchema = z.object({
  policyId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/, 'Policy ID must be lowercase with hyphens'),
  changedPaths: z.array(z.string().max(500)).min(1).max(1000),
  target: z.string().max(100).optional(),
});

export type GuardCheckInput = z.infer<typeof GuardCheckInputSchema>;

/**
 * Gate result in guard check output
 */
export const GateResultSchema = z.object({
  gate: z.string(),
  status: z.enum(['PASS', 'FAIL', 'WARN']),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type GateResult = z.infer<typeof GateResultSchema>;

/**
 * Output schema for guard_check tool
 */
export const GuardCheckOutputSchema = z.object({
  status: z.enum(['PASS', 'FAIL', 'WARN']),
  policyId: z.string(),
  target: z.string(),
  gates: z.array(GateResultSchema),
  summary: z.string(),
  suggestions: z.array(z.string()),
  timestamp: z.string().datetime(),
});

export type GuardCheckOutput = z.infer<typeof GuardCheckOutputSchema>;

// ============================================================================
// guard_list Tool
// ============================================================================

/**
 * Input schema for guard_list tool
 */
export const GuardListInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export type GuardListInput = z.infer<typeof GuardListInputSchema>;

/**
 * Policy summary in guard list output
 */
export const PolicySummarySchema = z.object({
  policyId: z.string(),
  allowedPaths: z.array(z.string()),
  forbiddenPaths: z.array(z.string()),
  gates: z.array(z.string()),
  changeRadiusLimit: z.number(),
});

export type PolicySummary = z.infer<typeof PolicySummarySchema>;

/**
 * Output schema for guard_list tool
 */
export const GuardListOutputSchema = z.object({
  policies: z.array(PolicySummarySchema),
  total: z.number().int().min(0),
});

export type GuardListOutput = z.infer<typeof GuardListOutputSchema>;

// ============================================================================
// guard_apply Tool
// ============================================================================

/**
 * Input schema for guard_apply tool
 */
export const GuardApplyInputSchema = z.object({
  sessionId: z.string().uuid(),
  policyId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/, 'Policy ID must be lowercase with hyphens'),
});

export type GuardApplyInput = z.infer<typeof GuardApplyInputSchema>;

/**
 * Output schema for guard_apply tool
 */
export const GuardApplyOutputSchema = z.object({
  applied: z.boolean(),
  sessionId: z.string().uuid(),
  policyId: z.string(),
  message: z.string(),
});

export type GuardApplyOutput = z.infer<typeof GuardApplyOutputSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Guard tool error codes
 */
export const GuardToolErrorCode = {
  POLICY_NOT_FOUND: 'POLICY_NOT_FOUND',
  GATE_EXECUTION_FAILED: 'GATE_EXECUTION_FAILED',
  INVALID_PATH_PATTERN: 'INVALID_PATH_PATTERN',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  POLICY_ALREADY_APPLIED: 'POLICY_ALREADY_APPLIED',
} as const;

export type GuardToolErrorCode =
  (typeof GuardToolErrorCode)[keyof typeof GuardToolErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates guard_check input
 */
export function validateGuardCheckInput(data: unknown): GuardCheckInput {
  return GuardCheckInputSchema.parse(data);
}

/**
 * Safely validates guard_check input
 */
export function safeValidateGuardCheckInput(
  data: unknown
): { success: true; data: GuardCheckInput } | { success: false; error: z.ZodError } {
  const result = GuardCheckInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates guard_list input
 */
export function validateGuardListInput(data: unknown): GuardListInput {
  return GuardListInputSchema.parse(data);
}

/**
 * Validates guard_apply input
 */
export function validateGuardApplyInput(data: unknown): GuardApplyInput {
  return GuardApplyInputSchema.parse(data);
}
