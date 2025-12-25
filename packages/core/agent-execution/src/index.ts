/**
 * @defai.digital/agent-execution
 *
 * Agent Execution Domain
 *
 * Provides checkpoint management, delegation tracking, and parallel execution
 * for resumable, composable agent workflows.
 */

// Checkpoint Manager
export {
  createCheckpointManager,
  createInMemoryCheckpointStorage,
  CheckpointError,
  type CheckpointManager,
  type CheckpointStorage,
} from './checkpoint-manager.js';

// Delegation Tracker
export {
  createDelegationTracker,
  validateDelegationRequest,
  createSuccessResult,
  createFailureResult,
  DelegationError,
  type DelegationTracker,
} from './delegation-tracker.js';

// Parallel Executor
export {
  createParallelExecutor,
  identifyParallelGroups,
  ParallelExecutionError,
  type ParallelExecutor,
  type StepExecutor,
} from './parallel-executor.js';
