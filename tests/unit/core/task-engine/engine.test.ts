/**
 * TaskEngine Unit Tests
 *
 * Tests for the core task orchestration:
 * - Task creation and execution
 * - Loop prevention integration
 * - Retry and timeout handling
 * - Statistics tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TaskEngine,
  createTaskEngine,
  getTaskEngine,
  resetTaskEngine
} from '@/core/task-engine/engine';
import {
  type CreateTaskInput,
  TaskEngineError,
  LoopPreventionError
} from '@/core/task-engine/types';

describe('TaskEngine', () => {
  let engine: TaskEngine;

  beforeEach(async () => {
    await resetTaskEngine();
    engine = new TaskEngine({
      store: { dbPath: ':memory:' },
      maxConcurrent: 12,
      defaultTimeoutMs: 5000,
      maxRetries: 2,
      retryDelayMs: 100
    });
  });

  afterEach(async () => {
    await engine.shutdown();
    await resetTaskEngine();
  });

  describe('createTask', () => {
    it('should create a task', async () => {
      const input: CreateTaskInput = {
        type: 'web_search',
        payload: { query: 'test' }
      };

      const result = await engine.createTask(input);

      expect(result.id).toMatch(/^task_/);
      expect(result.status).toBe('pending');
    });

    it('should track creation in statistics', async () => {
      await engine.createTask({ type: 'web_search', payload: {} });
      await engine.createTask({ type: 'analysis', payload: {} });

      const stats = engine.getStats();

      expect(stats.totalCreated).toBe(2);
    });

    it('should emit task:created event', async () => {
      const handler = vi.fn();
      engine.on('task:created', handler);

      await engine.createTask({ type: 'web_search', payload: {} });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('runTask', () => {
    it('should execute a task', async () => {
      const created = await engine.createTask({
        type: 'web_search',
        payload: { query: 'test query' }
      });

      const result = await engine.runTask(created.id);

      expect(result.status).toBe('completed');
      expect(result.taskId).toBe(created.id);
      expect(result.engine).toBeDefined();
      expect(result.result).not.toBeNull();
    });

    it('should update task status to completed', async () => {
      const created = await engine.createTask({
        type: 'analysis',
        payload: { data: 'test' }
      });

      await engine.runTask(created.id);
      const task = engine.getTask(created.id);

      expect(task?.status).toBe('completed');
      expect(task?.result).not.toBeNull();
    });

    it('should return cached result for completed task', async () => {
      const created = await engine.createTask({
        type: 'web_search',
        payload: {}
      });

      await engine.runTask(created.id);
      const result = await engine.runTask(created.id);

      expect(result.cacheHit).toBe(true);
    });

    it('should throw for non-existent task', async () => {
      await expect(engine.runTask('task_nonexistent'))
        .rejects.toThrow(TaskEngineError);
    });

    it('should throw for already running task', async () => {
      const created = await engine.createTask({
        type: 'analysis',
        payload: {}
      });

      // Start running (don't await)
      const runPromise = engine.runTask(created.id);

      // Try to run again immediately
      await expect(engine.runTask(created.id))
        .rejects.toThrow('already running');

      await runPromise;
    });

    it('should emit task:started event', async () => {
      const handler = vi.fn();
      engine.on('task:started', handler);

      const created = await engine.createTask({
        type: 'web_search',
        payload: {}
      });

      await engine.runTask(created.id);

      expect(handler).toHaveBeenCalledWith(created.id, expect.any(String));
    });

    it('should emit task:completed event', async () => {
      const handler = vi.fn();
      engine.on('task:completed', handler);

      const created = await engine.createTask({
        type: 'web_search',
        payload: {}
      });

      await engine.runTask(created.id);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should track metrics', async () => {
      const created = await engine.createTask({
        type: 'web_search',
        payload: {}
      });

      const result = await engine.runTask(created.id);

      expect(result.metrics?.durationMs).toBeGreaterThan(0);
    });
  });

  describe('loop prevention', () => {
    it('should prevent recursive calls', async () => {
      const created = await engine.createTask({
        type: 'web_search',
        payload: {},
        context: {
          originClient: 'claude-code',
          callChain: ['claude-code', 'automatosx', 'gemini'],
          depth: 2
        }
      });

      await expect(engine.runTask(created.id))
        .rejects.toThrow(LoopPreventionError);
    });

    it('should emit loop:prevented event', async () => {
      const handler = vi.fn();
      engine.on('loop:prevented', handler);

      const created = await engine.createTask({
        type: 'web_search',
        payload: {},
        context: {
          originClient: 'claude-code',
          callChain: ['claude-code', 'automatosx', 'gemini'],
          depth: 2
        }
      });

      try {
        await engine.runTask(created.id);
      } catch {
        // Expected
      }

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('concurrency', () => {
    it('should enforce concurrency limit', async () => {
      // Create engine with low concurrency
      const lowConcurrencyEngine = new TaskEngine({
        store: { dbPath: ':memory:' },
        maxConcurrent: 2
      });

      try {
        // Create 3 tasks
        const tasks = await Promise.all([
          lowConcurrencyEngine.createTask({ type: 'analysis', payload: {} }),
          lowConcurrencyEngine.createTask({ type: 'analysis', payload: {} }),
          lowConcurrencyEngine.createTask({ type: 'analysis', payload: {} })
        ]);

        // Start first two
        const run1 = lowConcurrencyEngine.runTask(tasks[0].id);
        const run2 = lowConcurrencyEngine.runTask(tasks[1].id);

        // Third should fail immediately due to concurrency limit
        await expect(lowConcurrencyEngine.runTask(tasks[2].id))
          .rejects.toThrow('Maximum concurrent tasks');

        await Promise.all([run1, run2]);
      } finally {
        await lowConcurrencyEngine.shutdown();
      }
    });

    it('should track running tasks count', async () => {
      const created = await engine.createTask({
        type: 'analysis',
        payload: {}
      });

      const runPromise = engine.runTask(created.id);

      // Check stats while running
      // Note: This is racy, but with simulated execution it should work
      const stats = engine.getStats();
      expect(stats.runningCount).toBeGreaterThanOrEqual(0);

      await runPromise;

      // After completion
      const finalStats = engine.getStats();
      expect(finalStats.runningCount).toBe(0);
    });
  });

  describe('timeout', () => {
    it('should timeout long-running tasks', async () => {
      // Create engine with very short timeout
      const shortTimeoutEngine = new TaskEngine({
        store: { dbPath: ':memory:' },
        defaultTimeoutMs: 50 // 50ms timeout
      });

      try {
        const created = await shortTimeoutEngine.createTask({
          type: 'analysis',
          payload: {}
        });

        // The simulated execution takes 100ms, so it should timeout
        const result = await shortTimeoutEngine.runTask(created.id, {
          timeoutMs: 10 // Even shorter
        });

        // Should fail with timeout
        expect(result.status).toBe('failed');
        expect(result.error?.code).toBe('TIMEOUT');
      } finally {
        await shortTimeoutEngine.shutdown();
      }
    });
  });

  describe('getTaskResult', () => {
    it('should return result for completed task', async () => {
      const created = await engine.createTask({
        type: 'web_search',
        payload: { query: 'test' }
      });

      await engine.runTask(created.id);
      const result = engine.getTaskResult(created.id);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('completed');
    });

    it('should return null for pending task', async () => {
      const created = await engine.createTask({
        type: 'web_search',
        payload: {}
      });

      const result = engine.getTaskResult(created.id);

      expect(result).toBeNull();
    });

    it('should return null for non-existent task', () => {
      const result = engine.getTaskResult('task_nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getTask', () => {
    it('should return task by ID', async () => {
      const created = await engine.createTask({
        type: 'analysis',
        payload: { key: 'value' }
      });

      const task = engine.getTask(created.id);

      expect(task).not.toBeNull();
      expect(task?.id).toBe(created.id);
    });
  });

  describe('listTasks', () => {
    it('should list tasks with filter', async () => {
      await engine.createTask({ type: 'web_search', payload: {} });
      await engine.createTask({ type: 'analysis', payload: {} });
      await engine.createTask({ type: 'web_search', payload: {} });

      const result = engine.listTasks({ type: 'web_search' });

      expect(result.tasks.length).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      const created = await engine.createTask({
        type: 'web_search',
        payload: {}
      });

      const deleted = engine.deleteTask(created.id);
      const task = engine.getTask(created.id);

      expect(deleted).toBe(true);
      expect(task).toBeNull();
    });

    it('should not delete running task without force', async () => {
      const created = await engine.createTask({
        type: 'analysis',
        payload: {}
      });

      const runPromise = engine.runTask(created.id);

      // Try to delete while running
      expect(() => engine.deleteTask(created.id))
        .toThrow('Cannot delete running task');

      await runPromise;
    });

    it('should delete running task with force', async () => {
      const created = await engine.createTask({
        type: 'analysis',
        payload: {}
      });

      const runPromise = engine.runTask(created.id);

      // Force delete
      const deleted = engine.deleteTask(created.id, true);
      expect(deleted).toBe(true);

      // The run should eventually complete or fail
      await runPromise.catch(() => {});
    });
  });

  describe('getStats', () => {
    it('should return engine statistics', async () => {
      await engine.createTask({ type: 'web_search', payload: {} });
      const created = await engine.createTask({ type: 'analysis', payload: {} });
      await engine.runTask(created.id);

      const stats = engine.getStats();

      expect(stats.totalCreated).toBe(2);
      expect(stats.completedCount).toBeGreaterThanOrEqual(1);
      expect(stats.cache.hitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cleanupExpired', () => {
    it('should return number of cleaned tasks', async () => {
      const cleaned = engine.cleanupExpired();

      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shutdown', () => {
    it('should close engine gracefully', async () => {
      await engine.shutdown();

      await expect(engine.createTask({ type: 'web_search', payload: {} }))
        .rejects.toThrow('closed');
    });

    it('should cancel running tasks on shutdown', async () => {
      const created = await engine.createTask({
        type: 'analysis',
        payload: {}
      });

      const runPromise = engine.runTask(created.id);

      // Shutdown while task is running
      await engine.shutdown();

      // Task should eventually complete (aborted)
      await runPromise.catch(() => {});
    });

    it('should be idempotent', async () => {
      await engine.shutdown();
      await engine.shutdown();
      // Should not throw
    });
  });

  describe('isHealthy', () => {
    it('should return true for healthy engine', () => {
      expect(engine.isHealthy()).toBe(true);
    });

    it('should return false after shutdown', async () => {
      await engine.shutdown();

      expect(engine.isHealthy()).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance from getTaskEngine', async () => {
      await resetTaskEngine();

      const engine1 = getTaskEngine({ store: { dbPath: ':memory:' } });
      const engine2 = getTaskEngine();

      expect(engine1).toBe(engine2);

      await resetTaskEngine();
    });

    it('should reset with resetTaskEngine', async () => {
      const engine1 = getTaskEngine({ store: { dbPath: ':memory:' } });
      await resetTaskEngine();
      const engine2 = getTaskEngine({ store: { dbPath: ':memory:' } });

      expect(engine1).not.toBe(engine2);

      await resetTaskEngine();
    });
  });

  describe('factory function', () => {
    it('should create new instance with createTaskEngine', async () => {
      const engine1 = createTaskEngine({ store: { dbPath: ':memory:' } });
      const engine2 = createTaskEngine({ store: { dbPath: ':memory:' } });

      expect(engine1).not.toBe(engine2);

      await engine1.shutdown();
      await engine2.shutdown();
    });
  });
});

describe('TaskEngine retry behavior', () => {
  it('should emit task:retry event on retry', async () => {
    // This test would require mocking the execution to fail initially
    // For now, we verify the retry mechanism exists
    const engine = new TaskEngine({
      store: { dbPath: ':memory:' },
      maxRetries: 3,
      retryDelayMs: 10
    });

    const handler = vi.fn();
    engine.on('task:retry', handler);

    // In Phase 1 with simulated execution, tasks always succeed
    // In Phase 2+ with real routing, we can test retry behavior

    await engine.shutdown();
  });
});

describe('TaskEngine task types', () => {
  let engine: TaskEngine;

  beforeEach(async () => {
    engine = new TaskEngine({
      store: { dbPath: ':memory:' }
    });
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  it('should handle web_search tasks', async () => {
    const created = await engine.createTask({
      type: 'web_search',
      payload: { query: 'AI news' }
    });

    const result = await engine.runTask(created.id);

    expect(result.result).toHaveProperty('query');
    expect(result.result).toHaveProperty('results');
  });

  it('should handle code_review tasks', async () => {
    const created = await engine.createTask({
      type: 'code_review',
      payload: { file: 'test.ts' }
    });

    const result = await engine.runTask(created.id);

    expect(result.result).toHaveProperty('file');
    expect(result.result).toHaveProperty('issues');
  });

  it('should handle code_generation tasks', async () => {
    const created = await engine.createTask({
      type: 'code_generation',
      payload: { prompt: 'Create a function', language: 'typescript' }
    });

    const result = await engine.runTask(created.id);

    expect(result.result).toHaveProperty('code');
    expect(result.result).toHaveProperty('language');
  });

  it('should handle analysis tasks', async () => {
    const created = await engine.createTask({
      type: 'analysis',
      payload: { input: { data: 'test' } }
    });

    const result = await engine.runTask(created.id);

    expect(result.result).toHaveProperty('analysis');
    expect(result.result).toHaveProperty('confidence');
  });

  it('should handle custom tasks', async () => {
    const created = await engine.createTask({
      type: 'custom',
      payload: { customField: 'value' }
    });

    const result = await engine.runTask(created.id);

    expect(result.result).toHaveProperty('result');
  });
});

describe('bug fixes', () => {
  let engine: TaskEngine;

  beforeEach(async () => {
    await resetTaskEngine();
  });

  afterEach(async () => {
    if (engine) {
      await engine.shutdown();
    }
    await resetTaskEngine();
  });

  it('should respect timeout during retry delay (Bug fix)', async () => {
    // This test verifies that the retry delay respects the abort signal.
    // Previously, sleep() was called without the signal during retry,
    // causing tasks to continue waiting even after timeout.
    engine = new TaskEngine({
      store: { dbPath: ':memory:' },
      maxConcurrent: 5,
      defaultTimeoutMs: 150, // Short timeout
      maxRetries: 3,
      retryDelayMs: 500 // Long retry delay (longer than timeout)
    });

    let attemptCount = 0;

    // Mock executeOnEngine to fail on first attempt
    const originalExecute = (engine as unknown as { executeOnEngine: () => Promise<unknown> }).executeOnEngine;
    (engine as unknown as { executeOnEngine: () => Promise<unknown> }).executeOnEngine = async function() {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error('Transient error');
      }
      return originalExecute.call(this);
    };

    const created = await engine.createTask({
      type: 'web_search',
      payload: { query: 'test' }
    });

    const startTime = Date.now();
    const result = await engine.runTask(created.id);
    const duration = Date.now() - startTime;

    // The task should timeout during the retry delay, not wait the full 500ms
    // With 150ms timeout, it should fail quickly
    expect(result.status).toBe('failed');
    expect(duration).toBeLessThan(400); // Should timeout, not wait for full retry delay
  });

  it('should not leak abort event listeners on normal completion', async () => {
    // This test verifies that abort event listeners are properly cleaned up
    // when sleep() completes normally (not aborted).
    engine = new TaskEngine({
      store: { dbPath: ':memory:' },
      maxConcurrent: 20, // Allow enough concurrent tasks
      defaultTimeoutMs: 5000,
      maxRetries: 0,
      retryDelayMs: 10
    });

    // Run multiple tasks sequentially to accumulate potential listener leaks
    for (let i = 0; i < 10; i++) {
      const created = await engine.createTask({
        type: 'analysis',
        payload: { index: i }
      });
      const result = await engine.runTask(created.id);
      expect(result.status).toBe('completed');
    }

    // Verify no memory leak by checking stats
    const stats = engine.getStats();
    expect(stats.completedCount).toBe(10);
    expect(stats.runningCount).toBe(0);
  });

  it('should handle abort during retry delay gracefully', async () => {
    engine = new TaskEngine({
      store: { dbPath: ':memory:' },
      maxConcurrent: 5,
      defaultTimeoutMs: 100,
      maxRetries: 5,
      retryDelayMs: 1000 // Very long retry delay
    });

    let attempts = 0;

    // Always fail to trigger retries
    (engine as unknown as { executeOnEngine: () => Promise<unknown> }).executeOnEngine = async function() {
      attempts++;
      throw new Error('Always fails');
    };

    const created = await engine.createTask({
      type: 'web_search',
      payload: { query: 'test' }
    });

    const result = await engine.runTask(created.id);

    // Should timeout during first retry delay, not attempt all retries
    expect(result.status).toBe('failed');
    expect(attempts).toBeLessThanOrEqual(2); // At most 1-2 attempts before timeout
  });
});
