/**
 * Autonomous Loop Contract Tests
 *
 * Tests for autonomous loop schema validation and invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  // Schemas
  AutonomousLoopPhaseSchema,
  AutonomousLoopStatusSchema,
  AutonomousLoopConfigSchema,
  AutonomousLoopStateSchema,
  TestResultSchema,
  LoopIterationSchema,
  GuardGateResultSchema,
  GuardCheckResultSchema,
  StartLoopRequestSchema,
  StartLoopResponseSchema,
  ContinueLoopRequestSchema,
  AbortLoopRequestSchema,
  LoopStatusResponseSchema,
  // Factory functions
  createDefaultAutonomousLoopConfig,
  createInitialLoopState,
  createLoopIteration,
  // Validation functions
  validateAutonomousLoopConfig,
  safeValidateAutonomousLoopConfig,
  validateAutonomousLoopState,
  validateStartLoopRequest,
  // Phase transitions
  PHASE_TRANSITIONS,
  isValidPhaseTransition,
  getValidNextPhases,
  // Error codes
  AutonomousLoopErrorCodes,
} from '@defai.digital/contracts';

// ============================================================================
// Phase Schema Tests
// ============================================================================

describe('AutonomousLoopPhaseSchema', () => {
  it('should accept valid phases', () => {
    expect(AutonomousLoopPhaseSchema.parse('plan')).toBe('plan');
    expect(AutonomousLoopPhaseSchema.parse('write')).toBe('write');
    expect(AutonomousLoopPhaseSchema.parse('test')).toBe('test');
    expect(AutonomousLoopPhaseSchema.parse('fix')).toBe('fix');
    expect(AutonomousLoopPhaseSchema.parse('verify')).toBe('verify');
    expect(AutonomousLoopPhaseSchema.parse('complete')).toBe('complete');
  });

  it('should reject invalid phases', () => {
    expect(() => AutonomousLoopPhaseSchema.parse('invalid')).toThrow();
    expect(() => AutonomousLoopPhaseSchema.parse('')).toThrow();
    expect(() => AutonomousLoopPhaseSchema.parse(123)).toThrow();
  });
});

describe('AutonomousLoopStatusSchema', () => {
  it('should accept valid statuses', () => {
    expect(AutonomousLoopStatusSchema.parse('running')).toBe('running');
    expect(AutonomousLoopStatusSchema.parse('paused')).toBe('paused');
    expect(AutonomousLoopStatusSchema.parse('completed')).toBe('completed');
    expect(AutonomousLoopStatusSchema.parse('failed')).toBe('failed');
    expect(AutonomousLoopStatusSchema.parse('blocked')).toBe('blocked');
    expect(AutonomousLoopStatusSchema.parse('cancelled')).toBe('cancelled');
  });

  it('should reject invalid statuses', () => {
    expect(() => AutonomousLoopStatusSchema.parse('invalid')).toThrow();
  });
});

// ============================================================================
// Config Schema Tests
// ============================================================================

describe('AutonomousLoopConfigSchema', () => {
  it('should accept valid configuration', () => {
    const config = AutonomousLoopConfigSchema.parse({
      maxIterations: 10,
      maxFixAttempts: 3,
      requireTestPass: true,
      breakpoints: ['write'],
      testCommand: 'pnpm test',
    });

    expect(config.maxIterations).toBe(10);
    expect(config.maxFixAttempts).toBe(3);
    expect(config.requireTestPass).toBe(true);
    expect(config.breakpoints).toEqual(['write']);
    expect(config.testCommand).toBe('pnpm test');
  });

  it('should apply defaults for missing fields', () => {
    const config = AutonomousLoopConfigSchema.parse({});

    expect(config.maxIterations).toBe(10);
    expect(config.maxFixAttempts).toBe(3);
    expect(config.requireTestPass).toBe(true);
    expect(config.breakpoints).toEqual(['write']);
    expect(config.testCommand).toBe('pnpm test');
    expect(config.autoCommit).toBe(false);
    expect(config.enableCheckpointing).toBeUndefined();
  });

  it('should reject invalid maxIterations', () => {
    expect(() => AutonomousLoopConfigSchema.parse({ maxIterations: 0 })).toThrow();
    expect(() => AutonomousLoopConfigSchema.parse({ maxIterations: 51 })).toThrow();
  });

  it('should reject invalid maxFixAttempts', () => {
    expect(() => AutonomousLoopConfigSchema.parse({ maxFixAttempts: 0 })).toThrow();
    expect(() => AutonomousLoopConfigSchema.parse({ maxFixAttempts: 11 })).toThrow();
  });

  it('should accept optional guardPolicy', () => {
    const config = AutonomousLoopConfigSchema.parse({
      guardPolicy: 'autonomous-development',
    });
    expect(config.guardPolicy).toBe('autonomous-development');
  });

  it('should accept optional agentId and provider', () => {
    const config = AutonomousLoopConfigSchema.parse({
      agentId: 'my-agent',
      provider: 'claude',
    });
    expect(config.agentId).toBe('my-agent');
    expect(config.provider).toBe('claude');
  });
});

// ============================================================================
// State Schema Tests
// ============================================================================

describe('AutonomousLoopStateSchema', () => {
  it('should accept valid state', () => {
    const state = AutonomousLoopStateSchema.parse({
      loopId: '550e8400-e29b-41d4-a716-446655440000',
      phase: 'write',
      iteration: 1,
      status: 'running',
      task: 'Implement feature X',
      config: createDefaultAutonomousLoopConfig(),
      changedFiles: ['src/feature.ts'],
      iterations: [],
      currentFixAttempts: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(state.loopId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(state.phase).toBe('write');
    expect(state.iteration).toBe(1);
    expect(state.status).toBe('running');
    expect(state.task).toBe('Implement feature X');
    expect(state.changedFiles).toEqual(['src/feature.ts']);
  });

  it('should reject invalid loopId', () => {
    expect(() =>
      AutonomousLoopStateSchema.parse({
        loopId: 'not-a-uuid',
        phase: 'plan',
        iteration: 0,
        status: 'running',
        task: 'Test',
        config: createDefaultAutonomousLoopConfig(),
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ).toThrow();
  });
});

// ============================================================================
// Test Result Schema Tests
// ============================================================================

describe('TestResultSchema', () => {
  it('should accept valid test result', () => {
    const result = TestResultSchema.parse({
      passed: true,
      totalTests: 10,
      passedTests: 10,
      failedTests: 0,
      skippedTests: 0,
      durationMs: 5000,
    });

    expect(result.passed).toBe(true);
    expect(result.totalTests).toBe(10);
    expect(result.passedTests).toBe(10);
  });

  it('should accept failed test result with error output', () => {
    const result = TestResultSchema.parse({
      passed: false,
      totalTests: 10,
      passedTests: 8,
      failedTests: 2,
      skippedTests: 0,
      durationMs: 5000,
      errorOutput: 'Test error output...',
      failedTestNames: ['test1', 'test2'],
    });

    expect(result.passed).toBe(false);
    expect(result.failedTests).toBe(2);
    expect(result.errorOutput).toBe('Test error output...');
    expect(result.failedTestNames).toEqual(['test1', 'test2']);
  });
});

// ============================================================================
// Loop Iteration Schema Tests
// ============================================================================

describe('LoopIterationSchema', () => {
  it('should accept valid iteration', () => {
    const iteration = LoopIterationSchema.parse({
      iteration: 1,
      phase: 'write',
      success: true,
      changedFiles: ['src/file.ts'],
      durationMs: 1000,
      startedAt: new Date().toISOString(),
    });

    expect(iteration.iteration).toBe(1);
    expect(iteration.phase).toBe('write');
    expect(iteration.success).toBe(true);
    expect(iteration.changedFiles).toEqual(['src/file.ts']);
  });

  it('should accept iteration with test and guard results', () => {
    const iteration = LoopIterationSchema.parse({
      iteration: 2,
      phase: 'test',
      success: false,
      changedFiles: [],
      durationMs: 5000,
      startedAt: new Date().toISOString(),
      testResult: {
        passed: false,
        totalTests: 10,
        passedTests: 8,
        failedTests: 2,
        skippedTests: 0,
        durationMs: 4500,
      },
      fixAttempts: 1,
      error: 'Tests failed',
    });

    expect(iteration.testResult?.passed).toBe(false);
    expect(iteration.fixAttempts).toBe(1);
    expect(iteration.error).toBe('Tests failed');
  });
});

// ============================================================================
// Guard Result Schema Tests
// ============================================================================

describe('GuardGateResultSchema', () => {
  it('should accept valid gate result', () => {
    const result = GuardGateResultSchema.parse({
      gateId: 'path_violation',
      passed: true,
    });

    expect(result.gateId).toBe('path_violation');
    expect(result.passed).toBe(true);
  });

  it('should accept failed gate result with violations', () => {
    const result = GuardGateResultSchema.parse({
      gateId: 'secrets_detection',
      passed: false,
      severity: 'error',
      message: 'Potential secrets detected',
      violations: [
        { path: 'src/config.ts', message: 'API key detected' },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.violations).toHaveLength(1);
  });
});

describe('GuardCheckResultSchema', () => {
  it('should accept valid guard check result', () => {
    const result = GuardCheckResultSchema.parse({
      policyId: 'autonomous-development',
      passed: true,
      blocked: false,
      gateResults: [],
      checkedAt: new Date().toISOString(),
    });

    expect(result.policyId).toBe('autonomous-development');
    expect(result.passed).toBe(true);
    expect(result.blocked).toBe(false);
  });
});

// ============================================================================
// Request/Response Schema Tests
// ============================================================================

describe('StartLoopRequestSchema', () => {
  it('should accept valid start request', () => {
    const request = StartLoopRequestSchema.parse({
      task: 'Implement user authentication',
    });

    expect(request.task).toBe('Implement user authentication');
  });

  it('should accept request with config and sessionId', () => {
    const request = StartLoopRequestSchema.parse({
      task: 'Fix bug #123',
      config: {
        maxIterations: 5,
        guardPolicy: 'bugfix',
      },
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(request.task).toBe('Fix bug #123');
    expect(request.config?.maxIterations).toBe(5);
    expect(request.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should reject empty task', () => {
    expect(() => StartLoopRequestSchema.parse({ task: '' })).toThrow();
  });
});

describe('ContinueLoopRequestSchema', () => {
  it('should accept valid continue request', () => {
    const request = ContinueLoopRequestSchema.parse({
      loopId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(request.loopId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should accept request with skip to phase', () => {
    const request = ContinueLoopRequestSchema.parse({
      loopId: '550e8400-e29b-41d4-a716-446655440000',
      skipToPhase: 'verify',
      feedback: 'Looks good, skip testing',
    });

    expect(request.skipToPhase).toBe('verify');
    expect(request.feedback).toBe('Looks good, skip testing');
  });
});

describe('AbortLoopRequestSchema', () => {
  it('should accept valid abort request', () => {
    const request = AbortLoopRequestSchema.parse({
      loopId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(request.loopId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(request.keepChanges).toBe(true); // default
  });

  it('should accept request with reason', () => {
    const request = AbortLoopRequestSchema.parse({
      loopId: '550e8400-e29b-41d4-a716-446655440000',
      reason: 'Requirements changed',
      keepChanges: false,
    });

    expect(request.reason).toBe('Requirements changed');
    expect(request.keepChanges).toBe(false);
  });
});

describe('LoopStatusResponseSchema', () => {
  it('should accept valid status response', () => {
    const state = createInitialLoopState('Test task');
    const response = LoopStatusResponseSchema.parse({
      state,
      isActive: true,
      awaitingInput: false,
      progress: 10,
    });

    expect(response.isActive).toBe(true);
    expect(response.awaitingInput).toBe(false);
    expect(response.progress).toBe(10);
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('createDefaultAutonomousLoopConfig', () => {
  it('should create config with defaults', () => {
    const config = createDefaultAutonomousLoopConfig();

    expect(config.maxIterations).toBe(10);
    expect(config.maxFixAttempts).toBe(3);
    expect(config.requireTestPass).toBe(true);
    expect(config.breakpoints).toEqual(['write']);
    expect(config.testCommand).toBe('pnpm test');
    expect(config.failureStrategy).toBeUndefined();
  });
});

describe('createInitialLoopState', () => {
  it('should create initial state', () => {
    const state = createInitialLoopState('Implement feature');

    expect(state.phase).toBe('plan');
    expect(state.iteration).toBe(0);
    expect(state.status).toBe('running');
    expect(state.task).toBe('Implement feature');
    expect(state.changedFiles).toEqual([]);
    expect(state.iterations).toEqual([]);
    expect(state.currentFixAttempts).toBe(0);
    expect(state.loopId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('should accept config overrides', () => {
    const state = createInitialLoopState('Implement feature', {
      maxIterations: 5,
      guardPolicy: 'autonomous-development',
    });

    expect(state.config.maxIterations).toBe(5);
    expect(state.config.guardPolicy).toBe('autonomous-development');
  });
});

describe('createLoopIteration', () => {
  it('should create iteration record', () => {
    const iteration = createLoopIteration(1, 'write', true);

    expect(iteration.iteration).toBe(1);
    expect(iteration.phase).toBe('write');
    expect(iteration.success).toBe(true);
    expect(iteration.changedFiles).toEqual([]);
    expect(iteration.fixAttempts).toBe(0);
    expect(iteration.durationMs).toBe(0);
  });

  it('should accept options', () => {
    const iteration = createLoopIteration(2, 'test', false, {
      changedFiles: ['src/file.ts'],
      error: 'Tests failed',
      durationMs: 5000,
    });

    expect(iteration.changedFiles).toEqual(['src/file.ts']);
    expect(iteration.error).toBe('Tests failed');
    expect(iteration.durationMs).toBe(5000);
  });
});

// ============================================================================
// Validation Function Tests
// ============================================================================

describe('validateAutonomousLoopConfig', () => {
  it('should validate valid config', () => {
    const config = validateAutonomousLoopConfig({
      maxIterations: 10,
    });
    expect(config.maxIterations).toBe(10);
  });

  it('should throw on invalid config', () => {
    expect(() => validateAutonomousLoopConfig({ maxIterations: -1 })).toThrow();
  });
});

describe('safeValidateAutonomousLoopConfig', () => {
  it('should return success for valid config', () => {
    const result = safeValidateAutonomousLoopConfig({
      maxIterations: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should return error for invalid config', () => {
    const result = safeValidateAutonomousLoopConfig({
      maxIterations: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('validateAutonomousLoopState', () => {
  it('should validate valid state', () => {
    const state = validateAutonomousLoopState(
      createInitialLoopState('Test task')
    );
    expect(state.task).toBe('Test task');
  });
});

describe('validateStartLoopRequest', () => {
  it('should validate valid request', () => {
    const request = validateStartLoopRequest({
      task: 'Test task',
    });
    expect(request.task).toBe('Test task');
  });
});

// ============================================================================
// Phase Transition Tests
// ============================================================================

describe('PHASE_TRANSITIONS', () => {
  it('should define valid transitions for all phases', () => {
    expect(PHASE_TRANSITIONS.plan).toEqual(['write']);
    expect(PHASE_TRANSITIONS.write).toEqual(['test', 'verify']);
    expect(PHASE_TRANSITIONS.test).toEqual(['fix', 'verify']);
    expect(PHASE_TRANSITIONS.fix).toEqual(['test', 'write']);
    expect(PHASE_TRANSITIONS.verify).toEqual(['complete', 'write']);
    expect(PHASE_TRANSITIONS.complete).toEqual([]);
  });
});

describe('isValidPhaseTransition', () => {
  it('should return true for valid transitions', () => {
    expect(isValidPhaseTransition('plan', 'write')).toBe(true);
    expect(isValidPhaseTransition('write', 'test')).toBe(true);
    expect(isValidPhaseTransition('write', 'verify')).toBe(true);
    expect(isValidPhaseTransition('test', 'fix')).toBe(true);
    expect(isValidPhaseTransition('test', 'verify')).toBe(true);
    expect(isValidPhaseTransition('fix', 'test')).toBe(true);
    expect(isValidPhaseTransition('fix', 'write')).toBe(true);
    expect(isValidPhaseTransition('verify', 'complete')).toBe(true);
    expect(isValidPhaseTransition('verify', 'write')).toBe(true);
  });

  it('should return false for invalid transitions', () => {
    expect(isValidPhaseTransition('plan', 'test')).toBe(false);
    expect(isValidPhaseTransition('plan', 'verify')).toBe(false);
    expect(isValidPhaseTransition('write', 'plan')).toBe(false);
    expect(isValidPhaseTransition('test', 'plan')).toBe(false);
    expect(isValidPhaseTransition('complete', 'plan')).toBe(false);
    expect(isValidPhaseTransition('complete', 'write')).toBe(false);
  });
});

describe('getValidNextPhases', () => {
  it('should return valid next phases', () => {
    expect(getValidNextPhases('plan')).toEqual(['write']);
    expect(getValidNextPhases('write')).toEqual(['test', 'verify']);
    expect(getValidNextPhases('test')).toEqual(['fix', 'verify']);
    expect(getValidNextPhases('complete')).toEqual([]);
  });
});

// ============================================================================
// Error Codes Tests
// ============================================================================

describe('AutonomousLoopErrorCodes', () => {
  it('should define all error codes', () => {
    expect(AutonomousLoopErrorCodes.LOOP_NOT_FOUND).toBe('ALO_LOOP_NOT_FOUND');
    expect(AutonomousLoopErrorCodes.LOOP_ALREADY_RUNNING).toBe('ALO_LOOP_ALREADY_RUNNING');
    expect(AutonomousLoopErrorCodes.LOOP_NOT_PAUSED).toBe('ALO_LOOP_NOT_PAUSED');
    expect(AutonomousLoopErrorCodes.MAX_ITERATIONS_EXCEEDED).toBe('ALO_MAX_ITERATIONS_EXCEEDED');
    expect(AutonomousLoopErrorCodes.MAX_FIX_ATTEMPTS_EXCEEDED).toBe('ALO_MAX_FIX_ATTEMPTS_EXCEEDED');
    expect(AutonomousLoopErrorCodes.GUARD_BLOCKED).toBe('ALO_GUARD_BLOCKED');
    expect(AutonomousLoopErrorCodes.TEST_FAILED).toBe('ALO_TEST_FAILED');
    expect(AutonomousLoopErrorCodes.PHASE_TIMEOUT).toBe('ALO_PHASE_TIMEOUT');
    expect(AutonomousLoopErrorCodes.INVALID_TRANSITION).toBe('ALO_INVALID_TRANSITION');
    expect(AutonomousLoopErrorCodes.CANCELLED).toBe('ALO_CANCELLED');
    expect(AutonomousLoopErrorCodes.AGENT_FAILED).toBe('ALO_AGENT_FAILED');
  });
});
