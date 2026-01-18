/**
 * Autonomous Loop Contracts v1
 *
 * Exports all schemas, types, and utilities for governed
 * write-test-fix cycles.
 */

export {
  // Phase and Status
  AutonomousLoopPhaseSchema,
  AutonomousLoopStatusSchema,
  type AutonomousLoopPhase,
  type AutonomousLoopStatus,

  // Configuration
  AutonomousLoopConfigSchema,
  type AutonomousLoopConfig,

  // Guard Results
  GuardGateResultSchema,
  GuardCheckResultSchema,
  type GuardGateResult,
  type GuardCheckResult,

  // State
  TestResultSchema,
  LoopIterationSchema,
  AutonomousLoopStateSchema,
  type TestResult,
  type LoopIteration,
  type AutonomousLoopState,

  // Request/Response
  StartLoopRequestSchema,
  StartLoopResponseSchema,
  ContinueLoopRequestSchema,
  AbortLoopRequestSchema,
  LoopStatusResponseSchema,
  type StartLoopRequest,
  type StartLoopResponse,
  type ContinueLoopRequest,
  type AbortLoopRequest,
  type LoopStatusResponse,

  // Error Codes
  AutonomousLoopErrorCodes,
  type AutonomousLoopErrorCode,

  // Validation
  validateAutonomousLoopConfig,
  safeValidateAutonomousLoopConfig,
  validateAutonomousLoopState,
  validateStartLoopRequest,

  // Factory
  createDefaultAutonomousLoopConfig,
  createInitialLoopState,
  createLoopIteration,

  // Phase Transitions
  PHASE_TRANSITIONS,
  isValidPhaseTransition,
  getValidNextPhases,
} from './schema.js';
