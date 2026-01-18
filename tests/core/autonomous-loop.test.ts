/**
 * Autonomous Loop Domain Tests
 *
 * Tests for autonomous loop domain logic and invariants.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInitialLoopState,
  createDefaultAutonomousLoopConfig,
  type AutonomousLoopState,
  type TestResult,
  type GuardCheckResult,
} from '@defai.digital/contracts';
import {
  // Phase Machine
  createPhaseMachine,
  InvalidTransitionError,
  determineNextPhase,
  getPhaseDisplayName,
  getPhaseEmoji,
  calculateProgress,
  // Guard Integration
  createStubGuardPort,
  runGuardCheck,
  shouldBlockExecution,
  hasBlockingViolations,
  getViolationSummary,
  AUTONOMOUS_DEVELOPMENT_POLICY,
  // Test Runner
  detectTestFramework,
  parseTestOutput,
  isTestSuccess,
  createStubTestRunnerPort,
  createTestResult,
  createFailedTestResult,
  createPassingTestResult,
  formatTestResult,
  getTestFailureSummary,
  // Loop Controller
  createLoopController,
  LoopControllerError,
  type LoopController,
} from '@defai.digital/autonomous-loop';

// ============================================================================
// Phase Machine Tests
// ============================================================================

describe('Phase Machine', () => {
  describe('createPhaseMachine', () => {
    it('should create machine with initial phase', () => {
      const config = createDefaultAutonomousLoopConfig();
      const machine = createPhaseMachine('plan', config);

      expect(machine.getCurrentPhase()).toBe('plan');
      expect(machine.isComplete()).toBe(false);
    });

    it('should allow valid transitions', () => {
      const config = createDefaultAutonomousLoopConfig();
      const machine = createPhaseMachine('plan', config);

      machine.transition('write');
      expect(machine.getCurrentPhase()).toBe('write');

      machine.transition('test');
      expect(machine.getCurrentPhase()).toBe('test');

      machine.transition('verify');
      expect(machine.getCurrentPhase()).toBe('verify');

      machine.transition('complete');
      expect(machine.getCurrentPhase()).toBe('complete');
      expect(machine.isComplete()).toBe(true);
    });

    it('should throw on invalid transitions', () => {
      const config = createDefaultAutonomousLoopConfig();
      const machine = createPhaseMachine('plan', config);

      expect(() => machine.transition('test')).toThrow(InvalidTransitionError);
      expect(() => machine.transition('verify')).toThrow(InvalidTransitionError);
      expect(() => machine.transition('complete')).toThrow(InvalidTransitionError);
    });

    it('should identify breakpoints', () => {
      const config = { ...createDefaultAutonomousLoopConfig(), breakpoints: ['write', 'verify'] as const };
      const machine = createPhaseMachine('write', config);

      expect(machine.isBreakpoint()).toBe(true);

      machine.transition('test');
      expect(machine.isBreakpoint()).toBe(false);
    });

    it('should reset to plan phase', () => {
      const config = createDefaultAutonomousLoopConfig();
      const machine = createPhaseMachine('write', config);

      machine.transition('test');
      machine.reset();

      expect(machine.getCurrentPhase()).toBe('plan');
    });

    it('should return valid next phases', () => {
      const config = createDefaultAutonomousLoopConfig();
      const machine = createPhaseMachine('write', config);

      // With requireTestPass=true, verify should not be in valid next phases from write
      const validPhases = machine.getValidNextPhases();
      expect(validPhases).toContain('test');
      expect(validPhases).not.toContain('verify');
    });
  });

  describe('determineNextPhase', () => {
    it('should determine next phase from plan', () => {
      const state = createInitialLoopState('Test task');
      expect(determineNextPhase(state)).toBe('write');
    });

    it('should go to test after write when requireTestPass=true', () => {
      const state = createInitialLoopState('Test task');
      state.phase = 'write';
      expect(determineNextPhase(state)).toBe('test');
    });

    it('should go to verify after write when requireTestPass=false', () => {
      const state = createInitialLoopState('Test task', { requireTestPass: false });
      state.phase = 'write';
      expect(determineNextPhase(state)).toBe('verify');
    });

    it('should go to fix when tests fail and fix attempts available', () => {
      const state = createInitialLoopState('Test task');
      state.phase = 'test';
      state.currentFixAttempts = 0;
      expect(determineNextPhase(state, false)).toBe('fix');
    });

    it('should go to write when max fix attempts exceeded', () => {
      const state = createInitialLoopState('Test task', { maxFixAttempts: 2 });
      state.phase = 'test';
      state.currentFixAttempts = 2;
      expect(determineNextPhase(state, false)).toBe('write');
    });

    it('should go to verify when tests pass', () => {
      const state = createInitialLoopState('Test task');
      state.phase = 'test';
      expect(determineNextPhase(state, true)).toBe('verify');
    });
  });

  describe('getPhaseDisplayName', () => {
    it('should return display names for all phases', () => {
      expect(getPhaseDisplayName('plan')).toBe('Planning');
      expect(getPhaseDisplayName('write')).toBe('Writing Code');
      expect(getPhaseDisplayName('test')).toBe('Running Tests');
      expect(getPhaseDisplayName('fix')).toBe('Fixing Issues');
      expect(getPhaseDisplayName('verify')).toBe('Verifying');
      expect(getPhaseDisplayName('complete')).toBe('Complete');
    });
  });

  describe('getPhaseEmoji', () => {
    it('should return emojis for all phases', () => {
      expect(getPhaseEmoji('plan')).toBeDefined();
      expect(getPhaseEmoji('write')).toBeDefined();
      expect(getPhaseEmoji('test')).toBeDefined();
      expect(getPhaseEmoji('fix')).toBeDefined();
      expect(getPhaseEmoji('verify')).toBeDefined();
      expect(getPhaseEmoji('complete')).toBeDefined();
    });
  });

  describe('calculateProgress', () => {
    it('should calculate progress based on phase', () => {
      const state = createInitialLoopState('Test task');

      state.phase = 'plan';
      expect(calculateProgress(state)).toBe(10);

      state.phase = 'write';
      expect(calculateProgress(state)).toBe(30);

      state.phase = 'complete';
      expect(calculateProgress(state)).toBe(100);
    });
  });
});

// ============================================================================
// Guard Integration Tests
// ============================================================================

describe('Guard Integration', () => {
  describe('createStubGuardPort', () => {
    it('should create stub guard that always passes', async () => {
      const guard = createStubGuardPort();
      const result = await guard.check({
        policyId: 'test',
        changedPaths: ['src/file.ts'],
      });

      expect(result.passed).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('should list available policies', async () => {
      const guard = createStubGuardPort();
      const policies = await guard.listPolicies();

      expect(policies).toContain('autonomous-development');
    });
  });

  describe('runGuardCheck', () => {
    it('should return passing result when no policy configured', async () => {
      const guard = createStubGuardPort();
      const state = createInitialLoopState('Test task');

      const result = await runGuardCheck(guard, state);

      expect(result.passed).toBe(true);
      expect(result.policyId).toBe('none');
    });

    it('should return passing result when no changed files', async () => {
      const guard = createStubGuardPort();
      const state = createInitialLoopState('Test task', {
        guardPolicy: 'autonomous-development',
      });

      const result = await runGuardCheck(guard, state);

      expect(result.passed).toBe(true);
    });

    it('should call guard check with policy and changed paths', async () => {
      const guard = createStubGuardPort();
      const checkSpy = vi.spyOn(guard, 'check');

      const state = createInitialLoopState('Test task', {
        guardPolicy: 'autonomous-development',
      });
      state.changedFiles = ['src/file.ts'];

      await runGuardCheck(guard, state);

      expect(checkSpy).toHaveBeenCalledWith({
        policyId: 'autonomous-development',
        changedPaths: ['src/file.ts'],
      });
    });
  });

  describe('shouldBlockExecution', () => {
    it('should return true when blocked is true', () => {
      const result: GuardCheckResult = {
        policyId: 'test',
        passed: false,
        blocked: true,
        gateResults: [],
        checkedAt: new Date().toISOString(),
      };

      expect(shouldBlockExecution(result)).toBe(true);
    });

    it('should return true when gate has error severity', () => {
      const result: GuardCheckResult = {
        policyId: 'test',
        passed: false,
        blocked: false,
        gateResults: [
          { gateId: 'test', passed: false, severity: 'error' },
        ],
        checkedAt: new Date().toISOString(),
      };

      expect(shouldBlockExecution(result)).toBe(true);
    });

    it('should return false when warning severity only', () => {
      const result: GuardCheckResult = {
        policyId: 'test',
        passed: false,
        blocked: false,
        gateResults: [
          { gateId: 'test', passed: false, severity: 'warning' },
        ],
        checkedAt: new Date().toISOString(),
      };

      expect(shouldBlockExecution(result)).toBe(false);
    });
  });

  describe('getViolationSummary', () => {
    it('should return summary when no violations', () => {
      const result: GuardCheckResult = {
        policyId: 'test',
        passed: true,
        blocked: false,
        gateResults: [],
        summary: 'All checks passed',
        checkedAt: new Date().toISOString(),
      };

      expect(getViolationSummary(result)).toBe('All checks passed');
    });

    it('should format violations from gate results', () => {
      const result: GuardCheckResult = {
        policyId: 'test',
        passed: false,
        blocked: false,
        gateResults: [
          {
            gateId: 'secrets',
            passed: false,
            violations: [{ message: 'API key detected in config.ts' }],
          },
        ],
        checkedAt: new Date().toISOString(),
      };

      const summary = getViolationSummary(result);
      expect(summary).toContain('[secrets]');
      expect(summary).toContain('API key detected');
    });
  });

  describe('AUTONOMOUS_DEVELOPMENT_POLICY', () => {
    it('should define policy configuration', () => {
      expect(AUTONOMOUS_DEVELOPMENT_POLICY.policyId).toBe('autonomous-development');
      expect(AUTONOMOUS_DEVELOPMENT_POLICY.allowedPaths).toContain('src/**');
      expect(AUTONOMOUS_DEVELOPMENT_POLICY.forbiddenPaths).toContain('**/.env*');
      expect(AUTONOMOUS_DEVELOPMENT_POLICY.gates).toContain('path_violation');
      expect(AUTONOMOUS_DEVELOPMENT_POLICY.changeRadiusLimit).toBe(5);
    });
  });
});

// ============================================================================
// Test Runner Tests
// ============================================================================

describe('Test Runner', () => {
  describe('detectTestFramework', () => {
    it('should detect vitest from command', () => {
      expect(detectTestFramework('pnpm vitest run')).toBe('vitest');
    });

    it('should detect jest from command', () => {
      expect(detectTestFramework('npx jest')).toBe('jest');
    });

    it('should detect pytest from command', () => {
      expect(detectTestFramework('pytest tests/')).toBe('pytest');
    });

    it('should return generic for unknown', () => {
      expect(detectTestFramework('npm run test')).toBe('generic');
    });
  });

  describe('parseTestOutput', () => {
    it('should parse vitest output', () => {
      // The regex matches patterns like "25 passed"
      const output = `
        Test Files  5 passed (5)
        Tests  25 passed
        Duration  2.5s
      `;

      const result = parseTestOutput(output, 'vitest');
      // The regex will find "5 passed" first from Test Files, then "25 passed" from Tests
      // The last match wins in the current implementation
      expect(result.passedTests).toBeGreaterThan(0);
      expect(result.failedTests).toBe(0);
    });

    it('should parse failed test output', () => {
      const output = `
        Tests: 3 passed, 2 failed, 5 total
        FAIL src/test.ts
      `;

      const result = parseTestOutput(output, 'jest');
      expect(result.passedTests).toBe(3);
      expect(result.failedTests).toBe(2);
    });
  });

  describe('isTestSuccess', () => {
    it('should return true for passing tests', () => {
      const output = 'Test Files  5 passed (5)';
      expect(isTestSuccess(output, 'vitest')).toBe(true);
    });

    it('should return false for failing tests', () => {
      const output = 'Tests: 3 passed, 2 failed';
      expect(isTestSuccess(output, 'jest')).toBe(false);
    });
  });

  describe('createStubTestRunnerPort', () => {
    it('should create stub runner that always passes', async () => {
      const runner = createStubTestRunnerPort();
      const result = await runner.runTests({
        command: 'pnpm test',
        timeout: 60000,
      });

      expect(result.passed).toBe(true);
      expect(result.totalTests).toBe(1);
    });

    it('should parse output', () => {
      const runner = createStubTestRunnerPort();
      const result = runner.parseOutput('Tests: 5 passed');

      expect(result.passedTests).toBe(5);
    });
  });

  describe('createTestResult', () => {
    it('should create result from output', () => {
      const output = 'Tests: 10 passed, 2 failed';
      const result = createTestResult(output, 1, 5000, 'pnpm test');

      expect(result.passed).toBe(false);
      expect(result.passedTests).toBe(10);
      expect(result.failedTests).toBe(2);
      expect(result.durationMs).toBe(5000);
    });

    it('should mark as passed when exit code is 0 and no failures', () => {
      const output = 'Tests: 10 passed';
      const result = createTestResult(output, 0, 5000);

      expect(result.passed).toBe(true);
    });
  });

  describe('createFailedTestResult', () => {
    it('should create failed result with error', () => {
      const result = createFailedTestResult('Command failed', 1000);

      expect(result.passed).toBe(false);
      expect(result.errorOutput).toBe('Command failed');
      expect(result.durationMs).toBe(1000);
    });
  });

  describe('createPassingTestResult', () => {
    it('should create passing result', () => {
      const result = createPassingTestResult(500);

      expect(result.passed).toBe(true);
      expect(result.durationMs).toBe(500);
    });
  });

  describe('formatTestResult', () => {
    it('should format passing result', () => {
      const result: TestResult = {
        passed: true,
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        durationMs: 5000,
      };

      const formatted = formatTestResult(result);
      expect(formatted).toContain('passed');
      expect(formatted).toContain('10/10');
      expect(formatted).toContain('5000ms');
    });

    it('should format failed result with test names', () => {
      const result: TestResult = {
        passed: false,
        totalTests: 10,
        passedTests: 8,
        failedTests: 2,
        skippedTests: 0,
        durationMs: 5000,
        failedTestNames: ['test1', 'test2'],
      };

      const formatted = formatTestResult(result);
      expect(formatted).toContain('failed');
      expect(formatted).toContain('test1');
      expect(formatted).toContain('test2');
    });
  });

  describe('getTestFailureSummary', () => {
    it('should return simple message for passing tests', () => {
      const result: TestResult = {
        passed: true,
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        durationMs: 5000,
      };

      expect(getTestFailureSummary(result)).toBe('All tests passed');
    });

    it('should include failure details', () => {
      const result: TestResult = {
        passed: false,
        totalTests: 10,
        passedTests: 8,
        failedTests: 2,
        skippedTests: 0,
        durationMs: 5000,
        errorOutput: 'Error: assertion failed',
        failedTestNames: ['test1'],
      };

      const summary = getTestFailureSummary(result);
      expect(summary).toContain('2 test(s) failed');
      expect(summary).toContain('test1');
      expect(summary).toContain('Error: assertion failed');
    });
  });
});

// ============================================================================
// Loop Controller Tests
// ============================================================================

describe('Loop Controller', () => {
  let controller: LoopController;

  beforeEach(() => {
    controller = createLoopController();
  });

  describe('start', () => {
    it('should start a new loop', async () => {
      const response = await controller.start({
        task: 'Implement feature X',
      });

      expect(response.started).toBe(true);
      expect(response.loopId).toBeDefined();
      expect(response.state.phase).toBe('plan');
      expect(response.state.status).toBe('running');
      expect(response.state.task).toBe('Implement feature X');
    });

    it('should accept config overrides', async () => {
      const response = await controller.start({
        task: 'Implement feature X',
        config: {
          maxIterations: 5,
          guardPolicy: 'autonomous-development',
        },
      });

      expect(response.state.config.maxIterations).toBe(5);
      expect(response.state.config.guardPolicy).toBe('autonomous-development');
    });

    it('should accept sessionId', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await controller.start({
        task: 'Implement feature X',
        sessionId,
      });

      expect(response.state.sessionId).toBe(sessionId);
    });
  });

  describe('getStatus', () => {
    it('should return status for existing loop', async () => {
      const { loopId } = await controller.start({ task: 'Test' });
      const status = await controller.getStatus(loopId);

      expect(status.isActive).toBe(true);
      expect(status.awaitingInput).toBe(false);
      expect(status.progress).toBeGreaterThan(0);
    });

    it('should throw for non-existent loop', async () => {
      await expect(
        controller.getStatus('non-existent-id')
      ).rejects.toThrow(LoopControllerError);
    });
  });

  describe('abort', () => {
    it('should abort running loop', async () => {
      const { loopId } = await controller.start({ task: 'Test' });
      const status = await controller.abort({ loopId });

      expect(status.state.status).toBe('cancelled');
      expect(status.isActive).toBe(false);
    });

    it('should accept abort reason', async () => {
      const { loopId } = await controller.start({ task: 'Test' });
      const status = await controller.abort({
        loopId,
        reason: 'Requirements changed',
      });

      expect(status.state.error).toBe('Requirements changed');
    });

    it('should throw for non-existent loop', async () => {
      await expect(
        controller.abort({ loopId: 'non-existent-id' })
      ).rejects.toThrow(LoopControllerError);
    });
  });

  describe('listActive', () => {
    it('should list active loops', async () => {
      await controller.start({ task: 'Test 1' });
      await controller.start({ task: 'Test 2' });

      const active = await controller.listActive();

      expect(active.length).toBe(2);
    });

    it('should not include aborted loops', async () => {
      const { loopId } = await controller.start({ task: 'Test' });
      await controller.abort({ loopId });

      const active = await controller.listActive();

      expect(active.length).toBe(0);
    });
  });

  describe('runIteration', () => {
    it('should run one iteration', async () => {
      const { loopId, state } = await controller.start({ task: 'Test' });

      expect(state.iteration).toBe(0);

      const newState = await controller.runIteration(loopId);

      expect(newState.iteration).toBe(1);
      expect(newState.iterations.length).toBe(1);
    });

    it('should not run if not in running status', async () => {
      const { loopId } = await controller.start({ task: 'Test' });
      await controller.abort({ loopId });

      const state = await controller.runIteration(loopId);

      expect(state.status).toBe('cancelled');
    });

    it('should fail when max iterations exceeded', async () => {
      const { loopId } = await controller.start({
        task: 'Test',
        config: { maxIterations: 1 },
      });

      // Run first iteration
      let state = await controller.runIteration(loopId);
      expect(state.iteration).toBe(1);

      // Run second iteration - should fail
      state = await controller.runIteration(loopId);
      expect(state.status).toBe('failed');
      expect(state.error).toContain('Max iterations');
    });
  });

  describe('continue', () => {
    it('should throw when loop not paused', async () => {
      const { loopId } = await controller.start({ task: 'Test' });

      await expect(
        controller.continue({ loopId })
      ).rejects.toThrow(LoopControllerError);
    });
  });
});

// ============================================================================
// Invariant Tests
// ============================================================================

describe('Autonomous Loop Invariants', () => {
  describe('INV-ALO-001: Guard Gates After Write', () => {
    it('should run guard check after write phase', async () => {
      const guardCheck = vi.fn().mockResolvedValue({
        policyId: 'test',
        passed: true,
        blocked: false,
        gateResults: [],
        checkedAt: new Date().toISOString(),
      });

      const guard = {
        check: guardCheck,
        listPolicies: vi.fn().mockResolvedValue(['test']),
      };

      const controller = createLoopController({
        guard,
        agentExecutor: {
          execute: vi.fn().mockResolvedValue({
            success: true,
            output: 'Done',
            changedFiles: ['src/file.ts'],
            durationMs: 100,
          }),
        },
      });

      const { loopId } = await controller.start({
        task: 'Test',
        config: { guardPolicy: 'test' },
      });

      // Run plan phase
      await controller.runIteration(loopId);

      // Run write phase
      await controller.runIteration(loopId);

      expect(guardCheck).toHaveBeenCalled();
    });
  });

  describe('INV-ALO-003: Fix Attempts Bounded', () => {
    it('should track fix attempts and transition to fix on test failure', async () => {
      const controller = createLoopController({
        testRunner: {
          runTests: vi.fn().mockResolvedValue({
            passed: false,
            totalTests: 1,
            passedTests: 0,
            failedTests: 1,
            skippedTests: 0,
            durationMs: 100,
          }),
          parseOutput: vi.fn(),
        },
      });

      const { loopId, state: initialState } = await controller.start({
        task: 'Test',
        // Override breakpoints to not pause at write phase
        config: { maxFixAttempts: 2, requireTestPass: true, breakpoints: [] },
      });

      // Initial phase is plan
      expect(initialState.phase).toBe('plan');

      // Run plan phase -> should transition to write
      let state = await controller.runIteration(loopId);
      expect(state.phase).toBe('write');

      // Run write phase -> should transition to test (no breakpoint pause)
      state = await controller.runIteration(loopId);
      expect(state.phase).toBe('test');

      // Run test phase with failing tests -> should transition to fix
      state = await controller.runIteration(loopId);
      expect(state.phase).toBe('fix');
      expect(state.lastTestResult?.passed).toBe(false);
    });
  });

  describe('INV-ALO-005: Changed Files Tracked', () => {
    it('should accumulate changed files across iterations', async () => {
      let callCount = 0;
      const controller = createLoopController({
        agentExecutor: {
          execute: vi.fn().mockImplementation(() => {
            callCount++;
            return Promise.resolve({
              success: true,
              output: 'Done',
              changedFiles: [`src/file${callCount}.ts`],
              durationMs: 100,
            });
          }),
        },
      });

      const { loopId } = await controller.start({
        task: 'Test',
        config: { requireTestPass: false },
      });

      // Run plan phase
      let state = await controller.runIteration(loopId);
      expect(state.changedFiles).toContain('src/file1.ts');

      // Run write phase
      state = await controller.runIteration(loopId);
      expect(state.changedFiles).toContain('src/file1.ts');
      expect(state.changedFiles).toContain('src/file2.ts');
    });
  });

  describe('INV-ALO-006: Valid Phase Transitions', () => {
    it('should only allow valid transitions', () => {
      const config = createDefaultAutonomousLoopConfig();
      const machine = createPhaseMachine('plan', config);

      // Valid: plan -> write
      expect(() => machine.transition('write')).not.toThrow();

      // Invalid: write -> plan
      expect(() => machine.transition('plan')).toThrow(InvalidTransitionError);
    });
  });

  describe('INV-ALO-007: Iteration Limit Enforced', () => {
    it('should fail when iteration limit reached', async () => {
      const controller = createLoopController();

      const { loopId } = await controller.start({
        task: 'Test',
        config: { maxIterations: 1 },
      });

      await controller.runIteration(loopId);
      const state = await controller.runIteration(loopId);

      expect(state.status).toBe('failed');
      expect(state.error).toContain('Max iterations');
    });
  });

  describe('INV-ALO-008: Immutable Iteration History', () => {
    it('should append iterations without modifying existing', async () => {
      const controller = createLoopController();

      const { loopId } = await controller.start({
        task: 'Test',
        config: { requireTestPass: false },
      });

      let state = await controller.runIteration(loopId);
      const firstIteration = state.iterations[0];

      state = await controller.runIteration(loopId);

      // First iteration should be unchanged
      expect(state.iterations[0]).toEqual(firstIteration);
      expect(state.iterations.length).toBe(2);
    });
  });

  describe('INV-ALO-009: Guard Block Stops Execution', () => {
    it('should block execution when guard fails', async () => {
      const controller = createLoopController({
        guard: {
          check: vi.fn().mockResolvedValue({
            policyId: 'test',
            passed: false,
            blocked: true,
            gateResults: [
              { gateId: 'secrets', passed: false, severity: 'error' },
            ],
            checkedAt: new Date().toISOString(),
          }),
          listPolicies: vi.fn().mockResolvedValue(['test']),
        },
        agentExecutor: {
          execute: vi.fn().mockResolvedValue({
            success: true,
            output: 'Done',
            changedFiles: ['src/file.ts'],
            durationMs: 100,
          }),
        },
      });

      const { loopId } = await controller.start({
        task: 'Test',
        config: { guardPolicy: 'test' },
      });

      // Run plan phase
      await controller.runIteration(loopId);

      // Run write phase - should be blocked
      const state = await controller.runIteration(loopId);
      expect(state.status).toBe('blocked');
    });
  });
});
