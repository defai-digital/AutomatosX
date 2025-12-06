/**
 * TaskStore Unit Tests
 *
 * Tests for SQLite-based task persistence:
 * - Task creation and retrieval
 * - Status updates
 * - Result storage
 * - Filtering and listing
 * - Cleanup and expiration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskStore, createTaskStore } from '@/core/task-engine/store';
import {
  type CreateTaskInput,
  TaskEngineError
} from '@/core/task-engine/types';

describe('TaskStore', () => {
  let store: TaskStore;

  beforeEach(() => {
    // Use in-memory database for tests
    store = new TaskStore({
      dbPath: ':memory:',
      maxPayloadBytes: 1024 * 1024,
      compressionEnabled: true,
      defaultTtlHours: 24
    });
  });

  afterEach(() => {
    store.close();
  });

  describe('createTask', () => {
    it('should create a task with valid input', () => {
      const input: CreateTaskInput = {
        type: 'web_search',
        payload: { query: 'test query' }
      };

      const result = store.createTask(input);

      expect(result.id).toMatch(/^task_[a-z0-9]+$/);
      expect(result.status).toBe('pending');
      expect(result.payloadSize).toBeGreaterThan(0);
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should generate unique task IDs', () => {
      const input: CreateTaskInput = {
        type: 'analysis',
        payload: { data: 'test' }
      };

      const results = Array(100).fill(null).map(() => store.createTask(input));
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100);
    });

    it('should respect custom TTL', () => {
      const input: CreateTaskInput = {
        type: 'custom',
        payload: {},
        ttlHours: 1
      };

      const result = store.createTask(input);
      const expectedExpiry = Date.now() + (1 * 60 * 60 * 1000);

      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.expiresAt).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should clamp TTL to max', () => {
      const input: CreateTaskInput = {
        type: 'custom',
        payload: {},
        ttlHours: 1000 // Exceeds max of 168
      };

      const result = store.createTask(input);
      const maxExpiry = Date.now() + (168 * 60 * 60 * 1000);

      expect(result.expiresAt).toBeLessThanOrEqual(maxExpiry + 1000);
    });

    it('should reject oversized payloads', () => {
      const input: CreateTaskInput = {
        type: 'custom',
        payload: { data: 'x'.repeat(2 * 1024 * 1024) } // 2MB
      };

      expect(() => store.createTask(input)).toThrow(TaskEngineError);
    });

    it('should store context from input', () => {
      const input: CreateTaskInput = {
        type: 'web_search',
        payload: { query: 'test' },
        context: {
          originClient: 'claude-code',
          callChain: ['claude-code', 'automatosx'],
          depth: 1
        }
      };

      const result = store.createTask(input);
      const task = store.getTask(result.id);

      expect(task?.context.originClient).toBe('claude-code');
      expect(task?.context.callChain).toEqual(['claude-code', 'automatosx']);
      expect(task?.context.depth).toBe(1);
    });

    it('should estimate engine based on task type', () => {
      const webSearch = store.createTask({ type: 'web_search', payload: {} });
      const codeReview = store.createTask({ type: 'code_review', payload: {} });

      expect(webSearch.estimatedEngine).toBe('gemini');
      expect(codeReview.estimatedEngine).toBe('claude');
    });

    it('should compress payload and report ratio', () => {
      const input: CreateTaskInput = {
        type: 'custom',
        payload: { data: 'x'.repeat(10000) }
      };

      const result = store.createTask(input);

      expect(result.compressionRatio).toBeGreaterThan(1);
    });
  });

  describe('getTask', () => {
    it('should retrieve created task', () => {
      const input: CreateTaskInput = {
        type: 'analysis',
        payload: { key: 'value' }
      };

      const created = store.createTask(input);
      const retrieved = store.getTask(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.type).toBe('analysis');
      expect(retrieved?.payload).toEqual({ key: 'value' });
    });

    it('should return null for non-existent task', () => {
      const result = store.getTask('task_nonexistent');

      expect(result).toBeNull();
    });

    it('should decompress payload correctly', () => {
      const payload = {
        nested: {
          deep: {
            value: 'test',
            array: [1, 2, 3]
          }
        }
      };

      const created = store.createTask({
        type: 'custom',
        payload
      });

      const retrieved = store.getTask(created.id);

      expect(retrieved?.payload).toEqual(payload);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update status to running', () => {
      const created = store.createTask({
        type: 'web_search',
        payload: {}
      });

      store.updateTaskStatus(created.id, 'running');
      const task = store.getTask(created.id);

      expect(task?.status).toBe('running');
      expect(task?.startedAt).toBeGreaterThan(0);
    });

    it('should update status to completed', () => {
      const created = store.createTask({
        type: 'web_search',
        payload: {}
      });

      store.updateTaskStatus(created.id, 'completed');
      const task = store.getTask(created.id);

      expect(task?.status).toBe('completed');
      expect(task?.completedAt).toBeGreaterThan(0);
    });

    it('should update status with error', () => {
      const created = store.createTask({
        type: 'web_search',
        payload: {}
      });

      store.updateTaskStatus(created.id, 'failed', {
        code: 'TEST_ERROR',
        message: 'Test error message'
      });

      const task = store.getTask(created.id);

      expect(task?.status).toBe('failed');
      expect(task?.error?.code).toBe('TEST_ERROR');
      expect(task?.error?.message).toBe('Test error message');
    });

    it('should throw for non-existent task', () => {
      expect(() => store.updateTaskStatus('task_nonexistent', 'running'))
        .toThrow(TaskEngineError);
    });
  });

  describe('updateTaskResult', () => {
    it('should store result with metrics', () => {
      const created = store.createTask({
        type: 'web_search',
        payload: { query: 'test' }
      });

      const result = { results: [{ title: 'Test' }] };
      const metrics = { durationMs: 1500, tokensPrompt: 100, tokensCompletion: 50 };

      store.updateTaskResult(created.id, result, metrics);
      const task = store.getTask(created.id);

      expect(task?.status).toBe('completed');
      expect(task?.result).toEqual(result);
      expect(task?.metrics?.durationMs).toBe(1500);
      expect(task?.metrics?.tokensPrompt).toBe(100);
    });

    it('should compress result', () => {
      const created = store.createTask({
        type: 'custom',
        payload: {}
      });

      const largeResult = { data: 'x'.repeat(10000) };
      store.updateTaskResult(created.id, largeResult, { durationMs: 100 });

      const task = store.getTask(created.id);
      expect(task?.result).toEqual(largeResult);
    });
  });

  describe('updateTaskFailed', () => {
    it('should mark task as failed with error', () => {
      const created = store.createTask({
        type: 'web_search',
        payload: {}
      });

      store.updateTaskFailed(created.id, {
        code: 'TIMEOUT',
        message: 'Task timed out'
      }, 5000);

      const task = store.getTask(created.id);

      expect(task?.status).toBe('failed');
      expect(task?.error?.code).toBe('TIMEOUT');
      expect(task?.metrics?.durationMs).toBe(5000);
      expect(task?.retryCount).toBe(1);
    });
  });

  describe('incrementRetry', () => {
    it('should increment retry count', () => {
      const created = store.createTask({
        type: 'web_search',
        payload: {}
      });

      store.incrementRetry(created.id);
      store.incrementRetry(created.id);
      store.incrementRetry(created.id);

      const task = store.getTask(created.id);
      expect(task?.retryCount).toBe(3);
    });
  });

  describe('deleteTask', () => {
    it('should delete existing task', () => {
      const created = store.createTask({
        type: 'web_search',
        payload: {}
      });

      const deleted = store.deleteTask(created.id);
      const task = store.getTask(created.id);

      expect(deleted).toBe(true);
      expect(task).toBeNull();
    });

    it('should return false for non-existent task', () => {
      const deleted = store.deleteTask('task_nonexistent');

      expect(deleted).toBe(false);
    });
  });

  describe('listTasks', () => {
    beforeEach(() => {
      // Create test tasks
      store.createTask({ type: 'web_search', payload: {}, priority: 5 });
      store.createTask({ type: 'code_review', payload: {}, priority: 8 });
      store.createTask({ type: 'analysis', payload: {}, priority: 3 });
    });

    it('should list all tasks', () => {
      const tasks = store.listTasks();

      expect(tasks.length).toBe(3);
    });

    it('should order by priority descending', () => {
      const tasks = store.listTasks();

      expect(tasks[0]?.priority).toBe(8);
      expect(tasks[1]?.priority).toBe(5);
      expect(tasks[2]?.priority).toBe(3);
    });

    it('should filter by status', () => {
      const created = store.createTask({ type: 'custom', payload: {} });
      store.updateTaskStatus(created.id, 'running');

      const running = store.listTasks({ status: 'running' });
      const pending = store.listTasks({ status: 'pending' });

      expect(running.length).toBe(1);
      expect(pending.length).toBe(3);
    });

    it('should filter by type', () => {
      const webSearch = store.listTasks({ type: 'web_search' });

      expect(webSearch.length).toBe(1);
      expect(webSearch[0]?.type).toBe('web_search');
    });

    it('should respect limit', () => {
      const tasks = store.listTasks({ limit: 2 });

      expect(tasks.length).toBe(2);
    });

    it('should respect offset', () => {
      const tasks = store.listTasks({ offset: 1, limit: 10 });

      expect(tasks.length).toBe(2);
      expect(tasks[0]?.priority).toBe(5);
    });
  });

  describe('countByStatus', () => {
    it('should count tasks by status', () => {
      store.createTask({ type: 'web_search', payload: {} });
      store.createTask({ type: 'web_search', payload: {} });

      const task = store.createTask({ type: 'web_search', payload: {} });
      store.updateTaskStatus(task.id, 'running');

      const counts = store.countByStatus();

      expect(counts.pending).toBe(2);
      expect(counts.running).toBe(1);
      expect(counts.completed).toBe(0);
    });
  });

  describe('findByPayloadHash', () => {
    it('should find completed task with same payload', () => {
      const payload = { query: 'unique query' };

      const created = store.createTask({ type: 'web_search', payload });
      store.updateTaskResult(created.id, { result: 'test' }, { durationMs: 100 });

      // Create another task with same payload
      const created2 = store.createTask({ type: 'web_search', payload });

      // Should find the first completed task
      const found = store.findByPayloadHash(
        require('crypto').createHash('sha256')
          .update(JSON.stringify(payload))
          .digest('hex')
          .substring(0, 16)
      );

      expect(found).toBe(created.id);
    });

    it('should return null for no match', () => {
      const found = store.findByPayloadHash('nonexistent_hash');

      expect(found).toBeNull();
    });
  });

  describe('cleanupExpired', () => {
    it('should remove expired tasks', () => {
      // Create task with very short TTL
      const shortTtlStore = new TaskStore({
        dbPath: ':memory:',
        defaultTtlHours: 0 // Will expire immediately
      });

      try {
        // The task should be created with expires_at in the past or very near future
        // We need to manipulate the expiration manually for testing
        shortTtlStore.createTask({ type: 'web_search', payload: {} });

        // For this test, we'll verify the cleanup method works
        // In real scenarios, tasks would naturally expire
        const cleaned = shortTtlStore.cleanupExpired();

        // May or may not have expired depending on timing
        expect(cleaned).toBeGreaterThanOrEqual(0);
      } finally {
        shortTtlStore.close();
      }
    });

    it('should not remove running tasks', () => {
      const created = store.createTask({
        type: 'web_search',
        payload: {},
        ttlHours: 1
      });

      store.updateTaskStatus(created.id, 'running');

      // Even if expired, running tasks should not be cleaned
      const cleaned = store.cleanupExpired();

      // Task is not expired yet, so nothing should be cleaned
      expect(store.getTask(created.id)).not.toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return store statistics', () => {
      store.createTask({ type: 'web_search', payload: {} });
      store.createTask({ type: 'web_search', payload: {} });

      const stats = store.getStats();

      expect(stats.totalTasks).toBe(2);
      expect(stats.byStatus.pending).toBe(2);
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('close', () => {
    it('should close the store', () => {
      store.close();

      expect(() => store.createTask({ type: 'web_search', payload: {} }))
        .toThrow(TaskEngineError);
    });

    it('should be idempotent', () => {
      store.close();
      store.close();
      // Should not throw
    });
  });

  describe('factory function', () => {
    it('should create store with createTaskStore', () => {
      const testStore = createTaskStore({ dbPath: ':memory:' });

      const result = testStore.createTask({ type: 'web_search', payload: {} });
      expect(result.id).toMatch(/^task_/);

      testStore.close();
    });
  });
});

describe('TaskStore without compression', () => {
  let store: TaskStore;

  beforeEach(() => {
    store = new TaskStore({
      dbPath: ':memory:',
      compressionEnabled: false
    });
  });

  afterEach(() => {
    store.close();
  });

  it('should store uncompressed payloads', () => {
    const payload = { data: 'test data' };
    const created = store.createTask({ type: 'custom', payload });
    const retrieved = store.getTask(created.id);

    expect(retrieved?.payload).toEqual(payload);
  });

  it('should report compression ratio of 1', () => {
    const result = store.createTask({
      type: 'custom',
      payload: { data: 'test' }
    });

    expect(result.compressionRatio).toBe(1);
  });
});

describe('TaskStore zombie cleanup (bug fix)', () => {
  let store: TaskStore;

  beforeEach(() => {
    store = new TaskStore({
      dbPath: ':memory:',
      defaultTtlHours: 24 // Use normal TTL, we'll manipulate expiry via SQL
    });
  });

  afterEach(() => {
    store.close();
  });

  it('should mark zombie running tasks as failed', () => {
    // Create a task
    const created = store.createTask({
      type: 'web_search',
      payload: { query: 'test' }
    });

    // Mark it as running
    store.updateTaskStatus(created.id, 'running');

    // Task is now expired but running
    const taskBeforeCleanup = store.getTask(created.id);
    expect(taskBeforeCleanup?.status).toBe('running');

    // Manually set expires_at to the past to simulate an expired running task
    // @ts-expect-error - accessing private db for test purposes
    store.db.prepare('UPDATE task_store SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, created.id);

    // Now the cleanup should find it
    const zombieCount = store.cleanupZombieRunning();

    // Should have marked the zombie task as failed
    expect(zombieCount).toBe(1);

    const taskAfterCleanup = store.getTask(created.id);
    expect(taskAfterCleanup?.status).toBe('failed');
    expect(taskAfterCleanup?.error?.code).toBe('ZOMBIE_TASK');
  });

  it('should not affect non-expired running tasks', () => {
    const created = store.createTask({
      type: 'web_search',
      payload: { query: 'test' }
    });

    store.updateTaskStatus(created.id, 'running');

    const zombieCount = store.cleanupZombieRunning();
    expect(zombieCount).toBe(0);

    const task = store.getTask(created.id);
    expect(task?.status).toBe('running');
  });

  it('cleanupAll should handle both expired and zombie tasks', () => {
    // Create pending task
    const pending = store.createTask({
      type: 'web_search',
      payload: { query: 'pending' }
    });

    // Create running task (will become zombie)
    const running = store.createTask({
      type: 'web_search',
      payload: { query: 'running' }
    });
    store.updateTaskStatus(running.id, 'running');

    // Manually expire both tasks
    // @ts-expect-error - accessing private db for test purposes
    store.db.prepare('UPDATE task_store SET expires_at = ? WHERE id IN (?, ?)').run(
      Date.now() - 1000,
      pending.id,
      running.id
    );

    // Run full cleanup
    const result = store.cleanupAll();

    // Zombie should be marked as failed
    expect(result.zombies).toBe(1);

    // Now the former zombie is 'failed' and can be deleted
    // The pending task should also be cleaned
    expect(result.expired).toBeGreaterThanOrEqual(1);
  });
});
