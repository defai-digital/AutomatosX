/**
 * Autonomous Loop Domain
 *
 * Governed write-test-fix cycles with guard gate integration.
 *
 * Key Invariants:
 * - INV-ALO-001: Guard gates run after EVERY write phase
 * - INV-ALO-002: Test phase required before verify (when requireTestPass=true)
 * - INV-ALO-003: Fix attempts bounded by maxFixAttempts
 * - INV-ALO-004: Breakpoints pause for user review
 * - INV-ALO-005: Changed files tracked for guard radius checks
 */

// Types
export type {
  AgentExecutorPort,
  AgentExecutionResult,
  TestRunnerPort,
  GuardPort,
  LoopStateStoragePort,
  LoopEvent,
  LoopEventEmitterPort,
  LoopControllerOptions,
  PhaseHandler,
  PhaseResult,
  IterationSummary,
} from './types.js';

// Phase Machine
export {
  InvalidTransitionError,
  createPhaseMachine,
  determineNextPhase,
  getPhaseDisplayName,
  getPhaseEmoji,
  calculateProgress,
  type PhaseMachine,
} from './phase-machine.js';

// Guard Integration
export {
  createStubGuardPort,
  runGuardCheck,
  shouldBlockExecution,
  hasBlockingViolations,
  getViolationSummary,
  createDisabledGuardResult,
  createErrorGuardResult,
  mergeGuardResults,
  AUTONOMOUS_DEVELOPMENT_POLICY,
} from './guard-integration.js';

// Test Runner
export {
  detectTestFramework,
  parseTestOutput,
  isTestSuccess,
  createStubTestRunnerPort,
  createTestResult,
  createFailedTestResult,
  createPassingTestResult,
  formatTestResult,
  getTestFailureSummary,
} from './test-runner.js';

// Loop Controller
export {
  LoopControllerError,
  createLoopController,
  type LoopController,
} from './loop-controller.js';
