/**
 * Refactor Controller Tests
 *
 * @module tests/unit/core/refactor/refactor-controller
 * @since v12.10.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { RefactorController } from '../../../../src/core/refactor/refactor-controller.js';
import { createDefaultRefactorConfig } from '../../../../src/core/refactor/types.js';
import type { RefactorState, RefactorFinding } from '../../../../src/core/refactor/types.js';

describe('RefactorController', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `refactor-controller-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'src'), { recursive: true });
    await mkdir(join(testDir, '.automatosx', 'backups'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('execute', () => {
    it('should complete with no findings when code is clean', async () => {
      const code = `const greeting = 'Hello, World!';
export function sayHello() {
  return greeting;
}`;
      await writeFile(join(testDir, 'src', 'clean.ts'), code);

      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['dead_code'],
          maxFindings: 10,
          dryRun: true,
        },
      });

      const result = await controller.execute();

      expect(result.finalState).toBe('COMPLETE');
      expect(result.stats).toBeDefined();
    });

    it('should detect refactoring opportunities', async () => {
      const code = `
import { unused1, unused2 } from './utils';
const magicNumber = 42;
const unusedVar = 'never used';

export function process() {
  return magicNumber;
}`;
      await writeFile(join(testDir, 'src', 'issues.ts'), code);

      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['dead_code', 'hardcoded_values'],
          maxFindings: 10,
          dryRun: true,
        },
      });

      const result = await controller.execute();

      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.finalState).toBe('COMPLETE');
    });

    it('should respect maxFindings limit', async () => {
      // Create many issues
      const code = `
const a = 1;
const b = 2;
const c = 3;
const d = 4;
const e = 5;
const f = 6;
const g = 7;
const h = 8;
const i = 9;
const j = 10;
export function x() { return 1; }`;
      await writeFile(join(testDir, 'src', 'many.ts'), code);

      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['dead_code'],
          maxFindings: 3,
          dryRun: true,
        },
      });

      const result = await controller.execute();

      expect(result.findings.length).toBeLessThanOrEqual(3);
    });

    it('should call onProgress callback during execution', async () => {
      const code = `const x = 1;\nexport const y = x;`;
      await writeFile(join(testDir, 'src', 'progress.ts'), code);

      const progressMessages: string[] = [];

      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['dead_code'],
          dryRun: true,
        },
        onProgress: (state, message) => {
          progressMessages.push(message);
        },
      });

      await controller.execute();

      expect(progressMessages.length).toBeGreaterThan(0);
    });

    it('should call onFindingFound callback for each finding', async () => {
      const code = `
import { foo } from './bar';
const unused = 'test';
export function baz() { return 1; }`;
      await writeFile(join(testDir, 'src', 'callbacks.ts'), code);

      const foundFindings: RefactorFinding[] = [];

      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['dead_code'],
          dryRun: true,
        },
        onFindingFound: (finding) => {
          foundFindings.push(finding);
        },
      });

      await controller.execute();

      expect(foundFindings.length).toBeGreaterThan(0);
      foundFindings.forEach((f) => {
        expect(f.id).toBeDefined();
        expect(f.type).toBeDefined();
        expect(f.file).toBeDefined();
      });
    });
  });

  describe('state management', () => {
    it('should track state throughout execution', async () => {
      const code = `export const x = 1;`;
      await writeFile(join(testDir, 'src', 'state.ts'), code);

      const states: RefactorState[] = [];

      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['dead_code'],
          dryRun: true,
        },
        onProgress: () => {
          states.push(controller.getState());
        },
      });

      expect(controller.getState()).toBe('IDLE');

      await controller.execute();

      expect(controller.getState()).toBe('COMPLETE');
    });

    it('should include stats in execution result', async () => {
      const code = `const x = 1; export const y = x;`;
      await writeFile(join(testDir, 'src', 'stats.ts'), code);

      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['dead_code'],
          dryRun: true,
        },
      });

      const result = await controller.execute();

      expect(result.stats).toBeDefined();
      expect(result.stats.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stop', () => {
    // Skip: stop() method not yet implemented in RefactorController
    it.skip('should stop execution when stop is called', async () => {
      // Create many files to ensure long execution
      for (let i = 0; i < 10; i++) {
        const code = `const unused${i} = ${i};\nexport const x${i} = 1;`;
        await writeFile(join(testDir, 'src', `file${i}.ts`), code);
      }

      let stopped = false;
      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['dead_code', 'hardcoded_values'],
          maxFindings: 50,
          dryRun: true,
        },
        onProgress: (state, _msg) => {
          if (!stopped && state === 'SCANNING') {
            stopped = true;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (controller as any).stop?.();
          }
        },
      });

      const result = await controller.execute();

      // When stopped early, the state depends on implementation
      // It may be COMPLETE or FAILED depending on when stop is called
      expect(['COMPLETE', 'FAILED']).toContain(result.finalState);
    });
  });

  describe('result', () => {
    it('should include all required fields in result', async () => {
      const code = `const x = 42; export const y = x;`;
      await writeFile(join(testDir, 'src', 'result.ts'), code);

      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['hardcoded_values'],
          maxFindings: 5,
          dryRun: true,
        },
      });

      const result = await controller.execute();

      expect(result.sessionId).toBeDefined();
      expect(result.startedAt).toBeDefined();
      expect(result.endedAt).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.findings).toBeDefined();
      expect(result.attempts).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.finalState).toBeDefined();
    });

    it('should include stats breakdown', async () => {
      const code = `
const magic = 42;
const unused = 'test';
export function fn() { return magic; }`;
      await writeFile(join(testDir, 'src', 'breakdown.ts'), code);

      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['dead_code', 'hardcoded_values'],
          dryRun: true,
        },
      });

      const result = await controller.execute();

      expect(result.stats.opportunitiesByType).toBeDefined();
      expect(result.stats.opportunitiesBySeverity).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle non-existent directory gracefully', async () => {
      const controller = new RefactorController({
        rootDir: '/nonexistent/path',
        config: {
          focusAreas: ['dead_code'],
          dryRun: true,
        },
      });

      const result = await controller.execute();

      // Non-existent directory results in FAILED state (no files to scan)
      expect(['COMPLETE', 'FAILED']).toContain(result.finalState);
      expect(result.findings).toHaveLength(0);
    });

    it('should handle file read errors gracefully', async () => {
      // Create a directory with the same name as a file to cause read error
      await mkdir(join(testDir, 'src', 'notafile.ts'), { recursive: true });

      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['dead_code'],
          dryRun: true,
        },
      });

      const result = await controller.execute();

      // Should complete without crashing
      expect(result.finalState).toBe('COMPLETE');
    });
  });

  describe('configuration', () => {
    it('should use default config when not provided', async () => {
      const controller = new RefactorController({
        rootDir: testDir,
      });

      const result = await controller.execute();

      expect(result.config).toBeDefined();
      expect(result.config.focusAreas.length).toBeGreaterThan(0);
    });

    it('should merge provided config with defaults', async () => {
      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          maxFindings: 5,
        },
      });

      const result = await controller.execute();

      expect(result.config.maxFindings).toBe(5);
      expect(result.config.focusAreas.length).toBeGreaterThan(0);
    });

    it('should respect dryRun mode', async () => {
      const code = `const unused = 1; export const x = 2;`;
      const filePath = join(testDir, 'src', 'dryrun.ts');
      await writeFile(filePath, code);

      const controller = new RefactorController({
        rootDir: testDir,
        config: {
          focusAreas: ['dead_code'],
          dryRun: true,
        },
      });

      await controller.execute();

      // File should be unchanged in dry-run mode
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe(code);
    });
  });

  describe('focus areas', () => {
    const focusAreas = [
      'dead_code',
      'type_safety',
      'conditionals',
      'hardcoded_values',
      'naming',
      'duplication',
      'readability',
      'performance',
    ] as const;

    focusAreas.forEach((focusArea) => {
      it(`should support ${focusArea} focus area`, async () => {
        const code = `export const x = 1;`;
        await writeFile(join(testDir, 'src', 'focus.ts'), code);

        const controller = new RefactorController({
          rootDir: testDir,
          config: {
            focusAreas: [focusArea],
            dryRun: true,
          },
        });

        const result = await controller.execute();

        expect(result.finalState).toBe('COMPLETE');
        expect(result.config.focusAreas).toContain(focusArea);
      });
    });
  });

  describe('resolveFilePath', () => {
    it('should resolve relative paths correctly', async () => {
      const code = `export const x = 1;`;
      await writeFile(join(testDir, 'src', 'relative.ts'), code);

      const controller = new RefactorController({
        rootDir: testDir,
        config: { dryRun: true },
      });

      // Access private method via bracket notation for testing
      const resolved = (controller as any).resolveFilePath('src/relative.ts');

      expect(resolved).toBe(join(testDir, 'src', 'relative.ts'));
    });

    it('should keep absolute paths unchanged', async () => {
      const absolutePath = '/absolute/path/to/file.ts';

      const controller = new RefactorController({
        rootDir: testDir,
        config: { dryRun: true },
      });

      const resolved = (controller as any).resolveFilePath(absolutePath);

      expect(resolved).toBe(absolutePath);
    });
  });
});

describe('createDefaultRefactorConfig', () => {
  it('should create config with default values', () => {
    const config = createDefaultRefactorConfig();

    expect(config.focusAreas).toBeDefined();
    expect(config.maxFindings).toBeDefined();
    expect(config.maxChangesPerFile).toBeDefined();
    expect(config.maxLinesChanged).toBeDefined();
    expect(config.maxDurationMinutes).toBeDefined();
    expect(config.maxIterations).toBeDefined();
    expect(config.dryRun).toBeDefined();
    expect(config.requireTests).toBeDefined();
    expect(config.requireTypecheck).toBeDefined();
    expect(config.conservative).toBeDefined();
    expect(config.minConfidence).toBeDefined();
    expect(config.severityThreshold).toBeDefined();
  });

  it('should allow overriding default values', () => {
    const config = createDefaultRefactorConfig({
      maxFindings: 5,
      dryRun: true,
      focusAreas: ['dead_code'],
    });

    expect(config.maxFindings).toBe(5);
    expect(config.dryRun).toBe(true);
    expect(config.focusAreas).toEqual(['dead_code']);
  });

  it('should have sensible defaults', () => {
    const config = createDefaultRefactorConfig();

    expect(config.maxFindings).toBeGreaterThan(0);
    expect(config.maxChangesPerFile).toBeGreaterThan(0);
    expect(config.minConfidence).toBeGreaterThan(0);
    expect(config.minConfidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(config.excludePatterns)).toBe(true);
    expect(config.excludePatterns).toContain('node_modules');
  });

  it('should include all focus areas by default', () => {
    const config = createDefaultRefactorConfig();

    const expectedFocusAreas = [
      'duplication',
      'readability',
      'performance',
      'hardcoded_values',
      'naming',
      'conditionals',
      'dead_code',
      'type_safety',
    ];

    expectedFocusAreas.forEach((area) => {
      expect(config.focusAreas).toContain(area);
    });
  });
});
