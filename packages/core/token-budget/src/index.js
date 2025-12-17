/**
 * @automatosx/token-budget
 *
 * Token budget management for AutomatosX context windows.
 * Manages token allocation for embedded instructions to prevent
 * context window overflow.
 *
 * Note: This is NOT cost-based - it manages limited context window tokens.
 */
export { DefaultTokenBudgetAllocator, TokenBudgetError, createTokenBudgetAllocator, createInstruction, } from './allocator.js';
export { InstructionTypeSchema, InstructionPrioritySchema, PerTypeLimitsSchema, TokenBudgetConfigSchema, EmbeddedInstructionSchema, BudgetAllocationSchema, BudgetStatusSchema, TokenBudgetErrorCode, TokenBudgetErrorSchema, DEFAULT_TOKEN_BUDGET, PRIORITY_ORDER, TYPE_PRIORITY_ORDER, validateTokenBudgetConfig, safeValidateTokenBudgetConfig, validateEmbeddedInstruction, safeValidateEmbeddedInstruction, validateAllocationInput, getPriorityValue, getTypePriorityValue, } from '@automatosx/contracts';
//# sourceMappingURL=index.js.map