/**
 * Regression tests for session metadata deduplication (Bug #2 fix)
 *
 * These tests verify that SessionManager correctly removes ALL duplicate
 * task entries when joining tasks to sessions, preventing accumulation
 * of stale zombie entries from retries and re-runs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../src/core/session/manager.js';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SessionManager - Deduplication Regression Tests', () => {
  let sessionManager: SessionManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `session-manager-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    sessionManager = new SessionManager({ persistencePath: testDir });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Bug #2 Fix: Remove ALL duplicate task entries', () => {
    it('should remove single duplicate task entry when re-running', async () => {
      const session = await sessionManager.createSession('test-agent', 'Test task');

      // First run
      await sessionManager.joinTask(session.id, {
        taskId: 'task-1',
        taskTitle: 'Task One',
        agent: 'test-agent'
      });

      let updated = await sessionManager.getSession(session.id);
      expect(updated?.metadata?.tasks).toHaveLength(1);
      expect(updated?.metadata?.tasks?.[0]?.id).toBe('task-1');

      // Re-run same task (simulates retry)
      await sessionManager.joinTask(session.id, {
        taskId: 'task-1',
        taskTitle: 'Task One (retry)',
        agent: 'test-agent'
      });

      updated = await sessionManager.getSession(session.id);
      expect(updated?.metadata?.tasks).toHaveLength(1); // Should still be 1
      expect(updated?.metadata?.tasks?.[0]?.id).toBe('task-1');
      expect(updated?.metadata?.tasks?.[0]?.title).toBe('Task One (retry)'); // Updated title
    });

    it('should remove MULTIPLE duplicate task entries (regression case)', async () => {
      const session = await sessionManager.createSession('test-agent', 'Test task');

      // Simulate scenario where multiple stale duplicates exist
      // (could happen from previous buggy version or upgrade path)

      // First run
      await sessionManager.joinTask(session.id, {
        taskId: 'task-1',
        taskTitle: 'Task One - Attempt 1',
        agent: 'test-agent'
      });

      // Second run (creates duplicate)
      await sessionManager.joinTask(session.id, {
        taskId: 'task-1',
        taskTitle: 'Task One - Attempt 2',
        agent: 'test-agent'
      });

      // Third run (another duplicate)
      await sessionManager.joinTask(session.id, {
        taskId: 'task-1',
        taskTitle: 'Task One - Attempt 3',
        agent: 'test-agent'
      });

      // Fourth run (yet another duplicate)
      await sessionManager.joinTask(session.id, {
        taskId: 'task-1',
        taskTitle: 'Task One - Attempt 4',
        agent: 'test-agent'
      });

      const updated = await sessionManager.getSession(session.id);

      // Critical assertion: Should have ONLY 1 entry, not 4
      expect(updated?.metadata?.tasks).toHaveLength(1);
      expect(updated?.metadata?.tasks?.[0]?.id).toBe('task-1');
      expect(updated?.metadata?.tasks?.[0]?.title).toBe('Task One - Attempt 4');
    });

    it('should not affect other non-duplicate tasks', async () => {
      const session = await sessionManager.createSession('test-agent', 'Test task');

      // Add multiple different tasks
      await sessionManager.joinTask(session.id, {
        taskId: 'task-1',
        taskTitle: 'Task One',
        agent: 'agent-1'
      });

      await sessionManager.joinTask(session.id, {
        taskId: 'task-2',
        taskTitle: 'Task Two',
        agent: 'agent-2'
      });

      await sessionManager.joinTask(session.id, {
        taskId: 'task-3',
        taskTitle: 'Task Three',
        agent: 'agent-3'
      });

      // Re-run task-2 (should only affect task-2, not task-1 or task-3)
      await sessionManager.joinTask(session.id, {
        taskId: 'task-2',
        taskTitle: 'Task Two (retry)',
        agent: 'agent-2'
      });

      const updated = await sessionManager.getSession(session.id);

      expect(updated?.metadata?.tasks).toHaveLength(3); // Still 3 tasks

      const task1 = updated?.metadata?.tasks?.find((t: any) => t.id === 'task-1');
      const task2 = updated?.metadata?.tasks?.find((t: any) => t.id === 'task-2');
      const task3 = updated?.metadata?.tasks?.find((t: any) => t.id === 'task-3');

      expect(task1?.title).toBe('Task One'); // Unchanged
      expect(task2?.title).toBe('Task Two (retry)'); // Updated
      expect(task3?.title).toBe('Task Three'); // Unchanged
    });

    it('should handle re-running with status changes', async () => {
      const session = await sessionManager.createSession('test-agent', 'Test task');

      // First run - starts running
      await sessionManager.joinTask(session.id, {
        taskId: 'task-1',
        taskTitle: 'Task One',
        agent: 'test-agent'
      });

      let updated = await sessionManager.getSession(session.id);
      expect(updated?.metadata?.tasks?.[0]?.status).toBe('running');

      // Complete the task
      await sessionManager.completeTask(session.id, 'task-1', 1000); // 1000ms duration

      updated = await sessionManager.getSession(session.id);
      expect(updated?.metadata?.tasks?.[0]?.status).toBe('completed');

      // Re-run task (should replace completed entry)
      await sessionManager.joinTask(session.id, {
        taskId: 'task-1',
        taskTitle: 'Task One (retry)',
        agent: 'test-agent'
      });

      updated = await sessionManager.getSession(session.id);

      expect(updated?.metadata?.tasks).toHaveLength(1);
      expect(updated?.metadata?.tasks?.[0]?.status).toBe('running'); // Reset to running
      expect(updated?.metadata?.tasks?.[0]?.title).toBe('Task One (retry)');
    });

    it('should handle rapid sequential joins (race condition)', async () => {
      const session = await sessionManager.createSession('test-agent', 'Test task');

      // Simulate rapid retries (potential race condition)
      const joins = [];
      for (let i = 1; i <= 10; i++) {
        joins.push(
          sessionManager.joinTask(session.id, {
            taskId: 'task-1',
            taskTitle: `Task One - Attempt ${i}`,
            agent: 'test-agent'
          })
        );
      }

      await Promise.all(joins);

      const updated = await sessionManager.getSession(session.id);

      // Should have only 1 entry despite 10 rapid joins
      expect(updated?.metadata?.tasks).toHaveLength(1);
      expect(updated?.metadata?.tasks?.[0]?.id).toBe('task-1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle task with colon-separated ID', async () => {
      const session = await sessionManager.createSession('test-agent', 'Test task');

      await sessionManager.joinTask(session.id, {
        taskId: 'auth:setup:database',
        taskTitle: 'Setup auth database',
        agent: 'backend'
      });

      // Re-run
      await sessionManager.joinTask(session.id, {
        taskId: 'auth:setup:database',
        taskTitle: 'Setup auth database (retry)',
        agent: 'backend'
      });

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.metadata?.tasks).toHaveLength(1);
    });

    it('should handle tasks with similar but not identical IDs', async () => {
      const session = await sessionManager.createSession('test-agent', 'Test task');

      // These should be treated as separate tasks
      await sessionManager.joinTask(session.id, {
        taskId: 'build',
        taskTitle: 'Build project',
        agent: 'backend'
      });

      await sessionManager.joinTask(session.id, {
        taskId: 'build:test',
        taskTitle: 'Build test suite',
        agent: 'qa'
      });

      await sessionManager.joinTask(session.id, {
        taskId: 'build:deploy',
        taskTitle: 'Build for deployment',
        agent: 'devops'
      });

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.metadata?.tasks).toHaveLength(3);

      const ids = updated?.metadata?.tasks?.map((t: any) => t.id) || [];
      expect(ids).toContain('build');
      expect(ids).toContain('build:test');
      expect(ids).toContain('build:deploy');
    });

    it('should preserve task ordering after deduplication', async () => {
      const session = await sessionManager.createSession('test-agent', 'Test task');

      // Add tasks in specific order
      await sessionManager.joinTask(session.id, {
        taskId: 'task-1',
        taskTitle: 'First',
        agent: 'agent-1'
      });

      await sessionManager.joinTask(session.id, {
        taskId: 'task-2',
        taskTitle: 'Second',
        agent: 'agent-2'
      });

      await sessionManager.joinTask(session.id, {
        taskId: 'task-3',
        taskTitle: 'Third',
        agent: 'agent-3'
      });

      // Re-run middle task
      await sessionManager.joinTask(session.id, {
        taskId: 'task-2',
        taskTitle: 'Second (retry)',
        agent: 'agent-2'
      });

      const updated = await sessionManager.getSession(session.id);
      const titles = updated?.metadata?.tasks?.map((t: any) => t.title) || [];

      // task-2 should be moved to end (most recent)
      expect(titles).toEqual(['First', 'Third', 'Second (retry)']);
    });
  });
});
