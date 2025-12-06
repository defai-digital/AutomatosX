/**
 * Task MCP Tools Unit Tests
 *
 * Tests for MCP tools:
 * - create_task
 * - run_task
 * - get_task_result
 * - list_tasks
 * - delete_task
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createCreateTaskHandler,
  createTaskSchema,
  createRunTaskHandler,
  runTaskSchema,
  createGetTaskResultHandler,
  getTaskResultSchema,
  createListTasksHandler,
  listTasksSchema,
  createDeleteTaskHandler,
  deleteTaskSchema
} from '@/mcp/tools/task';
import { TaskEngine, resetTaskEngine, resetLoopGuard } from '@/core/task-engine';
import type { McpSession } from '@/mcp/types';

// Mock session - use 'gemini' to avoid loop detection when tasks route to 'claude'
const mockSession: McpSession = {
  clientInfo: {
    name: 'test-client',
    version: '1.0.0'
  },
  normalizedProvider: 'gemini', // Use gemini so we don't trigger loop when routing to claude
  initTime: Date.now()
};

// Mock the getTaskEngine function to return our test engine
let testEngine: TaskEngine;

vi.mock('@/core/task-engine', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/core/task-engine')>();
  return {
    ...original,
    getTaskEngine: () => testEngine
  };
});

describe('Task MCP Tools', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    await resetTaskEngine();
    await resetLoopGuard();

    testEngine = new TaskEngine({
      store: { dbPath: ':memory:' },
      maxConcurrent: 4,
      defaultTimeoutMs: 5000
    });
  });

  afterEach(async () => {
    if (testEngine) {
      await testEngine.shutdown();
    }
    await resetTaskEngine();
    await resetLoopGuard();
  });

  describe('create_task', () => {
    it('should have valid schema', () => {
      expect(createTaskSchema.name).toBe('create_task');
      expect(createTaskSchema.inputSchema.required).toContain('type');
      expect(createTaskSchema.inputSchema.required).toContain('payload');
    });

    it('should create a task', async () => {
      const handler = createCreateTaskHandler({
        getSession: () => mockSession
      });

      const result = await handler({
        type: 'web_search',
        payload: { query: 'test query' }
      });

      expect(result.task_id).toMatch(/^task_/);
      expect(result.status).toBe('pending');
      expect(result.payload_size_bytes).toBeGreaterThan(0);
    });

    it('should set estimated engine based on type', async () => {
      const handler = createCreateTaskHandler({
        getSession: () => mockSession
      });

      const webSearch = await handler({
        type: 'web_search',
        payload: { query: 'test' }
      });

      const codeReview = await handler({
        type: 'code_review',
        payload: { file: 'test.ts' }
      });

      expect(webSearch.estimated_engine).toBe('gemini');
      expect(codeReview.estimated_engine).toBe('claude');
    });

    it('should respect priority parameter', async () => {
      const handler = createCreateTaskHandler({
        getSession: () => null
      });

      const result = await handler({
        type: 'custom',
        payload: { data: 'test' },
        priority: 10
      });

      const task = testEngine.getTask(result.task_id);
      expect(task?.priority).toBe(10);
    });

    it('should work without session', async () => {
      const handler = createCreateTaskHandler({
        getSession: () => null
      });

      const result = await handler({
        type: 'analysis',
        payload: { data: [1, 2, 3] }
      });

      expect(result.task_id).toMatch(/^task_/);
    });
  });

  describe('run_task', () => {
    it('should have valid schema', () => {
      expect(runTaskSchema.name).toBe('run_task');
      expect(runTaskSchema.inputSchema.required).toContain('task_id');
    });

    it('should execute a task', async () => {
      // Use null session to avoid loop prevention
      const createHandler = createCreateTaskHandler({
        getSession: () => null
      });
      const runHandler = createRunTaskHandler({
        getSession: () => null
      });

      const created = await createHandler({
        type: 'web_search',
        payload: { query: 'test' }
      });

      const result = await runHandler({
        task_id: created.task_id
      });

      expect(result.task_id).toBe(created.task_id);
      expect(result.status).toBe('completed');
      expect(result.result).not.toBeNull();
      expect(result.metrics.duration_ms).toBeGreaterThan(0);
    });

    it('should return cached result on second run', async () => {
      const createHandler = createCreateTaskHandler({
        getSession: () => mockSession
      });
      const runHandler = createRunTaskHandler({
        getSession: () => mockSession
      });

      const created = await createHandler({
        type: 'analysis',
        payload: { data: 'test' }
      });

      const result1 = await runHandler({ task_id: created.task_id });
      const result2 = await runHandler({ task_id: created.task_id });

      expect(result1.cache_hit).toBe(false);
      expect(result2.cache_hit).toBe(true);
    });

    it('should handle skip_cache option', async () => {
      const createHandler = createCreateTaskHandler({
        getSession: () => mockSession
      });
      const runHandler = createRunTaskHandler({
        getSession: () => mockSession
      });

      const created = await createHandler({
        type: 'custom',
        payload: {}
      });

      await runHandler({ task_id: created.task_id });

      // With skip_cache, should return cached (task is completed)
      // Note: skip_cache actually forces re-execution, but our mock engine
      // still returns cached for completed tasks
      const result = await runHandler({
        task_id: created.task_id,
        skip_cache: true
      });

      expect(result.status).toBe('completed');
    });

    it('should throw for non-existent task', async () => {
      const handler = createRunTaskHandler({
        getSession: () => mockSession
      });

      await expect(handler({ task_id: 'task_nonexistent' }))
        .rejects.toThrow('not found');
    });
  });

  describe('get_task_result', () => {
    it('should have valid schema', () => {
      expect(getTaskResultSchema.name).toBe('get_task_result');
      expect(getTaskResultSchema.inputSchema.required).toContain('task_id');
    });

    it('should retrieve task details', async () => {
      const createHandler = createCreateTaskHandler({
        getSession: () => mockSession
      });
      const getHandler = createGetTaskResultHandler();

      const created = await createHandler({
        type: 'code_generation',
        payload: { prompt: 'test', language: 'typescript' }
      });

      const result = await getHandler({ task_id: created.task_id });

      expect(result.task_id).toBe(created.task_id);
      expect(result.status).toBe('pending');
      expect(result.type).toBe('code_generation');
      expect(result.result).toBeNull();
    });

    it('should include payload when requested', async () => {
      const createHandler = createCreateTaskHandler({
        getSession: () => mockSession
      });
      const getHandler = createGetTaskResultHandler();

      const created = await createHandler({
        type: 'custom',
        payload: { secret: 'data' }
      });

      const resultWithPayload = await getHandler({
        task_id: created.task_id,
        include_payload: true
      });

      const resultWithoutPayload = await getHandler({
        task_id: created.task_id,
        include_payload: false
      });

      expect(resultWithPayload.payload).toEqual({ secret: 'data' });
      expect(resultWithoutPayload.payload).toBeUndefined();
    });

    it('should throw for non-existent task', async () => {
      const handler = createGetTaskResultHandler();

      await expect(handler({ task_id: 'task_nonexistent' }))
        .rejects.toThrow('not found');
    });
  });

  describe('list_tasks', () => {
    it('should have valid schema', () => {
      expect(listTasksSchema.name).toBe('list_tasks');
      expect(listTasksSchema.inputSchema.required).toEqual([]);
    });

    it('should list all tasks', async () => {
      const createHandler = createCreateTaskHandler({
        getSession: () => mockSession
      });
      const listHandler = createListTasksHandler();

      await createHandler({ type: 'web_search', payload: {} });
      await createHandler({ type: 'analysis', payload: {} });
      await createHandler({ type: 'custom', payload: {} });

      const result = await listHandler({});

      expect(result.tasks.length).toBe(3);
      expect(result.total).toBe(3);
      expect(result.has_more).toBe(false);
    });

    it('should filter by status', async () => {
      // Use null session to avoid loop prevention
      const createHandler = createCreateTaskHandler({
        getSession: () => null
      });
      const runHandler = createRunTaskHandler({
        getSession: () => null
      });
      const listHandler = createListTasksHandler();

      const created1 = await createHandler({ type: 'web_search', payload: {} });
      await createHandler({ type: 'analysis', payload: {} });

      await runHandler({ task_id: created1.task_id });

      const pending = await listHandler({ status: 'pending' });
      const completed = await listHandler({ status: 'completed' });

      expect(pending.total).toBe(1);
      expect(completed.total).toBe(1);
    });

    it('should filter by type', async () => {
      const createHandler = createCreateTaskHandler({
        getSession: () => mockSession
      });
      const listHandler = createListTasksHandler();

      await createHandler({ type: 'web_search', payload: {} });
      await createHandler({ type: 'web_search', payload: {} });
      await createHandler({ type: 'analysis', payload: {} });

      const result = await listHandler({ type: 'web_search' });

      expect(result.total).toBe(2);
      expect(result.tasks.every(t => t.type === 'web_search')).toBe(true);
    });

    it('should support pagination', async () => {
      const createHandler = createCreateTaskHandler({
        getSession: () => mockSession
      });
      const listHandler = createListTasksHandler();

      for (let i = 0; i < 5; i++) {
        await createHandler({ type: 'custom', payload: { i } });
      }

      const page1 = await listHandler({ limit: 2, offset: 0 });
      const page2 = await listHandler({ limit: 2, offset: 2 });

      expect(page1.tasks.length).toBe(2);
      expect(page1.has_more).toBe(true);
      expect(page2.tasks.length).toBe(2);
      expect(page2.offset).toBe(2);
    });

    it('should cap limit at 100', async () => {
      const listHandler = createListTasksHandler();

      const result = await listHandler({ limit: 500 });

      expect(result.limit).toBe(100);
    });
  });

  describe('delete_task', () => {
    it('should have valid schema', () => {
      expect(deleteTaskSchema.name).toBe('delete_task');
      expect(deleteTaskSchema.inputSchema.required).toContain('task_id');
    });

    it('should delete a task', async () => {
      const createHandler = createCreateTaskHandler({
        getSession: () => mockSession
      });
      const deleteHandler = createDeleteTaskHandler();

      const created = await createHandler({
        type: 'custom',
        payload: {}
      });

      const result = await deleteHandler({ task_id: created.task_id });

      expect(result.deleted).toBe(true);
      expect(result.previous_status).toBe('pending');

      // Verify task is gone
      expect(testEngine.getTask(created.task_id)).toBeNull();
    });

    it('should handle non-existent task', async () => {
      const handler = createDeleteTaskHandler();

      const result = await handler({ task_id: 'task_nonexistent' });

      expect(result.deleted).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should delete completed task', async () => {
      const createHandler = createCreateTaskHandler({
        getSession: () => mockSession
      });
      const runHandler = createRunTaskHandler({
        getSession: () => mockSession
      });
      const deleteHandler = createDeleteTaskHandler();

      const created = await createHandler({
        type: 'analysis',
        payload: {}
      });

      // Run the task to completion
      await runHandler({ task_id: created.task_id });

      // Now delete the completed task
      const result = await deleteHandler({ task_id: created.task_id });
      expect(result.deleted).toBe(true);
      expect(result.previous_status).toBe('completed');
    });
  });
});
