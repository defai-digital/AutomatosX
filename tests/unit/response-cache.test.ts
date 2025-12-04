/**
 * ResponseCache Unit Tests
 *
 * Tests for the dual-layer response caching system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ResponseCache } from '../../src/core/cache/response-cache.js';
import { unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('ResponseCache', () => {
  let cache: ResponseCache;
  const testDbPath = resolve('.automatosx/cache/test-responses.db');

  beforeEach(() => {
    // Clean up test database if exists
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    cache = new ResponseCache({
      enabled: true,
      ttl: 60, // 60 seconds for testing
      maxSize: 10,
      maxMemorySize: 5,
      dbPath: testDbPath
    });
  });

  afterEach(() => {
    cache.close();
    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Basic Operations', () => {
    it('should store and retrieve cached responses', () => {
      const provider = 'claude-code';
      const prompt = 'test prompt';
      const response = 'test response';

      cache.set(provider, prompt, response);
      const retrieved = cache.get(provider, prompt);

      expect(retrieved).toBe(response);
    });

    it('should return null for non-existent cache entries', () => {
      const retrieved = cache.get('claude-code', 'non-existent prompt');
      expect(retrieved).toBeNull();
    });

    it('should handle model parameters in cache key', () => {
      const provider = 'openai';
      const prompt = 'test prompt';
      const response1 = 'response with temp 0';
      const response2 = 'response with temp 1';

      cache.set(provider, prompt, response1, { temperature: 0 });
      cache.set(provider, prompt, response2, { temperature: 1 });

      const retrieved1 = cache.get(provider, prompt, { temperature: 0 });
      const retrieved2 = cache.get(provider, prompt, { temperature: 1 });

      expect(retrieved1).toBe(response1);
      expect(retrieved2).toBe(response2);
    });

    it('should differentiate between providers', () => {
      const prompt = 'same prompt';
      const response1 = 'claude response';
      const response2 = 'gemini response';

      cache.set('claude-code', prompt, response1);
      cache.set('gemini-cli', prompt, response2);

      expect(cache.get('claude-code', prompt)).toBe(response1);
      expect(cache.get('gemini-cli', prompt)).toBe(response2);
    });
  });

  describe('L1 (Memory) Cache', () => {
    it('should prioritize L1 cache for recently accessed entries', () => {
      const provider = 'claude-code';
      const prompt = 'test prompt';
      const response = 'test response';

      cache.set(provider, prompt, response);

      // First get populates L1
      const retrieved1 = cache.get(provider, prompt);
      expect(retrieved1).toBe(response);

      // Second get should hit L1 (faster)
      const retrieved2 = cache.get(provider, prompt);
      expect(retrieved2).toBe(response);

      const stats = cache.getStats();
      expect(stats.l1Entries).toBeGreaterThan(0);
    });

    it('should evict oldest L1 entries when maxMemorySize is exceeded', () => {
      // Fill L1 cache beyond maxMemorySize (5)
      for (let i = 0; i < 10; i++) {
        cache.set('claude-code', `prompt ${i}`, `response ${i}`);
      }

      const stats = cache.getStats();
      expect(stats.l1Entries).toBeLessThanOrEqual(5);
      expect(stats.l2Entries).toBe(10);
    });
  });

  describe('L2 (SQLite) Cache', () => {
    it('should persist entries to SQLite', () => {
      const provider = 'claude-code';
      const prompt = 'test prompt';
      const response = 'test response';

      cache.set(provider, prompt, response);
      cache.close();

      // Reopen cache with same database
      cache = new ResponseCache({
        enabled: true,
        ttl: 60,
        maxSize: 10,
        maxMemorySize: 5,
        dbPath: testDbPath
      });

      const retrieved = cache.get(provider, prompt);
      expect(retrieved).toBe(response);
    });

    it('should evict oldest L2 entries when maxSize is exceeded', () => {
      // Fill cache beyond maxSize (10)
      for (let i = 0; i < 15; i++) {
        cache.set('claude-code', `prompt ${i}`, `response ${i}`);
      }

      const stats = cache.getStats();
      expect(stats.l2Entries).toBeLessThanOrEqual(10);
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      // Create cache with very short TTL (1 second)
      cache.close();
      cache = new ResponseCache({
        enabled: true,
        ttl: 1,
        maxSize: 10,
        maxMemorySize: 5,
        dbPath: testDbPath
      });

      const provider = 'claude-code';
      const prompt = 'test prompt';
      const response = 'test response';

      cache.set(provider, prompt, response);

      // Verify entry exists
      expect(cache.get(provider, prompt)).toBe(response);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Entry should be expired
      expect(cache.get(provider, prompt)).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', () => {
      const provider = 'claude-code';
      const prompt = 'test prompt';
      const response = 'test response';

      // Miss
      cache.get(provider, prompt);

      // Set
      cache.set(provider, prompt, response);

      // Hit
      cache.get(provider, prompt);
      cache.get(provider, prompt);

      const stats = cache.getStats();
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should track total entries and size', () => {
      cache.set('claude-code', 'prompt 1', 'response 1');
      cache.set('claude-code', 'prompt 2', 'response 2');

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should track oldest and newest entries', () => {
      cache.set('claude-code', 'prompt 1', 'response 1');

      // Small delay
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      return delay(10).then(() => {
        cache.set('claude-code', 'prompt 2', 'response 2');

        const stats = cache.getStats();
        expect(stats.oldestEntry).toBeLessThan(stats.newestEntry!);
      });
    });
  });

  describe('Clear Operation', () => {
    it('should clear all cache entries', () => {
      cache.set('claude-code', 'prompt 1', 'response 1');
      cache.set('gemini-cli', 'prompt 2', 'response 2');
      cache.set('openai', 'prompt 3', 'response 3');

      let stats = cache.getStats();
      expect(stats.totalEntries).toBe(3);

      cache.clear();

      stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.l1Entries).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });
  });

  describe('Disabled Cache', () => {
    it('should not cache when disabled', () => {
      cache.close();
      cache = new ResponseCache({
        enabled: false,
        ttl: 60,
        maxSize: 10,
        maxMemorySize: 5,
        dbPath: testDbPath
      });

      cache.set('claude-code', 'prompt', 'response');
      const retrieved = cache.get('claude-code', 'prompt');

      expect(retrieved).toBeNull();
      expect(cache.isEnabled).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prompts', () => {
      cache.set('claude-code', '', 'empty prompt response');
      const retrieved = cache.get('claude-code', '');
      expect(retrieved).toBe('empty prompt response');
    });

    it('should handle large responses', () => {
      const largeResponse = 'x'.repeat(10000);
      cache.set('claude-code', 'large prompt', largeResponse);
      const retrieved = cache.get('claude-code', 'large prompt');
      expect(retrieved).toBe(largeResponse);
    });

    it('should handle special characters in prompts', () => {
      const specialPrompt = 'test\n\t"\'\\prompt';
      const response = 'special response';
      cache.set('claude-code', specialPrompt, response);
      const retrieved = cache.get('claude-code', specialPrompt);
      expect(retrieved).toBe(response);
    });
  });
});
