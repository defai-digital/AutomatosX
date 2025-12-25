import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WorkflowRunner,
  createWorkflowRunner,
  prepareWorkflow,
  validateWorkflow,
  WorkflowValidationError,
  WorkflowErrorCodes,
  shouldRetry,
  calculateBackoff,
  mergeRetryPolicy,
  DEFAULT_RETRY_POLICY,
  type StepExecutor,
  type StepResult,
} from '@defai.digital/workflow-engine';
import type { Workflow } from '@defai.digital/contracts';

describe('Workflow Engine', () => {
  describe('Validation (INV-WF-003, INV-WF-004)', () => {
    it('should validate a valid workflow', () => {
      const workflow: Workflow = {
        workflowId: 'test-workflow',
        version: '1.0.0',
        steps: [
          { stepId: 'step-1', type: 'prompt' },
          { stepId: 'step-2', type: 'tool' },
        ],
      };

      const result = validateWorkflow(workflow);
      expect(result.workflowId).toBe('test-workflow');
    });

    it('INV-WF-003: should reject unknown fields', () => {
      const workflowWithUnknown = {
        workflowId: 'test',
        version: '1.0.0',
        steps: [{ stepId: 'step-1', type: 'prompt' }],
        unknownField: 'should fail',
      };

      expect(() => validateWorkflow(workflowWithUnknown)).toThrow(
        WorkflowValidationError
      );
    });

    it('INV-WF-004: should reject duplicate step IDs', () => {
      const workflowWithDuplicates = {
        workflowId: 'test',
        version: '1.0.0',
        steps: [
          { stepId: 'step-1', type: 'prompt' },
          { stepId: 'step-1', type: 'tool' }, // Duplicate
        ],
      };

      expect(() => validateWorkflow(workflowWithDuplicates)).toThrow(
        WorkflowValidationError
      );
      expect(() => validateWorkflow(workflowWithDuplicates)).toThrow(
        /duplicate/i
      );
    });
  });

  describe('Preparation (INV-WF-005)', () => {
    it('INV-WF-005: should freeze workflow after preparation', () => {
      const workflow = {
        workflowId: 'test',
        version: '1.0.0',
        steps: [{ stepId: 'step-1', type: 'prompt' }],
      };

      const prepared = prepareWorkflow(workflow);

      // Workflow should be frozen
      expect(Object.isFrozen(prepared.workflow)).toBe(true);

      // Attempting to modify should throw
      expect(() => {
        (prepared.workflow as Workflow).workflowId = 'modified';
      }).toThrow();
    });

    it('should collect step IDs correctly', () => {
      const workflow = {
        workflowId: 'test',
        version: '1.0.0',
        steps: [
          { stepId: 'step-1', type: 'prompt' },
          { stepId: 'step-2', type: 'tool' },
        ],
      };

      const prepared = prepareWorkflow(workflow);
      expect(prepared.stepIds.has('step-1')).toBe(true);
      expect(prepared.stepIds.has('step-2')).toBe(true);
      expect(prepared.stepIds.size).toBe(2);
    });
  });

  describe('Runner (INV-WF-001)', () => {
    let executionOrder: string[];
    let mockExecutor: StepExecutor;

    beforeEach(() => {
      executionOrder = [];
      mockExecutor = (step, _context): Promise<StepResult> => {
        executionOrder.push(step.stepId);
        return Promise.resolve({
          stepId: step.stepId,
          success: true,
          output: { executed: step.stepId },
          durationMs: 10,
          retryCount: 0,
        });
      };
    });

    it('INV-WF-001: should execute steps in definition order', async () => {
      const workflow = {
        workflowId: 'order-test',
        version: '1.0.0',
        steps: [
          { stepId: 'step-a', type: 'prompt' },
          { stepId: 'step-b', type: 'tool' },
          { stepId: 'step-c', type: 'prompt' },
        ],
      };

      const runner = createWorkflowRunner({ stepExecutor: mockExecutor });
      const result = await runner.run(workflow);

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(['step-a', 'step-b', 'step-c']);
    });

    it('should stop on step failure', async () => {
      const failingExecutor: StepExecutor = (step): Promise<StepResult> => {
        executionOrder.push(step.stepId);
        if (step.stepId === 'step-b') {
          return Promise.resolve({
            stepId: step.stepId,
            success: false,
            error: { code: 'TEST_ERROR', message: 'Test failure', retryable: false },
            durationMs: 10,
            retryCount: 0,
          });
        }
        return Promise.resolve({
          stepId: step.stepId,
          success: true,
          durationMs: 10,
          retryCount: 0,
        });
      };

      const workflow = {
        workflowId: 'fail-test',
        version: '1.0.0',
        steps: [
          { stepId: 'step-a', type: 'prompt' },
          { stepId: 'step-b', type: 'tool' },
          { stepId: 'step-c', type: 'prompt' }, // Should not execute
        ],
      };

      const runner = createWorkflowRunner({ stepExecutor: failingExecutor });
      const result = await runner.run(workflow);

      expect(result.success).toBe(false);
      expect(executionOrder).toEqual(['step-a', 'step-b']);
      expect(result.error?.failedStepId).toBe('step-b');
    });

    it('should call lifecycle hooks', async () => {
      const startCalls: string[] = [];
      const completeCalls: string[] = [];

      const workflow = {
        workflowId: 'hooks-test',
        version: '1.0.0',
        steps: [
          { stepId: 'step-1', type: 'prompt' },
          { stepId: 'step-2', type: 'tool' },
        ],
      };

      const runner = createWorkflowRunner({
        stepExecutor: mockExecutor,
        onStepStart: (step) => startCalls.push(step.stepId),
        onStepComplete: (step) => completeCalls.push(step.stepId),
      });

      await runner.run(workflow);

      expect(startCalls).toEqual(['step-1', 'step-2']);
      expect(completeCalls).toEqual(['step-1', 'step-2']);
    });
  });

  describe('Retry Logic (INV-WF-002)', () => {
    it('should use defaults when no policy provided', () => {
      const merged = mergeRetryPolicy(undefined);

      expect(merged.maxAttempts).toBe(DEFAULT_RETRY_POLICY.maxAttempts);
      expect(merged.backoffMs).toBe(DEFAULT_RETRY_POLICY.backoffMs);
      expect(merged.backoffMultiplier).toBe(DEFAULT_RETRY_POLICY.backoffMultiplier);
    });

    it('should determine retry eligibility', () => {
      const policy = mergeRetryPolicy({
        maxAttempts: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
        retryOn: ['timeout', 'rate_limit', 'server_error', 'network_error'],
      });

      // Retryable error
      const retryableError = {
        code: 'TIMEOUT',
        message: 'Request timed out',
        retryable: true,
      };
      expect(shouldRetry(retryableError, policy, 1)).toBe(true);
      expect(shouldRetry(retryableError, policy, 3)).toBe(false); // Max reached

      // Non-retryable error
      const nonRetryableError = {
        code: 'INVALID_INPUT',
        message: 'Bad input',
        retryable: false,
      };
      expect(shouldRetry(nonRetryableError, policy, 1)).toBe(false);
    });

    it('should calculate exponential backoff', () => {
      const policy = mergeRetryPolicy({
        maxAttempts: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
      });

      expect(calculateBackoff(policy, 1)).toBe(1000);
      expect(calculateBackoff(policy, 2)).toBe(2000);
      expect(calculateBackoff(policy, 3)).toBe(4000);
    });

    it('INV-WF-002: retries should be scoped to current step', async () => {
      let step1Attempts = 0;
      let step2Attempts = 0;

      const retryingExecutor: StepExecutor = (step): Promise<StepResult> => {
        if (step.stepId === 'step-1') {
          step1Attempts++;
          return Promise.resolve({
            stepId: step.stepId,
            success: true,
            durationMs: 10,
            retryCount: 0,
          });
        }

        step2Attempts++;
        if (step2Attempts < 3) {
          return Promise.resolve({
            stepId: step.stepId,
            success: false,
            error: { code: 'TIMEOUT', message: 'Timeout', retryable: true },
            durationMs: 10,
            retryCount: step2Attempts - 1,
          });
        }
        return Promise.resolve({
          stepId: step.stepId,
          success: true,
          durationMs: 10,
          retryCount: step2Attempts - 1,
        });
      };

      const workflow = {
        workflowId: 'retry-test',
        version: '1.0.0',
        steps: [
          { stepId: 'step-1', type: 'prompt' },
          {
            stepId: 'step-2',
            type: 'tool',
            retryPolicy: { maxAttempts: 3, backoffMs: 100, backoffMultiplier: 1 },
          },
        ],
      };

      const runner = createWorkflowRunner({ stepExecutor: retryingExecutor });
      const result = await runner.run(workflow);

      expect(result.success).toBe(true);
      expect(step1Attempts).toBe(1); // Step 1 should only run once
      expect(step2Attempts).toBe(3); // Step 2 retried
    });
  });
});
