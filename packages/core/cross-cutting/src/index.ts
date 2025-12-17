/**
 * @automatosx/cross-cutting
 *
 * Cross-Cutting Concerns Domain
 *
 * Provides Dead Letter Queue, Saga pattern, and Idempotency
 * for robust, fault-tolerant system operations.
 */

// Dead Letter Queue
export {
  createDeadLetterQueue,
  createInMemoryDeadLetterStorage,
  DeadLetterQueueError,
  processRetry,
  type DeadLetterQueue,
  type DeadLetterStorage,
} from './dead-letter-queue.js';

// Saga Manager
export {
  createSagaManager,
  defineSaga,
  SagaError,
  type SagaManager,
  type SagaStepExecutor,
  type CompensationExecutor,
} from './saga-manager.js';

// Idempotency Manager
export {
  createIdempotencyManager,
  createInMemoryIdempotencyStorage,
  withIdempotency,
  IdempotencyError,
  type IdempotencyManager,
  type IdempotencyStorage,
} from './idempotency-manager.js';

// Retention Manager
export {
  createRetentionManager,
  createInMemoryRetentionStore,
  createInMemoryArchiver,
  RetentionError,
  type RetentionManager,
  type RetentionStore,
  type RetentionEntry,
  type DataArchiver,
} from './retention-manager.js';

// Re-export key types from contracts for convenience
export type {
  IdempotencyCheckResult,
  DLQStats,
  SagaResult,
  RetentionPolicy,
  RetentionRunResult,
  RetentionSummary,
} from '@automatosx/contracts';
