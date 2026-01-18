/**
 * Autonomous Loop Domain Types
 *
 * Port interfaces for the autonomous loop controller.
 */

import type {
  AutonomousLoopConfig,
  AutonomousLoopState,
  AutonomousLoopPhase,
  TestResult,
  GuardCheckResult,
} from '@defai.digital/contracts';

/**
 * Port for executing agent tasks
 */
export interface AgentExecutorPort {
  /**
   * Execute an agent with the given task and context
   */
  execute(params: {
    agentId?: string;
    task: string;
    context?: Record<string, unknown>;
    provider?: string;
    timeout?: number;
  }): Promise<AgentExecutionResult>;
}

/**
 * Result of agent execution
 */
export interface AgentExecutionResult {
  success: boolean;
  output: string;
  changedFiles: string[];
  error?: string;
  durationMs: number;
}

/**
 * Port for running tests
 */
export interface TestRunnerPort {
  /**
   * Execute tests and return results
   */
  runTests(params: {
    command: string;
    workingDirectory?: string;
    timeout?: number;
  }): Promise<TestResult>;

  /**
   * Parse test output to extract results
   */
  parseOutput(output: string): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    failedTestNames: string[];
  };
}

/**
 * Port for guard checks
 */
export interface GuardPort {
  /**
   * Check changed files against a policy
   */
  check(params: {
    policyId: string;
    changedPaths: string[];
    target?: string;
  }): Promise<GuardCheckResult>;

  /**
   * Get available policies
   */
  listPolicies(): Promise<string[]>;
}

/**
 * Port for storing loop state
 */
export interface LoopStateStoragePort {
  /**
   * Get loop state by ID
   */
  get(loopId: string): Promise<AutonomousLoopState | null>;

  /**
   * Save loop state
   */
  set(loopId: string, state: AutonomousLoopState): Promise<void>;

  /**
   * Delete loop state
   */
  delete(loopId: string): Promise<void>;

  /**
   * List all active loops
   */
  listActive(): Promise<AutonomousLoopState[]>;
}

/**
 * Event emitted during loop execution
 */
export interface LoopEvent {
  type: 'phase_started' | 'phase_completed' | 'paused' | 'resumed' | 'completed' | 'failed' | 'blocked' | 'cancelled';
  loopId: string;
  phase?: AutonomousLoopPhase;
  iteration?: number;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Port for emitting loop events
 */
export interface LoopEventEmitterPort {
  /**
   * Emit a loop event
   */
  emit(event: LoopEvent): void;

  /**
   * Subscribe to loop events
   */
  subscribe(handler: (event: LoopEvent) => void): () => void;
}

/**
 * Options for loop controller
 */
export interface LoopControllerOptions {
  /**
   * Agent executor for code generation
   */
  agentExecutor: AgentExecutorPort;

  /**
   * Test runner for executing tests
   */
  testRunner: TestRunnerPort;

  /**
   * Guard for policy checks
   */
  guard: GuardPort;

  /**
   * State storage
   */
  storage: LoopStateStoragePort;

  /**
   * Event emitter
   */
  eventEmitter?: LoopEventEmitterPort;

  /**
   * Default configuration
   */
  defaultConfig?: Partial<AutonomousLoopConfig>;
}

/**
 * Phase transition handler
 */
export interface PhaseHandler {
  /**
   * Execute the phase
   */
  execute(state: AutonomousLoopState): Promise<PhaseResult>;

  /**
   * Can this phase be skipped?
   */
  canSkip?(state: AutonomousLoopState): boolean;
}

/**
 * Result of phase execution
 */
export interface PhaseResult {
  success: boolean;
  nextPhase: AutonomousLoopPhase;
  changedFiles?: string[];
  testResult?: TestResult;
  guardResult?: GuardCheckResult;
  error?: string;
  shouldPause?: boolean;
  pauseReason?: string;
}

/**
 * Iteration summary for reporting
 */
export interface IterationSummary {
  iteration: number;
  phases: {
    phase: AutonomousLoopPhase;
    success: boolean;
    durationMs: number;
  }[];
  changedFiles: string[];
  testsPassed: boolean;
  guardPassed: boolean;
  fixAttempts: number;
}
