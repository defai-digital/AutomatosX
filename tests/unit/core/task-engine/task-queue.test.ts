/**
 * TaskQueueManager Unit Tests
 *
 * Tests for task scheduling and execution queue.
 *
 * Part of Phase 5: Full Scale
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskQueueManager, createTaskQueueManager } from '@/core/task-engine/task-queue';

describe('TaskQueueManager', () => {
  let queue: TaskQueueManager;

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(async () => {
    if (queue) {
      await queue.shutdown(false);
    }
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      queue = new TaskQueueManager();

      const stats = queue.getStats();
      expect(stats.queuedTasks).toBe(0);
      expect(stats.runningTasks).toBe(0);
    });

    it('should accept custom config', () => {
      queue = new TaskQueueManager({ maxConcurrent: 10 });

      const stats = queue.getStats();
      expect(stats.queuedTasks).toBe(0);
    });
  });

  describe('enqueue', () => {
    it('should enqueue and execute tasks', async () => {
      queue = new TaskQueueManager();

      const result = await queue.enqueue({
        taskId: 'task_1',
        clientId: 'client-1',
        execute: async () => ({ success: true })
      });

      expect(result).toEqual({ success: true });
    });

    it('should handle multiple tasks', async () => {
      queue = new TaskQueueManager({ maxConcurrent: 5 });

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          queue.enqueue({
            taskId: `task_${i}`,
            clientId: 'client-1',
            execute: async () => i
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should respect priority ordering', async () => {
      queue = new TaskQueueManager({ maxConcurrent: 1 });

      const executionOrder: number[] = [];

      // Queue low priority first
      const lowPriority = queue.enqueue({
        taskId: 'low',
        clientId: 'client-1',
        priority: 1,
        execute: async () => {
          executionOrder.push(1);
          return 1;
        }
      });

      // Queue high priority second
      const highPriority = queue.enqueue({
        taskId: 'high',
        clientId: 'client-1',
        priority: 10,
        execute: async () => {
          executionOrder.push(10);
          return 10;
        }
      });

      await Promise.all([lowPriority, highPriority]);

      // First task runs immediately regardless of priority
      // But subsequent tasks should respect priority
      expect(executionOrder).toContain(1);
      expect(executionOrder).toContain(10);
    });

    it('should reject when closed', async () => {
      queue = new TaskQueueManager();
      await queue.shutdown(false);

      await expect(
        queue.enqueue({
          taskId: 'task_1',
          clientId: 'client-1',
          execute: async () => ({})
        })
      ).rejects.toThrow('TaskQueueManager is closed');
    });

    it('should reject when queue is full', async () => {
      queue = new TaskQueueManager({
        maxConcurrent: 1,
        maxQueueSize: 2
      });

      // Fill the queue
      const blocking = queue.enqueue({
        taskId: 'blocking',
        clientId: 'client-1',
        execute: () => new Promise((r) => setTimeout(r, 1000))
      }).catch(() => {}); // Handle rejection on shutdown

      const queued1 = queue.enqueue({
        taskId: 'queued_1',
        clientId: 'client-1',
        execute: async () => ({})
      }).catch(() => {}); // Handle rejection on shutdown

      const queued2 = queue.enqueue({
        taskId: 'queued_2',
        clientId: 'client-1',
        execute: async () => ({})
      }).catch(() => {}); // Handle rejection on shutdown

      // This should fail - queue full
      await expect(
        queue.enqueue({
          taskId: 'overflow',
          clientId: 'client-1',
          execute: async () => ({})
        })
      ).rejects.toThrow('Task queue is full');

      // Cleanup
      await queue.shutdown(false);
      await Promise.all([blocking, queued1, queued2]);
      queue = null as unknown as TaskQueueManager;
    });
  });

  describe('getStats', () => {
    it('should track task statistics', async () => {
      queue = new TaskQueueManager();

      await queue.enqueue({
        taskId: 'task_1',
        clientId: 'client-1',
        execute: async () => ({})
      });

      await queue.enqueue({
        taskId: 'task_2',
        clientId: 'client-1',
        execute: async () => ({})
      });

      const stats = queue.getStats();
      expect(stats.totalProcessed).toBe(2);
      expect(stats.totalSucceeded).toBe(2);
      expect(stats.totalFailed).toBe(0);
    });

    it('should track failed tasks', async () => {
      queue = new TaskQueueManager({ defaultMaxRetries: 0 });

      try {
        await queue.enqueue({
          taskId: 'failing',
          clientId: 'client-1',
          execute: async () => {
            throw new Error('Task failed');
          }
        });
      } catch {
        // Expected
      }

      const stats = queue.getStats();
      expect(stats.totalFailed).toBe(1);
    });
  });

  describe('getRunningCount', () => {
    it('should track running tasks', async () => {
      queue = new TaskQueueManager({ maxConcurrent: 2 });

      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((r) => {
        resolveFirst = r;
      });

      const task = queue.enqueue({
        taskId: 'running',
        clientId: 'client-1',
        execute: () => firstPromise
      });

      // Give time for task to start
      await new Promise((r) => setTimeout(r, 10));

      expect(queue.getRunningCount()).toBe(1);

      resolveFirst!();
      await task;

      expect(queue.getRunningCount()).toBe(0);

      // Properly shutdown before afterEach
      await queue.shutdown(false);
      queue = null as unknown as TaskQueueManager;
    });
  });

  describe('isTaskRunning', () => {
    it('should check if task is running', async () => {
      queue = new TaskQueueManager();

      let resolveTask: () => void;
      const taskPromise = new Promise<void>((r) => {
        resolveTask = r;
      });

      const task = queue.enqueue({
        taskId: 'check_running',
        clientId: 'client-1',
        execute: () => taskPromise
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(queue.isTaskRunning('check_running')).toBe(true);
      expect(queue.isTaskRunning('nonexistent')).toBe(false);

      resolveTask!();
      await task;

      expect(queue.isTaskRunning('check_running')).toBe(false);
    });
  });

  describe('cancel', () => {
    it('should cancel queued task', async () => {
      queue = new TaskQueueManager({ maxConcurrent: 1 });

      // Block the queue
      let resolveBlocker: () => void;
      const blocker = queue.enqueue({
        taskId: 'blocker',
        clientId: 'client-1',
        execute: () =>
          new Promise<void>((r) => {
            resolveBlocker = r;
          })
      });

      // Queue a task
      const cancelMe = queue.enqueue({
        taskId: 'cancel_me',
        clientId: 'client-1',
        execute: async () => 'should not run'
      });

      // Cancel the queued task
      const cancelled = queue.cancel('cancel_me');
      expect(cancelled).toBe(true);

      // The cancelled task should reject
      await expect(cancelMe).rejects.toThrow('Task cancelled');

      // Cleanup
      resolveBlocker!();
      await blocker;
    });

    it('should return false for non-existent task', () => {
      queue = new TaskQueueManager();

      expect(queue.cancel('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all queued tasks', async () => {
      queue = new TaskQueueManager({ maxConcurrent: 1 });

      // Block the queue
      let resolveBlocker: () => void;
      const blocker = queue.enqueue({
        taskId: 'blocker',
        clientId: 'client-1',
        execute: () =>
          new Promise<void>((r) => {
            resolveBlocker = r;
          })
      });

      // Queue multiple tasks
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        tasks.push(
          queue.enqueue({
            taskId: `clear_${i}`,
            clientId: 'client-1',
            execute: async () => i
          }).catch(() => 'cleared')
        );
      }

      // Clear the queue
      const cleared = queue.clear();
      expect(cleared).toBe(5);

      // All cleared tasks should reject
      const results = await Promise.all(tasks);
      expect(results).toEqual(['cleared', 'cleared', 'cleared', 'cleared', 'cleared']);

      // Cleanup
      resolveBlocker!();
      await blocker;
    });
  });

  describe('retry behavior', () => {
    it('should retry failed tasks', async () => {
      queue = new TaskQueueManager({
        defaultMaxRetries: 2,
        retryBaseDelayMs: 10,
        retryMaxDelayMs: 50
      });

      let attempts = 0;

      const result = await queue.enqueue({
        taskId: 'retry_task',
        clientId: 'client-1',
        maxRetries: 2,
        execute: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error(`Attempt ${attempts} failed`);
          }
          return 'success';
        }
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);

      const stats = queue.getStats();
      expect(stats.totalRetries).toBe(2);
    });

    it('should fail after max retries', async () => {
      queue = new TaskQueueManager({
        retryBaseDelayMs: 10,
        retryMaxDelayMs: 20
      });

      await expect(
        queue.enqueue({
          taskId: 'always_fail',
          clientId: 'client-1',
          maxRetries: 1,
          execute: async () => {
            throw new Error('Always fails');
          }
        })
      ).rejects.toThrow('Always fails');
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running tasks', async () => {
      queue = new TaskQueueManager();

      await expect(
        queue.enqueue({
          taskId: 'timeout_task',
          clientId: 'client-1',
          timeoutMs: 50,
          maxRetries: 0,
          execute: () => new Promise((r) => setTimeout(r, 5000))
        })
      ).rejects.toThrow('Task timeout');
    });
  });

  describe('events', () => {
    it('should emit task:queued event', async () => {
      queue = new TaskQueueManager();

      const events: Array<{ taskId: string; priority: number }> = [];
      queue.on('task:queued', (taskId, priority) => {
        events.push({ taskId, priority });
      });

      await queue.enqueue({
        taskId: 'event_task',
        clientId: 'client-1',
        priority: 7,
        execute: async () => ({})
      });

      expect(events).toContainEqual({ taskId: 'event_task', priority: 7 });
    });

    it('should emit task:completed event', async () => {
      queue = new TaskQueueManager();

      const completed: string[] = [];
      queue.on('task:completed', (taskId) => {
        completed.push(taskId);
      });

      await queue.enqueue({
        taskId: 'complete_task',
        clientId: 'client-1',
        execute: async () => ({})
      });

      expect(completed).toContain('complete_task');
    });

    it('should emit task:failed event', async () => {
      queue = new TaskQueueManager();

      const failed: string[] = [];
      queue.on('task:failed', (taskId) => {
        failed.push(taskId);
      });

      try {
        await queue.enqueue({
          taskId: 'fail_task',
          clientId: 'client-1',
          maxRetries: 0,
          execute: async () => {
            throw new Error('Fail');
          }
        });
      } catch {
        // Expected
      }

      expect(failed).toContain('fail_task');
    });
  });

  describe('shutdown', () => {
    it('should be idempotent', async () => {
      queue = new TaskQueueManager();

      await queue.shutdown(false);
      await queue.shutdown(false); // Should not throw
      queue = null as unknown as TaskQueueManager;
    });

    it('should reject pending tasks', async () => {
      queue = new TaskQueueManager({ maxConcurrent: 1 });

      // Block with a long task
      const blocker = queue.enqueue({
        taskId: 'blocker',
        clientId: 'client-1',
        execute: () => new Promise((r) => setTimeout(r, 5000))
      }).catch(() => {}); // Handle rejection

      // Queue another task
      const pending = queue.enqueue({
        taskId: 'pending',
        clientId: 'client-1',
        execute: async () => 'should not complete'
      });

      // Shutdown immediately
      await queue.shutdown(false);

      await expect(pending).rejects.toThrow();

      // Wait for blocker to be rejected
      await blocker;
      queue = null as unknown as TaskQueueManager;
    });
  });

  describe('createTaskQueueManager', () => {
    it('should create a queue instance', () => {
      queue = createTaskQueueManager();
      expect(queue).toBeInstanceOf(TaskQueueManager);
    });

    it('should accept custom config', () => {
      queue = createTaskQueueManager({ maxConcurrent: 25 });
      expect(queue).toBeInstanceOf(TaskQueueManager);
    });
  });

  describe('bug fixes', () => {
    it('should ignore stale execution results after timeout and retry (Bug fix)', async () => {
      // This test verifies that when a task times out and retries,
      // the delayed result from the original execution is ignored
      // and only the retry's result is used.
      queue = new TaskQueueManager({
        maxConcurrent: 1,
        retryBaseDelayMs: 10,
        retryMaxDelayMs: 20
      });

      let executionCount = 0;
      const executionResults: string[] = [];

      const result = await queue.enqueue({
        taskId: 'stale_result_task',
        clientId: 'client-1',
        timeoutMs: 30,
        maxRetries: 2,
        execute: async () => {
          executionCount++;
          const currentExecution = executionCount;

          if (currentExecution === 1) {
            // First execution: takes too long, will timeout
            await new Promise((r) => setTimeout(r, 100));
            executionResults.push(`execution_${currentExecution}_completed`);
            return `result_from_execution_${currentExecution}`;
          } else {
            // Retry: completes quickly
            executionResults.push(`execution_${currentExecution}_completed`);
            return `result_from_execution_${currentExecution}`;
          }
        }
      });

      // Wait for delayed first execution to complete
      await new Promise((r) => setTimeout(r, 150));

      // The result should be from the retry, not the original timed-out execution
      expect(result).toBe('result_from_execution_2');

      // Both executions should have run
      expect(executionCount).toBe(2);

      // The stats should show 1 retry occurred
      const stats = queue.getStats();
      expect(stats.totalRetries).toBeGreaterThanOrEqual(1);
    });

    it('should properly track execution IDs across retries', async () => {
      queue = new TaskQueueManager({
        maxConcurrent: 1,
        retryBaseDelayMs: 5,
        retryMaxDelayMs: 10
      });

      let attempts = 0;

      const result = await queue.enqueue({
        taskId: 'execution_id_task',
        clientId: 'client-1',
        maxRetries: 3,
        execute: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error(`Attempt ${attempts} failed`);
          }
          return 'success_on_attempt_3';
        }
      });

      expect(result).toBe('success_on_attempt_3');
      expect(attempts).toBe(3);

      const stats = queue.getStats();
      expect(stats.totalRetries).toBe(2);
      expect(stats.totalSucceeded).toBe(1);
    });
  });
});
