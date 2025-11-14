/**
 * Cache Fixes Validation Test
 * Quick test to verify Bug #1 and Bug #2 fixes
 */

import { describe, it, expect } from 'vitest';
import { MemoryCache } from '../../memory/MemoryCache.js';
import type { Conversation } from '../../types/schemas/memory.schema.js';

describe('Cache Fixes Validation', () => {
  describe('Bug #1: Hit Rate Calculation', () => {
    it('should return hit rate as percentage (not fraction)', () => {
      const cache = new MemoryCache({ maxSize: 100 });

      const mockConversation: Conversation = {
        id: 'test-1',
        agentId: 'test-agent',
        title: 'Test',
        state: 'idle',
        messageCount: 0,
        totalTokens: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Prime cache
      cache.setConversation('test-1', mockConversation);

      // 80 hits
      for (let i = 0; i < 80; i++) {
        cache.getConversation('test-1');
      }

      // 20 misses
      for (let i = 0; i < 20; i++) {
        cache.getConversation('non-existent');
      }

      const stats = cache.getStats();

      console.log(`  Hits: ${stats.hits}`);
      console.log(`  Misses: ${stats.misses}`);
      console.log(`  Hit rate: ${stats.hitRate.toFixed(2)}%`);

      // Hit rate should be 80% (not 0.8%)
      expect(stats.hitRate).toBeGreaterThan(75);
      expect(stats.hitRate).toBeLessThan(85);
      expect(stats.hitRate).toBeCloseTo(80, 1);
    });
  });

  describe('Bug #2: Cache LRU Eviction', () => {
    it('should enforce maxSize across all cache maps', () => {
      const maxSize = 10;
      const cache = new MemoryCache({ maxSize });

      // Create 20 conversations (exceeds maxSize)
      for (let i = 1; i <= 20; i++) {
        const conversation: Conversation = {
          id: `conv-${i}`,
          agentId: 'test-agent',
          title: `Conversation ${i}`,
          state: 'idle',
          messageCount: 0,
          totalTokens: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        cache.setConversation(`conv-${i}`, conversation);

        // Small delay to ensure different lastAccessedAt times
        if (i < 20) {
          const start = Date.now();
          while (Date.now() - start < 2) {
            // 2ms delay
          }
        }
      }

      const stats = cache.getStats();

      console.log(`  Cache size: ${stats.size}`);
      console.log(`  Max size: ${maxSize}`);
      console.log(`  Evictions: ${stats.evictions}`);

      // Cache should not exceed maxSize
      expect(stats.size).toBeLessThanOrEqual(maxSize);

      // Should have evicted 10 entries (20 - 10 = 10)
      expect(stats.evictions).toBeGreaterThanOrEqual(10);

      // Verify oldest entries were evicted (LRU)
      // conv-1 through conv-10 should be gone
      expect(cache.getConversation('conv-1')).toBeNull();
      expect(cache.getConversation('conv-5')).toBeNull();
      expect(cache.getConversation('conv-10')).toBeNull();

      // conv-11 through conv-20 should still be there
      expect(cache.getConversation('conv-15')).not.toBeNull();
      expect(cache.getConversation('conv-20')).not.toBeNull();
    });

    it('should evict from correct cache when limit reached', () => {
      const maxSize = 5;
      const cache = new MemoryCache({ maxSize });

      // Add 3 conversations
      for (let i = 1; i <= 3; i++) {
        cache.setConversation(`conv-${i}`, {
          id: `conv-${i}`,
          agentId: 'test-agent',
          title: `Conv ${i}`,
          state: 'idle',
          messageCount: 0,
          totalTokens: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Add 3 search results (total size now = 6, exceeds maxSize of 5)
      for (let i = 1; i <= 3; i++) {
        cache.setSearchResults(`query-${i}`, []);
      }

      const stats = cache.getStats();

      console.log(`  Total size: ${stats.size}`);
      console.log(`  Max size: ${maxSize}`);

      // Should not exceed maxSize
      expect(stats.size).toBeLessThanOrEqual(maxSize);

      // Should have evicted at least 1 entry
      expect(stats.evictions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Combined Test: Hit Rate + Eviction', () => {
    it('should maintain correct hit rate with evictions', () => {
      const maxSize = 5;
      const cache = new MemoryCache({ maxSize });

      // Add 10 conversations (will trigger evictions)
      for (let i = 1; i <= 10; i++) {
        cache.setConversation(`conv-${i}`, {
          id: `conv-${i}`,
          agentId: 'test-agent',
          title: `Conv ${i}`,
          state: 'idle',
          messageCount: 0,
          totalTokens: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Small delay
        const start = Date.now();
        while (Date.now() - start < 1) {}
      }

      // Access last 5 (should be in cache)
      let hits = 0;
      let misses = 0;
      for (let i = 6; i <= 10; i++) {
        const result = cache.getConversation(`conv-${i}`);
        if (result) hits++;
        else misses++;
      }

      // Try to access first 5 (should be evicted)
      for (let i = 1; i <= 5; i++) {
        const result = cache.getConversation(`conv-${i}`);
        if (result) hits++;
        else misses++;
      }

      const stats = cache.getStats();

      console.log(`  Size: ${stats.size} / ${maxSize}`);
      console.log(`  Hits: ${stats.hits}`);
      console.log(`  Misses: ${stats.misses}`);
      console.log(`  Hit rate: ${stats.hitRate.toFixed(1)}%`);
      console.log(`  Evictions: ${stats.evictions}`);

      // Should have ~50% hit rate (5 hits, 5 misses)
      expect(stats.hitRate).toBeGreaterThan(40);
      expect(stats.hitRate).toBeLessThan(60);

      // Should not exceed maxSize
      expect(stats.size).toBeLessThanOrEqual(maxSize);
    });
  });
});
