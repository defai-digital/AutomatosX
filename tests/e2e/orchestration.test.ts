/**
 * E2E Orchestration Tests
 *
 * Tests multi-agent orchestration features including:
 * - Session lifecycle management
 * - Multi-agent collaboration
 * - Session persistence
 * - Workspace isolation
 * - Shared workspace access
 * - Cleanup coordination
 *
 * @since v4.7.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { readFile, access, readdir } from 'fs/promises';
import {
  createTestEnv,
  cleanupTestEnv,
  createAgentProfile,
  execCLI,
  assertSuccess,
  assertOutputContains,
  type E2ETestEnv
} from './helpers';

describe('E2E Orchestration Workflows (v4.7.0)', () => {
  let env: E2ETestEnv;

  beforeEach(async () => {
    env = await createTestEnv();
  }, 15000);

  afterEach(async () => {
    await cleanupTestEnv(env);
  }, 10000);

  describe('Session Lifecycle', () => {
    it('should create session and persist to file', async () => {
      // Create agent profiles
      await createAgentProfile(env, 'backend', {
        role: 'backend',
        description: 'Backend developer',
        systemPrompt: 'You are a backend developer.'
      });

      // Create SessionManager programmatically to create a session
      const { SessionManager } = await import('../../src/core/session-manager.js');
      const sessionsPath = join(env.testDir, '.automatosx', 'sessions', 'sessions.json');
      const sessionManager = new SessionManager({ persistencePath: sessionsPath });
      await sessionManager.initialize();

      // Create session
      const session = await sessionManager.createSession('Implement auth feature', 'backend');

      // Wait for debounced save to complete (100ms debounce + buffer)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify session file was created
      const sessionFileExists = await access(sessionsPath)
        .then(() => true)
        .catch(() => false);
      expect(sessionFileExists).toBe(true);

      // Read and verify session data
      const sessionData = JSON.parse(await readFile(sessionsPath, 'utf-8'));
      expect(sessionData).toHaveLength(1);
      expect(sessionData[0].id).toBe(session.id);
      expect(sessionData[0].task).toBe('Implement auth feature');
      expect(sessionData[0].initiator).toBe('backend');
      expect(sessionData[0].agents).toEqual(['backend']);
      expect(sessionData[0].status).toBe('active');
    }, 20000);

    it('should load sessions from persistence file on restart', async () => {
      // Create agent
      await createAgentProfile(env, 'backend');

      const { SessionManager } = await import('../../src/core/session-manager.js');
      const sessionsPath = join(env.testDir, '.automatosx', 'sessions', 'sessions.json');

      // First instance - create session
      const sessionManager1 = new SessionManager({ persistencePath: sessionsPath });
      await sessionManager1.initialize();
      const session1 = await sessionManager1.createSession('Task 1', 'backend');
      const session2 = await sessionManager1.createSession('Task 2', 'backend');

      // Wait for debounced save to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Second instance - should load existing sessions
      const sessionManager2 = new SessionManager({ persistencePath: sessionsPath });
      await sessionManager2.initialize();

      const loadedSession1 = await sessionManager2.getSession(session1.id);
      const loadedSession2 = await sessionManager2.getSession(session2.id);

      expect(loadedSession1).toBeDefined();
      expect(loadedSession1?.task).toBe('Task 1');
      expect(loadedSession2).toBeDefined();
      expect(loadedSession2?.task).toBe('Task 2');

      const stats = await sessionManager2.getStats();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
    }, 20000);

    it('should complete session and persist status', async () => {
      await createAgentProfile(env, 'backend');

      const { SessionManager } = await import('../../src/core/session-manager.js');
      const sessionsPath = join(env.testDir, '.automatosx', 'sessions', 'sessions.json');
      const sessionManager = new SessionManager({ persistencePath: sessionsPath });
      await sessionManager.initialize();

      const session = await sessionManager.createSession('Task', 'backend');
      await sessionManager.completeSession(session.id);

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify persistence
      const sessionData = JSON.parse(await readFile(sessionsPath, 'utf-8'));
      expect(sessionData[0].status).toBe('completed');
    }, 20000);

    it('should fail session and persist error metadata', async () => {
      await createAgentProfile(env, 'backend');

      const { SessionManager } = await import('../../src/core/session-manager.js');
      const sessionsPath = join(env.testDir, '.automatosx', 'sessions', 'sessions.json');
      const sessionManager = new SessionManager({ persistencePath: sessionsPath });
      await sessionManager.initialize();

      const session = await sessionManager.createSession('Task', 'backend');
      await sessionManager.failSession(session.id, new Error('Test error'));

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify persistence
      const sessionData = JSON.parse(await readFile(sessionsPath, 'utf-8'));
      expect(sessionData[0].status).toBe('failed');
      expect(sessionData[0].metadata.error).toBe('Test error');
    }, 20000);
  });

  describe('Multi-Agent Collaboration', () => {
    it('should allow multiple agents to join same session', async () => {
      // Create agent profiles
      await createAgentProfile(env, 'backend');
      await createAgentProfile(env, 'frontend');
      await createAgentProfile(env, 'security');

      const { SessionManager } = await import('../../src/core/session-manager.js');
      const sessionsPath = join(env.testDir, '.automatosx', 'sessions', 'sessions.json');
      const sessionManager = new SessionManager({ persistencePath: sessionsPath });
      await sessionManager.initialize();

      // Create session with backend
      const session = await sessionManager.createSession('Build auth system', 'backend');

      // Add frontend and security agents
      await sessionManager.addAgent(session.id, 'frontend');
      await sessionManager.addAgent(session.id, 'security');

      // Wait for save
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all agents in session
      const sessionData = JSON.parse(await readFile(sessionsPath, 'utf-8'));
      expect(sessionData[0].agents).toEqual(['backend', 'frontend', 'security']);
    }, 20000);

    it('should not add duplicate agents to session', async () => {
      await createAgentProfile(env, 'backend');

      const { SessionManager } = await import('../../src/core/session-manager.js');
      const sessionsPath = join(env.testDir, '.automatosx', 'sessions', 'sessions.json');
      const sessionManager = new SessionManager({ persistencePath: sessionsPath });
      await sessionManager.initialize();

      const session = await sessionManager.createSession('Task', 'backend');

      // Try to add backend again
      await sessionManager.addAgent(session.id, 'backend');

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.agents).toEqual(['backend']);
    }, 20000);

    it('should track active sessions per agent', async () => {
      await createAgentProfile(env, 'backend');
      await createAgentProfile(env, 'frontend');

      const { SessionManager } = await import('../../src/core/session-manager.js');
      const sessionManager = new SessionManager();
      await sessionManager.initialize();

      // Create multiple sessions
      const session1 = await sessionManager.createSession('Auth', 'backend');
      const session2 = await sessionManager.createSession('UI', 'frontend');
      const session3 = await sessionManager.createSession('API', 'backend');

      // Add frontend to session1
      await sessionManager.addAgent(session1.id, 'frontend');

      // Check backend sessions
      const backendSessions = await sessionManager.getActiveSessionsForAgent('backend');
      expect(backendSessions).toHaveLength(2);
      expect(backendSessions.map(s => s.task)).toContain('Auth');
      expect(backendSessions.map(s => s.task)).toContain('API');

      // Check frontend sessions
      const frontendSessions = await sessionManager.getActiveSessionsForAgent('frontend');
      expect(frontendSessions).toHaveLength(2);
      expect(frontendSessions.map(s => s.task)).toContain('Auth');
      expect(frontendSessions.map(s => s.task)).toContain('UI');
    }, 20000);
  });

  describe('Shared Workspace Access (v5.2.0)', () => {
    it('should allow all agents to write to PRD workspace', async () => {
      await createAgentProfile(env, 'backend');
      await createAgentProfile(env, 'frontend');

      const { WorkspaceManager } = await import('../../src/core/workspace-manager.js');
      const workspaceManager = new WorkspaceManager(env.testDir);

      // v5.2.0: All agents can write to shared PRD workspace
      await workspaceManager.writePRD('feature-auth.md', '# Auth Feature\n\nDesign by backend');
      await workspaceManager.writePRD('ui-design.md', '# UI Design\n\nDesign by frontend');

      // Verify both files exist in automatosx/PRD/
      const prdPath = join(env.testDir, 'automatosx', 'PRD');

      const authExists = await access(join(prdPath, 'feature-auth.md'))
        .then(() => true)
        .catch(() => false);
      const uiExists = await access(join(prdPath, 'ui-design.md'))
        .then(() => true)
        .catch(() => false);

      expect(authExists).toBe(true);
      expect(uiExists).toBe(true);

      // Verify content
      const authContent = await workspaceManager.readPRD('feature-auth.md');
      expect(authContent).toContain('Design by backend');
    }, 20000);

    it('should allow all agents to write to tmp workspace', async () => {
      await createAgentProfile(env, 'backend');
      await createAgentProfile(env, 'frontend');

      const { WorkspaceManager } = await import('../../src/core/workspace-manager.js');
      const workspaceManager = new WorkspaceManager(env.testDir);

      // v5.2.0: All agents can write to shared tmp workspace
      await workspaceManager.writeTmp('test-backend.sh', '#!/bin/bash\necho "backend test"');
      await workspaceManager.writeTmp('test-frontend.sh', '#!/bin/bash\necho "frontend test"');

      // Verify both files exist in automatosx/tmp/
      const tmpPath = join(env.testDir, 'automatosx', 'tmp');

      const backendExists = await access(join(tmpPath, 'test-backend.sh'))
        .then(() => true)
        .catch(() => false);
      const frontendExists = await access(join(tmpPath, 'test-frontend.sh'))
        .then(() => true)
        .catch(() => false);

      expect(backendExists).toBe(true);
      expect(frontendExists).toBe(true);
    }, 20000);

    it('should support nested directories in shared workspaces', async () => {
      const { WorkspaceManager } = await import('../../src/core/workspace-manager.js');
      const workspaceManager = new WorkspaceManager(env.testDir);

      // v5.2.0: Support nested paths in PRD/tmp
      await workspaceManager.writePRD('features/auth/design.md', '# Auth Design');
      await workspaceManager.writeTmp('scripts/tests/unit.sh', '#!/bin/bash');

      // Verify nested files exist
      const prdFile = join(env.testDir, 'automatosx', 'PRD', 'features', 'auth', 'design.md');
      const tmpFile = join(env.testDir, 'automatosx', 'tmp', 'scripts', 'tests', 'unit.sh');

      const prdExists = await access(prdFile).then(() => true).catch(() => false);
      const tmpExists = await access(tmpFile).then(() => true).catch(() => false);

      expect(prdExists).toBe(true);
      expect(tmpExists).toBe(true);
    }, 20000);
  });

  describe('Cleanup Coordination', () => {
    it('should cleanup old sessions and temporary files independently', async () => {
      const { SessionManager } = await import('../../src/core/session-manager.js');
      const { WorkspaceManager } = await import('../../src/core/workspace-manager.js');

      await createAgentProfile(env, 'backend');

      const sessionsPath = join(env.testDir, '.automatosx', 'sessions', 'sessions.json');
      const sessionManager = new SessionManager({ persistencePath: sessionsPath });
      await sessionManager.initialize();

      const workspaceManager = new WorkspaceManager(env.testDir);

      // Create sessions
      const session1 = await sessionManager.createSession('Task 1', 'backend');
      const session2 = await sessionManager.createSession('Task 2', 'backend');

      // Complete sessions
      await sessionManager.completeSession(session1.id);
      await sessionManager.completeSession(session2.id);

      // Create temporary files related to sessions
      await workspaceManager.writeTmp(`session-${session1.id}-analysis.txt`, 'Analysis for task 1');
      await workspaceManager.writeTmp(`session-${session2.id}-analysis.txt`, 'Analysis for task 2');

      // Manually set old updatedAt to trigger cleanup
      const s1 = await sessionManager.getSession(session1.id);
      const s2 = await sessionManager.getSession(session2.id);
      if (s1) s1.updatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      if (s2) s2.updatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      // Cleanup old sessions (v5.2.0: session and workspace cleanup are now independent)
      const result = await sessionManager.cleanupOldSessions(7);

      // Verify sessions were removed
      expect(result.removedCount).toBe(2);
      expect(result.removedSessionIds).toContain(session1.id);
      expect(result.removedSessionIds).toContain(session2.id);

      // v5.2.0: Temporary files are cleaned up separately by age, not by session
      // Files created just now are still present
      const tmpFiles = await workspaceManager.listTmp();
      expect(tmpFiles.length).toBe(2);
    }, 20000);

    it('should persist cleanup to sessions file', async () => {
      const { SessionManager } = await import('../../src/core/session-manager.js');

      await createAgentProfile(env, 'backend');

      const sessionsPath = join(env.testDir, '.automatosx', 'sessions', 'sessions.json');
      const sessionManager = new SessionManager({ persistencePath: sessionsPath });
      await sessionManager.initialize();

      // Create and complete sessions
      const session1 = await sessionManager.createSession('Task 1', 'backend');
      const session2 = await sessionManager.createSession('Task 2', 'backend');
      const session3 = await sessionManager.createSession('Task 3', 'backend');

      await sessionManager.completeSession(session1.id);
      await sessionManager.completeSession(session2.id);

      // Set old dates
      const s1 = await sessionManager.getSession(session1.id);
      const s2 = await sessionManager.getSession(session2.id);
      if (s1) s1.updatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      if (s2) s2.updatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      // Cleanup
      await sessionManager.cleanupOldSessions(7);

      // Wait for save
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify persistence
      const sessionData = JSON.parse(await readFile(sessionsPath, 'utf-8'));
      expect(sessionData).toHaveLength(1);
      expect(sessionData[0].id).toBe(session3.id);
    }, 20000);
  });

  describe('Session Metadata', () => {
    it('should update session metadata and persist', async () => {
      const { SessionManager } = await import('../../src/core/session-manager.js');

      await createAgentProfile(env, 'backend');

      const sessionsPath = join(env.testDir, '.automatosx', 'sessions', 'sessions.json');
      const sessionManager = new SessionManager({ persistencePath: sessionsPath });
      await sessionManager.initialize();

      const session = await sessionManager.createSession('Task', 'backend');

      // Update metadata
      await sessionManager.updateMetadata(session.id, {
        priority: 'high',
        tags: ['auth', 'security'],
        estimatedHours: 8
      });

      // Wait for save
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify persistence
      const sessionData = JSON.parse(await readFile(sessionsPath, 'utf-8'));
      expect(sessionData[0].metadata.priority).toBe('high');
      expect(sessionData[0].metadata.tags).toEqual(['auth', 'security']);
      expect(sessionData[0].metadata.estimatedHours).toBe(8);
    }, 20000);
  });
});
