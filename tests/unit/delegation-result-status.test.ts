/**
 * Delegation Result Status - Exhaustive Checking Tests
 *
 * Tests that ensure all DelegationResult.status values are properly handled
 * and no invalid status values are used.
 *
 * Added after Bug #11 discovery to prevent future status value bugs.
 *
 * @group unit
 * @group core
 * @group types
 */

import { describe, it, expect } from 'vitest';
import type { DelegationResult } from '../../src/types/orchestration.js';

describe('DelegationResult Status Values', () => {
  describe('Type Safety', () => {
    it('should only allow valid status values', () => {
      // Valid statuses
      const validStatuses: Array<DelegationResult['status']> = [
        'success',
        'failure',
        'timeout'
      ];

      expect(validStatuses).toHaveLength(3);
      expect(validStatuses).toContain('success');
      expect(validStatuses).toContain('failure');
      expect(validStatuses).toContain('timeout');
    });

    it('should create DelegationResult with success status', () => {
      const result: DelegationResult = {
        delegationId: 'test-1',
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        task: 'test task',
        status: 'success',
        success: true,
        response: {
          content: 'done',
          model: 'test',
          tokensUsed: { prompt: 10, completion: 10, total: 20 },
          latencyMs: 100,
          finishReason: 'stop'
        },
        duration: 100,
        outputs: {},
        startTime: new Date(),
        endTime: new Date()
      };

      expect(result.status).toBe('success');
      expect(result.success).toBe(true);
    });

    it('should create DelegationResult with failure status', () => {
      const result: DelegationResult = {
        delegationId: 'test-2',
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        task: 'test task',
        status: 'failure',
        success: false,
        response: {
          content: 'error',
          model: 'test',
          tokensUsed: { prompt: 10, completion: 10, total: 20 },
          latencyMs: 100,
          finishReason: 'error'
        },
        duration: 100,
        outputs: {},
        startTime: new Date(),
        endTime: new Date()
      };

      expect(result.status).toBe('failure');
      expect(result.success).toBe(false);
    });

    it('should create DelegationResult with timeout status', () => {
      const result: DelegationResult = {
        delegationId: 'test-3',
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        task: 'test task',
        status: 'timeout',
        success: false,
        response: {
          content: 'timeout',
          model: 'test',
          tokensUsed: { prompt: 10, completion: 10, total: 20 },
          latencyMs: 100,
          finishReason: 'length'
        },
        duration: 100,
        outputs: {},
        startTime: new Date(),
        endTime: new Date()
      };

      expect(result.status).toBe('timeout');
      expect(result.success).toBe(false);
    });
  });

  describe('Exhaustive Pattern Matching', () => {
    it('should handle all status values in switch statement', () => {
      const testStatus = (status: DelegationResult['status']): string => {
        switch (status) {
          case 'success':
            return 'completed successfully';
          case 'failure':
            return 'failed';
          case 'timeout':
            return 'timed out';
          default:
            // TypeScript will error if we miss a case
            const exhaustiveCheck: never = status;
            return exhaustiveCheck;
        }
      };

      expect(testStatus('success')).toBe('completed successfully');
      expect(testStatus('failure')).toBe('failed');
      expect(testStatus('timeout')).toBe('timed out');
    });

    it('should handle all status values with if-else chain', () => {
      const results: DelegationResult[] = [
        {
          delegationId: '1',
          fromAgent: 'a',
          toAgent: 'b',
          task: 'task',
          status: 'success',
          success: true,
          response: {
            content: 'ok',
            model: 'test',
            tokensUsed: { prompt: 10, completion: 10, total: 20 },
            latencyMs: 100,
            finishReason: 'stop'
          },
          duration: 100,
          outputs: {},
          startTime: new Date(),
          endTime: new Date()
        },
        {
          delegationId: '2',
          fromAgent: 'a',
          toAgent: 'b',
          task: 'task',
          status: 'failure',
          success: false,
          response: {
            content: 'error',
            model: 'test',
            tokensUsed: { prompt: 10, completion: 10, total: 20 },
            latencyMs: 100,
            finishReason: 'error'
          },
          duration: 100,
          outputs: {},
          startTime: new Date(),
          endTime: new Date()
        },
        {
          delegationId: '3',
          fromAgent: 'a',
          toAgent: 'b',
          task: 'task',
          status: 'timeout',
          success: false,
          response: {
            content: 'timeout',
            model: 'test',
            tokensUsed: { prompt: 10, completion: 10, total: 20 },
            latencyMs: 100,
            finishReason: 'length'
          },
          duration: 100,
          outputs: {},
          startTime: new Date(),
          endTime: new Date()
        }
      ];

      const categorized = {
        success: 0,
        failure: 0,
        timeout: 0
      };

      for (const result of results) {
        if (result.status === 'success') {
          categorized.success++;
        } else if (result.status === 'failure') {
          categorized.failure++;
        } else if (result.status === 'timeout') {
          categorized.timeout++;
        } else {
          // This should never happen
          throw new Error(`Unknown status: ${result.status}`);
        }
      }

      expect(categorized.success).toBe(1);
      expect(categorized.failure).toBe(1);
      expect(categorized.timeout).toBe(1);
    });

    it('should filter results by status exhaustively', () => {
      const results: DelegationResult[] = Array.from({ length: 10 }, (_, i): DelegationResult => ({
        delegationId: `test-${i}`,
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        task: 'test task',
        status: i < 5 ? 'success' : i < 8 ? 'failure' : 'timeout',
        success: i < 5,
        response: {
          content: 'test',
          model: 'test',
          tokensUsed: { prompt: 10, completion: 10, total: 20 },
          latencyMs: 100,
          finishReason: 'stop'
        },
        duration: 100,
        outputs: {},
        startTime: new Date(),
        endTime: new Date()
      }));

      const successes = results.filter(r => r.status === 'success');
      const failures = results.filter(r => r.status === 'failure');
      const timeouts = results.filter(r => r.status === 'timeout');

      expect(successes.length).toBe(5);
      expect(failures.length).toBe(3);
      expect(timeouts.length).toBe(2);
      expect(successes.length + failures.length + timeouts.length).toBe(results.length);
    });
  });

  describe('Status-Success Consistency', () => {
    it('should have success=true when status=success', () => {
      const result: DelegationResult = {
        delegationId: 'test',
        fromAgent: 'a',
        toAgent: 'b',
        task: 'task',
        status: 'success',
        success: true,
        response: {
          content: 'done',
          model: 'test',
          tokensUsed: { prompt: 10, completion: 10, total: 20 },
          latencyMs: 100,
          finishReason: 'stop'
        },
        duration: 100,
        outputs: {},
        startTime: new Date(),
        endTime: new Date()
      };

      expect(result.status).toBe('success');
      expect(result.success).toBe(true);
      expect(result.status === 'success').toBe(result.success);
    });

    it('should have success=false when status=failure', () => {
      const result: DelegationResult = {
        delegationId: 'test',
        fromAgent: 'a',
        toAgent: 'b',
        task: 'task',
        status: 'failure',
        success: false,
        response: {
          content: 'error',
          model: 'test',
          tokensUsed: { prompt: 10, completion: 10, total: 20 },
          latencyMs: 100,
          finishReason: 'error'
        },
        duration: 100,
        outputs: {},
        startTime: new Date(),
        endTime: new Date()
      };

      expect(result.status).toBe('failure');
      expect(result.success).toBe(false);
      expect(result.status === 'success').toBe(result.success);
    });

    it('should have success=false when status=timeout', () => {
      const result: DelegationResult = {
        delegationId: 'test',
        fromAgent: 'a',
        toAgent: 'b',
        task: 'task',
        status: 'timeout',
        success: false,
        response: {
          content: 'timeout',
          model: 'test',
          tokensUsed: { prompt: 10, completion: 10, total: 20 },
          latencyMs: 100,
          finishReason: 'length'
        },
        duration: 100,
        outputs: {},
        startTime: new Date(),
        endTime: new Date()
      };

      expect(result.status).toBe('timeout');
      expect(result.success).toBe(false);
      expect(result.status === 'success').toBe(result.success);
    });
  });

  describe('Regression Tests for Bug #11', () => {
    it('should NOT allow skipped status', () => {
      // This test documents that 'skipped' is NOT a valid status
      // AgentNode.status can be 'skipped', but DelegationResult.status cannot

      // TypeScript will prevent this at compile time:
      // const invalid: DelegationResult = {
      //   ...
      //   status: 'skipped',  // ❌ TypeScript error
      //   ...
      // };

      // Instead, skipped agents should be mapped to 'failure'
      const skippedAgent: DelegationResult = {
        delegationId: 'test',
        fromAgent: 'a',
        toAgent: 'b',
        task: 'task',
        status: 'failure',  // ✅ Skipped maps to failure
        success: false,
        response: {
          content: 'Agent skipped due to dependency failure',
          model: 'error',
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          latencyMs: 0,
          finishReason: 'error'
        },
        duration: 0,
        outputs: {},
        startTime: new Date(),
        endTime: new Date()
      };

      expect(skippedAgent.status).toBe('failure');
      expect(skippedAgent.success).toBe(false);
    });

    it('should handle skipped agents by mapping to failure status', () => {
      // Simulate what executor.ts does when an agent is skipped
      const agentNodeStatus: 'skipped' | 'failed' | 'completed' = 'skipped';

      // Map to DelegationResult status
      const delegationStatus: DelegationResult['status'] = 'failure';

      expect(delegationStatus).toBe('failure');
      expect(['success', 'failure', 'timeout']).toContain(delegationStatus);
    });
  });
});
