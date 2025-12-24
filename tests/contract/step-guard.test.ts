/**
 * Step Guard Contract Tests
 *
 * Validates step guard schemas and invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  GuardPositionSchema,
  GuardFailActionSchema,
  WorkflowStepGuardSchema,
  GuardCheckStatusSchema,
  StepGateResultSchema,
  StepGuardResultSchema,
  StepGuardPolicySchema,
  StepGuardContextSchema,
  StageProgressStatusSchema,
  StageProgressEventSchema,
  GoalAnchorTriggerSchema,
  GoalAnchorConfigSchema,
  GoalAnchorContextSchema,
  DEFAULT_STEP_GUARD,
  createStepGuardResult,
  createProgressEvent,
  type WorkflowStepGuard,
  type StepGuardPolicy,
  type StepGuardContext,
  type StageProgressEvent,
  type GoalAnchorConfig,
} from '@automatosx/contracts';

describe('Step Guard Contract', () => {
  describe('GuardPositionSchema', () => {
    it('accepts valid positions', () => {
      expect(GuardPositionSchema.parse('before')).toBe('before');
      expect(GuardPositionSchema.parse('after')).toBe('after');
    });

    it('rejects invalid positions', () => {
      expect(() => GuardPositionSchema.parse('during')).toThrow();
      expect(() => GuardPositionSchema.parse('')).toThrow();
    });
  });

  describe('GuardFailActionSchema', () => {
    it('accepts valid actions', () => {
      expect(GuardFailActionSchema.parse('block')).toBe('block');
      expect(GuardFailActionSchema.parse('warn')).toBe('warn');
      expect(GuardFailActionSchema.parse('continue')).toBe('continue');
    });

    it('rejects invalid actions', () => {
      expect(() => GuardFailActionSchema.parse('stop')).toThrow();
      expect(() => GuardFailActionSchema.parse('')).toThrow();
    });
  });

  describe('WorkflowStepGuardSchema', () => {
    it('parses valid step guard', () => {
      const guard: WorkflowStepGuard = {
        guardId: 'guard-1',
        stepId: 'step-1',
        position: 'before',
        gates: ['validation', 'capability'],
        onFail: 'block',
        description: 'Pre-execution guard',
        enabled: true,
      };

      const result = WorkflowStepGuardSchema.parse(guard);
      expect(result.guardId).toBe('guard-1');
      expect(result.gates).toHaveLength(2);
      expect(result.onFail).toBe('block');
    });

    it('applies defaults', () => {
      const guard = {
        guardId: 'guard-1',
        stepId: '*',
        position: 'before',
        gates: ['validation'],
      };

      const result = WorkflowStepGuardSchema.parse(guard);
      expect(result.onFail).toBe('warn');
      expect(result.enabled).toBe(true);
    });

    it('requires at least one gate', () => {
      const guard = {
        guardId: 'guard-1',
        stepId: 'step-1',
        position: 'before',
        gates: [],
      };

      expect(() => WorkflowStepGuardSchema.parse(guard)).toThrow();
    });

    it('requires non-empty guardId and stepId', () => {
      expect(() =>
        WorkflowStepGuardSchema.parse({
          guardId: '',
          stepId: 'step-1',
          position: 'before',
          gates: ['test'],
        })
      ).toThrow();

      expect(() =>
        WorkflowStepGuardSchema.parse({
          guardId: 'guard-1',
          stepId: '',
          position: 'before',
          gates: ['test'],
        })
      ).toThrow();
    });
  });

  describe('GuardCheckStatusSchema', () => {
    it('accepts valid statuses', () => {
      expect(GuardCheckStatusSchema.parse('PASS')).toBe('PASS');
      expect(GuardCheckStatusSchema.parse('FAIL')).toBe('FAIL');
      expect(GuardCheckStatusSchema.parse('WARN')).toBe('WARN');
    });

    it('rejects invalid statuses', () => {
      expect(() => GuardCheckStatusSchema.parse('SKIP')).toThrow();
      expect(() => GuardCheckStatusSchema.parse('invalid')).toThrow();
    });
  });

  describe('StepGateResultSchema', () => {
    it('parses valid gate result', () => {
      const result = StepGateResultSchema.parse({
        gateId: 'validation',
        status: 'PASS',
        message: 'All checks passed',
        details: { checked: 5 },
      });

      expect(result.gateId).toBe('validation');
      expect(result.status).toBe('PASS');
      expect(result.details).toEqual({ checked: 5 });
    });

    it('requires message field', () => {
      expect(() =>
        StepGateResultSchema.parse({
          gateId: 'test',
          status: 'FAIL',
        })
      ).toThrow();
    });
  });

  describe('StepGuardResultSchema', () => {
    it('parses valid step guard result', () => {
      const result = StepGuardResultSchema.parse({
        guardId: 'guard-1',
        stepId: 'step-1',
        position: 'before',
        status: 'PASS',
        gates: [
          { gateId: 'validation', status: 'PASS', message: 'Valid' },
          { gateId: 'capability', status: 'PASS', message: 'Has capability' },
        ],
        blocked: false,
        summary: 'All 2 gates passed',
        timestamp: new Date().toISOString(),
        durationMs: 15,
      });

      expect(result.guardId).toBe('guard-1');
      expect(result.blocked).toBe(false);
      expect(result.gates).toHaveLength(2);
    });
  });

  describe('StepGuardPolicySchema', () => {
    it('parses valid policy', () => {
      const policy: StepGuardPolicy = {
        policyId: 'strict-policy',
        name: 'Strict Execution Policy',
        description: 'Enforces strict validation',
        enabled: true,
        priority: 100,
        workflowPatterns: ['*'],
        agentPatterns: ['*'],
        guards: [
          {
            guardId: 'pre-check',
            stepId: '*',
            position: 'before',
            gates: ['validation'],
            onFail: 'block',
            enabled: true,
          },
        ],
      };

      const result = StepGuardPolicySchema.parse(policy);
      expect(result.priority).toBe(100);
      expect(result.guards).toHaveLength(1);
    });

    it('applies priority default', () => {
      const policy = {
        policyId: 'test',
        name: 'Test',
        enabled: true,
        agentPatterns: ['*'],
        guards: [
          {
            guardId: 'g1',
            stepId: '*',
            position: 'before',
            gates: ['test'],
          },
        ],
      };

      const result = StepGuardPolicySchema.parse(policy);
      expect(result.priority).toBe(0);
    });

    it('applies agent pattern defaults', () => {
      const result = StepGuardPolicySchema.parse({
        policyId: 'test',
        name: 'Test',
        enabled: true,
        guards: [],
      });
      // Default is ['*'] which matches all agents
      expect(result.agentPatterns).toEqual(['*']);
    });
  });

  describe('StepGuardContextSchema', () => {
    it('parses valid context', () => {
      const context: StepGuardContext = {
        executionId: 'exec-123',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        stepConfig: { query: 'test' },
        previousOutputs: {},
      };

      const result = StepGuardContextSchema.parse(context);
      expect(result.executionId).toBe('exec-123');
      expect(result.stepIndex).toBe(0);
    });
  });

  describe('StageProgressStatusSchema', () => {
    it('accepts valid statuses', () => {
      expect(StageProgressStatusSchema.parse('starting')).toBe('starting');
      expect(StageProgressStatusSchema.parse('completed')).toBe('completed');
      expect(StageProgressStatusSchema.parse('failed')).toBe('failed');
      expect(StageProgressStatusSchema.parse('skipped')).toBe('skipped');
      expect(StageProgressStatusSchema.parse('blocked')).toBe('blocked');
    });
  });

  describe('StageProgressEventSchema', () => {
    it('parses valid progress event', () => {
      const event: StageProgressEvent = {
        type: 'stage.progress',
        executionId: 'exec-123',
        agentId: 'agent-1',
        sessionId: 'session-1',
        stageIndex: 2,
        stageTotal: 5,
        stageName: 'process-data',
        stageType: 'tool',
        status: 'completed',
        timestamp: new Date().toISOString(),
        durationMs: 150,
      };

      const result = StageProgressEventSchema.parse(event);
      expect(result.stageIndex).toBe(2);
      expect(result.status).toBe('completed');
    });

    it('rejects negative stageIndex', () => {
      const event = {
        type: 'stage.progress',
        executionId: 'exec-123',
        agentId: 'agent-1',
        stageIndex: -1,
        stageTotal: 5,
        stageName: 'step',
        stageType: 'prompt',
        status: 'starting',
        timestamp: new Date().toISOString(),
      };

      expect(() => StageProgressEventSchema.parse(event)).toThrow();
    });

    it('rejects non-positive stageTotal', () => {
      const event = {
        type: 'stage.progress',
        executionId: 'exec-123',
        agentId: 'agent-1',
        stageIndex: 0,
        stageTotal: 0,
        stageName: 'step',
        stageType: 'prompt',
        status: 'starting',
        timestamp: new Date().toISOString(),
      };

      expect(() => StageProgressEventSchema.parse(event)).toThrow();
    });
  });

  describe('GoalAnchorConfigSchema', () => {
    it('parses valid config', () => {
      const config: GoalAnchorConfig = {
        originalTask: 'Complete the user registration flow',
        checkpointsReached: ['login-page', 'form-validation'],
        trigger: 'on_checkpoint',
        includeRemainingSteps: true,
        includeProgress: true,
      };

      const result = GoalAnchorConfigSchema.parse(config);
      expect(result.originalTask).toBe('Complete the user registration flow');
      expect(result.trigger).toBe('on_checkpoint');
      expect(result.checkpointsReached).toHaveLength(2);
    });

    it('applies defaults', () => {
      const config = { originalTask: 'Test task' };
      const result = GoalAnchorConfigSchema.parse(config);
      expect(result.checkpointsReached).toEqual([]);
      expect(result.trigger).toBe('on_checkpoint');
      expect(result.includeRemainingSteps).toBe(true);
      expect(result.includeProgress).toBe(true);
    });
  });

  describe('GoalAnchorContextSchema', () => {
    it('parses valid context', () => {
      const context = GoalAnchorContextSchema.parse({
        task: 'Complete the task',
        progress: 'Step 3 of 10 complete',
        checkpointsReached: ['init', 'setup'],
        remainingSteps: ['process', 'cleanup'],
        percentComplete: 65,
      });

      expect(context.task).toBe('Complete the task');
      expect(context.percentComplete).toBe(65);
      expect(context.remainingSteps).toHaveLength(2);
    });

    it('allows optional fields', () => {
      const context = GoalAnchorContextSchema.parse({
        task: 'Complete the task',
        progress: 'In progress',
        checkpointsReached: [],
      });

      expect(context.remainingSteps).toBeUndefined();
      expect(context.percentComplete).toBeUndefined();
    });
  });

  describe('DEFAULT_STEP_GUARD', () => {
    it('has valid default values', () => {
      expect(DEFAULT_STEP_GUARD.position).toBe('before');
      expect(DEFAULT_STEP_GUARD.onFail).toBe('warn');
      expect(DEFAULT_STEP_GUARD.enabled).toBe(true);
    });
  });

  describe('createStepGuardResult', () => {
    it('creates valid result', () => {
      const result = createStepGuardResult(
        'guard-1',
        'step-1',
        'before',
        [{ gateId: 'test', status: 'PASS', message: 'Passed' }],
        false
      );

      expect(result.guardId).toBe('guard-1');
      expect(result.stepId).toBe('step-1');
      expect(result.position).toBe('before');
      expect(result.blocked).toBe(false);
      expect(result.timestamp).toBeDefined();
    });

    it('validates created result against schema', () => {
      const result = createStepGuardResult(
        'guard-1',
        'step-1',
        'after',
        [{ gateId: 'validation', status: 'FAIL', message: 'Failed' }],
        true
      );

      expect(() => StepGuardResultSchema.parse(result)).not.toThrow();
    });
  });

  describe('createProgressEvent', () => {
    it('creates valid progress event', () => {
      const event = createProgressEvent(
        'exec-123',
        'agent-1',
        0,
        5,
        'init',
        'prompt',
        'starting'
      );

      expect(event.type).toBe('stage.progress');
      expect(event.executionId).toBe('exec-123');
      expect(event.stageIndex).toBe(0);
      expect(event.status).toBe('starting');
    });

    it('includes optional fields', () => {
      const event = createProgressEvent(
        'exec-123',
        'agent-1',
        1,
        5,
        'process',
        'tool',
        'completed',
        {
          sessionId: 'session-1',
          durationMs: 100,
        }
      );

      expect(event.sessionId).toBe('session-1');
      expect(event.durationMs).toBe(100);
    });

    it('validates created event against schema', () => {
      const event = createProgressEvent(
        'exec-123',
        'agent-1',
        2,
        5,
        'validate',
        'conditional',
        'failed',
        { error: 'Validation failed' }
      );

      expect(() => StageProgressEventSchema.parse(event)).not.toThrow();
    });
  });
});
