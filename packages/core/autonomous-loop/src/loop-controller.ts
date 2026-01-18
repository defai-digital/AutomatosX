/**
 * Loop Controller
 *
 * Main controller for autonomous loop execution.
 *
 * Invariants:
 * - INV-ALO-001: Guard gates run after EVERY write phase
 * - INV-ALO-002: Test phase required before verify (when requireTestPass=true)
 * - INV-ALO-003: Fix attempts bounded by maxFixAttempts
 * - INV-ALO-004: Breakpoints pause for user review
 * - INV-ALO-005: Changed files tracked for guard radius checks
 * - INV-ALO-007: Iteration limit enforced
 * - INV-ALO-008: Immutable iteration history
 * - INV-ALO-009: Guard block stops execution
 * - INV-ALO-010: Timeout per phase
 */

import type {
  AutonomousLoopState,
  AutonomousLoopConfig,
  StartLoopRequest,
  StartLoopResponse,
  ContinueLoopRequest,
  AbortLoopRequest,
  LoopStatusResponse,
} from '@defai.digital/contracts';
import {
  createInitialLoopState,
  createLoopIteration,
  createDefaultAutonomousLoopConfig,
  AutonomousLoopErrorCodes,
} from '@defai.digital/contracts';
import type {
  LoopControllerOptions,
  LoopStateStoragePort,
  AgentExecutorPort,
  LoopEventEmitterPort,
  PhaseResult,
} from './types.js';
import {
  createPhaseMachine,
  calculateProgress,
  type PhaseMachine,
} from './phase-machine.js';
import {
  runGuardCheck,
  shouldBlockExecution,
  createStubGuardPort,
} from './guard-integration.js';
import {
  createStubTestRunnerPort,
  getTestFailureSummary,
} from './test-runner.js';

/**
 * Error class for loop controller
 */
export class LoopControllerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LoopControllerError';
  }
}

/**
 * Loop controller interface
 */
export interface LoopController {
  /**
   * Start a new autonomous loop
   */
  start(request: StartLoopRequest): Promise<StartLoopResponse>;

  /**
   * Continue a paused loop
   */
  continue(request: ContinueLoopRequest): Promise<LoopStatusResponse>;

  /**
   * Abort a running or paused loop
   */
  abort(request: AbortLoopRequest): Promise<LoopStatusResponse>;

  /**
   * Get loop status
   */
  getStatus(loopId: string): Promise<LoopStatusResponse>;

  /**
   * List active loops
   */
  listActive(): Promise<AutonomousLoopState[]>;

  /**
   * Run one iteration of the loop
   */
  runIteration(loopId: string): Promise<AutonomousLoopState>;
}

/**
 * Create a stub agent executor
 */
function createStubAgentExecutor(): AgentExecutorPort {
  return {
    async execute({ task }) {
      console.warn(
        '[autonomous-loop] Using stub agent executor - no real execution. ' +
        'Inject a real AgentExecutorPort for production use.'
      );
      return {
        success: true,
        output: `Stub execution for: ${task.slice(0, 100)}`,
        changedFiles: [],
        durationMs: 100,
      };
    },
  };
}

/**
 * Create a stub storage port
 */
function createInMemoryStorage(): LoopStateStoragePort {
  const storage = new Map<string, AutonomousLoopState>();

  return {
    async get(loopId) {
      return storage.get(loopId) ?? null;
    },
    async set(loopId, state) {
      storage.set(loopId, state);
    },
    async delete(loopId) {
      storage.delete(loopId);
    },
    async listActive() {
      return Array.from(storage.values()).filter(
        (s) => s.status === 'running' || s.status === 'paused'
      );
    },
  };
}

/**
 * Create a stub event emitter
 */
function createStubEventEmitter(): LoopEventEmitterPort {
  return {
    emit() {
      // No-op
    },
    subscribe() {
      return () => {
        // No-op cleanup
      };
    },
  };
}

/**
 * Build agent execute params, filtering out undefined values
 */
function buildAgentParams(
  config: AutonomousLoopConfig,
  task: string,
  context?: Record<string, unknown>
): { agentId?: string; task: string; context?: Record<string, unknown>; provider?: string; timeout?: number } {
  const params: { agentId?: string; task: string; context?: Record<string, unknown>; provider?: string; timeout?: number } = {
    task,
    timeout: config.phaseTimeout,
  };

  if (config.agentId !== undefined) {
    params.agentId = config.agentId;
  }
  if (config.provider !== undefined) {
    params.provider = config.provider;
  }
  if (context !== undefined) {
    params.context = context;
  }

  return params;
}

/**
 * Build test runner params, filtering out undefined values
 */
function buildTestParams(
  config: AutonomousLoopConfig
): { command: string; workingDirectory?: string; timeout?: number } {
  const params: { command: string; workingDirectory?: string; timeout?: number } = {
    command: config.testCommand,
    timeout: config.testTimeout,
  };

  if (config.workingDirectory !== undefined) {
    params.workingDirectory = config.workingDirectory;
  }

  return params;
}

/**
 * Create loop controller
 */
export function createLoopController(
  options: Partial<LoopControllerOptions> = {}
): LoopController {
  const {
    agentExecutor = createStubAgentExecutor(),
    testRunner = createStubTestRunnerPort(),
    guard = createStubGuardPort(),
    storage = createInMemoryStorage(),
    eventEmitter = createStubEventEmitter(),
    defaultConfig = {},
  } = options;

  // Track active phase machines
  const phaseMachines = new Map<string, PhaseMachine>();

  /**
   * Get or create phase machine for loop
   */
  function getPhaseMachine(state: AutonomousLoopState): PhaseMachine {
    let machine = phaseMachines.get(state.loopId);
    if (!machine) {
      machine = createPhaseMachine(state.phase, state.config);
      phaseMachines.set(state.loopId, machine);
    }
    return machine;
  }

  /**
   * Update state and emit event
   */
  async function updateState(
    state: AutonomousLoopState,
    updates: Partial<AutonomousLoopState>,
    eventType?: 'phase_started' | 'phase_completed' | 'paused' | 'resumed' | 'completed' | 'failed' | 'blocked' | 'cancelled'
  ): Promise<AutonomousLoopState> {
    const newState: AutonomousLoopState = {
      ...state,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await storage.set(state.loopId, newState);

    if (eventType) {
      eventEmitter.emit({
        type: eventType,
        loopId: state.loopId,
        phase: newState.phase,
        iteration: newState.iteration,
        timestamp: newState.updatedAt,
        details: { status: newState.status },
      });
    }

    return newState;
  }

  /**
   * Execute plan phase
   */
  async function executePlanPhase(state: AutonomousLoopState): Promise<PhaseResult> {
    const result = await agentExecutor.execute(
      buildAgentParams(state.config, `Plan the implementation for: ${state.task}`)
    );

    const phaseResult: PhaseResult = {
      success: result.success,
      nextPhase: result.success ? 'write' : 'plan',
      changedFiles: result.changedFiles,
    };

    if (result.error) {
      phaseResult.error = result.error;
    }

    return phaseResult;
  }

  /**
   * Execute write phase
   */
  async function executeWritePhase(state: AutonomousLoopState): Promise<PhaseResult> {
    const context: Record<string, unknown> = {};

    // Include test failure context if fixing
    if (state.lastTestResult && !state.lastTestResult.passed) {
      context.testFailures = getTestFailureSummary(state.lastTestResult);
    }

    const result = await agentExecutor.execute(
      buildAgentParams(state.config, state.task, Object.keys(context).length > 0 ? context : undefined)
    );

    if (!result.success) {
      const phaseResult: PhaseResult = {
        success: false,
        nextPhase: 'write',
      };
      if (result.error) {
        phaseResult.error = result.error;
      }
      return phaseResult;
    }

    // INV-ALO-001: Guard gates run after EVERY write phase
    const guardResult = await runGuardCheck(guard, {
      ...state,
      changedFiles: [...state.changedFiles, ...result.changedFiles],
    });

    // INV-ALO-009: Guard block stops execution
    if (shouldBlockExecution(guardResult)) {
      return {
        success: false,
        nextPhase: 'write',
        changedFiles: result.changedFiles,
        guardResult,
        shouldPause: true,
        pauseReason: `Guard blocked: ${guardResult.summary}`,
      };
    }

    // Determine next phase based on config
    // INV-ALO-002: Test phase required before verify
    const nextPhase = state.config.requireTestPass ? 'test' : 'verify';

    // Check breakpoint
    // INV-ALO-004: Breakpoints pause for user review
    const machine = getPhaseMachine(state);
    if (machine.isBreakpoint()) {
      return {
        success: true,
        nextPhase,
        changedFiles: result.changedFiles,
        guardResult,
        shouldPause: true,
        pauseReason: 'Breakpoint at write phase',
      };
    }

    return {
      success: true,
      nextPhase,
      changedFiles: result.changedFiles,
      guardResult,
    };
  }

  /**
   * Execute test phase
   */
  async function executeTestPhase(state: AutonomousLoopState): Promise<PhaseResult> {
    const testResult = await testRunner.runTests(buildTestParams(state.config));

    if (testResult.passed) {
      return {
        success: true,
        nextPhase: 'verify',
        testResult,
      };
    }

    // INV-ALO-003: Fix attempts bounded
    if (state.currentFixAttempts < state.config.maxFixAttempts) {
      return {
        success: false,
        nextPhase: 'fix',
        testResult,
      };
    }

    // Max fix attempts reached
    return {
      success: false,
      nextPhase: 'write',
      testResult,
      error: `Max fix attempts (${state.config.maxFixAttempts}) exceeded`,
    };
  }

  /**
   * Execute fix phase
   */
  async function executeFixPhase(state: AutonomousLoopState): Promise<PhaseResult> {
    // Defensive check - fix phase should only be entered with test results
    if (!state.lastTestResult) {
      return {
        success: false,
        nextPhase: 'test',
        error: 'Fix phase entered without test result - running tests first',
      };
    }

    const testFailureSummary = getTestFailureSummary(state.lastTestResult);
    const context: Record<string, unknown> = {
      testFailures: testFailureSummary,
      fixAttempt: state.currentFixAttempts + 1,
      maxAttempts: state.config.maxFixAttempts,
    };

    const result = await agentExecutor.execute(
      buildAgentParams(state.config, `Fix the failing tests:\n${testFailureSummary}`, context)
    );

    const phaseResult: PhaseResult = {
      success: result.success,
      nextPhase: 'test',
      changedFiles: result.changedFiles,
    };

    if (result.error) {
      phaseResult.error = result.error;
    }

    return phaseResult;
  }

  /**
   * Execute verify phase
   */
  async function executeVerifyPhase(state: AutonomousLoopState): Promise<PhaseResult> {
    // Run final guard check
    const guardResult = await runGuardCheck(guard, state);

    if (shouldBlockExecution(guardResult)) {
      return {
        success: false,
        nextPhase: 'write',
        guardResult,
        error: `Verification failed: ${guardResult.summary}`,
      };
    }

    return {
      success: true,
      nextPhase: 'complete',
      guardResult,
    };
  }

  /**
   * Execute a phase
   */
  async function executePhase(state: AutonomousLoopState): Promise<PhaseResult> {
    switch (state.phase) {
      case 'plan':
        return executePlanPhase(state);
      case 'write':
        return executeWritePhase(state);
      case 'test':
        return executeTestPhase(state);
      case 'fix':
        return executeFixPhase(state);
      case 'verify':
        return executeVerifyPhase(state);
      case 'complete':
        return { success: true, nextPhase: 'complete' };
      default:
        return { success: false, nextPhase: 'plan', error: 'Unknown phase' };
    }
  }

  /**
   * Create status response from state
   */
  function createStatusResponse(state: AutonomousLoopState): LoopStatusResponse {
    const isActive = state.status === 'running' || state.status === 'paused';
    const awaitingInput = state.status === 'paused' || state.status === 'blocked';

    return {
      state,
      isActive,
      awaitingInput,
      progress: calculateProgress(state),
      estimatedRemaining: isActive
        ? Math.max(0, state.config.maxIterations - state.iteration)
        : 0,
    };
  }

  /**
   * Merge configs, ensuring all required fields are present
   */
  function mergeConfigs(
    base: AutonomousLoopConfig,
    ...overrides: (Record<string, unknown> | undefined)[]
  ): AutonomousLoopConfig {
    const result = { ...base } as Record<string, unknown>;
    for (const override of overrides) {
      if (override) {
        // Only apply defined values
        for (const [key, value] of Object.entries(override)) {
          if (value !== undefined) {
            result[key] = value;
          }
        }
      }
    }
    return result as AutonomousLoopConfig;
  }

  return {
    async start(request): Promise<StartLoopResponse> {
      const config = mergeConfigs(
        createDefaultAutonomousLoopConfig(),
        defaultConfig,
        request.config
      );

      const state = createInitialLoopState(request.task, config);

      if (request.sessionId) {
        state.sessionId = request.sessionId;
      }

      await storage.set(state.loopId, state);

      // Create phase machine
      getPhaseMachine(state);

      eventEmitter.emit({
        type: 'phase_started',
        loopId: state.loopId,
        phase: state.phase,
        iteration: 0,
        timestamp: state.startedAt,
      });

      return {
        loopId: state.loopId,
        state,
        started: true,
        message: 'Loop started successfully',
      };
    },

    async continue(request): Promise<LoopStatusResponse> {
      const state = await storage.get(request.loopId);
      if (!state) {
        throw new LoopControllerError(
          AutonomousLoopErrorCodes.LOOP_NOT_FOUND,
          `Loop not found: ${request.loopId}`
        );
      }

      if (state.status !== 'paused' && state.status !== 'blocked') {
        throw new LoopControllerError(
          AutonomousLoopErrorCodes.LOOP_NOT_PAUSED,
          `Loop is not paused: ${request.loopId}`
        );
      }

      // Apply config overrides
      if (request.configOverrides) {
        state.config = mergeConfigs(state.config, request.configOverrides);
      }

      // Handle skip to phase
      if (request.skipToPhase) {
        const machine = getPhaseMachine(state);
        if (machine.canTransitionTo(request.skipToPhase)) {
          machine.transition(request.skipToPhase);
          state.phase = request.skipToPhase;
        }
      }

      // Resume
      const updatedState = await updateState(
        state,
        {
          status: 'running',
          pauseReason: undefined,
        },
        'resumed'
      );

      return createStatusResponse(updatedState);
    },

    async abort(request): Promise<LoopStatusResponse> {
      const state = await storage.get(request.loopId);
      if (!state) {
        throw new LoopControllerError(
          AutonomousLoopErrorCodes.LOOP_NOT_FOUND,
          `Loop not found: ${request.loopId}`
        );
      }

      const updatedState = await updateState(
        state,
        {
          status: 'cancelled',
          error: request.reason ?? 'Aborted by user',
          completedAt: new Date().toISOString(),
        },
        'cancelled'
      );

      // Clean up phase machine
      phaseMachines.delete(request.loopId);

      return createStatusResponse(updatedState);
    },

    async getStatus(loopId): Promise<LoopStatusResponse> {
      const state = await storage.get(loopId);
      if (!state) {
        throw new LoopControllerError(
          AutonomousLoopErrorCodes.LOOP_NOT_FOUND,
          `Loop not found: ${loopId}`
        );
      }

      return createStatusResponse(state);
    },

    async listActive(): Promise<AutonomousLoopState[]> {
      return storage.listActive();
    },

    async runIteration(loopId): Promise<AutonomousLoopState> {
      let state = await storage.get(loopId);
      if (!state) {
        throw new LoopControllerError(
          AutonomousLoopErrorCodes.LOOP_NOT_FOUND,
          `Loop not found: ${loopId}`
        );
      }

      // Check if can run
      if (state.status !== 'running') {
        return state;
      }

      // INV-ALO-007: Check iteration limit
      if (state.iteration >= state.config.maxIterations) {
        // Clean up phase machine on failure to prevent memory leak
        phaseMachines.delete(loopId);
        return updateState(
          state,
          {
            status: 'failed',
            error: 'Max iterations exceeded',
            completedAt: new Date().toISOString(),
          },
          'failed'
        );
      }

      const machine = getPhaseMachine(state);
      const iterationStart = new Date();

      // Emit phase started
      eventEmitter.emit({
        type: 'phase_started',
        loopId,
        phase: state.phase,
        iteration: state.iteration + 1,
        timestamp: iterationStart.toISOString(),
      });

      // Execute phase with timeout
      // INV-ALO-010: Timeout per phase
      let result: PhaseResult;
      const currentState = state; // Capture for closure
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Phase timeout')), currentState.config.phaseTimeout);
        });
        result = await Promise.race([executePhase(currentState), timeoutPromise]);
      } catch (error) {
        result = {
          success: false,
          nextPhase: currentState.phase,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      } finally {
        // Clean up timeout to prevent memory leak
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      }

      const durationMs = Date.now() - iterationStart.getTime();

      // INV-ALO-008: Create immutable iteration record
      const iterationRecord = createLoopIteration(
        state.iteration + 1,
        state.phase,
        result.success,
        {
          changedFiles: result.changedFiles ?? [],
          testResult: result.testResult,
          guardResult: result.guardResult,
          fixAttempts: state.phase === 'fix' ? state.currentFixAttempts + 1 : 0,
          error: result.error,
          durationMs,
          completedAt: new Date().toISOString(),
        }
      );

      // INV-ALO-005: Track changed files
      const allChangedFiles = [
        ...state.changedFiles,
        ...(result.changedFiles ?? []),
      ];

      // Update state
      const updates: Partial<AutonomousLoopState> = {
        iterations: [...state.iterations, iterationRecord],
        changedFiles: [...new Set(allChangedFiles)], // Dedupe
        lastTestResult: result.testResult ?? state.lastTestResult,
        lastGuardResult: result.guardResult ?? state.lastGuardResult,
      };

      // Handle phase transition
      if (result.success) {
        machine.transition(result.nextPhase);
        updates.phase = result.nextPhase;

        // Reset fix attempts on successful non-fix phase
        if (state.phase !== 'fix') {
          updates.currentFixAttempts = 0;
        }

        // INV-ALO-003: Increment fix attempts
        if (state.phase === 'fix') {
          updates.currentFixAttempts = state.currentFixAttempts + 1;
        }
      } else if (result.nextPhase === 'fix') {
        machine.transition('fix');
        updates.phase = 'fix';
      }

      // Check for completion
      if (result.nextPhase === 'complete') {
        updates.status = 'completed';
        updates.completedAt = new Date().toISOString();
        state = await updateState(state, updates, 'completed');
        phaseMachines.delete(loopId);
        return state;
      }

      // Check for pause/block
      if (result.shouldPause) {
        updates.status = result.guardResult?.blocked ? 'blocked' : 'paused';
        updates.pauseReason = result.pauseReason;
        state = await updateState(
          state,
          updates,
          result.guardResult?.blocked ? 'blocked' : 'paused'
        );
        return state;
      }

      // Increment iteration
      updates.iteration = state.iteration + 1;

      // Emit phase completed
      eventEmitter.emit({
        type: 'phase_completed',
        loopId,
        phase: state.phase,
        iteration: updates.iteration,
        timestamp: new Date().toISOString(),
        details: { success: result.success },
      });

      return updateState(state, updates);
    },
  };
}
