/**
 * Token Budget Domain Contracts v1
 *
 * @packageDocumentation
 */

export {
  // Type Schemas
  InstructionTypeSchema,
  InstructionPrioritySchema,

  // Priority Constants
  PRIORITY_ORDER,
  TYPE_PRIORITY_ORDER,

  // Config Schemas
  PerTypeLimitsSchema,
  TokenBudgetConfigSchema,
  DEFAULT_TOKEN_BUDGET,

  // Instruction Schema
  EmbeddedInstructionSchema,

  // Result Schemas
  BudgetAllocationSchema,
  BudgetStatusSchema,

  // Estimation Schemas
  TokenEstimationRequestSchema,
  TokenEstimationResultSchema,

  // Input Schemas
  AllocationInputSchema,

  // Error Schemas
  TokenBudgetErrorCode,
  TokenBudgetErrorSchema,

  // Validation Functions
  validateTokenBudgetConfig,
  safeValidateTokenBudgetConfig,
  validateEmbeddedInstruction,
  safeValidateEmbeddedInstruction,
  validateAllocationInput,
  getPriorityValue,
  getTypePriorityValue,

  // Types
  type InstructionType,
  type InstructionPriority,
  type PerTypeLimits,
  type TokenBudgetConfig,
  type EmbeddedInstruction,
  type BudgetAllocation,
  type BudgetStatus,
  type TokenEstimationRequest,
  type TokenEstimationResult,
  type AllocationInput,
  type TokenBudgetError,
} from './schema.js';
