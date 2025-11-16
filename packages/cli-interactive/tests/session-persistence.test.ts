/**
 * Tests for session-persistence.ts
 * Verifies session saving, loading, and resumption
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync, readdirSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';
import {
  SessionPersistenceManager,
  renderSessionList,
  type PersistedSession,
  type SessionListEntry
} from '../src/session-persistence.ts';

describe('SessionPersistenceManager', () => {
  let manager: SessionPersistenceManager;
  let testSessionsDir: string;

  beforeEach(() => {
    testSessionsDir = join(process.cwd(), '.test-sessions');
    manager = new SessionPersistenceManager(process.cwd());

    // Override sessions directory for testing
    (manager as any).sessionsDir = testSessionsDir;

    if (!existsSync(testSessionsDir)) {
      mkdirSync(testSessionsDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test sessions
    if (existsSync(testSessionsDir)) {
      const files = readdirSync(testSessionsDir);
      files.forEach(file => {
        try {
          unlinkSync(join(testSessionsDir, file));
        } catch (error) {
          // Ignore
        }
      });
      try {
        rmdirSync(testSessionsDir);
      } catch (error) {
        // Ignore
      }
    }

    // Disable auto-save
    manager.disableAutoSave();
  });

  describe('createSession', () => {
    it('should create new session with required fields', () => {
      const session = manager.createSession('test-session', 'claude', '/workspace');

      expect(session.id).toBeTruthy();
      expect(session.name).toBe('test-session');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastSavedAt).toBeInstanceOf(Date);
      expect(session.version).toBe('1.0');
      expect(session.conversationHistory).toEqual([]);
      expect(session.commandHistory).toEqual([]);
      expect(session.agentUpdates).toEqual([]);
      expect(session.metadata.provider).toBe('claude');
      expect(session.metadata.workspaceRoot).toBe('/workspace');
    });

    it('should generate unique session IDs', () => {
      const session1 = manager.createSession('session1');
      const session2 = manager.createSession('session2');

      expect(session1.id).not.toBe(session2.id);
    });

    it('should initialize with zero counts', () => {
      const session = manager.createSession('test');

      expect(session.metadata.messageCount).toBe(0);
      expect(session.metadata.commandCount).toBe(0);
      expect(session.metadata.agentCount).toBe(0);
    });

    it('should set as current session', () => {
      const session = manager.createSession('test');

      expect(manager.getCurrentSession()).toBe(session);
    });
  });

  describe('saveSession', () => {
    it('should save session to file', async () => {
      const session = manager.createSession('save-test');

      const result = await manager.saveSession();

      expect(result.success).toBe(true);
      expect(result.path).toBeTruthy();
      expect(existsSync(result.path!)).toBe(true);
    });

    it('should update timestamps on save', async () => {
      const session = manager.createSession('timestamp-test');
      const originalSavedAt = session.lastSavedAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      await manager.saveSession();

      expect(session.lastSavedAt.getTime()).toBeGreaterThan(originalSavedAt.getTime());
    });

    it('should save JSON format correctly', async () => {
      const session = manager.createSession('json-test');
      session.conversationHistory.push({
        role: 'user',
        content: 'Test message',
        timestamp: new Date()
      });

      const result = await manager.saveSession();

      expect(result.success).toBe(true);

      // Verify file contains valid JSON
      const fs = require('fs');
      const content = fs.readFileSync(result.path!, 'utf8');
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe('json-test');
      expect(parsed.conversationHistory).toHaveLength(1);
    });

    it('should return error when no active session', async () => {
      const emptyManager = new SessionPersistenceManager();
      (emptyManager as any).sessionsDir = testSessionsDir;

      const result = await emptyManager.saveSession();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No active session');
    });
  });

  describe('loadSession', () => {
    it('should load saved session', async () => {
      // Create and save session
      const session = manager.createSession('load-test', 'claude');
      manager.addMessage('user', 'Test message');

      await manager.saveSession();

      // Create new manager and load
      const newManager = new SessionPersistenceManager();
      (newManager as any).sessionsDir = testSessionsDir;

      const result = await newManager.loadSession(session.id);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session!.name).toBe('load-test');
      expect(result.session!.conversationHistory).toHaveLength(1);
    });

    it('should revive Date objects', async () => {
      const session = manager.createSession('date-test');
      await manager.saveSession();

      const newManager = new SessionPersistenceManager();
      (newManager as any).sessionsDir = testSessionsDir;

      const result = await newManager.loadSession(session.id);

      expect(result.session!.createdAt).toBeInstanceOf(Date);
      expect(result.session!.lastSavedAt).toBeInstanceOf(Date);
    });

    it('should return error for non-existent session', async () => {
      const result = await manager.loadSession('nonexistent-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should set as current session after loading', async () => {
      const session = manager.createSession('current-test');
      await manager.saveSession();

      const newManager = new SessionPersistenceManager();
      (newManager as any).sessionsDir = testSessionsDir;

      await newManager.loadSession(session.id);

      expect(newManager.getCurrentSession()).toBeDefined();
      expect(newManager.getCurrentSession()!.id).toBe(session.id);
    });

    it('should update lastAccessedAt timestamp', async () => {
      const session = manager.createSession('access-test');
      const originalAccessTime = session.lastAccessedAt;

      await manager.saveSession();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const newManager = new SessionPersistenceManager();
      (newManager as any).sessionsDir = testSessionsDir;

      const result = await newManager.loadSession(session.id);

      expect(result.session!.lastAccessedAt.getTime()).toBeGreaterThan(originalAccessTime.getTime());
    });
  });

  describe('listSessions', () => {
    it('should list all saved sessions', async () => {
      manager.createSession('session1');
      await manager.saveSession();

      manager.createSession('session2');
      await manager.saveSession();

      const sessions = manager.listSessions();

      expect(sessions).toHaveLength(2);
    });

    it('should return empty array when no sessions', () => {
      const sessions = manager.listSessions();

      expect(sessions).toEqual([]);
    });

    it('should sort by name', async () => {
      manager.createSession('charlie');
      await manager.saveSession();

      manager.createSession('alice');
      await manager.saveSession();

      manager.createSession('bob');
      await manager.saveSession();

      const sessions = manager.listSessions('name');

      expect(sessions[0].name).toBe('alice');
      expect(sessions[1].name).toBe('bob');
      expect(sessions[2].name).toBe('charlie');
    });

    it('should sort by created date', async () => {
      const session1 = manager.createSession('first');
      await manager.saveSession();
      await new Promise(resolve => setTimeout(resolve, 10));

      const session2 = manager.createSession('second');
      await manager.saveSession();

      const sessions = manager.listSessions('created');

      expect(sessions[0].name).toBe('second'); // Most recent first
      expect(sessions[1].name).toBe('first');
    });

    it('should sort by modified date (default)', async () => {
      manager.createSession('old');
      await manager.saveSession();

      await new Promise(resolve => setTimeout(resolve, 10));

      manager.createSession('new');
      await manager.saveSession();

      const sessions = manager.listSessions('modified');

      expect(sessions[0].name).toBe('new');
    });

    it('should include session metadata', async () => {
      const session = manager.createSession('metadata-test');
      manager.addMessage('user', 'Test');

      await manager.saveSession();

      const sessions = manager.listSessions();

      expect(sessions[0].messageCount).toBe(1);
      expect(sessions[0].size).toBeGreaterThan(0);
    });
  });

  describe('deleteSession', () => {
    it('should delete session file', async () => {
      const session = manager.createSession('delete-test');
      await manager.saveSession();

      const sessionPath = join(testSessionsDir, `${session.id}.json`);
      expect(existsSync(sessionPath)).toBe(true);

      const result = await manager.deleteSession(session.id);

      expect(result.success).toBe(true);
      expect(existsSync(sessionPath)).toBe(false);
    });

    it('should clear current session if deleted', async () => {
      const session = manager.createSession('current-delete');
      await manager.saveSession();

      await manager.deleteSession(session.id);

      expect(manager.getCurrentSession()).toBeNull();
    });

    it('should return error for non-existent session', async () => {
      const result = await manager.deleteSession('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation', () => {
      manager.createSession('message-test');

      manager.addMessage('user', 'Hello', { tag: 'greeting' });

      const session = manager.getCurrentSession();
      expect(session!.conversationHistory).toHaveLength(1);
      expect(session!.conversationHistory[0].role).toBe('user');
      expect(session!.conversationHistory[0].content).toBe('Hello');
      expect(session!.conversationHistory[0].metadata).toEqual({ tag: 'greeting' });
    });

    it('should increment message count', () => {
      manager.createSession('count-test');

      manager.addMessage('user', 'Message 1');
      manager.addMessage('assistant', 'Reply 1');

      const session = manager.getCurrentSession();
      expect(session!.metadata.messageCount).toBe(2);
    });

    it('should add timestamp automatically', () => {
      manager.createSession('timestamp-test');

      const before = Date.now();
      manager.addMessage('user', 'Test');
      const after = Date.now();

      const session = manager.getCurrentSession();
      const timestamp = session!.conversationHistory[0].timestamp.getTime();

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should handle no active session gracefully', () => {
      const emptyManager = new SessionPersistenceManager();

      expect(() => {
        emptyManager.addMessage('user', 'Test');
      }).not.toThrow();
    });
  });

  describe('addCommand', () => {
    it('should add command to history', () => {
      manager.createSession('command-test');

      const commandEntry = {
        id: 'cmd-1',
        timestamp: new Date(),
        command: 'test',
        args: [],
        type: 'command_exec' as const,
        reversible: false,
        description: 'Run tests'
      };

      manager.addCommand(commandEntry);

      const session = manager.getCurrentSession();
      expect(session!.commandHistory).toHaveLength(1);
      expect(session!.metadata.commandCount).toBe(1);
    });
  });

  describe('addAgentUpdate', () => {
    it('should add agent update', () => {
      manager.createSession('agent-test');

      const agentUpdate = {
        agent: 'backend',
        task: 'Implement API',
        status: 'complete' as const,
        depth: 0,
        timestamp: new Date()
      };

      manager.addAgentUpdate(agentUpdate);

      const session = manager.getCurrentSession();
      expect(session!.agentUpdates).toHaveLength(1);
      expect(session!.metadata.agentCount).toBe(1);
    });
  });

  describe('updateSessionSnapshot', () => {
    it('should update session snapshot', () => {
      manager.createSession('snapshot-test');

      const snapshot = {
        name: 'test',
        workspaceRoot: '/workspace',
        branch: 'main',
        provider: 'claude',
        messagesInSession: 5,
        activeAgents: ['backend'],
        startedAt: new Date(),
        lastActionTime: new Date(),
        lastAction: 'Test',
        policyMode: 'balanced' as const,
        costToday: 0.5
      };

      manager.updateSessionSnapshot(snapshot);

      const session = manager.getCurrentSession();
      expect(session!.sessionSnapshot).toEqual(snapshot);
    });
  });

  describe('updateOutcomeTracker', () => {
    it('should update outcome tracker', () => {
      manager.createSession('outcome-test');

      const tracker = {
        sessionId: 'test',
        outcomes: []
      };

      manager.updateOutcomeTracker(tracker);

      const session = manager.getCurrentSession();
      expect(session!.outcomeTracker).toEqual(tracker);
    });
  });

  describe('enableAutoSave and disableAutoSave', () => {
    it('should enable auto-save', async () => {
      manager.createSession('autosave-test');

      manager.enableAutoSave(100); // 100ms for testing

      // Wait for auto-save to trigger
      await new Promise(resolve => setTimeout(resolve, 150));

      const sessions = manager.listSessions();
      expect(sessions).toHaveLength(1);

      manager.disableAutoSave();
    });

    it('should disable auto-save', () => {
      manager.createSession('disable-test');

      manager.enableAutoSave(1000);
      manager.disableAutoSave();

      // Auto-save should not trigger
      expect((manager as any).autoSaveInterval).toBeNull();
    });
  });

  describe('exportToMarkdown', () => {
    it('should export session to markdown', () => {
      manager.createSession('export-test', 'claude', '/workspace');

      manager.addMessage('user', 'Hello');
      manager.addMessage('assistant', 'Hi there!');

      const commandEntry = {
        id: 'cmd-1',
        timestamp: new Date(),
        command: 'test',
        args: [],
        type: 'command_exec' as const,
        reversible: false,
        description: 'Run tests'
      };
      manager.addCommand(commandEntry);

      const markdown = manager.exportToMarkdown();

      expect(markdown).toContain('# export-test');
      expect(markdown).toContain('## Conversation');
      expect(markdown).toContain('USER');
      expect(markdown).toContain('Hello');
      expect(markdown).toContain('ASSISTANT');
      expect(markdown).toContain('Hi there!');
      expect(markdown).toContain('## Command History');
      expect(markdown).toContain('Run tests');
    });

    it('should return message when no session', () => {
      const emptyManager = new SessionPersistenceManager();

      const markdown = emptyManager.exportToMarkdown();

      expect(markdown).toContain('No session to export');
    });
  });

  describe('cleanupOldSessions', () => {
    it('should delete sessions older than specified days', async () => {
      // Create old session
      const oldSession = manager.createSession('old-session');
      await manager.saveSession();

      // Manually set lastSavedAt to 31 days ago
      oldSession.lastSavedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await manager.saveSession();

      // Create recent session
      manager.createSession('recent-session');
      await manager.saveSession();

      const result = await manager.cleanupOldSessions(30);

      expect(result.deleted).toBe(1);
      expect(result.errors).toHaveLength(0);

      const sessions = manager.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('recent-session');
    });
  });

  describe('getStatistics', () => {
    it('should calculate session statistics', async () => {
      manager.createSession('session1');
      manager.addMessage('user', 'Message 1');
      manager.addMessage('user', 'Message 2');
      await manager.saveSession();

      manager.createSession('session2');
      manager.addMessage('user', 'Message 3');
      await manager.saveSession();

      const stats = manager.getStatistics();

      expect(stats.totalSessions).toBe(2);
      expect(stats.averageMessages).toBe(2); // (2 + 1) / 2 = 1.5 -> 2 rounded
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should return zeros when no sessions', () => {
      const stats = manager.getStatistics();

      expect(stats.totalSessions).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageMessages).toBe(0);
    });
  });
});

describe('renderSessionList', () => {
  it('should render session list', () => {
    const sessions: SessionListEntry[] = [
      {
        id: 'session-1',
        name: 'Test Session 1',
        createdAt: new Date('2024-01-01'),
        lastSavedAt: new Date('2024-01-02'),
        messageCount: 10,
        size: 1024
      },
      {
        id: 'session-2',
        name: 'Test Session 2',
        createdAt: new Date('2024-01-03'),
        lastSavedAt: new Date('2024-01-04'),
        messageCount: 5,
        size: 512
      }
    ];

    const rendered = renderSessionList(sessions);

    expect(rendered).toContain('Saved Sessions');
    expect(rendered).toContain('Test Session 1');
    expect(rendered).toContain('Test Session 2');
    expect(rendered).toContain('10 messages');
    expect(rendered).toContain('5 messages');
  });

  it('should render message when no sessions', () => {
    const rendered = renderSessionList([]);

    expect(rendered).toContain('No saved sessions');
  });
});

describe('Edge Cases', () => {
  let manager: SessionPersistenceManager;
  let testSessionsDir: string;

  beforeEach(() => {
    testSessionsDir = join(process.cwd(), '.test-sessions-edge');
    manager = new SessionPersistenceManager();
    (manager as any).sessionsDir = testSessionsDir;

    if (!existsSync(testSessionsDir)) {
      mkdirSync(testSessionsDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up
    if (existsSync(testSessionsDir)) {
      const files = readdirSync(testSessionsDir);
      files.forEach(file => {
        try {
          unlinkSync(join(testSessionsDir, file));
        } catch (error) {
          // Ignore
        }
      });
      try {
        rmdirSync(testSessionsDir);
      } catch (error) {
        // Ignore
      }
    }

    manager.disableAutoSave();
  });

  it('should handle very long session names', async () => {
    const longName = 'A'.repeat(500);
    const session = manager.createSession(longName);

    await manager.saveSession();

    const result = await manager.loadSession(session.id);
    expect(result.success).toBe(true);
    expect(result.session!.name).toBe(longName);
  });

  it('should handle sessions with many messages', async () => {
    manager.createSession('large-session');

    // Add 1000 messages
    for (let i = 0; i < 1000; i++) {
      manager.addMessage('user', `Message ${i}`);
    }

    const result = await manager.saveSession();
    expect(result.success).toBe(true);

    const newManager = new SessionPersistenceManager();
    (newManager as any).sessionsDir = testSessionsDir;

    const loadResult = await newManager.loadSession(manager.getCurrentSession()!.id);
    expect(loadResult.success).toBe(true);
    expect(loadResult.session!.conversationHistory).toHaveLength(1000);
  });

  it('should handle special characters in messages', async () => {
    manager.createSession('special-chars');

    manager.addMessage('user', 'Test with "quotes" and \n newlines \t tabs');

    await manager.saveSession();

    const newManager = new SessionPersistenceManager();
    (newManager as any).sessionsDir = testSessionsDir;

    const result = await newManager.loadSession(manager.getCurrentSession()!.id);
    expect(result.session!.conversationHistory[0].content).toContain('quotes');
  });

  it('should handle concurrent save operations', async () => {
    manager.createSession('concurrent');

    // Trigger multiple saves concurrently
    const promises = [
      manager.saveSession(),
      manager.saveSession(),
      manager.saveSession()
    ];

    const results = await Promise.all(promises);

    // All should succeed
    results.forEach(result => {
      expect(result.success).toBe(true);
    });
  });

  it('should handle corrupted session files gracefully', async () => {
    const corruptedFile = join(testSessionsDir, 'corrupted-session.json');
    require('fs').writeFileSync(corruptedFile, 'invalid json {{{');

    const sessions = manager.listSessions();

    // Should skip corrupted file
    expect(sessions).toEqual([]);
  });
});
