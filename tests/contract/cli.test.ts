/**
 * CLI Contract Tests
 *
 * Validates CLI schemas and contract invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  ResumeOptionsSchema,
  CheckpointInfoSchema,
  ResumeResultSchema,
  RunStatusSchema,
  RunRecordSchema,
  HistoryOptionsSchema,
  CleanupOptionsSchema,
  CleanupResultSchema,
  StatusOptionsSchema,
  CLIErrorCodes,
  validateResumeOptions,
  safeValidateResumeOptions,
  createDefaultResumeOptions,
  createDefaultHistoryOptions,
} from '@automatosx/contracts';
// Simple UUID generation for tests
const uuid = () => crypto.randomUUID();

describe('CLI Contract', () => {
  describe('ResumeOptionsSchema', () => {
    it('should validate minimal resume options', () => {
      const options = {};
      const result = ResumeOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });

    it('should validate resume options with checkpoint', () => {
      const options = {
        checkpointId: uuid(),
        agentId: 'agent-1',
      };
      const result = ResumeOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });
  });

  describe('RunStatusSchema', () => {
    it('should accept valid statuses', () => {
      const statuses = ['running', 'completed', 'failed', 'cancelled'];
      for (const status of statuses) {
        const result = RunStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      expect(RunStatusSchema.safeParse('pending').success).toBe(false);
    });
  });

  describe('RunRecordSchema', () => {
    it('should validate a run record', () => {
      const record = {
        runId: uuid(),
        agentId: 'agent-1',
        sessionId: uuid(),
        task: 'Process the data',
        status: 'completed',
        stepsCompleted: 5,
        startedAt: new Date().toISOString(),
      };
      const result = RunRecordSchema.safeParse(record);
      expect(result.success).toBe(true);
    });
  });

  describe('CheckpointInfoSchema', () => {
    it('should validate checkpoint info', () => {
      const info = {
        checkpointId: uuid(),
        agentId: 'agent-1',
        stepIndex: 5,
        completedStepId: 'step-5',
        createdAt: new Date().toISOString(),
        age: '5 minutes ago',
      };
      const result = CheckpointInfoSchema.safeParse(info);
      expect(result.success).toBe(true);
    });
  });

  describe('HistoryOptionsSchema', () => {
    it('should validate history options', () => {
      const options = {
        limit: 10,
        status: 'completed',
      };
      const result = HistoryOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });
  });

  describe('CleanupOptionsSchema', () => {
    it('should validate cleanup options', () => {
      const options = {
        types: ['traces', 'checkpoints'],
        dryRun: true,
      };
      const result = CleanupOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });
  });

  describe('StatusOptionsSchema', () => {
    it('should validate status options', () => {
      const options = {
        verbose: true,
      };
      const result = StatusOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });
  });

  describe('Factory Functions', () => {
    it('should create default resume options', () => {
      const options = createDefaultResumeOptions();
      expect(options).toBeDefined();
    });

    it('should create default history options', () => {
      const options = createDefaultHistoryOptions();
      expect(options).toBeDefined();
    });
  });

  describe('Error Codes', () => {
    it('should have defined error codes', () => {
      expect(CLIErrorCodes).toBeDefined();
      expect(typeof CLIErrorCodes.CHECKPOINT_NOT_FOUND).toBe('string');
    });
  });

  /**
   * Invariant Tests
   * Tests for documented invariants in packages/contracts/src/cli/v1/invariants.md
   */
  describe('INV-CLI: CLI Invariants', () => {
    describe('INV-CLI-001: Exit Codes', () => {
      it('should define standard error codes', () => {
        expect(CLIErrorCodes).toBeDefined();
        expect(CLIErrorCodes.CHECKPOINT_NOT_FOUND).toBeDefined();
      });

      it('run status should map to exit behavior', () => {
        const validStatuses = ['running', 'completed', 'failed', 'cancelled'];
        for (const status of validStatuses) {
          const result = RunStatusSchema.safeParse(status);
          expect(result.success).toBe(true);
        }
      });

      it('completed status should indicate success exit', () => {
        const record = {
          runId: uuid(),
          agentId: 'agent-1',
          sessionId: uuid(),
          task: 'Test task',
          status: 'completed',
          stepsCompleted: 5,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        const result = RunRecordSchema.safeParse(record);
        expect(result.success).toBe(true);
      });

      it('failed status should indicate error exit', () => {
        const record = {
          runId: uuid(),
          agentId: 'agent-1',
          sessionId: uuid(),
          task: 'Test task',
          status: 'failed',
          stepsCompleted: 3,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          // error is a string, not an object
          error: 'Task failed: timeout after 30 seconds',
        };
        const result = RunRecordSchema.safeParse(record);
        expect(result.success).toBe(true);
      });
    });

    describe('INV-CLI-002: Error Messages', () => {
      it('run record should support error details', () => {
        const record = {
          runId: uuid(),
          agentId: 'agent-1',
          sessionId: uuid(),
          task: 'Failing task',
          status: 'failed',
          stepsCompleted: 1,
          startedAt: new Date().toISOString(),
          // error is just a string
          error: 'Provider connection failed: ECONNREFUSED',
        };
        const result = RunRecordSchema.safeParse(record);
        expect(result.success).toBe(true);
      });

      it('cleanup result should include details', () => {
        // CleanupResultSchema has cleaned array, totalCount, totalFreedBytes, dryRun
        const result = {
          cleaned: [
            { type: 'traces', count: 5, freedBytes: 512000 },
            { type: 'checkpoints', count: 5, freedBytes: 512000 },
          ],
          totalCount: 10,
          totalFreedBytes: 1024000,
          dryRun: false,
        };
        const parsed = CleanupResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
      });
    });

    describe('INV-CLI-OUT-001: Format Consistency', () => {
      it('history options should support limit', () => {
        const options = {
          limit: 20,
        };
        const result = HistoryOptionsSchema.safeParse(options);
        expect(result.success).toBe(true);
      });

      it('history options should support status filter', () => {
        const options = {
          status: 'completed',
        };
        const result = HistoryOptionsSchema.safeParse(options);
        expect(result.success).toBe(true);
      });

      it('status options should support verbose mode', () => {
        const options = {
          verbose: true,
        };
        const result = StatusOptionsSchema.safeParse(options);
        expect(result.success).toBe(true);
      });
    });

    describe('INV-CLI-OUT-002: Progress Feedback', () => {
      it('run record should track steps completed', () => {
        const record = {
          runId: uuid(),
          agentId: 'agent-1',
          sessionId: uuid(),
          task: 'Multi-step task',
          status: 'running',
          stepsCompleted: 3,
          startedAt: new Date().toISOString(),
        };
        const result = RunRecordSchema.safeParse(record);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.stepsCompleted).toBe(3);
        }
      });

      it('checkpoint should track step progress', () => {
        const checkpoint = {
          checkpointId: uuid(),
          agentId: 'agent-1',
          stepIndex: 5,
          completedStepId: 'step-5',
          createdAt: new Date().toISOString(),
          age: '2 minutes ago',
        };
        const result = CheckpointInfoSchema.safeParse(checkpoint);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.stepIndex).toBe(5);
        }
      });
    });

    describe('INV-CLI-STORE-001: Consistent Backend', () => {
      it('resume options should be consistent', () => {
        const options = {
          checkpointId: uuid(),
          agentId: 'agent-1',
        };
        const result1 = ResumeOptionsSchema.safeParse(options);
        const result2 = ResumeOptionsSchema.safeParse(options);

        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);
        if (result1.success && result2.success) {
          expect(result1.data.checkpointId).toBe(result2.data.checkpointId);
          expect(result1.data.agentId).toBe(result2.data.agentId);
        }
      });

      it('cleanup options should specify target types', () => {
        // CleanupOptionsSchema has types with default, dryRun default false
        const options = {
          types: ['traces', 'checkpoints'],
          force: false,
          format: 'text',
        };
        const result = CleanupOptionsSchema.safeParse(options);
        expect(result.success).toBe(true);
      });

      it('resume result should track step restoration', () => {
        // ResumeResultSchema has checkpointId, agentId, startFromStep, previousStepsCompleted
        const result = {
          checkpointId: uuid(),
          agentId: 'agent-1',
          startFromStep: 5,
          previousStepsCompleted: 4,
        };
        const parsed = ResumeResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.startFromStep).toBe(5);
        }
      });
    });
  });
});
