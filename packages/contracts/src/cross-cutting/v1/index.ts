/**
 * Cross-Cutting Contracts V1
 *
 * Contracts for cross-cutting concerns including:
 * - Dead Letter Queue (DLQ)
 * - Saga Pattern
 * - Data Retention
 * - Idempotency
 */

// Dead Letter Queue
export {
  DeadLetterStatusSchema,
  DeadLetterErrorSchema,
  DeadLetterEntrySchema,
  DLQConfigSchema,
  DLQProcessResultSchema,
  DLQListOptionsSchema,
  DLQStatsSchema,
  DLQErrorCodes,
  validateDLQConfig,
  validateDeadLetterEntry,
  createDefaultDLQConfig,
  calculateRetryDelay,
  type DeadLetterStatus,
  type DeadLetterError,
  type DeadLetterEntry,
  type DLQConfig,
  type DLQProcessResult,
  type DLQListOptions,
  type DLQStats,
  type DLQErrorCode,
} from './dead-letter.js';

// Saga Pattern
export {
  CompensationActionTypeSchema,
  CompensationActionSchema,
  SagaFailureStrategySchema,
  CompensationOrderSchema,
  SagaDefinitionSchema,
  SagaStatusSchema,
  CompensationErrorSchema,
  SagaStateSchema,
  SagaResultSchema,
  SagaStepSchema,
  SagaContextSchema,
  SagaErrorCodes,
  SAGA_STATE_TRANSITIONS,
  validateSagaDefinition,
  validateSagaState,
  isValidSagaTransition,
  createInitialSagaState,
  type CompensationActionType,
  type CompensationAction,
  type SagaFailureStrategy,
  type CompensationOrder,
  type SagaDefinition,
  type SagaStatus,
  type CompensationError,
  type SagaState,
  type SagaResult,
  type SagaStep,
  type SagaContext,
  type SagaErrorCode,
} from './saga.js';

// Data Retention
export {
  RetentionDataTypeSchema,
  RetentionConditionsSchema,
  RetentionPolicySchema,
  RetentionRunResultSchema,
  RetentionSummarySchema,
  ArchiveEntrySchema,
  RetentionErrorCodes,
  validateRetentionPolicy,
  validateRetentionRunResult,
  createDefaultRetentionPolicy,
  calculateRetentionCutoff,
  type RetentionDataType,
  type RetentionConditions,
  type RetentionPolicy,
  type RetentionRunResult,
  type RetentionSummary,
  type ArchiveEntry,
  type RetentionErrorCode,
} from './retention.js';

// Idempotency
export {
  IdempotencyStatusSchema,
  CacheEntryStatusSchema,
  IdempotencyCacheEntrySchema,
  IdempotencyConfigSchema,
  IdempotencyCheckResultSchema,
  IdempotencyStatsSchema,
  IdempotencyErrorCodes,
  validateIdempotencyConfig,
  validateIdempotencyCacheEntry,
  createDefaultIdempotencyConfig,
  generateRequestHash,
  calculateExpiration,
  isEntryExpired,
  type IdempotencyStatus,
  type CacheEntryStatus,
  type IdempotencyCacheEntry,
  type IdempotencyConfig,
  type IdempotencyCheckResult,
  type IdempotencyStats,
  type IdempotencyErrorCode,
} from './idempotency.js';
