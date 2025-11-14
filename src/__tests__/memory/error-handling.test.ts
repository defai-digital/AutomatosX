/**
 * error-handling.test.ts
 *
 * Comprehensive error handling tests for Memory System
 * Tests database failures, invalid inputs, edge cases
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { MemoryService } from '../../memory/MemoryService.js';
import { ConversationDAO } from '../../database/dao/ConversationDAO.js';
import { MessageDAO } from '../../database/dao/MessageDAO.js';
import { MemoryCache } from '../../memory/MemoryCache.js';
import { MemoryExporter } from '../../memory/MemoryExporter.js';

describe('Memory System Error Handling', () => {
  let db: Database.Database;
  let memoryService: MemoryService;

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
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    // Clear data
    db.exec('DELETE FROM messages');
    db.exec('DELETE FROM conversations');
  });

  // ============================================================================
  // Input Validation
  // ============================================================================

  describe('Input Validation', () => {
    it('should reject conversation with empty agentId', async () => {
      await expect(
        memoryService.createConversation({
          agentId: '',
          title: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should reject conversation with empty title', async () => {
      await expect(
        memoryService.createConversation({
          agentId: 'test-agent',
          title: '',
        })
      ).rejects.toThrow();
    });

    it('should reject message with empty conversationId', async () => {
      await expect(
        memoryService.addMessage({
          conversationId: '',
          role: 'user',
          content: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should reject message with empty content', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      await expect(
        memoryService.addMessage({
          conversationId: conversation.id,
          role: 'user',
          content: '',
        })
      ).rejects.toThrow();
    });

    it('should reject message with invalid role', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      await expect(
        memoryService.addMessage({
          conversationId: conversation.id,
          role: 'invalid' as any,
          content: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should reject search with empty query', async () => {
      await expect(
        memoryService.searchMessages({
          query: '',
          limit: 10,
          offset: 0,
          sortBy: 'relevance',
          sortOrder: 'desc',
        })
      ).rejects.toThrow();
    });

    it('should reject list with limit > 100', async () => {
      await expect(
        memoryService.listConversations({
          limit: 101,
          offset: 0,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        })
      ).rejects.toThrow();
    });

    it('should reject list with limit < 1', async () => {
      await expect(
        memoryService.listConversations({
          limit: 0,
          offset: 0,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        })
      ).rejects.toThrow();
    });

    it('should reject list with negative offset', async () => {
      await expect(
        memoryService.listConversations({
          limit: 10,
          offset: -1,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        })
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // Not Found Errors
  // ============================================================================

  describe('Not Found Errors', () => {
    it('should return null for non-existent conversation', async () => {
      const result = await memoryService.getConversation('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return null for non-existent message', async () => {
      const result = await memoryService.getMessage('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return false when archiving non-existent conversation', async () => {
      const result = await memoryService.archiveConversation('non-existent-id');
      expect(result).toBe(false);
    });

    it('should return false when deleting non-existent conversation', async () => {
      const result = await memoryService.deleteConversation('non-existent-id');
      expect(result).toBe(false);
    });

    it('should return false when deleting non-existent message', async () => {
      const result = await memoryService.deleteMessage('non-existent-id');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Foreign Key Violations
  // ============================================================================

  describe('Foreign Key Violations', () => {
    it('should reject message with non-existent conversationId', async () => {
      await expect(
        memoryService.addMessage({
          conversationId: 'non-existent-conversation',
          role: 'user',
          content: 'Test message',
        })
      ).rejects.toThrow(/FOREIGN KEY constraint failed/);
    });

    it('should delete messages when conversation is permanently deleted', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      await memoryService.addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'Test message',
      });

      await memoryService.permanentlyDeleteConversation(conversation.id);

      const messages = await memoryService.getMessagesByConversation(conversation.id);
      expect(messages).toHaveLength(0);
    });
  });

  // ============================================================================
  // Database Connection Errors
  // ============================================================================

  describe('Database Connection Errors', () => {
    it('should handle closed database gracefully', () => {
      const closedDb = new Database(':memory:');
      closedDb.close();

      const dao = new ConversationDAO(closedDb);

      expect(() => {
        dao.create({
          agentId: 'test-agent',
          title: 'Test',
        });
      }).toThrow(/database.*not open/i);
    });
  });

  // ============================================================================
  // Search Edge Cases
  // ============================================================================

  describe('Search Edge Cases', () => {
    it('should handle search with no results', async () => {
      const result = await memoryService.searchMessages({
        query: 'NONEXISTENT_QUERY_XYZ123',
        limit: 10,
        offset: 0,
        sortBy: 'relevance',
        sortOrder: 'desc',
      });

      expect(result.messages).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle search with special characters', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      await memoryService.addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'C++ template <typename T>',
      });

      const result = await memoryService.searchMessages({
        query: 'C++',
        limit: 10,
        offset: 0,
        sortBy: 'relevance',
        sortOrder: 'desc',
      });

      expect(result.messages.length).toBeGreaterThan(0);
    });

    it('should handle search with very long query', async () => {
      const longQuery = 'a'.repeat(1000);

      const result = await memoryService.searchMessages({
        query: longQuery,
        limit: 10,
        offset: 0,
        sortBy: 'relevance',
        sortOrder: 'desc',
      });

      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
    });

    it('should handle search with Unicode characters', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      await memoryService.addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'Hello 世界 🌍',
      });

      const result = await memoryService.searchMessages({
        query: '世界',
        limit: 10,
        offset: 0,
        sortBy: 'relevance',
        sortOrder: 'desc',
      });

      expect(result.messages.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Pagination Edge Cases
  // ============================================================================

  describe('Pagination Edge Cases', () => {
    it('should handle offset beyond total results', async () => {
      const result = await memoryService.listConversations({
        limit: 10,
        offset: 10000,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.conversations).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle limit=1 correctly', async () => {
      await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Conv 1',
      });

      await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Conv 2',
      });

      const result = await memoryService.listConversations({
        limit: 1,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.conversations).toHaveLength(1);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should handle exact page boundary', async () => {
      // Create exactly 10 conversations
      for (let i = 1; i <= 10; i++) {
        await memoryService.createConversation({
          agentId: 'test-agent',
          title: `Conv ${i}`,
        });
      }

      const result = await memoryService.listConversations({
        limit: 10,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.conversations).toHaveLength(10);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(false);
    });
  });

  // ============================================================================
  // Cache Error Handling
  // ============================================================================

  describe('Cache Error Handling', () => {
    it('should handle null/undefined cache keys', () => {
      const cache = new MemoryCache();

      expect(cache.getConversation(null as any)).toBeNull();
      expect(cache.getConversation(undefined as any)).toBeNull();
      expect(cache.getMessage(null as any)).toBeNull();
      expect(cache.getMessage(undefined as any)).toBeNull();
    });

    it('should handle cache with expired entries', () => {
      const cache = new MemoryCache({ ttlMs: 1 }); // 1ms TTL

      cache.setConversation('test-id', {
        id: 'test-id',
        agentId: 'agent',
        userId: null,
        title: 'Test',
        state: 'idle',
        messageCount: 0,
        totalTokens: 0,
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        archivedAt: null,
        deletedAt: null,
      });

      // Wait for expiration
      setTimeout(() => {
        cache.clearExpired();
        expect(cache.getConversation('test-id')).toBeNull();
      }, 10);
    });
  });

  // ============================================================================
  // Export/Import Errors
  // ============================================================================

  describe('Export/Import Errors', () => {
    it('should handle export to non-existent directory', async () => {
      const exporter = new MemoryExporter(memoryService);

      await expect(
        exporter.exportToJSON('/nonexistent/path/export.json', {})
      ).rejects.toThrow();
    });

    it('should handle import from non-existent file', async () => {
      const exporter = new MemoryExporter(memoryService);

      await expect(
        exporter.importFromJSON('/nonexistent/file.json')
      ).rejects.toThrow();
    });

    it('should handle import with invalid JSON', async () => {
      const exporter = new MemoryExporter(memoryService);
      const tempFile = '/tmp/invalid-export.json';

      // Create invalid JSON file
      const fs = await import('fs');
      fs.writeFileSync(tempFile, 'invalid json content');

      await expect(
        exporter.importFromJSON(tempFile)
      ).rejects.toThrow();

      // Cleanup
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    });

    it('should handle export with no conversations', async () => {
      const exporter = new MemoryExporter(memoryService);
      const tempFile = '/tmp/empty-export.json';

      const result = await exporter.exportToJSON(tempFile, {});

      expect(result.conversationCount).toBe(0);
      expect(result.messageCount).toBe(0);
      expect(existsSync(tempFile)).toBe(true);

      // Cleanup
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    });
  });

  // ============================================================================
  // Concurrency Edge Cases
  // ============================================================================

  describe('Concurrency Edge Cases', () => {
    it('should handle concurrent conversation creates', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        memoryService.createConversation({
          agentId: 'test-agent',
          title: `Concurrent Conv ${i}`,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);

      // All should have unique IDs
      const ids = new Set(results.map((r) => r.id));
      expect(ids.size).toBe(10);
    });

    it('should handle concurrent message adds to same conversation', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      const promises = Array.from({ length: 10 }, (_, i) =>
        memoryService.addMessage({
          conversationId: conversation.id,
          role: 'user',
          content: `Concurrent message ${i}`,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);

      // Verify all messages were added
      const messages = await memoryService.getMessagesByConversation(conversation.id);
      expect(messages).toHaveLength(10);
    });

    it('should handle concurrent searches', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      await memoryService.addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'Test message',
      });

      const promises = Array.from({ length: 10 }, () =>
        memoryService.searchMessages({
          query: 'test',
          limit: 10,
          offset: 0,
          sortBy: 'relevance',
          sortOrder: 'desc',
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.messages.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Data Integrity
  // ============================================================================

  describe('Data Integrity', () => {
    it('should maintain message count accuracy after adds', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      for (let i = 1; i <= 5; i++) {
        await memoryService.addMessage({
          conversationId: conversation.id,
          role: 'user',
          content: `Message ${i}`,
          tokens: 10,
        });
      }

      const updated = await memoryService.getConversation(conversation.id);
      expect(updated?.messageCount).toBe(5);
      expect(updated?.totalTokens).toBe(50);
    });

    it('should maintain message count accuracy after deletes', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      const messages = [];
      for (let i = 1; i <= 5; i++) {
        const msg = await memoryService.addMessage({
          conversationId: conversation.id,
          role: 'user',
          content: `Message ${i}`,
          tokens: 10,
        });
        messages.push(msg);
      }

      // Delete 2 messages
      await memoryService.deleteMessage(messages[0].id);
      await memoryService.deleteMessage(messages[1].id);

      const count = await memoryService.getMessageCount(conversation.id);
      expect(count).toBe(3);
    });

    it('should maintain referential integrity on archive', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      await memoryService.addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'Test message',
      });

      await memoryService.archiveConversation(conversation.id);

      const archived = await memoryService.getConversation(conversation.id);
      expect(archived?.archivedAt).not.toBeNull();

      // Messages should still be accessible
      const messages = await memoryService.getMessagesByConversation(conversation.id);
      expect(messages).toHaveLength(1);
    });
  });

  // ============================================================================
  // State Transitions
  // ============================================================================

  describe('State Transitions', () => {
    it('should handle archive -> restore -> archive cycle', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      // Archive
      await memoryService.archiveConversation(conversation.id);
      let conv = await memoryService.getConversation(conversation.id);
      expect(conv?.archivedAt).not.toBeNull();

      // Restore
      await memoryService.restoreConversation(conversation.id);
      conv = await memoryService.getConversation(conversation.id);
      expect(conv?.archivedAt).toBeNull();

      // Archive again
      await memoryService.archiveConversation(conversation.id);
      conv = await memoryService.getConversation(conversation.id);
      expect(conv?.archivedAt).not.toBeNull();
    });

    it('should handle delete -> permanent delete', async () => {
      const conversation = await memoryService.createConversation({
        agentId: 'test-agent',
        title: 'Test',
      });

      // Soft delete
      await memoryService.deleteConversation(conversation.id);
      let conv = await memoryService.getConversation(conversation.id);
      expect(conv?.deletedAt).not.toBeNull();

      // Permanent delete
      await memoryService.permanentlyDeleteConversation(conversation.id);
      conv = await memoryService.getConversation(conversation.id);
      expect(conv).toBeNull();
    });
  });
});
