/**
 * Parallel Execution Contract Tests
 *
 * Tests for parallel agent execution contract validation.
 * Enforces invariants from packages/contracts/src/parallel-execution/v1/invariants.md
 */

import { describe, it, expect } from 'vitest';
import {
  AgentParallelExecutionConfigSchema,
  AgentParallelTaskSchema,
  AgentParallelTaskResultSchema,
  AgentParallelGroupResultSchema,
  ExecutionPlanSchema,
  SharedContextSchema,
  ParallelExecutionRequestSchema,
  PreviewPlanRequestSchema,
  validateAgentParallelExecutionConfig,
  validateAgentParallelTask,
  validateParallelExecutionRequest,
  validateExecutionPlan,
  safeValidateAgentParallelExecutionConfig,
  createDefaultAgentParallelExecutionConfig,
  createAgentParallelTask,
  createSharedContext,
  ParallelExecutionErrorCodes,
} from '@defai.digital/contracts';

// ============================================================================
// Configuration Schema Tests
// ============================================================================

describe('AgentParallelExecutionConfigSchema', () => {
  it('should validate default configuration', () => {
    const config = createDefaultAgentParallelExecutionConfig();

    expect(config.maxConcurrentAgents).toBe(5);
    expect(config.agentTimeout).toBe(2700000);
    expect(config.failureStrategy).toBe('failSafe');
    expect(config.resultAggregation).toBe('merge');
    expect(config.enableCheckpointing).toBe(false);
    expect(config.shareContext).toBe(true);
  });

  it('should enforce maxConcurrentAgents bounds (INV-APE-001)', () => {
    // Valid range: 1-10
    expect(() =>
      AgentParallelExecutionConfigSchema.parse({ maxConcurrentAgents: 0 })
    ).toThrow();

    expect(() =>
      AgentParallelExecutionConfigSchema.parse({ maxConcurrentAgents: 11 })
    ).toThrow();

    expect(() =>
      AgentParallelExecutionConfigSchema.parse({ maxConcurrentAgents: 5 })
    ).not.toThrow();
  });

  it('should enforce agentTimeout bounds (INV-APE-005)', () => {
    // Min: 1000ms, Max: 7200000ms
    expect(() =>
      AgentParallelExecutionConfigSchema.parse({ agentTimeout: 500 })
    ).toThrow();

    expect(() =>
      AgentParallelExecutionConfigSchema.parse({ agentTimeout: 8000000 })
    ).toThrow();

    expect(() =>
      AgentParallelExecutionConfigSchema.parse({ agentTimeout: 60000 })
    ).not.toThrow();
  });

  it('should accept valid failure strategies', () => {
    const strategies = ['failFast', 'failSafe', 'continueOnError'];

    for (const strategy of strategies) {
      expect(() =>
        AgentParallelExecutionConfigSchema.parse({ failureStrategy: strategy })
      ).not.toThrow();
    }

    expect(() =>
      AgentParallelExecutionConfigSchema.parse({ failureStrategy: 'invalid' })
    ).toThrow();
  });

  it('should accept valid result aggregation strategies', () => {
    const strategies = ['merge', 'list', 'firstSuccess', 'custom'];

    for (const strategy of strategies) {
      expect(() =>
        AgentParallelExecutionConfigSchema.parse({ resultAggregation: strategy })
      ).not.toThrow();
    }
  });
});

// ============================================================================
// Task Schema Tests
// ============================================================================

describe('AgentParallelTaskSchema', () => {
  it('should create task with factory function', () => {
    const task = createAgentParallelTask('my-agent', { query: 'test' });

    expect(task.taskId).toBeDefined();
    expect(task.agentId).toBe('my-agent');
    expect(task.input).toEqual({ query: 'test' });
    expect(task.dependencies).toEqual([]);
    expect(task.priority).toBe(50);
  });

  it('should validate task structure', () => {
    const validTask = {
      taskId: crypto.randomUUID(),
      agentId: 'agent-1',
      input: { data: 'test' },
      dependencies: [],
      priority: 50,
    };

    expect(() => AgentParallelTaskSchema.parse(validTask)).not.toThrow();
  });

  it('should require taskId and agentId', () => {
    expect(() =>
      AgentParallelTaskSchema.parse({
        input: {},
        dependencies: [],
      })
    ).toThrow();
  });

  it('should enforce priority bounds', () => {
    expect(() =>
      AgentParallelTaskSchema.parse({
        taskId: crypto.randomUUID(),
        agentId: 'agent',
        input: {},
        priority: -1,
      })
    ).toThrow();

    expect(() =>
      AgentParallelTaskSchema.parse({
        taskId: crypto.randomUUID(),
        agentId: 'agent',
        input: {},
        priority: 101,
      })
    ).toThrow();
  });

  it('should allow optional fields', () => {
    const task = AgentParallelTaskSchema.parse({
      taskId: crypto.randomUUID(),
      agentId: 'agent',
      input: null,
      timeout: 60000,
      provider: 'claude',
      model: 'claude-3-opus',
      metadata: { key: 'value' },
    });

    expect(task.timeout).toBe(60000);
    expect(task.provider).toBe('claude');
    expect(task.model).toBe('claude-3-opus');
    expect(task.metadata).toEqual({ key: 'value' });
  });
});

// ============================================================================
// Task Result Schema Tests
// ============================================================================

describe('AgentParallelTaskResultSchema', () => {
  it('should validate successful task result', () => {
    const result = AgentParallelTaskResultSchema.parse({
      taskId: crypto.randomUUID(),
      agentId: 'agent-1',
      status: 'completed',
      success: true,
      output: { result: 'success' },
      durationMs: 1500,
      layer: 0,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('completed');
  });

  it('should validate failed task result', () => {
    const result = AgentParallelTaskResultSchema.parse({
      taskId: crypto.randomUUID(),
      agentId: 'agent-1',
      status: 'failed',
      success: false,
      error: 'Agent execution failed',
      errorCode: ParallelExecutionErrorCodes.TASK_FAILED,
      durationMs: 500,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.errorCode).toBe(ParallelExecutionErrorCodes.TASK_FAILED);
  });

  it('should validate all status values', () => {
    const statuses = [
      'pending',
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled',
      'timeout',
      'skipped',
    ];

    for (const status of statuses) {
      expect(() =>
        AgentParallelTaskResultSchema.parse({
          taskId: crypto.randomUUID(),
          agentId: 'agent',
          status,
          success: status === 'completed',
          durationMs: 100,
        })
      ).not.toThrow();
    }
  });
});

// ============================================================================
// Group Result Schema Tests
// ============================================================================

describe('AgentParallelGroupResultSchema', () => {
  it('should validate successful group result', () => {
    const result = AgentParallelGroupResultSchema.parse({
      groupId: crypto.randomUUID(),
      taskResults: [
        {
          taskId: crypto.randomUUID(),
          agentId: 'agent-1',
          status: 'completed',
          success: true,
          output: { data: 1 },
          durationMs: 100,
        },
        {
          taskId: crypto.randomUUID(),
          agentId: 'agent-2',
          status: 'completed',
          success: true,
          output: { data: 2 },
          durationMs: 150,
        },
      ],
      aggregatedOutput: { data: [1, 2] },
      allSucceeded: true,
      failedTasks: [],
      totalDurationMs: 200,
      tasksExecuted: 2,
      tasksSkipped: 0,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    expect(result.allSucceeded).toBe(true);
    expect(result.taskResults).toHaveLength(2);
    expect(result.failedTasks).toHaveLength(0);
  });

  it('should validate group with failures', () => {
    const taskId = crypto.randomUUID();
    const result = AgentParallelGroupResultSchema.parse({
      groupId: crypto.randomUUID(),
      taskResults: [
        {
          taskId,
          agentId: 'agent-1',
          status: 'failed',
          success: false,
          error: 'Failed',
          durationMs: 100,
        },
      ],
      allSucceeded: false,
      failedTasks: [taskId],
      totalDurationMs: 100,
      tasksExecuted: 1,
      tasksSkipped: 0,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    expect(result.allSucceeded).toBe(false);
    expect(result.failedTasks).toContain(taskId);
  });
});

// ============================================================================
// Execution Plan Schema Tests
// ============================================================================

describe('ExecutionPlanSchema', () => {
  it('should validate valid execution plan', () => {
    const plan = ExecutionPlanSchema.parse({
      planId: crypto.randomUUID(),
      layers: [
        {
          index: 0,
          tasks: [createAgentParallelTask('agent-1', {})],
          taskCount: 1,
        },
        {
          index: 1,
          tasks: [createAgentParallelTask('agent-2', {})],
          taskCount: 1,
        },
      ],
      totalTasks: 2,
      totalLayers: 2,
      maxParallelism: 1,
      hasCycles: false,
      createdAt: new Date().toISOString(),
    });

    expect(plan.totalLayers).toBe(2);
    expect(plan.hasCycles).toBe(false);
  });

  it('should indicate cycles', () => {
    const plan = ExecutionPlanSchema.parse({
      planId: crypto.randomUUID(),
      layers: [],
      totalTasks: 0,
      totalLayers: 0,
      maxParallelism: 0,
      hasCycles: true,
      createdAt: new Date().toISOString(),
    });

    expect(plan.hasCycles).toBe(true);
  });
});

// ============================================================================
// Shared Context Schema Tests
// ============================================================================

describe('SharedContextSchema', () => {
  it('should create valid shared context', () => {
    const context = createSharedContext({
      userId: '123',
      sessionData: { key: 'value' },
    });

    expect(context.data.userId).toBe('123');
    expect(context.createdAt).toBeDefined();
    expect(context.version).toBe('1');
  });

  it('should freeze context data (INV-APE-003)', () => {
    const context = createSharedContext({ mutable: 'data' });

    // Object.freeze returns frozen object
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.data)).toBe(true);
  });
});

// ============================================================================
// Request Schema Tests
// ============================================================================

describe('ParallelExecutionRequestSchema', () => {
  it('should validate valid request', () => {
    const request = ParallelExecutionRequestSchema.parse({
      tasks: [createAgentParallelTask('agent-1', { query: 'test' })],
      config: { maxConcurrentAgents: 3 },
      sharedContext: { userId: '123' },
    });

    expect(request.tasks).toHaveLength(1);
    expect(request.config?.maxConcurrentAgents).toBe(3);
  });

  it('should require at least one task', () => {
    expect(() =>
      ParallelExecutionRequestSchema.parse({
        tasks: [],
      })
    ).toThrow();
  });

  it('should limit to 100 tasks', () => {
    const manyTasks = Array.from({ length: 101 }, () =>
      createAgentParallelTask('agent', {})
    );

    expect(() =>
      ParallelExecutionRequestSchema.parse({
        tasks: manyTasks,
      })
    ).toThrow();
  });
});

// ============================================================================
// Error Codes Tests
// ============================================================================

describe('ParallelExecutionErrorCodes', () => {
  it('should have all required error codes', () => {
    expect(ParallelExecutionErrorCodes.CIRCULAR_DEPENDENCY).toBe(
      'PARALLEL_CIRCULAR_DEPENDENCY'
    );
    expect(ParallelExecutionErrorCodes.CONCURRENCY_EXCEEDED).toBe(
      'PARALLEL_CONCURRENCY_EXCEEDED'
    );
    expect(ParallelExecutionErrorCodes.GROUP_TIMEOUT).toBe(
      'PARALLEL_GROUP_TIMEOUT'
    );
    expect(ParallelExecutionErrorCodes.TASK_TIMEOUT).toBe(
      'PARALLEL_TASK_TIMEOUT'
    );
    expect(ParallelExecutionErrorCodes.TASK_FAILED).toBe(
      'PARALLEL_TASK_FAILED'
    );
    expect(ParallelExecutionErrorCodes.AGENT_NOT_FOUND).toBe(
      'PARALLEL_AGENT_NOT_FOUND'
    );
    expect(ParallelExecutionErrorCodes.DEPENDENCY_FAILED).toBe(
      'PARALLEL_DEPENDENCY_FAILED'
    );
    expect(ParallelExecutionErrorCodes.CANCELLED).toBe(
      'PARALLEL_CANCELLED'
    );
    expect(ParallelExecutionErrorCodes.INVALID_PLAN).toBe(
      'PARALLEL_INVALID_PLAN'
    );
    expect(ParallelExecutionErrorCodes.CONTEXT_MUTATION).toBe(
      'PARALLEL_CONTEXT_MUTATION'
    );
  });
});

// ============================================================================
// Validation Function Tests
// ============================================================================

describe('Validation Functions', () => {
  describe('validateAgentParallelExecutionConfig', () => {
    it('should return valid config', () => {
      const config = validateAgentParallelExecutionConfig({
        maxConcurrentAgents: 3,
      });
      expect(config.maxConcurrentAgents).toBe(3);
    });

    it('should throw on invalid config', () => {
      expect(() =>
        validateAgentParallelExecutionConfig({ maxConcurrentAgents: 100 })
      ).toThrow();
    });
  });

  describe('safeValidateAgentParallelExecutionConfig', () => {
    it('should return success for valid config', () => {
      const result = safeValidateAgentParallelExecutionConfig({
        maxConcurrentAgents: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should return error for invalid config', () => {
      const result = safeValidateAgentParallelExecutionConfig({
        maxConcurrentAgents: 'invalid',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('validateAgentParallelTask', () => {
    it('should validate task', () => {
      const task = validateAgentParallelTask({
        taskId: crypto.randomUUID(),
        agentId: 'agent',
        input: {},
      });
      expect(task.agentId).toBe('agent');
    });
  });

  describe('validateParallelExecutionRequest', () => {
    it('should validate request', () => {
      const request = validateParallelExecutionRequest({
        tasks: [createAgentParallelTask('agent', {})],
      });
      expect(request.tasks).toHaveLength(1);
    });
  });

  describe('validateExecutionPlan', () => {
    it('should validate plan', () => {
      const plan = validateExecutionPlan({
        planId: crypto.randomUUID(),
        layers: [],
        totalTasks: 0,
        totalLayers: 0,
        maxParallelism: 0,
        hasCycles: false,
        createdAt: new Date().toISOString(),
      });
      expect(plan.hasCycles).toBe(false);
    });
  });
});
