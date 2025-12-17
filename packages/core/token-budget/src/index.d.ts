/**
 * @automatosx/token-budget
 *
 * Token budget management for AutomatosX context windows.
 * Manages token allocation for embedded instructions to prevent
 * context window overflow.
 *
 * Note: This is NOT cost-based - it manages limited context window tokens.
 */
export type { TokenBudgetAllocator } from './allocator.js';
export { DefaultTokenBudgetAllocator, TokenBudgetError, createTokenBudgetAllocator, createInstruction, } from './allocator.js';
export type { InstructionType, InstructionPriority, PerTypeLimits, TokenBudgetConfig, EmbeddedInstruction, BudgetAllocation, BudgetStatus, TokenEstimationRequest, TokenEstimationResult, AllocationInput, TokenBudgetError as TokenBudgetErrorType, } from '@automatosx/contracts';
export { InstructionTypeSchema, InstructionPrioritySchema, PerTypeLimitsSchema, TokenBudgetConfigSchema, EmbeddedInstructionSchema, BudgetAllocationSchema, BudgetStatusSchema, TokenBudgetErrorCode, TokenBudgetErrorSchema, DEFAULT_TOKEN_BUDGET, PRIORITY_ORDER, TYPE_PRIORITY_ORDER, validateTokenBudgetConfig, safeValidateTokenBudgetConfig, validateEmbeddedInstruction, safeValidateEmbeddedInstruction, validateAllocationInput, getPriorityValue, getTypePriorityValue, } from '@automatosx/contracts';
//# sourceMappingURL=index.d.ts.map