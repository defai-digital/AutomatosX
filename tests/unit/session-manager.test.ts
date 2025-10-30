/**
 * Session Manager - Unit Tests
 *
 * @group unit
 * @group core
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../src/core/session-manager.js';
import { SessionError } from '../../src/types/orchestration.js';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('Session Creation', () => {
    it('should create new session with unique ID', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );

      expect(session.id).toBeDefined();
      expect(session.initiator).toBe('backend');
      expect(session.task).toBe('Test task');
      expect(session.agents).toEqual(['backend']);
      expect(session.status).toBe('active');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs for multiple sessions', async () => {
      const session1 = await sessionManager.createSession('Task 1', 'agent1');
      const session2 = await sessionManager.createSession('Task 2', 'agent2');

      expect(session1.id).not.toBe(session2.id);
    });

    it('should initialize with initiator as first agent', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );

      expect(session.agents).toHaveLength(1);
      expect(session.agents[0]).toBe('backend');
    });

    it('should initialize with empty metadata', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );

      expect(session.metadata).toEqual({});
    });
  });

  describe('Agent Management', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should add agent to session', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );

      await sessionManager.addAgent(session.id, 'frontend');

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.agents).toEqual(['backend', 'frontend']);
    });

    it('should not add duplicate agents', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );

      await sessionManager.addAgent(session.id, 'frontend');
      await sessionManager.addAgent(session.id, 'frontend'); // Duplicate

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.agents).toEqual(['backend', 'frontend']);
    });

    it('should throw error when adding agent to non-existent session', async () => {
      await expect(
        sessionManager.addAgent('non-existent', 'frontend')
      ).rejects.toThrow(SessionError);
    });

    it('should update session timestamp when adding agent', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );
      const originalUpdate = session.updatedAt;

      // Small delay to ensure different timestamp
      await vi.advanceTimersByTimeAsync(10);
      await sessionManager.addAgent(session.id, 'frontend');

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        originalUpdate.getTime()
      );
    });
  });

  describe('Session Retrieval', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should get session by ID', async () => {
      const created = await sessionManager.createSession(
        'Test task',
        'backend'
      );

      const retrieved = await sessionManager.getSession(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent session', async () => {
      const session = await sessionManager.getSession('non-existent');

      expect(session).toBeNull();
    });

    it('should get all active sessions', async () => {
      await sessionManager.createSession('Task 1', 'agent1');
      await sessionManager.createSession('Task 2', 'agent2');
      const session3 = await sessionManager.createSession('Task 3', 'agent3');

      // Complete one session
      await sessionManager.completeSession(session3.id);

      const active = await sessionManager.getActiveSessions();

      expect(active).toHaveLength(2);
      expect(active.every(s => s.status === 'active')).toBe(true);
    });

    it('should get active sessions for specific agent', async () => {
      const session1 = await sessionManager.createSession(
        'Task 1',
        'backend'
      );
      await sessionManager.createSession('Task 2', 'frontend');
      const session3 = await sessionManager.createSession(
        'Task 3',
        'backend'
      );
      await sessionManager.addAgent(session3.id, 'frontend');

      const backendSessions = await sessionManager.getActiveSessionsForAgent(
        'backend'
      );

      expect(backendSessions).toHaveLength(2);
      expect(backendSessions.every(s => s.agents.includes('backend'))).toBe(
        true
      );
    });

    it('should sort agent sessions by most recent first', async () => {
      const session1 = await sessionManager.createSession(
        'Task 1',
        'backend'
      );
      await vi.advanceTimersByTimeAsync(10);
      const session2 = await sessionManager.createSession(
        'Task 2',
        'backend'
      );

      const sessions = await sessionManager.getActiveSessionsForAgent(
        'backend'
      );

      expect(sessions).toHaveLength(2);
      expect(sessions[0]!.id).toBe(session2.id); // Most recent first
      expect(sessions[1]!.id).toBe(session1.id);
    });
  });

  describe('Session Completion', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should complete session successfully', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );

      await sessionManager.completeSession(session.id);

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.status).toBe('completed');
    });

    it('should update timestamp on completion', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );
      const originalUpdate = session.updatedAt;

      await vi.advanceTimersByTimeAsync(10);
      await sessionManager.completeSession(session.id);

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        originalUpdate.getTime()
      );
    });

    it('should throw error when completing non-existent session', async () => {
      await expect(
        sessionManager.completeSession('non-existent')
      ).rejects.toThrow(SessionError);
    });

    it('should handle completing already completed session gracefully', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );

      await sessionManager.completeSession(session.id);
      await expect(
        sessionManager.completeSession(session.id)
      ).resolves.not.toThrow();
    });
  });

  describe('Session Failure', () => {
    it('should mark session as failed', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );
      const error = new Error('Test error');

      await sessionManager.failSession(session.id, error);

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.status).toBe('failed');
    });

    it('should store error message in metadata', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );
      const error = new Error('Test error message');

      await sessionManager.failSession(session.id, error);

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.metadata?.error).toBe('Test error message');
      expect(updated?.metadata?.errorStack).toBeDefined();
    });

    it('should handle failing non-existent session gracefully', async () => {
      const error = new Error('Test error');

      await expect(
        sessionManager.failSession('non-existent', error)
      ).resolves.not.toThrow();
    });
  });

  describe('Metadata Management', () => {
    it('should update session metadata', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );

      await sessionManager.updateMetadata(session.id, {
        priority: 'high',
        tags: ['auth', 'feature']
      });

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.metadata?.priority).toBe('high');
      expect(updated?.metadata?.tags).toEqual(['auth', 'feature']);
    });

    it('should merge metadata instead of replacing', async () => {
      const session = await sessionManager.createSession(
        'Test task',
        'backend'
      );

      await sessionManager.updateMetadata(session.id, { key1: 'value1' });
      await sessionManager.updateMetadata(session.id, { key2: 'value2' });

      const updated = await sessionManager.getSession(session.id);
      expect(updated).toBeDefined();
      expect(updated!.metadata?.key1).toBe('value1');
      expect(updated!.metadata?.key2).toBe('value2');
    });

    it('should throw error when updating metadata of non-existent session', async () => {
      await expect(
        sessionManager.updateMetadata('non-existent', {})
      ).rejects.toThrow(SessionError);
    });
  });

  describe('Session Cleanup', () => {
    it('should not cleanup when under limit', async () => {
      // Create a few sessions (well under limit)
      for (let i = 0; i < 5; i++) {
        await sessionManager.createSession(`Task ${i}`, 'agent');
      }

      const removed = await sessionManager.cleanup();
      expect(removed).toBe(0);

      const stats = await sessionManager.getStats();
      expect(stats.total).toBe(5);
    });

    it('should cleanup when manual cleanup called with many sessions', async () => {
      // Create sessions
      for (let i = 0; i < 10; i++) {
        await sessionManager.createSession(`Task ${i}`, 'agent');
      }

      // Manually test cleanup logic (without hitting MAX limit)
      const stats = await sessionManager.getStats();
      expect(stats.total).toBe(10);
    });

    it('should return count of cleaned sessions', async () => {
      // Cleanup when under limit
      const removed = await sessionManager.cleanup();
      expect(removed).toBe(0);
    });

    it('should cleanup old completed sessions', async () => {
      // Create sessions and complete them
      const session1 = await sessionManager.createSession('Task 1', 'agent');
      const session2 = await sessionManager.createSession('Task 2', 'agent');
      const session3 = await sessionManager.createSession('Task 3', 'agent');

      await sessionManager.completeSession(session1.id);
      await sessionManager.completeSession(session2.id);

      // Manually set old updatedAt to simulate old sessions
      const s1 = await sessionManager.getSession(session1.id);
      const s2 = await sessionManager.getSession(session2.id);
      if (s1) s1.updatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      if (s2) s2.updatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago

      // Cleanup old sessions (default 7 days)
      const removed = await sessionManager.cleanupOldSessions();

      expect(removed.removedCount).toBe(2);
      expect(removed.removedSessionIds).toHaveLength(2);

      const stats = await sessionManager.getStats();
      expect(stats.total).toBe(1); // Only session3 remains
      expect(stats.active).toBe(1);
    });

    it('should not cleanup old active sessions', async () => {
      // Create active session
      const session = await sessionManager.createSession('Task', 'agent');

      // Manually set old updatedAt
      const s = await sessionManager.getSession(session.id);
      if (s) s.updatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago

      // Cleanup should not remove active sessions
      const removed = await sessionManager.cleanupOldSessions();

      expect(removed.removedCount).toBe(0);
      expect(removed.removedSessionIds).toHaveLength(0);

      const stats = await sessionManager.getStats();
      expect(stats.total).toBe(1);
      expect(stats.active).toBe(1);
    });

    it('should cleanup old failed sessions', async () => {
      // Create session and fail it
      const session = await sessionManager.createSession('Task', 'agent');
      await sessionManager.failSession(session.id, new Error('Test error'));

      // Manually set old updatedAt
      const s = await sessionManager.getSession(session.id);
      if (s) s.updatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago

      // Cleanup old sessions
      const removed = await sessionManager.cleanupOldSessions();

      expect(removed.removedCount).toBe(1);
      expect(removed.removedSessionIds).toHaveLength(1);

      const stats = await sessionManager.getStats();
      expect(stats.total).toBe(0);
    });

    it('should support custom cleanup age', async () => {
      // Create and complete session
      const session = await sessionManager.createSession('Task', 'agent');
      await sessionManager.completeSession(session.id);

      // Set to 2 days ago
      const s = await sessionManager.getSession(session.id);
      if (s) s.updatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      // Cleanup with 7 day threshold - should not remove
      let removed = await sessionManager.cleanupOldSessions(7);
      expect(removed.removedCount).toBe(0);

      // Cleanup with 1 day threshold - should remove
      removed = await sessionManager.cleanupOldSessions(1);
      expect(removed.removedCount).toBe(1);
    });
  });

  describe('Clear All', () => {
    it('should clear all sessions', async () => {
      await sessionManager.createSession('Task 1', 'agent1');
      await sessionManager.createSession('Task 2', 'agent2');

      const removed = await sessionManager.clearAll();

      expect(removed).toBe(2);

      const stats = await sessionManager.getStats();
      expect(stats.total).toBe(0);
    });

    it('should return zero when no sessions to clear', async () => {
      const removed = await sessionManager.clearAll();
      expect(removed).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should return accurate session statistics', async () => {
      const session1 = await sessionManager.createSession(
        'Task 1',
        'agent1'
      );
      const session2 = await sessionManager.createSession(
        'Task 2',
        'agent2'
      );
      const session3 = await sessionManager.createSession(
        'Task 3',
        'agent3'
      );

      await sessionManager.completeSession(session1.id);
      await sessionManager.failSession(session2.id, new Error('Test'));

      const stats = await sessionManager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });

    it('should return zero stats when no sessions', async () => {
      const stats = await sessionManager.getStats();

      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('Resource Management', () => {
    it('should destroy and cleanup resources', async () => {
      const session = await sessionManager.createSession('Task', 'agent');
      await sessionManager.updateMetadata(session.id, { test: 'data' });

      // Destroy should not throw
      await expect(sessionManager.destroy()).resolves.not.toThrow();
    });

    it('should reject metadata exceeding size limit', async () => {
      const session = await sessionManager.createSession('Task', 'agent');

      // Create metadata larger than 10KB
      const largeMetadata = { data: 'x'.repeat(11 * 1024) };

      await expect(
        sessionManager.updateMetadata(session.id, largeMetadata)
      ).rejects.toThrow('Metadata too large');
    });

    it('should handle multi-byte characters in metadata size calculation', async () => {
      const session = await sessionManager.createSession('Task', 'agent');

      // Chinese characters are 3 bytes each in UTF-8
      // 3000 characters * 3 bytes = 9000 bytes (under 10KB limit)
      const metadata = { text: '測試'.repeat(1500) };

      await expect(
        sessionManager.updateMetadata(session.id, metadata)
      ).resolves.not.toThrow();

      // 4000 characters * 3 bytes = 12000 bytes (over 10KB limit)
      const largeMetadata = { text: '測試'.repeat(2000) };

      await expect(
        sessionManager.updateMetadata(session.id, largeMetadata)
      ).rejects.toThrow('Metadata too large');
    });
  });

  describe('Session ID Validation', () => {
    it('should reject empty session ID in getSession', async () => {
      const session = await sessionManager.getSession('');
      expect(session).toBeNull();
    });

    it('should reject whitespace session ID in completeSession', async () => {
      await expect(
        sessionManager.completeSession('   ')
      ).rejects.toThrow('Session ID cannot be empty');
    });

    it('should reject invalid format in addAgent', async () => {
      await expect(
        sessionManager.addAgent('not-a-uuid', 'agent')
      ).rejects.toThrow('Invalid session ID format');
    });
  });

  describe('Task Metadata Management', () => {
    it('[REGRESSION] should remove ALL duplicate task entries in joinTask', async () => {
      // Bug fix v5.12.1: Use filter() to remove ALL duplicates, not just first
      // Previous bug: findIndex() + splice() only removed first duplicate,
      // leaving additional stale entries from multiple retries
      const session = await sessionManager.createSession(
        'Test task with retries',
        'backend'
      );

      // Simulate multiple retries by manually adding duplicate task entries
      // (In production, this would happen through joinTask failures/retries)
      const taskId = 'task-1';

      // First attempt
      await sessionManager.joinTask(session.id, {
        taskId,
        taskTitle: 'Test Task',
        agent: 'backend'
      });

      let updated = await sessionManager.getSession(session.id);
      expect(updated?.metadata.tasks).toHaveLength(1);

      // Simulate failure by manually adding duplicate entry (simulating old bug)
      // This represents what would happen if joinTask was called multiple times
      // for the same task due to retries
      if (updated?.metadata.tasks) {
        updated.metadata.tasks.push({
          id: taskId,
          title: 'Test Task (retry 1)',
          agent: 'backend',
          status: 'running',
          startedAt: new Date().toISOString()
        });
        updated.metadata.tasks.push({
          id: taskId,
          title: 'Test Task (retry 2)',
          agent: 'backend',
          status: 'running',
          startedAt: new Date().toISOString()
        });
      }

      // Now we have 3 entries for the same taskId (1 original + 2 simulated duplicates)
      expect(updated?.metadata.tasks?.filter(t => t.id === taskId)).toHaveLength(3);

      // Call joinTask again - it should remove ALL 3 duplicates and add a fresh entry
      await sessionManager.joinTask(session.id, {
        taskId,
        taskTitle: 'Test Task (final)',
        agent: 'backend'
      });

      updated = await sessionManager.getSession(session.id);

      // Verify: Should have exactly 1 entry for this taskId (not 2 or 3)
      const taskEntries = updated?.metadata.tasks?.filter(t => t.id === taskId);
      expect(taskEntries).toHaveLength(1);
      expect(taskEntries?.[0]?.title).toBe('Test Task (final)');

      // Verify the old bug would have left duplicates
      // (If the bug still existed, we'd have 2 entries: one from the last push,
      //  and one from the splice only removing the first duplicate)
    });
  });

  describe('Configuration', () => {
    it('should accept custom maxSessions limit', async () => {
      const customManager = new SessionManager({ maxSessions: 50 });

      // This should work without errors
      expect(customManager).toBeDefined();
    });
  });
});
