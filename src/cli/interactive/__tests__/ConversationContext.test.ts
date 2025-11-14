/**
 * AutomatosX v8.0.0 - ConversationContext Tests
 *
 * Tests for in-memory conversation management and SQLite persistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ConversationContext } from '../ConversationContext.js';

describe('ConversationContext', () => {
  let db: Database.Database;
  let context: ConversationContext;
  const TEST_USER_ID = 'test-user';

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Create minimal schema for testing (without vec0 extension)
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        state TEXT DEFAULT 'active',
        message_count INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        archived_at INTEGER,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        tokens INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    `);

    // Create fresh context
    context = new ConversationContext(db, TEST_USER_ID);
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  describe('Conversation Creation', () => {
    it('should create new conversation with unique ID', () => {
      const conversationId = context.getConversationId();

      expect(conversationId).toBeDefined();
      expect(typeof conversationId).toBe('string');
      expect(conversationId.length).toBeGreaterThan(0);

      // Each new context should have unique ID
      const context2 = new ConversationContext(db, TEST_USER_ID);
      expect(context2.getConversationId()).not.toBe(conversationId);
    });

    it('should initialize with zero messages', () => {
      expect(context.getMessageCount()).toBe(0);
      expect(context.getMessages()).toEqual([]);
    });

    it('should initialize with no active agent or workflow', () => {
      expect(context.getActiveAgent()).toBeUndefined();
      expect(context.getActiveWorkflow()).toBeUndefined();
    });
  });

  describe('Message Management', () => {
    it('should add and retrieve messages', () => {
      // Add user message
      const msg1 = context.addMessage('user', 'Hello, AI!');
      expect(msg1.role).toBe('user');
      expect(msg1.content).toBe('Hello, AI!');
      expect(msg1.conversationId).toBe(context.getConversationId());
      expect(context.getMessageCount()).toBe(1);

      // Add assistant message
      const msg2 = context.addMessage('assistant', 'Hello! How can I help?');
      expect(msg2.role).toBe('assistant');
      expect(context.getMessageCount()).toBe(2);

      // Retrieve all messages
      const messages = context.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Hello, AI!');
      expect(messages[1].content).toBe('Hello! How can I help?');
    });

    it('should get recent messages with limit', () => {
      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        context.addMessage('user', `Message ${i}`);
      }

      expect(context.getMessageCount()).toBe(10);

      // Get recent 5 messages
      const recent = context.getRecentMessages(5);
      expect(recent).toHaveLength(5);
      expect(recent[0].content).toBe('Message 5'); // Most recent first
      expect(recent[4].content).toBe('Message 9');
    });

    it('should track message timestamps', () => {
      const before = new Date();
      const msg = context.addMessage('user', 'Test message');
      const after = new Date();

      expect(msg.timestamp).toBeInstanceOf(Date);
      expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(msg.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should assign unique IDs to messages', () => {
      const msg1 = context.addMessage('user', 'Message 1');
      const msg2 = context.addMessage('user', 'Message 2');

      expect(msg1.id).toBeDefined();
      expect(msg2.id).toBeDefined();
      expect(msg1.id).not.toBe(msg2.id);
    });
  });

  describe('Agent and Workflow Management', () => {
    it('should set and get active agent', () => {
      context.setActiveAgent('BackendAgent');
      expect(context.getActiveAgent()).toBe('BackendAgent');

      // Change agent
      context.setActiveAgent('FrontendAgent');
      expect(context.getActiveAgent()).toBe('FrontendAgent');
    });

    it('should clear active agent', () => {
      context.setActiveAgent('BackendAgent');
      expect(context.getActiveAgent()).toBe('BackendAgent');

      context.setActiveAgent(undefined);
      expect(context.getActiveAgent()).toBeUndefined();
    });

    it('should set and get active workflow', () => {
      context.setActiveWorkflow('code-review');
      expect(context.getActiveWorkflow()).toBe('code-review');

      context.setActiveWorkflow(undefined);
      expect(context.getActiveWorkflow()).toBeUndefined();
    });
  });

  describe('Variables Management', () => {
    it('should set and get variables', () => {
      context.setVariable('language', 'TypeScript');
      context.setVariable('maxTokens', 1000);

      expect(context.getVariable('language')).toBe('TypeScript');
      expect(context.getVariable('maxTokens')).toBe(1000);

      const allVars = context.getVariables();
      expect(allVars).toEqual({
        language: 'TypeScript',
        maxTokens: 1000
      });
    });

    it('should return undefined for non-existent variable', () => {
      expect(context.getVariable('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing variables', () => {
      context.setVariable('language', 'TypeScript');
      context.setVariable('language', 'JavaScript');

      expect(context.getVariable('language')).toBe('JavaScript');
    });
  });

  describe('Snapshot and Restore', () => {
    it('should create and restore from snapshot', () => {
      // Build some state
      context.addMessage('user', 'Question 1');
      context.addMessage('assistant', 'Answer 1');
      context.setActiveAgent('BackendAgent');
      context.setVariable('test', 'value');

      // Create snapshot
      const snapshot = context.getSnapshot();

      expect(snapshot.conversationId).toBe(context.getConversationId());
      expect(snapshot.messages).toHaveLength(2);
      expect(snapshot.activeAgent).toBe('BackendAgent');
      expect(snapshot.variables).toEqual({ test: 'value' });

      // Create new context and restore
      const newContext = new ConversationContext(db, TEST_USER_ID);
      newContext.restoreFromSnapshot(snapshot);

      expect(newContext.getConversationId()).toBe(snapshot.conversationId);
      expect(newContext.getMessageCount()).toBe(2);
      expect(newContext.getActiveAgent()).toBe('BackendAgent');
      expect(newContext.getVariable('test')).toBe('value');
    });
  });

  describe('SQLite Persistence', () => {
    it('should call saveToDB without errors', async () => {
      // Add some state
      context.addMessage('user', 'Hello');
      context.addMessage('assistant', 'Hi there!');
      context.setActiveAgent('TestAgent');

      // Save to DB should not throw
      await expect(context.saveToDB()).resolves.not.toThrow();
    });

    it('should return null for non-existent conversation', async () => {
      const loaded = await ConversationContext.loadFromDB(db, 'non-existent-id');
      expect(loaded).toBeNull();
    });

    // Note: Full DAO integration tests are deferred as they require
    // the complete migration stack including vec0 extension.
    // The persistence logic is tested in integration tests with real database.
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      // Close database to force error
      db.close();

      // Should not throw
      await expect(context.saveToDB()).resolves.not.toThrow();

      // Conversation should still be in memory
      expect(context.getMessageCount()).toBe(0);
    });

    it('should handle invalid snapshot gracefully', () => {
      const invalidSnapshot = {
        conversationId: 'test',
        userId: 'user',
        messages: [],
        activeAgent: null,
        activeWorkflow: null,
        variables: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Should not throw
      expect(() => context.restoreFromSnapshot(invalidSnapshot)).not.toThrow();
    });
  });
});
