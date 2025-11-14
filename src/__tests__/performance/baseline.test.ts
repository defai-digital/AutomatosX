/**
 * Performance Baseline Tests
 *
 * Establishes performance baselines for P1-5.1
 * Tests run against current implementation to measure improvements
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FileService } from '../../services/FileService.js';
import { getPerformanceMonitor } from '../../performance/PerformanceMonitor.js';

describe('Performance Baseline', () => {
  let fileService: FileService;
  let perfMonitor: ReturnType<typeof getPerformanceMonitor>;

  beforeEach(() => {
    fileService = new FileService();
    perfMonitor = getPerformanceMonitor();
    perfMonitor.reset();
  });

  it('should measure baseline indexing speed', () => {
    const files = Array.from({ length: 20 }, (_, i) => ({
      path: `/test/baseline${i}.ts`,
      content: `
        export function test${i}(x: number): number {
          if (x > 0) {
            return x * 2;
          }
          return 0;
        }
      `,
    }));

    const start = performance.now();

    for (const file of files) {
      fileService.indexFile(file.path, file.content);
    }

    const time = performance.now() - start;
    const filesPerSec = (files.length / time) * 1000;

    console.log('\n📊 Baseline Indexing Performance:');
    console.log(`  Files: ${files.length}`);
    console.log(`  Total Time: ${time.toFixed(2)}ms`);
    console.log(`  Files/Second: ${filesPerSec.toFixed(2)}`);
    console.log(`  Avg Time/File: ${(time / files.length).toFixed(2)}ms`);

    // Record baseline
    perfMonitor.recordIndexing(files.length, time, 0);

    // Baseline expectation: ~10 files/sec
    expect(filesPerSec).toBeGreaterThan(5);
  });

  it('should measure baseline query latency', () => {
    // Setup: index some files
    fileService.indexFile('/test/query1.ts', 'export function foo() {}');
    fileService.indexFile('/test/query2.ts', 'export function bar() {}');

    // Measure uncached query
    fileService.clearCache();
    const uncachedStart = performance.now();
    fileService.search('function');
    const uncachedTime = performance.now() - uncachedStart;

    // Measure cached query
    const cachedStart = performance.now();
    fileService.search('function');
    const cachedTime = performance.now() - cachedStart;

    console.log('\n📊 Baseline Query Performance:');
    console.log(`  Uncached Latency: ${uncachedTime.toFixed(2)}ms`);
    console.log(`  Cached Latency: ${cachedTime.toFixed(2)}ms`);
    console.log(`  Cache Speedup: ${(uncachedTime / cachedTime).toFixed(2)}x`);

    // Record baseline
    perfMonitor.recordQuery(uncachedTime, false);
    perfMonitor.recordQuery(cachedTime, true);

    // Baseline expectation: <5ms uncached, <1ms cached
    expect(uncachedTime).toBeLessThan(10);
    expect(cachedTime).toBeLessThan(2);
  });

  it('should measure baseline cache hit rate', () => {
    fileService.indexFile('/test/cache1.ts', 'export const x = 1;');
    fileService.indexFile('/test/cache2.ts', 'export const y = 2;');

    fileService.clearCache();

    // Execute queries (first will miss, rest will hit)
    const queries = ['export', 'const', 'export', 'const', 'export'];
    for (const query of queries) {
      fileService.search(query);
    }

    const cacheStats = fileService.getCacheStats();
    const hitRate = cacheStats.hitRate * 100;

    console.log('\n📊 Baseline Cache Performance:');
    console.log(`  Hits: ${cacheStats.hits}`);
    console.log(`  Misses: ${cacheStats.misses}`);
    console.log(`  Hit Rate: ${hitRate.toFixed(1)}%`);

    // Baseline expectation: 60% hit rate for repeated queries
    expect(hitRate).toBeGreaterThan(40);
  });

  it('should measure baseline memory usage', () => {
    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    const memBefore = process.memoryUsage();

    // Index 100 files
    const files = Array.from({ length: 100 }, (_, i) => ({
      path: `/test/mem${i}.ts`,
      content: `export function test${i}() { return ${i}; }`,
    }));

    for (const file of files) {
      fileService.indexFile(file.path, file.content);
    }

    if (global.gc) {
      global.gc();
    }

    const memAfter = process.memoryUsage();
    const memIncrease = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

    console.log('\n📊 Baseline Memory Usage:');
    console.log(`  Files Indexed: ${files.length}`);
    console.log(`  Memory Increase: ${memIncrease.toFixed(2)} MB`);
    console.log(`  Memory per File: ${(memIncrease / files.length).toFixed(3)} MB`);

    perfMonitor.recordMemory();

    // Baseline expectation: <5MB for 100 small files
    expect(memIncrease).toBeLessThan(20);
  });

  it('should print complete baseline report', () => {
    // Run mini benchmark
    const files = Array.from({ length: 10 }, (_, i) => ({
      path: `/test/report${i}.ts`,
      content: `export class Test${i} { getValue() { return ${i}; } }`,
    }));

    const start = performance.now();
    for (const file of files) {
      fileService.indexFile(file.path, file.content);
    }
    const time = performance.now() - start;

    perfMonitor.recordIndexing(files.length, time, time * 0.6);

    // Execute some queries
    fileService.search('class');
    fileService.search('getValue');
    fileService.search('class'); // Cache hit

    perfMonitor.recordQuery(3.5, false);
    perfMonitor.recordQuery(0.8, true);
    perfMonitor.recordMemory();

    // Print report
    const report = perfMonitor.formatReport();
    console.log(report);

    expect(report).toContain('Performance Statistics');
    expect(report).toContain('Indexing:');
    expect(report).toContain('Queries:');
    expect(report).toContain('Memory:');
  });
});
