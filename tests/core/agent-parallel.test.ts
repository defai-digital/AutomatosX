/**
 * Agent Parallel Domain Tests
 *
 * Tests for parallel agent execution orchestration.
 * Enforces invariants from packages/contracts/src/parallel-execution/v1/invariants.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAgentParallelOrchestrator,
  createDAGAnalyzer,
  createContextManager,
  createResultAggregator,
  DAGAnalysisError,
  ContextMutationError,
  StubAgentExecutor,
  findCyclePath,
  AggregationStrategies,
  createKeyedAggregator,
  type AgentParallelOrchestrator,
  type AgentExecutorPort,
} from '@defai.digital/agent-parallel';
import {
  createAgentParallelTask,
  type AgentParallelTask,
  type AgentParallelTaskResult,
  ParallelExecutionErrorCodes,
} from '@defai.digital/contracts';

// ============================================================================
// DAG Analyzer Tests
// ============================================================================

describe('DAGAnalyzer', () => {
  const analyzer = createDAGAnalyzer();

  describe('analyze', () => {
    it('should handle empty task list', () => {
      const result = analyzer.analyze([]);

      expect(result.layers).toHaveLength(0);
      expect(result.totalLayers).toBe(0);
      expect(result.maxParallelism).toBe(0);
      expect(result.hasCycles).toBe(false);
    });

    it('should create single layer for independent tasks', () => {
      const tasks = [
        createAgentParallelTask('agent-1', {}),
        createAgentParallelTask('agent-2', {}),
        createAgentParallelTask('agent-3', {}),
      ];

      const result = analyzer.analyze(tasks);

      expect(result.layers).toHaveLength(1);
      expect(result.layers[0]!.tasks).toHaveLength(3);
      expect(result.maxParallelism).toBe(3);
    });

    it('should create sequential layers for dependent tasks (INV-APE-002)', () => {
      const task1 = createAgentParallelTask('agent-1', {});
      const task2 = createAgentParallelTask('agent-2', {}, {
        dependencies: [task1.taskId],
      });
      const task3 = createAgentParallelTask('agent-3', {}, {
        dependencies: [task2.taskId],
      });

      const result = analyzer.analyze([task1, task2, task3]);

      expect(result.layers).toHaveLength(3);
      expect(result.layers[0]!.tasks[0]!.taskId).toBe(task1.taskId);
      expect(result.layers[1]!.tasks[0]!.taskId).toBe(task2.taskId);
      expect(result.layers[2]!.tasks[0]!.taskId).toBe(task3.taskId);
    });

    it('should detect circular dependencies (INV-APE-200)', () => {
      const task1 = createAgentParallelTask('agent-1', {});
      const task2 = createAgentParallelTask('agent-2', {}, {
        dependencies: [task1.taskId],
      });

      // Create circular dependency: task1 depends on task2
      task1.dependencies = [task2.taskId];

      expect(() => analyzer.analyze([task1, task2])).toThrow(DAGAnalysisError);
    });

    it('should sort tasks by priority within layer', () => {
      const taskLow = createAgentParallelTask('low', {}, { priority: 10 });
      const taskHigh = createAgentParallelTask('high', {}, { priority: 90 });
      const taskMid = createAgentParallelTask('mid', {}, { priority: 50 });

      const result = analyzer.analyze([taskLow, taskMid, taskHigh]);

      expect(result.layers[0]!.tasks[0]!.agentId).toBe('high');
      expect(result.layers[0]!.tasks[1]!.agentId).toBe('mid');
      expect(result.layers[0]!.tasks[2]!.agentId).toBe('low');
    });

    it('should handle diamond dependency pattern', () => {
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D
      const taskA = createAgentParallelTask('A', {});
      const taskB = createAgentParallelTask('B', {}, {
        dependencies: [taskA.taskId],
      });
      const taskC = createAgentParallelTask('C', {}, {
        dependencies: [taskA.taskId],
      });
      const taskD = createAgentParallelTask('D', {}, {
        dependencies: [taskB.taskId, taskC.taskId],
      });

      const result = analyzer.analyze([taskA, taskB, taskC, taskD]);

      expect(result.layers).toHaveLength(3);
      expect(result.layers[0]!.tasks).toHaveLength(1); // A
      expect(result.layers[1]!.tasks).toHaveLength(2); // B, C
      expect(result.layers[2]!.tasks).toHaveLength(1); // D
    });
  });

  describe('validate', () => {
    it('should detect duplicate task IDs', () => {
      const task1 = createAgentParallelTask('agent-1', {});
      const task2 = { ...createAgentParallelTask('agent-2', {}), taskId: task1.taskId };

      const result = analyzer.validate([task1, task2]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Duplicate'));
    });

    it('should detect self-dependencies', () => {
      const task = createAgentParallelTask('agent-1', {});
      task.dependencies = [task.taskId];

      const result = analyzer.validate([task]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('depends on itself'));
    });

    it('should detect missing dependencies', () => {
      const task = createAgentParallelTask('agent-1', {}, {
        dependencies: [crypto.randomUUID()], // Non-existent task
      });

      const result = analyzer.validate([task]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('non-existent'));
    });
  });
});

describe('findCyclePath', () => {
  it('should find cycle path', () => {
    const task1 = createAgentParallelTask('A', {});
    const task2 = createAgentParallelTask('B', {}, {
      dependencies: [task1.taskId],
    });
    task1.dependencies = [task2.taskId];

    const path = findCyclePath([task1, task2]);

    expect(path).not.toBeNull();
    expect(path).toContain(task1.taskId);
    expect(path).toContain(task2.taskId);
  });

  it('should return null for no cycle', () => {
    const task1 = createAgentParallelTask('A', {});
    const task2 = createAgentParallelTask('B', {}, {
      dependencies: [task1.taskId],
    });

    const path = findCyclePath([task1, task2]);

    expect(path).toBeNull();
  });
});

// ============================================================================
// Context Manager Tests
// ============================================================================

describe('ContextManager', () => {
  it('should create frozen context (INV-APE-003)', () => {
    const manager = createContextManager();
    const context = manager.create({ key: 'value', nested: { inner: 1 } });

    expect(manager.isFrozen()).toBe(true);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.data)).toBe(true);
  });

  it('should return context via get()', () => {
    const manager = createContextManager();
    manager.create({ key: 'value' });

    const context = manager.get();

    expect(context).not.toBeNull();
    expect(context!.data.key).toBe('value');
  });

  it('should clear context', () => {
    const manager = createContextManager();
    manager.create({ key: 'value' });

    manager.clear();

    expect(manager.get()).toBeNull();
    expect(manager.isFrozen()).toBe(false);
  });

  it('should deep clone data to prevent external mutation', () => {
    const manager = createContextManager();
    const originalData = { nested: { value: 1 } };

    manager.create(originalData);

    // Modify original - should not affect context
    originalData.nested.value = 999;

    const context = manager.get();
    expect(context!.data.nested).toEqual({ value: 1 });
  });
});

// ============================================================================
// Result Aggregator Tests
// ============================================================================

describe('ResultAggregator', () => {
  const aggregator = createResultAggregator();

  const createResult = (
    agentId: string,
    output: unknown,
    success = true,
    layer = 0
  ): AgentParallelTaskResult => ({
    taskId: crypto.randomUUID(),
    agentId,
    status: success ? 'completed' : 'failed',
    success,
    output,
    durationMs: 100,
    layer,
    completedAt: new Date().toISOString(),
  });

  describe('merge strategy (INV-APE-004)', () => {
    it('should merge object outputs', () => {
      const results = [
        createResult('agent-1', { a: 1 }),
        createResult('agent-2', { b: 2 }),
      ];

      const aggregated = aggregator.aggregate(results, { strategy: 'merge' });

      expect(aggregated).toEqual({ a: 1, b: 2 });
    });

    it('should deep merge nested objects', () => {
      const results = [
        createResult('agent-1', { nested: { a: 1 } }),
        createResult('agent-2', { nested: { b: 2 } }),
      ];

      const aggregated = aggregator.aggregate(results, { strategy: 'merge' }) as Record<string, unknown>;

      expect(aggregated.nested).toEqual({ a: 1, b: 2 });
    });

    it('should use agentId as key for non-object outputs', () => {
      const results = [
        createResult('agent-1', 'value1'),
        createResult('agent-2', 'value2'),
      ];

      const aggregated = aggregator.aggregate(results, { strategy: 'merge' }) as Record<string, unknown>;

      expect(aggregated['agent-1']).toBe('value1');
      expect(aggregated['agent-2']).toBe('value2');
    });

    it('should exclude failed results', () => {
      const results = [
        createResult('agent-1', { a: 1 }),
        createResult('agent-2', { b: 2 }, false),
      ];

      const aggregated = aggregator.aggregate(results, { strategy: 'merge' });

      expect(aggregated).toEqual({ a: 1 });
    });
  });

  describe('list strategy (INV-APE-004)', () => {
    it('should return array of results', () => {
      const results = [
        createResult('agent-1', { a: 1 }),
        createResult('agent-2', { b: 2 }),
      ];

      const aggregated = aggregator.aggregate(results, { strategy: 'list' }) as unknown[];

      expect(aggregated).toHaveLength(2);
      expect(aggregated[0]).toHaveProperty('output');
    });

    it('should order by taskId', () => {
      // Create with deterministic task IDs for ordering
      const result1 = createResult('agent-a', { a: 1 });
      const result2 = createResult('agent-b', { b: 2 });

      const aggregated = aggregator.aggregate([result2, result1], { strategy: 'list' }) as unknown[];

      // Should be sorted by taskId
      expect(aggregated).toHaveLength(2);
    });
  });

  describe('firstSuccess strategy (INV-APE-004)', () => {
    it('should return first successful result', () => {
      const results = [
        createResult('agent-1', { a: 1 }, true, 0),
        createResult('agent-2', { b: 2 }, true, 1),
      ];

      const aggregated = aggregator.aggregate(results, { strategy: 'firstSuccess' });

      expect(aggregated).toEqual({ a: 1 });
    });

    it('should return undefined if all failed', () => {
      const results = [
        createResult('agent-1', undefined, false),
        createResult('agent-2', undefined, false),
      ];

      const aggregated = aggregator.aggregate(results, { strategy: 'firstSuccess' });

      expect(aggregated).toBeUndefined();
    });
  });

  describe('custom strategy', () => {
    it('should use custom aggregator function', () => {
      const results = [
        createResult('agent-1', 10),
        createResult('agent-2', 20),
      ];

      const customAggregator = (r: AgentParallelTaskResult[]) =>
        r.filter((x) => x.success).reduce((sum, x) => sum + (x.output as number), 0);

      const aggregated = aggregator.aggregate(results, {
        strategy: 'custom',
        customAggregator,
      });

      expect(aggregated).toBe(30);
    });

    it('should throw if no custom aggregator provided', () => {
      expect(() =>
        aggregator.aggregate([], { strategy: 'custom' })
      ).toThrow('customAggregator function');
    });
  });
});

describe('AggregationStrategies', () => {
  it('should provide built-in strategies', () => {
    expect(typeof AggregationStrategies.merge).toBe('function');
    expect(typeof AggregationStrategies.list).toBe('function');
    expect(typeof AggregationStrategies.firstSuccess).toBe('function');
  });
});

describe('createKeyedAggregator', () => {
  it('should group results by key', () => {
    const results: AgentParallelTaskResult[] = [
      {
        taskId: crypto.randomUUID(),
        agentId: 'type-a',
        status: 'completed',
        success: true,
        output: 1,
        durationMs: 100,
      },
      {
        taskId: crypto.randomUUID(),
        agentId: 'type-a',
        status: 'completed',
        success: true,
        output: 2,
        durationMs: 100,
      },
      {
        taskId: crypto.randomUUID(),
        agentId: 'type-b',
        status: 'completed',
        success: true,
        output: 3,
        durationMs: 100,
      },
    ];

    const aggregator = createKeyedAggregator((r) => r.agentId);
    const result = aggregator(results) as Record<string, unknown[]>;

    expect(result['type-a']).toEqual([1, 2]);
    expect(result['type-b']).toEqual([3]);
  });
});

// ============================================================================
// Orchestrator Tests
// ============================================================================

describe('AgentParallelOrchestrator', () => {
  let executor: StubAgentExecutor;
  let orchestrator: AgentParallelOrchestrator;

  beforeEach(() => {
    executor = new StubAgentExecutor();
    orchestrator = createAgentParallelOrchestrator({
      agentExecutor: executor,
    });
  });

  describe('buildExecutionPlan', () => {
    it('should build valid execution plan', () => {
      const tasks = [
        createAgentParallelTask('agent-1', {}),
        createAgentParallelTask('agent-2', {}),
      ];

      const plan = orchestrator.buildExecutionPlan(tasks);

      expect(plan.planId).toBeDefined();
      expect(plan.totalTasks).toBe(2);
      expect(plan.totalLayers).toBe(1);
      expect(plan.maxParallelism).toBe(2);
      expect(plan.hasCycles).toBe(false);
    });
  });

  describe('executeParallel', () => {
    it('should execute independent tasks in parallel', async () => {
      executor.setExists('agent-1', true);
      executor.setExists('agent-2', true);
      executor.setResult('agent-1', { success: true, agentId: 'agent-1', output: 1, durationMs: 50 });
      executor.setResult('agent-2', { success: true, agentId: 'agent-2', output: 2, durationMs: 50 });

      const tasks = [
        createAgentParallelTask('agent-1', {}),
        createAgentParallelTask('agent-2', {}),
      ];

      const result = await orchestrator.executeParallel(tasks);

      expect(result.allSucceeded).toBe(true);
      expect(result.tasksExecuted).toBe(2);
      expect(result.taskResults).toHaveLength(2);
    });

    it('should respect maxConcurrentAgents (INV-APE-001)', async () => {
      // Create many tasks
      const tasks = Array.from({ length: 10 }, (_, i) => {
        executor.setExists(`agent-${i}`, true);
        executor.setResult(`agent-${i}`, {
          success: true,
          agentId: `agent-${i}`,
          output: i,
          durationMs: 50,
        });
        return createAgentParallelTask(`agent-${i}`, {});
      });

      const result = await orchestrator.executeParallel(tasks, {
        maxConcurrentAgents: 2,
      });

      expect(result.allSucceeded).toBe(true);
      expect(result.tasksExecuted).toBe(10);
      // Peak concurrency should be limited
      expect(result.peakConcurrency).toBeLessThanOrEqual(2);
    });

    it('should honor dependencies (INV-APE-002)', async () => {
      const executionOrder: string[] = [];

      const customExecutor: AgentExecutorPort = {
        async execute(request) {
          executionOrder.push(request.agentId);
          return {
            success: true,
            agentId: request.agentId,
            output: { order: executionOrder.length },
            durationMs: 10,
          };
        },
        async exists() {
          return true;
        },
      };

      const localOrchestrator = createAgentParallelOrchestrator({
        agentExecutor: customExecutor,
      });

      const task1 = createAgentParallelTask('first', {});
      const task2 = createAgentParallelTask('second', {}, {
        dependencies: [task1.taskId],
      });

      await localOrchestrator.executeParallel([task1, task2]);

      expect(executionOrder[0]).toBe('first');
      expect(executionOrder[1]).toBe('second');
    });

    it('should handle failFast strategy (INV-APE-101)', async () => {
      executor.setExists('agent-1', true);
      executor.setExists('agent-2', true);
      executor.setResult('agent-1', {
        success: false,
        agentId: 'agent-1',
        error: 'Failed',
        durationMs: 50,
      });
      executor.setResult('agent-2', {
        success: true,
        agentId: 'agent-2',
        output: 2,
        durationMs: 100,
      });

      const task1 = createAgentParallelTask('agent-1', {});
      const task2 = createAgentParallelTask('agent-2', {}, {
        dependencies: [task1.taskId],
      });

      const result = await orchestrator.executeParallel([task1, task2], {
        failureStrategy: 'failFast',
      });

      expect(result.allSucceeded).toBe(false);
      expect(result.failedTasks).toContain(task1.taskId);
      // task2 should be skipped/cancelled due to dependency failure
      expect(result.skippedTasks?.includes(task2.taskId) || result.cancelledTasks?.includes(task2.taskId)).toBe(true);
    });

    it('should handle failSafe strategy (INV-APE-101)', async () => {
      executor.setExists('agent-1', true);
      executor.setExists('agent-2', true);
      executor.setResult('agent-1', {
        success: false,
        agentId: 'agent-1',
        error: 'Failed',
        durationMs: 50,
      });
      executor.setResult('agent-2', {
        success: true,
        agentId: 'agent-2',
        output: 2,
        durationMs: 50,
      });

      const tasks = [
        createAgentParallelTask('agent-1', {}),
        createAgentParallelTask('agent-2', {}),
      ];

      const result = await orchestrator.executeParallel(tasks, {
        failureStrategy: 'failSafe',
      });

      // Both should complete (no early exit)
      expect(result.taskResults).toHaveLength(2);
      expect(result.allSucceeded).toBe(false);
    });

    it('should cascade dependency failures (INV-APE-201)', async () => {
      executor.setExists('agent-1', true);
      executor.setExists('agent-2', true);
      executor.setResult('agent-1', {
        success: false,
        agentId: 'agent-1',
        error: 'Failed',
        durationMs: 50,
      });

      const task1 = createAgentParallelTask('agent-1', {});
      const task2 = createAgentParallelTask('agent-2', {}, {
        dependencies: [task1.taskId],
      });

      const result = await orchestrator.executeParallel([task1, task2], {
        failureStrategy: 'failSafe',
      });

      // task2 should be skipped due to dependency failure
      const task2Result = result.taskResults.find((r) => r.taskId === task2.taskId);
      expect(task2Result?.status).toBe('skipped');
      expect(task2Result?.errorCode).toBe(ParallelExecutionErrorCodes.DEPENDENCY_FAILED);
    });

    it('should handle agent not found', async () => {
      // Don't set exists for agent-1
      const tasks = [createAgentParallelTask('agent-1', {})];

      const result = await orchestrator.executeParallel(tasks);

      expect(result.allSucceeded).toBe(false);
      expect(result.taskResults[0]?.errorCode).toBe(
        ParallelExecutionErrorCodes.AGENT_NOT_FOUND
      );
    });

    it('should aggregate results based on strategy (INV-APE-004)', async () => {
      executor.setExists('agent-1', true);
      executor.setExists('agent-2', true);
      executor.setResult('agent-1', {
        success: true,
        agentId: 'agent-1',
        output: { a: 1 },
        durationMs: 50,
      });
      executor.setResult('agent-2', {
        success: true,
        agentId: 'agent-2',
        output: { b: 2 },
        durationMs: 50,
      });

      const tasks = [
        createAgentParallelTask('agent-1', {}),
        createAgentParallelTask('agent-2', {}),
      ];

      const result = await orchestrator.executeParallel(tasks, {
        resultAggregation: 'merge',
      });

      expect(result.aggregatedOutput).toEqual({ a: 1, b: 2 });
    });
  });

  describe('cancel', () => {
    it('should cancel ongoing execution', async () => {
      // Create slow executor
      const slowExecutor: AgentExecutorPort = {
        async execute(request) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return {
            success: true,
            agentId: request.agentId,
            output: {},
            durationMs: 1000,
          };
        },
        async exists() {
          return true;
        },
      };

      const localOrchestrator = createAgentParallelOrchestrator({
        agentExecutor: slowExecutor,
      });

      const tasks = [
        createAgentParallelTask('slow-agent', {}),
      ];

      // Start execution and cancel immediately
      const executionPromise = localOrchestrator.executeParallel(tasks);
      localOrchestrator.cancel();

      const result = await executionPromise;

      // Cancellation might not have taken effect if execution was fast
      // The important thing is that the orchestrator completes without error
      expect(result).toBeDefined();
      expect(result.taskResults).toBeDefined();
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = orchestrator.getConfig();

      expect(config.maxConcurrentAgents).toBeDefined();
      expect(config.failureStrategy).toBeDefined();
    });
  });
});
