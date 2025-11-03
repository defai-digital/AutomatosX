/**
 * Unit tests for ConversationManager
 * Tests conversation state, persistence, and export functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationManager } from '../../../packages/cli-interactive/src/conversation.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConversationManager', () => {
  let manager: ConversationManager;
  let testDir: string;

  beforeEach(async () => {
    // Create temp directory for test conversations
    testDir = join(tmpdir(), `ax-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    manager = new ConversationManager({
      conversationsDir: testDir,
      autoSaveInterval: 0, // Disable auto-save for tests
      maxMessages: 100
    });
  });

  afterEach(async () => {
    // Cleanup
    manager.stopAutoSave();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('message management', () => {
    it('should start with empty conversation', () => {
      const conv = manager.getConversation();
      expect(conv.messages).toHaveLength(0);
      expect(conv.id).toBeDefined();
      expect(conv.createdAt).toBeDefined();
    });

    it('should add user messages', () => {
      manager.addMessage('user', 'Hello', {});

      const conv = manager.getConversation();
      expect(conv.messages).toHaveLength(1);
      expect(conv.messages[0]!.role).toBe('user');
      expect(conv.messages[0]!.content).toBe('Hello');
    });

    it('should add assistant messages', () => {
      manager.addMessage('assistant', 'Hi there!', {
        tokens: 10,
        provider: 'test'
      });

      const conv = manager.getConversation();
      expect(conv.messages).toHaveLength(1);
      expect(conv.messages[0]!.role).toBe('assistant');
      expect(conv.messages[0]!.tokens).toBe(10);
    });

    it('should maintain message order', () => {
      manager.addMessage('user', 'First');
      manager.addMessage('assistant', 'Second');
      manager.addMessage('user', 'Third');

      const conv = manager.getConversation();
      expect(conv.messages).toHaveLength(3);
      expect(conv.messages[0]!.content).toBe('First');
      expect(conv.messages[1]!.content).toBe('Second');
      expect(conv.messages[2]!.content).toBe('Third');
    });

    it('should include timestamps for messages', () => {
      manager.addMessage('user', 'Test', {});

      const conv = manager.getConversation();
      expect(conv.messages[0]!.timestamp).toBeDefined();
      expect(typeof conv.messages[0]!.timestamp).toBe('number');
    });

    it('should update conversation updatedAt timestamp', async () => {
      const conv1 = manager.getConversation();
      const firstUpdate = conv1.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      manager.addMessage('user', 'Test', {});
      const conv2 = manager.getConversation();

      expect(conv2.updatedAt).not.toBe(firstUpdate);
    });
  });

  describe('context management', () => {
    it('should get context with default limit', () => {
      for (let i = 0; i < 30; i++) {
        manager.addMessage('user', `Message ${i}`, {});
      }

      const context = manager.getContext();
      expect(context.length).toBeLessThanOrEqual(20); // Default limit
    });

    it('should get context with custom limit', () => {
      for (let i = 0; i < 30; i++) {
        manager.addMessage('user', `Message ${i}`, {});
      }

      const context = manager.getContext(10);
      expect(context).toHaveLength(10);
    });

    it('should return most recent messages', () => {
      for (let i = 0; i < 30; i++) {
        manager.addMessage('user', `Message ${i}`, {});
      }

      const context = manager.getContext(5);
      expect(context[context.length - 1]!.content).toBe('Message 29');
      expect(context[0]!.content).toBe('Message 25');
    });

    it('should handle limit larger than message count', () => {
      manager.addMessage('user', 'Only message', {});

      const context = manager.getContext(100);
      expect(context).toHaveLength(1);
    });
  });

  describe('conversation clearing', () => {
    it('should clear all messages', () => {
      manager.addMessage('user', 'Test 1', {});
      manager.addMessage('assistant', 'Test 2', {});

      manager.clear();

      const conv = manager.getConversation();
      expect(conv.messages).toHaveLength(0);
    });

    it('should generate new conversation ID after clear', () => {
      const conv1 = manager.getConversation();
      const oldId = conv1.id;

      manager.clear();

      const conv2 = manager.getConversation();
      expect(conv2.id).not.toBe(oldId);
    });

    it('should reset timestamps after clear', async () => {
      manager.addMessage('user', 'Test', {});
      const conv1 = manager.getConversation();
      const oldCreatedAt = conv1.createdAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      manager.clear();

      const conv2 = manager.getConversation();
      expect(conv2.createdAt).not.toBe(oldCreatedAt);
    });
  });

  describe('statistics', () => {
    it('should calculate message counts', () => {
      manager.addMessage('user', 'User 1', {});
      manager.addMessage('assistant', 'Assistant 1', {});
      manager.addMessage('user', 'User 2', {});

      const stats = manager.getStats();
      expect(stats.messageCount).toBe(3);
    });

    it('should calculate total tokens', () => {
      manager.addMessage('user', 'Test', { tokens: 10 });
      manager.addMessage('assistant', 'Response', { tokens: 20 });
      manager.addMessage('user', 'More', { tokens: 15 });

      const stats = manager.getStats();
      expect(stats.totalTokens).toBe(45);
    });

    it('should handle missing token metadata', () => {
      manager.addMessage('user', 'No tokens', {});
      manager.addMessage('assistant', 'Also no tokens', {});

      const stats = manager.getStats();
      expect(stats.totalTokens).toBe(0);
    });

    it('should calculate conversation duration', async () => {
      const conv1 = manager.getConversation();

      await new Promise(resolve => setTimeout(resolve, 50));
      manager.addMessage('user', 'Test', {});

      const stats = manager.getStats();
      expect(stats.duration).toBeGreaterThan(0);
    });
  });

  describe('persistence - save/load', () => {
    it('should save conversation to file', async () => {
      manager.addMessage('user', 'Test message', {});

      const filename = await manager.saveAs('test-save');
      expect(filename).toContain('test-save');

      const files = await fs.readdir(testDir);
      expect(files.some(f => f.includes('test-save'))).toBe(true);
    });

    it('should load conversation from file', async () => {
      manager.addMessage('user', 'Original message', {});
      manager.addMessage('assistant', 'Original response', {});

      const filename = await manager.saveAs('test-load');

      // Create new manager and load
      const manager2 = new ConversationManager({
        conversationsDir: testDir,
        autoSaveInterval: 0
      });

      // Use relative filename (not absolute path) for security
      await manager2.loadFromFile(filename);

      const conv = manager2.getConversation();
      expect(conv.messages).toHaveLength(2);
      expect(conv.messages[0]!.content).toBe('Original message');
      expect(conv.messages[1]!.content).toBe('Original response');
    });

    it('should preserve metadata on save/load', async () => {
      manager.addMessage('user', 'Test', {
        tokens: 42,
        provider: 'test-provider'
      });

      const filename = await manager.saveAs('test-metadata');

      const manager2 = new ConversationManager({
        conversationsDir: testDir,
        autoSaveInterval: 0
      });

      // Use relative filename (not absolute path) for security
      await manager2.loadFromFile(filename);

      const conv = manager2.getConversation();
      expect(conv.messages[0]!.tokens).toBe(42);
      expect(conv.messages[0]!.provider).toBe('test-provider');
    });

    it('should sanitize filenames', async () => {
      const filename = await manager.saveAs('test/with\\invalid:chars*');

      expect(filename).not.toContain('/');
      expect(filename).not.toContain('\\');
      expect(filename).not.toContain(':');
      expect(filename).not.toContain('*');
    });
  });

  describe('conversation listing', () => {
    it('should list saved conversations', async () => {
      await manager.saveAs('conv1');
      await manager.saveAs('conv2');
      await manager.saveAs('conv3');

      const list = await manager.listConversations();
      expect(list.length).toBeGreaterThanOrEqual(3);
    });

    it('should include conversation metadata in list', async () => {
      manager.addMessage('user', 'Test', {});
      await manager.saveAs('test-list');

      const list = await manager.listConversations();
      const conv = list.find(c => c.name?.includes('test-list'));

      expect(conv).toBeDefined();
      expect(conv?.messageCount).toBeGreaterThan(0);
      expect(conv?.updatedAt).toBeDefined();
    });

    it('should sort conversations by update time', async () => {
      await manager.saveAs('first');
      await new Promise(resolve => setTimeout(resolve, 10));
      await manager.saveAs('second');
      await new Promise(resolve => setTimeout(resolve, 10));
      await manager.saveAs('third');

      const list = await manager.listConversations();

      // Should be sorted newest first
      const indices = list.map((c, i) => ({ name: c.name, index: i }));
      const third = indices.find(x => x.name?.includes('third'));
      const first = indices.find(x => x.name?.includes('first'));

      if (third && first) {
        expect(third.index).toBeLessThan(first.index);
      }
    });
  });

  describe('conversation deletion', () => {
    it('should delete conversation file', async () => {
      const filename = await manager.saveAs('to-delete');

      await manager.deleteConversation(filename);

      const files = await fs.readdir(testDir);
      expect(files.includes(filename)).toBe(false);
    });

    it('should handle deleting non-existent file', async () => {
      // Should not throw
      await expect(manager.deleteConversation('non-existent.json')).resolves.not.toThrow();
    });
  });

  describe('markdown export', () => {
    it('should export conversation to markdown', () => {
      manager.addMessage('user', 'Question?', {});
      manager.addMessage('assistant', 'Answer!', {});

      const markdown = manager.exportToMarkdown();

      expect(markdown).toContain('# Conversation');
      expect(markdown).toContain('Question?');
      expect(markdown).toContain('Answer!');
      expect(markdown).toContain('**User:**');
      expect(markdown).toContain('**Assistant:**');
    });

    it('should save markdown to file', async () => {
      manager.addMessage('user', 'Test', {});

      const filename = await manager.exportToMarkdownFile();

      const files = await fs.readdir(testDir);
      expect(files.some(f => f === filename)).toBe(true);
      expect(filename).toContain('.md');
    });

    it('should include timestamps in export', () => {
      manager.addMessage('user', 'Test', {});

      const markdown = manager.exportToMarkdown();
      expect(markdown).toMatch(/\d{4}-\d{2}-\d{2}/); // Date format
    });

    it('should handle empty conversations', () => {
      const markdown = manager.exportToMarkdown();

      expect(markdown).toContain('# Conversation');
      expect(markdown).toContain('No messages');
    });
  });

  describe('auto-save', () => {
    it('should not auto-save when interval is 0', async () => {
      const managerNoAuto = new ConversationManager({
        conversationsDir: testDir,
        autoSaveInterval: 0
      });

      managerNoAuto.addMessage('user', 'Test', {});

      await new Promise(resolve => setTimeout(resolve, 100));

      const files = await fs.readdir(testDir);
      // No auto-save files should be created
      expect(files.length).toBe(0);

      managerNoAuto.stopAutoSave();
    });

    it('should stop auto-save timer', () => {
      const managerWithAuto = new ConversationManager({
        conversationsDir: testDir,
        autoSaveInterval: 1000
      });

      // Should not throw
      expect(() => managerWithAuto.stopAutoSave()).not.toThrow();
    });
  });
});
