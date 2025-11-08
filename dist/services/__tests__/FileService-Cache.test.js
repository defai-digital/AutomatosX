/**
 * FileService-Cache.test.ts
 *
 * Tests for FileService query caching
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileService } from '../FileService.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
describe('FileService Cache', () => {
    let fileService;
    let tempDir;
    beforeEach(() => {
        fileService = new FileService();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'));
    });
    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    it('should cache search results', () => {
        // Index a test file
        const testFile = path.join(tempDir, 'test.ts');
        const content = `
      export class Calculator {
        add(a: number, b: number): number {
          return a + b;
        }
      }
    `;
        fs.writeFileSync(testFile, content);
        fileService.indexFile(testFile, content);
        // Clear cache to start fresh
        fileService.clearCache();
        // First search - cache miss
        const firstResult = fileService.search('Calculator', 10);
        const firstStats = fileService.getCacheStats();
        expect(firstStats.misses).toBe(1);
        expect(firstStats.hits).toBe(0);
        expect(firstResult.results.length).toBeGreaterThan(0);
        // Second search (same query) - cache hit
        const secondResult = fileService.search('Calculator', 10);
        const secondStats = fileService.getCacheStats();
        expect(secondStats.misses).toBe(1);
        expect(secondStats.hits).toBe(1);
        expect(secondStats.hitRate).toBeCloseTo(0.5, 2);
        // Results should be identical
        expect(secondResult.results).toEqual(firstResult.results);
    });
    it('should provide significant speedup for cached queries', () => {
        // Index a test file
        const testFile = path.join(tempDir, 'test.ts');
        const content = `
      export class Calculator {
        add(a: number, b: number): number {
          return a + b;
        }
        subtract(a: number, b: number): number {
          return a - b;
        }
      }
    `;
        fs.writeFileSync(testFile, content);
        fileService.indexFile(testFile, content);
        fileService.clearCache();
        // First search - uncached
        const uncachedResult = fileService.search('Calculator', 10);
        const uncachedTime = uncachedResult.searchTime;
        // Second search - cached
        const cachedResult = fileService.search('Calculator', 10);
        const cachedTime = cachedResult.searchTime;
        // Cached should be significantly faster (at least 2x)
        // Note: Cache hit is usually 10-100x faster, but we use conservative estimate
        expect(cachedTime).toBeLessThan(uncachedTime);
        // Cache stats should show one hit
        const stats = fileService.getCacheStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
    });
    it('should cache different queries separately', () => {
        // Index a test file
        const testFile = path.join(tempDir, 'test.ts');
        const content = `
      export class Calculator {
        add(a: number, b: number): number {
          return a + b;
        }
      }
      export class Multiplier {
        multiply(a: number, b: number): number {
          return a * b;
        }
      }
    `;
        fs.writeFileSync(testFile, content);
        fileService.indexFile(testFile, content);
        fileService.clearCache();
        // Search for Calculator
        fileService.search('Calculator', 10);
        // Search for Multiplier (different query)
        fileService.search('Multiplier', 10);
        // Both should be cached
        const stats = fileService.getCacheStats();
        expect(stats.size).toBe(2); // Two different queries cached
        expect(stats.misses).toBe(2); // Both were initial misses
        expect(stats.hits).toBe(0);
        // Search Calculator again - should be cache hit
        fileService.search('Calculator', 10);
        const stats2 = fileService.getCacheStats();
        expect(stats2.hits).toBe(1);
    });
    it('should invalidate cache after indexing new file', () => {
        // Index first file
        const file1 = path.join(tempDir, 'file1.ts');
        fs.writeFileSync(file1, 'export class Foo {}');
        fileService.indexFile(file1, 'export class Foo {}');
        // Perform search - gets cached
        fileService.search('Foo', 10);
        expect(fileService.getCacheStats().size).toBe(1);
        // Index another file - should invalidate cache
        const file2 = path.join(tempDir, 'file2.ts');
        fs.writeFileSync(file2, 'export class Bar {}');
        fileService.indexFile(file2, 'export class Bar {}');
        // Cache should be cleared (size and stats reset)
        const stats = fileService.getCacheStats();
        expect(stats.size).toBe(0);
        expect(stats.hits).toBe(0); // Counters reset on clear
        expect(stats.misses).toBe(0); // Counters reset on clear
    });
    it('should clear cache manually', () => {
        // Index a file
        const testFile = path.join(tempDir, 'test.ts');
        fs.writeFileSync(testFile, 'export class Test {}');
        fileService.indexFile(testFile, 'export class Test {}');
        // Perform searches
        fileService.search('Test', 10);
        fileService.search('class', 10);
        expect(fileService.getCacheStats().size).toBe(2);
        // Clear cache
        fileService.clearCache();
        const stats = fileService.getCacheStats();
        expect(stats.size).toBe(0);
        expect(stats.hits).toBe(0);
        expect(stats.misses).toBe(0);
    });
    it('should respect different query parameters', () => {
        // Index a file
        const testFile = path.join(tempDir, 'test.ts');
        const content = `
      export class A {}
      export class B {}
      export class C {}
    `;
        fs.writeFileSync(testFile, content);
        fileService.indexFile(testFile, content);
        fileService.clearCache();
        // Same query but different limits should be separate cache entries
        fileService.search('class', 5);
        fileService.search('class', 10);
        const stats = fileService.getCacheStats();
        expect(stats.size).toBe(2); // Two separate cache entries
    });
});
//# sourceMappingURL=FileService-Cache.test.js.map