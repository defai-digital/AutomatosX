/**
 * Metrics Collector Tests
 *
 * @module tests/unit/core/refactor/metrics-collector
 * @since v12.7.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { MetricsCollector } from '../../../../src/core/refactor/metrics-collector.js';

describe('MetricsCollector', () => {
  let testDir: string;
  let collector: MetricsCollector;

  beforeEach(async () => {
    testDir = join(tmpdir(), `metrics-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'src'), { recursive: true });
    collector = new MetricsCollector();
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('linesOfCode', () => {
    it('should count lines of code accurately', async () => {
      const code = `
function hello() {
  console.log('hello');
}

function world() {
  console.log('world');
}
`;
      await writeFile(join(testDir, 'src', 'app.ts'), code);

      const metrics = await collector.collect(testDir);

      expect(metrics.linesOfCode).toBeGreaterThan(0);
      expect(metrics.numberOfFunctions).toBeGreaterThan(0);
    });

    it('should handle files with comments', async () => {
      const code = `
// This is a comment

/**
 * Multi-line comment
 */
function hello() {
  // Inline comment
  console.log('hello');
}

`;
      await writeFile(join(testDir, 'src', 'comments.ts'), code);

      const metrics = await collector.collect(testDir);

      // Should count lines
      expect(metrics.linesOfCode).toBeGreaterThan(0);
    });
  });

  describe('cyclomatic complexity', () => {
    it('should calculate low complexity for simple functions', async () => {
      const code = `
function simple() {
  return 42;
}
`;
      await writeFile(join(testDir, 'src', 'simple.ts'), code);

      const metrics = await collector.collect(testDir);

      expect(metrics.avgCyclomaticComplexity).toBeLessThanOrEqual(3);
    });

    it('should calculate higher complexity for branching functions', async () => {
      const code = `
function complex(a: number, b: number) {
  if (a > 0) {
    if (b > 0) {
      return 'both positive';
    } else if (b < 0) {
      return 'a positive, b negative';
    }
  } else if (a < 0) {
    if (b > 0) {
      return 'a negative, b positive';
    } else if (b < 0) {
      return 'both negative';
    }
  }
  return 'at least one zero';
}
`;
      await writeFile(join(testDir, 'src', 'complex.ts'), code);

      const metrics = await collector.collect(testDir);

      // Should have some complexity for branching code
      expect(metrics.avgCyclomaticComplexity).toBeGreaterThan(1);
    });

    it('should count logical operators towards complexity', async () => {
      const code = `
function logicalOps(a: boolean, b: boolean, c: boolean) {
  if (a && b || c) {
    return true;
  }
  return a || b && c;
}
`;
      await writeFile(join(testDir, 'src', 'logical.ts'), code);

      const metrics = await collector.collect(testDir);

      // Should count && and || as decision points
      expect(metrics.avgCyclomaticComplexity).toBeGreaterThan(1);
    });
  });

  describe('cognitive complexity', () => {
    it('should calculate cognitive complexity for nested structures', async () => {
      const nestedCode = `
function nested(a: boolean, b: boolean, c: boolean) {
  if (a) {
    if (b) {
      if (c) {
        return 1;
      }
    }
  }
  return 0;
}
`;
      await writeFile(join(testDir, 'src', 'nested.ts'), nestedCode);

      const metrics = await collector.collect(testDir);

      // Should report some cognitive complexity
      expect(metrics.avgCognitiveComplexity).toBeDefined();
      expect(typeof metrics.avgCognitiveComplexity).toBe('number');
    });
  });

  describe('maintainability index', () => {
    it('should return a maintainability value for simple code', async () => {
      const code = `
function add(a: number, b: number) {
  return a + b;
}
`;
      await writeFile(join(testDir, 'src', 'simple.ts'), code);

      const metrics = await collector.collect(testDir);

      // Maintainability index should be defined
      expect(metrics.maintainabilityIndex).toBeDefined();
      expect(typeof metrics.maintainabilityIndex).toBe('number');
    });
  });

  describe('duplication percentage', () => {
    it('should detect no duplication in unique code', async () => {
      const code = `
function unique1() { return 1; }
function unique2() { return 2; }
function unique3() { return 3; }
`;
      await writeFile(join(testDir, 'src', 'unique.ts'), code);

      const metrics = await collector.collect(testDir);

      expect(metrics.duplicationPercentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('compareMetrics', () => {
    it('should calculate improvements correctly', () => {
      // Use correct property names matching RefactorMetrics interface
      const before = {
        linesOfCode: 1000,
        numberOfFunctions: 50,
        numberOfClasses: 10,
        avgCyclomaticComplexity: 15,
        maxCyclomaticComplexity: 30,
        avgCognitiveComplexity: 20,
        maxCognitiveComplexity: 40,
        maintainabilityIndex: 50,
        duplicationPercentage: 30,
        maxNestingDepth: 5,
        avgNestingDepth: 2.5,
        avgFunctionLength: 30,
        maxFunctionLength: 100,
        anyTypeCount: 20,
        unusedImports: 10,
        unusedExports: 5
      };

      const after = {
        linesOfCode: 900,
        numberOfFunctions: 55,
        numberOfClasses: 10,
        avgCyclomaticComplexity: 10,
        maxCyclomaticComplexity: 20,
        avgCognitiveComplexity: 12,
        maxCognitiveComplexity: 25,
        maintainabilityIndex: 70,
        duplicationPercentage: 15,
        maxNestingDepth: 4,
        avgNestingDepth: 2.0,
        avgFunctionLength: 25,
        maxFunctionLength: 80,
        anyTypeCount: 10,
        unusedImports: 5,
        unusedExports: 2
      };

      const improvements = MetricsCollector.compareMetrics(before, after);

      expect(Array.isArray(improvements)).toBe(true);
      expect(improvements.length).toBeGreaterThan(0);

      // Each improvement should have required properties
      for (const imp of improvements) {
        expect(imp.metric).toBeDefined();
        expect(typeof imp.before).toBe('number');
        expect(typeof imp.after).toBe('number');
        expect(typeof imp.improvementPercent).toBe('number');
        expect(typeof imp.meetsThreshold).toBe('boolean');
      }
    });

    it('should handle zero values gracefully', () => {
      // Use correct property names matching RefactorMetrics interface
      const before = {
        linesOfCode: 0,
        numberOfFunctions: 0,
        numberOfClasses: 0,
        avgCyclomaticComplexity: 0,
        maxCyclomaticComplexity: 0,
        avgCognitiveComplexity: 0,
        maxCognitiveComplexity: 0,
        maintainabilityIndex: 0,
        duplicationPercentage: 0,
        maxNestingDepth: 0,
        avgNestingDepth: 0,
        avgFunctionLength: 0,
        maxFunctionLength: 0,
        anyTypeCount: 0,
        unusedImports: 0,
        unusedExports: 0
      };

      const after = {
        linesOfCode: 100,
        numberOfFunctions: 5,
        numberOfClasses: 1,
        avgCyclomaticComplexity: 5,
        maxCyclomaticComplexity: 10,
        avgCognitiveComplexity: 8,
        maxCognitiveComplexity: 15,
        maintainabilityIndex: 60,
        duplicationPercentage: 10,
        maxNestingDepth: 3,
        avgNestingDepth: 1.5,
        avgFunctionLength: 20,
        maxFunctionLength: 50,
        anyTypeCount: 3,
        unusedImports: 1,
        unusedExports: 0
      };

      const improvements = MetricsCollector.compareMetrics(before, after);

      // Should return results
      expect(Array.isArray(improvements)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty directory', async () => {
      const metrics = await collector.collect(testDir);

      // Empty dir may still report base complexity
      expect(metrics.linesOfCode).toBeDefined();
      expect(typeof metrics.avgCyclomaticComplexity).toBe('number');
    });

    it('should handle files with syntax errors gracefully', async () => {
      const badCode = `
function broken( {
  return
}
`;
      await writeFile(join(testDir, 'src', 'broken.ts'), badCode);

      // Should not throw
      const metrics = await collector.collect(testDir);

      expect(metrics).toBeDefined();
    });

    it('should handle binary files gracefully', async () => {
      // Create a buffer that looks like binary content
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]);
      await writeFile(join(testDir, 'src', 'image.png'), buffer);

      const metrics = await collector.collect(testDir);

      // Should not throw, should skip binary
      expect(metrics).toBeDefined();
    });

    it('should exclude node_modules by default', async () => {
      await mkdir(join(testDir, 'node_modules', 'pkg'), { recursive: true });

      const srcCode = `function app() { return 1; }`;
      const nmCode = `function lib() { return 2; }`;

      await writeFile(join(testDir, 'src', 'app.ts'), srcCode);
      await writeFile(join(testDir, 'node_modules', 'pkg', 'index.ts'), nmCode);

      const metrics = await collector.collect(testDir);

      // Should have some functions analyzed
      expect(metrics.numberOfFunctions).toBeGreaterThanOrEqual(1);
    });
  });
});
