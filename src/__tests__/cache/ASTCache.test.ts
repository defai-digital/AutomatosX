/**
 * AST Cache Tests
 *
 * Tests for LRU caching of parsed ASTs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ASTCache } from '../../cache/ASTCache.js';
import type { ParseResult } from '../../parser/LanguageParser.js';

describe('ASTCache', () => {
  let cache: ASTCache;
  let mockAST: ParseResult;

  beforeEach(() => {
    cache = new ASTCache({ maxSize: 3, ttl: 1000 });
    mockAST = {
      symbols: [
        { name: 'test', kind: 'function', line: 1, column: 0 },
      ],
      parseTime: 10,
    };
  });

  describe('Basic Operations', () => {
    it('should cache and retrieve AST', () => {
      cache.set('/test.ts', 'const x = 1;', mockAST);
      const result = cache.get('/test.ts', 'const x = 1;');

      expect(result).toEqual(mockAST);
      expect(cache.stats().hits).toBe(1);
      expect(cache.stats().misses).toBe(0);
    });

    it('should return null for cache miss', () => {
      const result = cache.get('/test.ts', 'const x = 1;');

      expect(result).toBeNull();
      expect(cache.stats().misses).toBe(1);
      expect(cache.stats().hits).toBe(0);
    });

    it('should invalidate on content change', () => {
      cache.set('/test.ts', 'const x = 1;', mockAST);
      expect(cache.get('/test.ts', 'const x = 1;')).toEqual(mockAST);

      // Different content = different hash = cache miss
      expect(cache.get('/test.ts', 'const x = 2;')).toBeNull();
      expect(cache.stats().hits).toBe(1);
      expect(cache.stats().misses).toBe(1);
    });

    it('should handle same content, different files', () => {
      const content = 'const x = 1;';

      cache.set('/file1.ts', content, mockAST);
      cache.set('/file2.ts', content, mockAST);

      expect(cache.get('/file1.ts', content)).toEqual(mockAST);
      expect(cache.get('/file2.ts', content)).toEqual(mockAST);
      expect(cache.stats().size).toBe(2);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict LRU entry when full', () => {
      const ast1 = { ...mockAST, parseTime: 1 };
      const ast2 = { ...mockAST, parseTime: 2 };
      const ast3 = { ...mockAST, parseTime: 3 };
      const ast4 = { ...mockAST, parseTime: 4 };

      cache.set('/file1.ts', 'code1', ast1);
      cache.set('/file2.ts', 'code2', ast2);
      cache.set('/file3.ts', 'code3', ast3);

      expect(cache.stats().size).toBe(3);

      // Access file1 to make it more recent
      cache.get('/file1.ts', 'code1');

      // Add file4 - should evict file2 (LRU)
      cache.set('/file4.ts', 'code4', ast4);

      expect(cache.get('/file1.ts', 'code1')).toEqual(ast1); // Still cached
      expect(cache.get('/file2.ts', 'code2')).toBeNull(); // Evicted
      expect(cache.get('/file3.ts', 'code3')).toEqual(ast3); // Still cached
      expect(cache.get('/file4.ts', 'code4')).toEqual(ast4); // Newly added

      expect(cache.stats().evictions).toBe(1);
    });

    it('should update LRU order on access', () => {
      cache.set('/file1.ts', 'code1', mockAST);
      cache.set('/file2.ts', 'code2', mockAST);
      cache.set('/file3.ts', 'code3', mockAST);

      // Access file1 multiple times
      cache.get('/file1.ts', 'code1');
      cache.get('/file1.ts', 'code1');
      cache.get('/file1.ts', 'code1');

      const topFiles = cache.getTopFiles(1);
      expect(topFiles[0].filePath).toBe('/file1.ts');
      expect(topFiles[0].hits).toBe(3);
    });
  });

  describe('Invalidation', () => {
    it('should invalidate specific file', () => {
      cache.set('/test.ts', 'const x = 1;', mockAST);
      cache.set('/test.ts', 'const x = 2;', mockAST);
      cache.set('/other.ts', 'const y = 1;', mockAST);

      expect(cache.stats().size).toBe(3);

      cache.invalidate('/test.ts');

      expect(cache.get('/test.ts', 'const x = 1;')).toBeNull();
      expect(cache.get('/test.ts', 'const x = 2;')).toBeNull();
      expect(cache.get('/other.ts', 'const y = 1;')).toEqual(mockAST);

      expect(cache.stats().size).toBe(1);
    });

    it('should clear entire cache', () => {
      cache.set('/file1.ts', 'code1', mockAST);
      cache.set('/file2.ts', 'code2', mockAST);
      cache.set('/file3.ts', 'code3', mockAST);

      expect(cache.stats().size).toBe(3);

      cache.clear();

      expect(cache.stats().size).toBe(0);
      expect(cache.stats().hits).toBe(0);
      expect(cache.stats().misses).toBe(0);
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      cache.set('/test.ts', 'const x = 1;', mockAST);

      // Immediate access should work
      expect(cache.get('/test.ts', 'const x = 1;')).toEqual(mockAST);

      // Wait for TTL to expire (1000ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      expect(cache.get('/test.ts', 'const x = 1;')).toBeNull();
      expect(cache.stats().size).toBe(0);
    });

    it('should not expire entries before TTL', async () => {
      cache.set('/test.ts', 'const x = 1;', mockAST);

      // Wait half the TTL
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should still be cached
      expect(cache.get('/test.ts', 'const x = 1;')).toEqual(mockAST);
    });
  });

  describe('Statistics', () => {
    it('should track hit rate correctly', () => {
      cache.set('/test.ts', 'const x = 1;', mockAST);

      // 1 hit
      cache.get('/test.ts', 'const x = 1;');

      // 2 misses
      cache.get('/test.ts', 'const x = 2;');
      cache.get('/other.ts', 'const y = 1;');

      const stats = cache.stats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(1 / 3, 2);
    });

    it('should report top accessed files', () => {
      cache.set('/file1.ts', 'code1', mockAST);
      cache.set('/file2.ts', 'code2', mockAST);
      cache.set('/file3.ts', 'code3', mockAST);

      // Access pattern: file2 (5), file1 (3), file3 (1)
      for (let i = 0; i < 5; i++) cache.get('/file2.ts', 'code2');
      for (let i = 0; i < 3; i++) cache.get('/file1.ts', 'code1');
      cache.get('/file3.ts', 'code3');

      const topFiles = cache.getTopFiles(3);

      expect(topFiles[0].filePath).toBe('/file2.ts');
      expect(topFiles[0].hits).toBe(5);
      expect(topFiles[1].filePath).toBe('/file1.ts');
      expect(topFiles[1].hits).toBe(3);
      expect(topFiles[2].filePath).toBe('/file3.ts');
      expect(topFiles[2].hits).toBe(1);
    });

    it('should estimate memory usage', () => {
      cache.set('/test.ts', 'const x = 1;', mockAST);

      const memUsage = cache.getMemoryUsage();

      expect(memUsage).toBeGreaterThan(0);
      expect(memUsage).toBeLessThan(1); // Should be < 1MB for one entry
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      cache.set('/empty.ts', '', mockAST);

      expect(cache.get('/empty.ts', '')).toEqual(mockAST);
    });

    it('should handle very large content', () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of content

      cache.set('/large.ts', largeContent, mockAST);

      expect(cache.get('/large.ts', largeContent)).toEqual(mockAST);
    });

    it('should handle special characters in file path', () => {
      const weirdPath = '/test/path with spaces/file-[special].ts';

      cache.set(weirdPath, 'code', mockAST);

      expect(cache.get(weirdPath, 'code')).toEqual(mockAST);
    });

    it('should handle concurrent updates to same file', () => {
      const ast1 = { ...mockAST, parseTime: 1 };
      const ast2 = { ...mockAST, parseTime: 2 };

      cache.set('/test.ts', 'version1', ast1);
      cache.set('/test.ts', 'version2', ast2);

      expect(cache.get('/test.ts', 'version1')).toEqual(ast1);
      expect(cache.get('/test.ts', 'version2')).toEqual(ast2);
      expect(cache.stats().size).toBe(2);
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle 1000 cache operations efficiently', () => {
      const largeCache = new ASTCache({ maxSize: 1000 });

      const start = performance.now();

      // Insert 1000 entries
      for (let i = 0; i < 1000; i++) {
        largeCache.set(`/file${i}.ts`, `code${i}`, mockAST);
      }

      // Access random entries
      for (let i = 0; i < 1000; i++) {
        const idx = Math.floor(Math.random() * 1000);
        largeCache.get(`/file${idx}.ts`, `code${idx}`);
      }

      const time = performance.now() - start;

      console.log(`1000 cache ops in ${time.toFixed(2)}ms`);

      // Should complete in < 100ms
      expect(time).toBeLessThan(100);
    });

    it('should maintain O(1) access time', () => {
      const iterations = [100, 500, 1000];
      const times: number[] = [];

      for (const n of iterations) {
        const testCache = new ASTCache({ maxSize: n });

        // Fill cache
        for (let i = 0; i < n; i++) {
          testCache.set(`/file${i}.ts`, `code${i}`, mockAST);
        }

        // Measure access time with more iterations for stable timing
        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
          const idx = Math.floor(Math.random() * n);
          testCache.get(`/file${idx}.ts`, `code${idx}`);
        }
        const time = performance.now() - start;

        times.push(time);
      }

      console.log('Access times:', times.map(t => `${t.toFixed(2)}ms`));

      // With O(1) access, time should scale roughly linearly with iterations
      // (since we're doing 1000 lookups in each test)
      // Allow 2x variance to account for JIT warmup and GC
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      for (const time of times) {
        expect(time).toBeLessThan(avgTime * 2);
      }
    });
  });
});
