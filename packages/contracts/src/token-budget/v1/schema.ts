/**
 * Token Budget Domain Contracts v1
 *
 * Zod schemas for token allocation and context window management.
 * Note: This is NOT cost-based - it manages limited context window tokens.
 */

import { z } from 'zod';

// ============================================================================
// Instruction Types and Priority
// ============================================================================

/**
 * Types of embedded instructions
 */
export const InstructionTypeSchema = z.enum([
  'memory',
  'todo',
  'session',
  'context',
  'system',
]);

export type InstructionType = z.infer<typeof InstructionTypeSchema>;

/**
 * Instruction priority levels
 */
export const InstructionPrioritySchema = z.enum([
  'critical',
  'high',
  'normal',
  'low',
]);

export type InstructionPriority = z.infer<typeof InstructionPrioritySchema>;

/**
 * Priority order (higher value = higher priority)
 */
export const PRIORITY_ORDER: Record<InstructionPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * Type priority order (higher value = higher priority)
 */
export const TYPE_PRIORITY_ORDER: Record<InstructionType, number> = {
  system: 5,
  memory: 4,
  session: 3,
  context: 2,
  todo: 1,
};

// ============================================================================
// Token Budget Configuration
// ============================================================================

/**
 * Per-type token limits
 */
export const PerTypeLimitsSchema = z.object({
  memory: z.number().int().min(0).max(100000),
  todo: z.number().int().min(0).max(100000),
  session: z.number().int().min(0).max(100000),
  context: z.number().int().min(0).max(100000).optional(),
  system: z.number().int().min(0).max(100000),
});

export type PerTypeLimits = z.infer<typeof PerTypeLimitsSchema>;

/**
 * Token budget configuration
 */
export const TokenBudgetConfigSchema = z.object({
  maxTotal: z.number().int().min(100).max(200000),
  perType: PerTypeLimitsSchema,
  criticalReserve: z.number().int().min(0).max(10000),
});

export type TokenBudgetConfig = z.infer<typeof TokenBudgetConfigSchema>;

/**
 * Default token budget configuration
 */
export const DEFAULT_TOKEN_BUDGET: TokenBudgetConfig = {
  maxTotal: 4000,
  perType: {
    memory: 1500,
    todo: 800,
    session: 700,
    context: 500,
    system: 500,
  },
  criticalReserve: 500,
};

// ============================================================================
// Embedded Instruction Schema
// ============================================================================

/**
 * An embedded instruction to include in context
 */
export const EmbeddedInstructionSchema = z.object({
  id: z.string().uuid(),
  type: InstructionTypeSchema,
  content: z.string().min(1).max(50000),
  priority: InstructionPrioritySchema,
  estimatedTokens: z.number().int().min(0).optional(),
  source: z.string().max(200).optional(),
  createdAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type EmbeddedInstruction = z.infer<typeof EmbeddedInstructionSchema>;

// ============================================================================
// Budget Allocation Result
// ============================================================================

/**
 * Result of budget allocation
 */
export const BudgetAllocationSchema = z.object({
  included: z.array(EmbeddedInstructionSchema),
  excluded: z.array(EmbeddedInstructionSchema),
  totalTokens: z.number().int().min(0),
  remaining: z.number().int().min(0),
  usageByType: z.record(InstructionTypeSchema, z.number().int().min(0)),
  criticalReserveUsed: z.number().int().min(0),
  allocationTimestamp: z.string().datetime(),
});

export type BudgetAllocation = z.infer<typeof BudgetAllocationSchema>;

// ============================================================================
// Budget Status
// ============================================================================

/**
 * Current budget status
 */
export const BudgetStatusSchema = z.object({
  config: TokenBudgetConfigSchema,
  currentUsage: z.number().int().min(0),
  usageByType: z.record(InstructionTypeSchema, z.number().int().min(0)),
  remaining: z.number().int().min(0),
  criticalReserveAvailable: z.number().int().min(0),
  utilizationPercent: z.number().min(0).max(100),
  canAcceptMore: z.boolean(),
});

export type BudgetStatus = z.infer<typeof BudgetStatusSchema>;

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Token estimation request
 */
export const TokenEstimationRequestSchema = z.object({
  content: z.string(),
  model: z.string().optional(),
});

export type TokenEstimationRequest = z.infer<typeof TokenEstimationRequestSchema>;

/**
 * Token estimation result
 */
export const TokenEstimationResultSchema = z.object({
  content: z.string(),
  estimatedTokens: z.number().int().min(0),
  model: z.string().optional(),
  method: z.enum(['exact', 'approximation', 'rule-based']),
});

export type TokenEstimationResult = z.infer<typeof TokenEstimationResultSchema>;

// ============================================================================
// Allocation Input
// ============================================================================

/**
 * Input for budget allocation
 */
export const AllocationInputSchema = z.object({
  instructions: z.array(EmbeddedInstructionSchema),
  config: TokenBudgetConfigSchema.optional(),
  estimateTokens: z.boolean().optional().default(true),
});

export type AllocationInput = z.infer<typeof AllocationInputSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Token budget error codes
 */
export const TokenBudgetErrorCode = {
  TOKEN_BUDGET_EXCEEDED: 'TOKEN_BUDGET_EXCEEDED',
  TOKEN_TYPE_LIMIT_EXCEEDED: 'TOKEN_TYPE_LIMIT_EXCEEDED',
  TOKEN_CRITICAL_DROPPED: 'TOKEN_CRITICAL_DROPPED',
  TOKEN_ESTIMATION_FAILED: 'TOKEN_ESTIMATION_FAILED',
  TOKEN_INVALID_CONFIG: 'TOKEN_INVALID_CONFIG',
  TOKEN_INVALID_INSTRUCTION: 'TOKEN_INVALID_INSTRUCTION',
} as const;

export type TokenBudgetErrorCode =
  (typeof TokenBudgetErrorCode)[keyof typeof TokenBudgetErrorCode];

/**
 * Token budget error schema
 */
export const TokenBudgetErrorSchema = z.object({
  code: z.nativeEnum(TokenBudgetErrorCode),
  message: z.string(),
  instructionId: z.string().uuid().optional(),
  type: InstructionTypeSchema.optional(),
  requested: z.number().int().optional(),
  available: z.number().int().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type TokenBudgetError = z.infer<typeof TokenBudgetErrorSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a token budget config
 */
export function validateTokenBudgetConfig(data: unknown): TokenBudgetConfig {
  return TokenBudgetConfigSchema.parse(data);
}

/**
 * Safely validates a token budget config
 */
export function safeValidateTokenBudgetConfig(
  data: unknown
):
  | { success: true; data: TokenBudgetConfig }
  | { success: false; error: z.ZodError } {
  const result = TokenBudgetConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates an embedded instruction
 */
export function validateEmbeddedInstruction(data: unknown): EmbeddedInstruction {
  return EmbeddedInstructionSchema.parse(data);
}

/**
 * Safely validates an embedded instruction
 */
export function safeValidateEmbeddedInstruction(
  data: unknown
):
  | { success: true; data: EmbeddedInstruction }
  | { success: false; error: z.ZodError } {
  const result = EmbeddedInstructionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates allocation input
 */
export function validateAllocationInput(data: unknown): AllocationInput {
  return AllocationInputSchema.parse(data);
}

/**
 * Gets priority value for sorting
 */
export function getPriorityValue(priority: InstructionPriority): number {
  return PRIORITY_ORDER[priority];
}

/**
 * Gets type priority value for sorting
 */
export function getTypePriorityValue(type: InstructionType): number {
  return TYPE_PRIORITY_ORDER[type];
}
