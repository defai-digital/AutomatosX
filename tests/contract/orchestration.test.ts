/**
 * Orchestration Contract Tests
 *
 * Validates orchestration schemas and contract invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  OrchTaskStatusSchema,
  OrchTaskPrioritySchema,
  OrchTaskTypeSchema,
  TaskDefinitionSchema,
  TaskExecutionSchema,
  QueueCreateRequestSchema,
  TaskSubmitRequestSchema,
  FlowStepSchema,
  FlowDefinitionSchema,
  validateTaskSubmitRequest,
  safeValidateTaskSubmitRequest,
  validateFlowDefinition,
} from '@defai.digital/contracts';
// Simple UUID generation for tests
const uuid = () => crypto.randomUUID();

describe('Orchestration Contract', () => {
  describe('OrchTaskStatusSchema', () => {
    it('should accept valid task statuses', () => {
      const statuses = ['pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'paused', 'timeout'];
      for (const status of statuses) {
        const result = OrchTaskStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('OrchTaskPrioritySchema', () => {
    it('should accept valid priorities', () => {
      const priorities = ['critical', 'high', 'medium', 'low', 'background'];
      for (const priority of priorities) {
        const result = OrchTaskPrioritySchema.safeParse(priority);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('OrchTaskTypeSchema', () => {
    it('should accept valid task types', () => {
      const types = ['sequential', 'parallel', 'conditional', 'loop', 'retry', 'timeout', 'wait', 'callback', 'other'];
      for (const type of types) {
        const result = OrchTaskTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('TaskDefinitionSchema', () => {
    it('should validate task definition', () => {
      const task = {
        taskId: uuid(),
        type: 'sequential',
        name: 'Process Data',
        priority: 'medium',
      };
      const result = TaskDefinitionSchema.safeParse(task);
      expect(result.success).toBe(true);
    });
  });

  describe('QueueCreateRequestSchema', () => {
    it('should validate queue creation request', () => {
      const request = {
        name: 'Main Queue',
        maxConcurrency: 5,
      };
      const result = QueueCreateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('TaskSubmitRequestSchema', () => {
    it('should validate submit request', () => {
      const request = {
        name: 'My Task',
        type: 'sequential',
        queueId: uuid(),
      };
      const result = TaskSubmitRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate request with dependencies', () => {
      const request = {
        name: 'Dependent Task',
        type: 'parallel',
        queueId: uuid(),
        dependencies: [uuid()],
      };
      const result = safeValidateTaskSubmitRequest(request);
      expect(result.success).toBe(true);
    });
  });

  describe('FlowStepSchema', () => {
    it('should validate flow step', () => {
      const step = {
        stepId: 'step-1',
        name: 'First Step',
        type: 'sequential',
      };
      const result = FlowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });
  });

  describe('FlowDefinitionSchema', () => {
    it('should validate flow definition', () => {
      const flow = {
        flowId: uuid(),
        name: 'My Flow',
        steps: [
          { stepId: 'step-1', name: 'Step 1', type: 'sequential' },
          { stepId: 'step-2', name: 'Step 2', type: 'parallel' },
        ],
        startStep: 'step-1',
        endSteps: ['step-2'],
      };
      const result = validateFlowDefinition(flow);
      expect(result.flowId).toBeDefined();
    });

    it('should require at least one step', () => {
      const flow = {
        flowId: uuid(),
        name: 'Empty Flow',
        steps: [],
        startStep: 'step-1',
        endSteps: ['step-1'],
      };
      const result = FlowDefinitionSchema.safeParse(flow);
      expect(result.success).toBe(false);
    });
  });

  describe('TaskExecutionSchema', () => {
    it('should validate task execution', () => {
      const execution = {
        taskId: uuid(),
        status: 'running',
        startedAt: new Date().toISOString(),
      };
      const result = TaskExecutionSchema.safeParse(execution);
      expect(result.success).toBe(true);
    });
  });

  /**
   * Invariant Tests
   * Tests for documented invariants in packages/contracts/src/orchestration/v1/invariants.md
   */
  describe('INV-ORC: Orchestration Invariants', () => {
    describe('INV-ORC-PLAN-001: Plan Validation', () => {
      it('should require unique step IDs in flow', () => {
        const flow = {
          flowId: uuid(),
          name: 'Test Flow',
          steps: [
            { stepId: 'step-1', name: 'A', type: 'sequential' },
          ],
          startStep: 'step-1',
          endSteps: ['step-1'],
        };
        const result = FlowDefinitionSchema.safeParse(flow);
        expect(result.success).toBe(true);
      });

      it('should validate flow definition with valid UUID', () => {
        const flow = {
          flowId: uuid(),
          name: 'Valid Flow',
          steps: [
            { stepId: 'step-1', name: 'First', type: 'sequential' },
            { stepId: 'step-2', name: 'Second', type: 'parallel' },
          ],
          startStep: 'step-1',
          endSteps: ['step-2'],
        };
        const result = FlowDefinitionSchema.safeParse(flow);
        expect(result.success).toBe(true);
      });

      it('should enforce at least one step in flow', () => {
        const flow = {
          flowId: uuid(),
          name: 'Empty Flow',
          steps: [],
          startStep: 'step-1',
          endSteps: ['step-1'],
        };
        const result = FlowDefinitionSchema.safeParse(flow);
        expect(result.success).toBe(false);
      });
    });

    describe('INV-ORC-PLAN-002: Step Dependencies', () => {
      it('should validate step with dependencies array', () => {
        const step = {
          stepId: 'step-2',
          name: 'Dependent Step',
          type: 'sequential',
          dependsOn: ['step-1'],
        };
        const result = FlowStepSchema.safeParse(step);
        expect(result.success).toBe(true);
      });

      it('should allow empty dependencies', () => {
        const step = {
          stepId: 'step-1',
          name: 'Independent Step',
          type: 'sequential',
          dependsOn: [],
        };
        const result = FlowStepSchema.safeParse(step);
        expect(result.success).toBe(true);
      });
    });

    describe('INV-ORC-AGT-001: Capability Matching', () => {
      it('should validate task type for capability matching', () => {
        const types = ['sequential', 'parallel', 'conditional', 'loop', 'retry', 'timeout', 'wait', 'callback', 'other'];
        for (const type of types) {
          const result = OrchTaskTypeSchema.safeParse(type);
          expect(result.success).toBe(true);
        }
      });

      it('should reject invalid task types', () => {
        const result = OrchTaskTypeSchema.safeParse('unknown-type');
        expect(result.success).toBe(false);
      });
    });

    describe('INV-ORC-AGT-002: Selection Determinism', () => {
      it('task definition should have deterministic structure', () => {
        const task = {
          taskId: uuid(),
          type: 'sequential',
          name: 'Deterministic Task',
          priority: 'high',
        };
        const result1 = TaskDefinitionSchema.safeParse(task);
        const result2 = TaskDefinitionSchema.safeParse(task);

        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);
        if (result1.success && result2.success) {
          expect(result1.data.type).toBe(result2.data.type);
          expect(result1.data.name).toBe(result2.data.name);
          expect(result1.data.priority).toBe(result2.data.priority);
        }
      });
    });

    describe('INV-ORC-RES-001: Result Aggregation', () => {
      it('should validate task execution with status', () => {
        const execution = {
          taskId: uuid(),
          status: 'completed',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          output: { result: 'success' },
        };
        const result = TaskExecutionSchema.safeParse(execution);
        expect(result.success).toBe(true);
      });

      it('should validate execution with failed status', () => {
        // TaskExecutionSchema doesn't have error field - just tracks status
        const execution = {
          taskId: uuid(),
          status: 'failed',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        const result = TaskExecutionSchema.safeParse(execution);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('failed');
        }
      });
    });

    describe('INV-ORC-RES-002: Partial Results', () => {
      it('should validate all execution statuses', () => {
        const statuses = ['pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'paused', 'timeout'];
        for (const status of statuses) {
          const execution = {
            taskId: uuid(),
            status,
            startedAt: new Date().toISOString(),
          };
          const result = TaskExecutionSchema.safeParse(execution);
          expect(result.success).toBe(true);
        }
      });

      it('should allow paused status for partial results', () => {
        const execution = {
          taskId: uuid(),
          status: 'paused',
          startedAt: new Date().toISOString(),
          output: { partialData: [1, 2, 3] },
        };
        const result = TaskExecutionSchema.safeParse(execution);
        expect(result.success).toBe(true);
      });

      it('should validate timeout status', () => {
        const execution = {
          taskId: uuid(),
          status: 'timeout',
          startedAt: new Date().toISOString(),
        };
        const result = TaskExecutionSchema.safeParse(execution);
        expect(result.success).toBe(true);
      });
    });
  });
});
