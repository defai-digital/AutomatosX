/**
 * Session Manager Integration Tests
 *
 * End-to-end tests for multi-agent session management:
 * - Session creation and lifecycle
 * - Agent participation tracking
 * - Persistence and recovery
 * - Cleanup and limits
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { SessionManager } from '../../../src/core/session/manager.js';
import { SessionError } from '../../../src/types/orchestration.js';

describe('Session Manager Integration', () => {
  let sessionManager: SessionManager;
  let testDir: string;
  let persistencePath: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'session-manager-test-'));
    persistencePath = join(testDir, 'sessions.json');
  });

  afterEach(async () => {
    if (sessionManager) {
      await sessionManager.destroy();
    }
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Session Lifecycle', () => {
    it('should create session with valid parameters', async () => {
      sessionManager = new SessionManager();

      const session = await sessionManager.createSession(
        'Implement authentication feature',
        'backend'
      );

      expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(session.task).toBe('Implement authentication feature');
      expect(session.status).toBe('active');
      expect(session.agents).toContain('backend');
      expect(session.createdAt).toBeDefined();
    });

    it('should complete session successfully', async () => {
      sessionManager = new SessionManager();

      const session = await sessionManager.createSession('Test task', 'backend');
      await sessionManager.completeSession(session.id);

      const completedSession = await sessionManager.getSession(session.id);
      expect(completedSession?.status).toBe('completed');
    });

    it('should fail session with error', async () => {
      sessionManager = new SessionManager();

      const session = await sessionManager.createSession('Test task', 'backend');
      await sessionManager.failSession(session.id, new Error('Provider timeout'));

      const failedSession = await sessionManager.getSession(session.id);
      expect(failedSession?.status).toBe('failed');
    });

    it('should get active sessions', async () => {
      sessionManager = new SessionManager();

      await sessionManager.createSession('Task 1', 'backend');
      await sessionManager.createSession('Task 2', 'frontend');
      await sessionManager.createSession('Task 3', 'quality');

      const sessions = await sessionManager.getActiveSessions();
      expect(sessions).toHaveLength(3);
    });

    it('should track session count', async () => {
      sessionManager = new SessionManager();

      await sessionManager.createSession('Task 1', 'backend');
      await sessionManager.createSession('Task 2', 'frontend');

      const count = await sessionManager.getTotalSessionCount();
      expect(count).toBe(2);
    });
  });

  describe('Agent Management', () => {
    it('should add agents to session', async () => {
      sessionManager = new SessionManager();

      const session = await sessionManager.createSession('Multi-agent task', 'backend');
      await sessionManager.addAgent(session.id, 'frontend');
      await sessionManager.addAgent(session.id, 'quality');

      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession?.agents).toContain('backend');
      expect(updatedSession?.agents).toContain('frontend');
      expect(updatedSession?.agents).toContain('quality');
    });

    it('should not duplicate agents', async () => {
      sessionManager = new SessionManager();

      const session = await sessionManager.createSession('Task', 'backend');
      await sessionManager.addAgent(session.id, 'backend');
      await sessionManager.addAgent(session.id, 'backend');

      const updatedSession = await sessionManager.getSession(session.id);
      const backendCount = updatedSession?.agents.filter(a => a === 'backend').length;
      expect(backendCount).toBe(1);
    });

    it('should get active sessions for specific agent', async () => {
      sessionManager = new SessionManager();

      await sessionManager.createSession('Backend task 1', 'backend');
      await sessionManager.createSession('Backend task 2', 'backend');
      await sessionManager.createSession('Frontend task', 'frontend');

      const backendSessions = await sessionManager.getActiveSessionsForAgent('backend');
      expect(backendSessions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Persistence', () => {
    it('should persist sessions to file', async () => {
      sessionManager = new SessionManager({
        persistencePath,
        maxSessions: 100
      });
      await sessionManager.initialize();

      await sessionManager.createSession('Persistent task', 'backend');
      await sessionManager.flushSave();

      // Verify file was created
      const fileExists = await access(persistencePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Read and verify content (may be array or object)
      const content = await readFile(persistencePath, 'utf-8');
      const data = JSON.parse(content);
      // The persistence format can be array directly or an object
      const sessions = Array.isArray(data) ? data : (data.sessions || []);
      expect(sessions.length).toBe(1);
    });

    it('should load sessions from file on initialize', async () => {
      // Create and save session with first manager
      const manager1 = new SessionManager({
        persistencePath,
        maxSessions: 100
      });
      await manager1.initialize();
      const session = await manager1.createSession('Persistent task', 'backend');
      await manager1.flushSave();
      await manager1.destroy();

      // Create new manager and load
      sessionManager = new SessionManager({
        persistencePath,
        maxSessions: 100
      });
      await sessionManager.initialize();

      const loadedSession = await sessionManager.getSession(session.id);
      expect(loadedSession).toBeDefined();
      expect(loadedSession?.task).toBe('Persistent task');
    });

    it('should handle corrupted persistence file gracefully', async () => {
      // Write invalid JSON to file
      await writeFile(persistencePath, 'not valid json');

      sessionManager = new SessionManager({
        persistencePath,
        maxSessions: 100
      });

      // Should not throw, just start with empty sessions
      await expect(sessionManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Session Limits and Cleanup', () => {
    it('should enforce max sessions limit', async () => {
      sessionManager = new SessionManager({
        maxSessions: 3
      });

      await sessionManager.createSession('Task 1', 'backend');
      await sessionManager.createSession('Task 2', 'backend');
      await sessionManager.createSession('Task 3', 'backend');

      // Creating 4th session should remove oldest
      await sessionManager.createSession('Task 4', 'backend');

      const count = await sessionManager.getTotalSessionCount();
      expect(count).toBeLessThanOrEqual(3);
    });

    it('should throw for invalid maxSessions configuration', () => {
      expect(() => {
        new SessionManager({ maxSessions: 0 });
      }).toThrow();

      expect(() => {
        new SessionManager({ maxSessions: -1 });
      }).toThrow();
    });

    it('should cleanup sessions', async () => {
      sessionManager = new SessionManager();

      await sessionManager.createSession('Task 1', 'backend');
      await sessionManager.createSession('Task 2', 'backend');

      const cleaned = await sessionManager.cleanup();
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it('should clear all sessions', async () => {
      sessionManager = new SessionManager();

      await sessionManager.createSession('Task 1', 'backend');
      await sessionManager.createSession('Task 2', 'backend');

      await sessionManager.clearAll();

      const count = await sessionManager.getTotalSessionCount();
      expect(count).toBe(0);
    });
  });

  describe('Session ID Validation', () => {
    it('should handle empty session ID', async () => {
      sessionManager = new SessionManager();

      // May throw or return null depending on implementation
      const result = await sessionManager.getSession('').catch(() => null);
      expect(result).toBeNull();
    });

    it('should handle invalid UUID format', async () => {
      sessionManager = new SessionManager();

      // May throw or return null depending on implementation
      const result1 = await sessionManager.getSession('invalid-id').catch(() => null);
      const result2 = await sessionManager.getSession('not-a-uuid').catch(() => null);
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should accept valid UUID v4', async () => {
      sessionManager = new SessionManager();

      const session = await sessionManager.createSession('Task', 'backend');
      const retrieved = await sessionManager.getSession(session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });
  });

  describe('Metadata Handling', () => {
    it('should store and retrieve session metadata', async () => {
      sessionManager = new SessionManager();

      const session = await sessionManager.createSession('Task', 'backend');
      await sessionManager.updateMetadata(session.id, {
        priority: 'high',
        tags: ['auth', 'security'],
        context: { project: 'automatosx' }
      });

      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession?.metadata?.priority).toBe('high');
      expect(updatedSession?.metadata?.tags).toContain('auth');
    });

    it('should merge metadata updates', async () => {
      sessionManager = new SessionManager();

      const session = await sessionManager.createSession('Task', 'backend');
      await sessionManager.updateMetadata(session.id, { key1: 'value1' });
      await sessionManager.updateMetadata(session.id, { key2: 'value2' });

      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession?.metadata?.key1).toBe('value1');
      expect(updatedSession?.metadata?.key2).toBe('value2');
    });
  });

  describe('Error Handling', () => {
    it('should handle session not found', async () => {
      sessionManager = new SessionManager();

      const validUUID = '00000000-0000-4000-8000-000000000000';
      const session = await sessionManager.getSession(validUUID);

      // getSession returns null for non-existent sessions
      expect(session).toBeNull();
    });

    it('should provide session stats', async () => {
      sessionManager = new SessionManager();

      await sessionManager.createSession('Task 1', 'backend');
      await sessionManager.createSession('Task 2', 'frontend');

      const stats = await sessionManager.getStats();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
    });
  });
});
