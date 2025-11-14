/**
 * Integration tests for Memory Service Layer (Phase 1 Week 2)
 * Tests MemoryService, ConversationManager, MemoryCache, MemoryAnalytics, and MemoryExporter
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { MemoryService } from '../MemoryService.js';
import { ConversationManager } from '../ConversationManager.js';
import { MemoryCache } from '../MemoryCache.js';
import { MemoryAnalytics } from '../MemoryAnalytics.js';
import { MemoryExporter } from '../MemoryExporter.js';

describe('Memory Service Layer Integration', () => {
  let db: Database.Database;
  let memoryService: MemoryService;
  let conversationManager: ConversationManager;
  let memoryCache: MemoryCache;
  let memoryAnalytics: MemoryAnalytics;
  let memoryExporter: MemoryExporter;

  beforeAll(() => {
    // Create in-memory database
    db = new Database(':memory:');

    // Apply migration 008
    const migrationSQL = readFileSync(
      join(process.cwd(), 'src/migrations/008_create_memory_system.sql'),
      'utf-8'
    );

    db.exec(migrationSQL);

    // Initialize services
    memoryService = new MemoryService(db);
    conversationManager = new ConversationManager(memoryService);
    memoryCache = new MemoryCache({ maxSize: 100, ttlMs: 60000 });
    memoryAnalytics = new MemoryAnalytics(memoryService);
    memoryExporter = new MemoryExporter(memoryService);
  });

  afterAll(() => {
    conversationManager.destroy();
    db.close();
  });

  beforeEach(() => {
    // Clear data
    db.exec('DELETE FROM messages');
    db.exec('DELETE FROM conversations');
    memoryCache.clear();
    memoryCache.resetStats();
    memoryAnalytics.clearEvents();
  });

  // ==========================================================================
  // MemoryService Tests
  // ==========================================================================

  describe('MemoryService', () => {
    it('should create and retrieve conversation', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Test Conversation',
      });

      expect(conversation.id).toBeDefined();
      expect(conversation.agentId).toBe('backend');
      expect(conversation.title).toBe('Test Conversation');

      const retrieved = await memoryService.getConversation(conversation.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(conversation.id);
    });

    it('should create and retrieve conversation with messages', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Test',
      });

      await memoryService.addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'Hello',
        tokens: 1,
      });

      await memoryService.addMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Hi there!',
        tokens: 2,
      });

      const convWithMessages = await memoryService.getConversationWithMessages(
        conversation.id
      );

      expect(convWithMessages).not.toBeNull();
      expect(convWithMessages!.messages).toHaveLength(2);
      expect(convWithMessages!.messageCount).toBe(2);
      expect(convWithMessages!.totalTokens).toBe(3);
    });

    it('should search messages using FTS5', async () => {
      const conv = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Test',
      });

      await memoryService.addMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'How do I create a REST API?',
      });

      await memoryService.addMessage({
        conversationId: conv.id,
        role: 'assistant',
        content: 'To create a REST API, use Express framework.',
      });

      const results = await memoryService.searchMessagesByQuery('REST API');

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.every((m) => m.content.includes('REST API'))).toBe(true);
    });

    it('should list conversations with pagination', async () => {
      // Create 5 conversations
      for (let i = 0; i < 5; i++) {
        await memoryService.createConversation({
          agentId: 'backend',
          title: `Conversation ${i}`,
        });
      }

      const result = await memoryService.listConversations({
        limit: 3,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.total).toBe(5);
      expect(result.conversations).toHaveLength(3);
      expect(result.hasMore).toBe(true);
    });

    it('should archive and restore conversation', async () => {
      const conv = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Test',
      });

      await memoryService.archiveConversation(conv.id);

      const archived = await memoryService.getConversation(conv.id);
      expect(archived!.state).toBe('archived');
      expect(archived!.archivedAt).toBeDefined();

      await memoryService.restoreConversation(conv.id);

      const restored = await memoryService.getConversation(conv.id);
      expect(restored!.state).toBe('active');
      expect(restored!.archivedAt).toBeUndefined();
    });

    it('should get memory statistics', async () => {
      // Create test data
      const conv1 = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Conv 1',
      });
      const conv2 = await memoryService.createConversation({
        agentId: 'frontend',
        title: 'Conv 2',
      });

      await memoryService.addMessage({
        conversationId: conv1.id,
        role: 'user',
        content: 'Test 1',
        tokens: 10,
      });
      await memoryService.addMessage({
        conversationId: conv2.id,
        role: 'user',
        content: 'Test 2',
        tokens: 20,
      });

      const stats = await memoryService.getMemoryStats();

      expect(stats.totalConversations).toBe(2);
      expect(stats.totalMessages).toBe(2);
      expect(stats.totalTokens).toBe(30);
    });
  });

  // ==========================================================================
  // ConversationManager Tests
  // ==========================================================================

  describe('ConversationManager', () => {
    it('should start and track active conversation', async () => {
      const conversation = await conversationManager.startConversation({
        agentId: 'backend',
        title: 'Active Conversation',
      });

      expect(conversationManager.isConversationActive(conversation.id)).toBe(true);
      expect(conversationManager.getActiveConversationCount()).toBe(1);

      const activeConversations = conversationManager.getActiveConversations();
      expect(activeConversations).toHaveLength(1);
      expect(activeConversations[0].conversation.id).toBe(conversation.id);
    });

    it('should end conversation and remove from active tracking', async () => {
      const conversation = await conversationManager.startConversation({
        agentId: 'backend',
        title: 'Test',
      });

      await conversationManager.endConversation(conversation.id);

      expect(conversationManager.isConversationActive(conversation.id)).toBe(false);
      expect(conversationManager.getActiveConversationCount()).toBe(0);
    });

    it('should resume existing conversation', async () => {
      const conversation = await conversationManager.startConversation({
        agentId: 'backend',
        title: 'Test',
      });

      await conversationManager.addMessage(conversation.id, {
        conversationId: conversation.id,
        role: 'user',
        content: 'Hello',
      });

      await conversationManager.endConversation(conversation.id);
      expect(conversationManager.isConversationActive(conversation.id)).toBe(false);

      const resumed = await conversationManager.resumeConversation(conversation.id);
      expect(resumed).not.toBeNull();
      expect(resumed!.messages).toHaveLength(1);
      expect(conversationManager.isConversationActive(conversation.id)).toBe(true);
    });

    it('should evict oldest conversation when max limit reached', async () => {
      const manager = new ConversationManager(memoryService, {
        maxActiveConversations: 2,
      });

      const conv1 = await manager.startConversation({
        agentId: 'backend',
        title: 'Conv 1',
      });
      const conv2 = await manager.startConversation({
        agentId: 'backend',
        title: 'Conv 2',
      });

      expect(manager.getActiveConversationCount()).toBe(2);

      // This should evict conv1
      const conv3 = await manager.startConversation({
        agentId: 'backend',
        title: 'Conv 3',
      });

      expect(manager.getActiveConversationCount()).toBe(2);
      expect(manager.isConversationActive(conv1.id)).toBe(false);
      expect(manager.isConversationActive(conv3.id)).toBe(true);

      manager.destroy();
    });

    it('should get statistics', async () => {
      const conv1 = await conversationManager.startConversation({
        agentId: 'backend',
        title: 'Conv 1',
      });
      await conversationManager.addMessage(conv1.id, {
        conversationId: conv1.id,
        role: 'user',
        content: 'Message 1',
      });

      const conv2 = await conversationManager.startConversation({
        agentId: 'frontend',
        title: 'Conv 2',
      });
      await conversationManager.addMessage(conv2.id, {
        conversationId: conv2.id,
        role: 'user',
        content: 'Message 2',
      });
      await conversationManager.addMessage(conv2.id, {
        conversationId: conv2.id,
        role: 'assistant',
        content: 'Reply 2',
      });

      const stats = conversationManager.getStatistics();

      expect(stats.activeCount).toBe(2);
      expect(stats.totalMessages).toBe(3);
      expect(stats.averageMessagesPerConversation).toBe(1.5);
    });
  });

  // ==========================================================================
  // MemoryCache Tests
  // ==========================================================================

  describe('MemoryCache', () => {
    it('should cache and retrieve conversation', () => {
      const conversation = {
        id: 'conv-123',
        agentId: 'backend',
        userId: undefined,
        title: 'Test',
        state: 'active' as const,
        messageCount: 0,
        totalTokens: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      memoryCache.setConversation(conversation.id, conversation);

      const cached = memoryCache.getConversation(conversation.id);
      expect(cached).not.toBeNull();
      expect(cached!.id).toBe(conversation.id);

      const stats = memoryCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should track cache hits and misses', () => {
      memoryCache.getConversation('non-existent');
      memoryCache.getConversation('non-existent');

      const stats = memoryCache.getStats();
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should expire entries after TTL', async () => {
      const cache = new MemoryCache({ maxSize: 100, ttlMs: 50 }); // 50ms TTL

      const conversation = {
        id: 'conv-123',
        agentId: 'backend',
        userId: undefined,
        title: 'Test',
        state: 'active' as const,
        messageCount: 0,
        totalTokens: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      cache.setConversation(conversation.id, conversation);

      // Should be cached
      let cached = cache.getConversation(conversation.id);
      expect(cached).not.toBeNull();

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Should be expired
      cached = cache.getConversation(conversation.id);
      expect(cached).toBeNull();
    });

    it('should evict LRU entry when max size reached', () => {
      const cache = new MemoryCache({ maxSize: 2, ttlMs: 60000 });

      const conv1 = {
        id: 'conv-1',
        agentId: 'backend',
        userId: undefined,
        title: 'Conv 1',
        state: 'active' as const,
        messageCount: 0,
        totalTokens: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const conv2 = {
        id: 'conv-2',
        agentId: 'backend',
        userId: undefined,
        title: 'Conv 2',
        state: 'active' as const,
        messageCount: 0,
        totalTokens: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const conv3 = {
        id: 'conv-3',
        agentId: 'backend',
        userId: undefined,
        title: 'Conv 3',
        state: 'active' as const,
        messageCount: 0,
        totalTokens: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      cache.setConversation(conv1.id, conv1);
      cache.setConversation(conv2.id, conv2);

      // This should evict conv1
      cache.setConversation(conv3.id, conv3);

      expect(cache.getConversation(conv1.id)).toBeNull();
      expect(cache.getConversation(conv2.id)).not.toBeNull();
      expect(cache.getConversation(conv3.id)).not.toBeNull();
    });

    it('should invalidate conversation cache', () => {
      const conversation = {
        id: 'conv-123',
        agentId: 'backend',
        userId: undefined,
        title: 'Test',
        state: 'active' as const,
        messageCount: 0,
        totalTokens: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      memoryCache.setConversation(conversation.id, conversation);
      expect(memoryCache.getConversation(conversation.id)).not.toBeNull();

      memoryCache.invalidateConversation(conversation.id);
      expect(memoryCache.getConversation(conversation.id)).toBeNull();
    });
  });

  // ==========================================================================
  // MemoryAnalytics Tests
  // ==========================================================================

  describe('MemoryAnalytics', () => {
    it('should track events', () => {
      memoryAnalytics.trackConversationCreated('conv-1', 'backend');
      memoryAnalytics.trackMessageAdded('conv-1', 'backend', 10);
      memoryAnalytics.trackSearchPerformed('test query', 5);

      const events = memoryAnalytics.getRecentEvents();
      expect(events).toHaveLength(3);

      const eventCounts = memoryAnalytics.getEventCounts();
      expect(eventCounts['conversation_created']).toBe(1);
      expect(eventCounts['message_added']).toBe(1);
      expect(eventCounts['search_performed']).toBe(1);
    });

    it('should get conversation metrics', async () => {
      const conv = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Test',
      });

      await memoryService.addMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'Hello',
        tokens: 10,
      });

      await memoryService.addMessage({
        conversationId: conv.id,
        role: 'assistant',
        content: 'Hi',
        tokens: 5,
      });

      const metrics = await memoryAnalytics.getConversationMetrics(conv.id);

      expect(metrics).not.toBeNull();
      expect(metrics!.messageCount).toBe(2);
      expect(metrics!.totalTokens).toBe(15);
      expect(metrics!.averageTokensPerMessage).toBe(7.5);
    });

    it('should get agent metrics', async () => {
      const conv1 = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Conv 1',
      });
      await memoryService.addMessage({
        conversationId: conv1.id,
        role: 'user',
        content: 'Test 1',
        tokens: 10,
      });

      const conv2 = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Conv 2',
      });
      await memoryService.addMessage({
        conversationId: conv2.id,
        role: 'user',
        content: 'Test 2',
        tokens: 20,
      });

      const metrics = await memoryAnalytics.getAgentMetrics('backend');

      expect(metrics.agentId).toBe('backend');
      expect(metrics.conversationCount).toBe(2);
      expect(metrics.totalMessages).toBe(2);
      expect(metrics.totalTokens).toBe(30);
    });

    it('should get memory usage metrics', async () => {
      const conv = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Test',
      });
      await memoryService.addMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'Test',
        tokens: 10,
      });

      const metrics = await memoryAnalytics.getMemoryUsageMetrics();

      expect(metrics.totalConversations).toBe(1);
      expect(metrics.totalMessages).toBe(1);
      expect(metrics.totalTokens).toBe(10);
      expect(metrics.storageEstimateMB).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // MemoryExporter Tests
  // ==========================================================================

  describe('MemoryExporter', () => {
    it('should export conversations to JSON', async () => {
      const conv = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Test Conversation',
      });

      await memoryService.addMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'Hello',
        tokens: 1,
      });

      const exportPath = '/tmp/test-export.json';
      const result = await memoryExporter.exportToJSON(exportPath);

      expect(result.format).toBe('json');
      expect(result.conversationCount).toBe(1);
      expect(result.messageCount).toBe(1);
      expect(result.sizeBytes).toBeGreaterThan(0);

      // Clean up
      try {
        unlinkSync(exportPath);
      } catch (e) {
        // File may not exist
      }
    });

    it('should export conversations to Markdown', async () => {
      const conv = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Test Conversation',
      });

      await memoryService.addMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'Hello',
      });

      const exportPath = '/tmp/test-export.md';
      const result = await memoryExporter.exportToMarkdown(exportPath);

      expect(result.format).toBe('markdown');
      expect(result.conversationCount).toBe(1);
      expect(result.messageCount).toBe(1);

      // Clean up
      try {
        unlinkSync(exportPath);
      } catch (e) {
        // File may not exist
      }
    });

    it('should create and restore backup', async () => {
      // Create test data
      const conv = await memoryService.createConversation({
        agentId: 'backend',
        title: 'Test',
      });

      await memoryService.addMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'Hello',
      });

      // Create backup
      const backupPath = '/tmp/test-backup.json';
      const exportResult = await memoryExporter.createBackup(backupPath);

      expect(exportResult.conversationCount).toBe(1);

      // Clear database
      db.exec('DELETE FROM messages');
      db.exec('DELETE FROM conversations');

      // Restore backup
      const importResult = await memoryExporter.restoreBackup(backupPath);

      expect(importResult.conversationsImported).toBe(1);
      expect(importResult.messagesImported).toBe(1);
      expect(importResult.errors).toHaveLength(0);

      // Verify restored data
      const conversations = await memoryService.listConversations({
        limit: 10,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(conversations.total).toBe(1);

      // Clean up
      try {
        unlinkSync(backupPath);
      } catch (e) {
        // File may not exist
      }
    });
  });
});
