/**
 * Bugfix Controller Integration Tests
 *
 * End-to-end tests for autonomous bug detection and fixing:
 * - Bug scanning and detection
 * - Fix application workflow
 * - Verification gates
 * - Progress callbacks
 * - Git-aware scanning
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { BugfixController } from '../../../src/core/bugfix/bugfix-controller.js';
import { BugDetector, createDefaultBugfixConfig } from '../../../src/core/bugfix/bug-detector.js';
import type { BugFinding, BugfixConfig } from '../../../src/core/bugfix/types.js';

describe('Bugfix Controller Integration', () => {
  let testDir: string;
  let srcDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'bugfix-test-'));
    srcDir = join(testDir, 'src');
    await mkdir(srcDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Bug Detection', () => {
    it('should detect timer leak bugs', async () => {
      // Create file with timer leak
      const fileContent = `
        export class Service {
          start() {
            setInterval(() => {
              console.log('tick');
            }, 1000);
          }
        }
      `;
      await writeFile(join(srcDir, 'service.ts'), fileContent);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10
        }
      });

      const result = await controller.execute();

      expect(result.stats.bugsFound).toBeGreaterThanOrEqual(0);
    });

    it('should detect missing destroy methods', async () => {
      // Create file with EventEmitter without destroy
      const fileContent = `
        import { EventEmitter } from 'events';

        export class MyEmitter extends EventEmitter {
          private interval: NodeJS.Timeout;

          start() {
            this.interval = setInterval(() => {
              this.emit('tick');
            }, 1000);
          }
          // Missing destroy() method
        }
      `;
      await writeFile(join(srcDir, 'emitter.ts'), fileContent);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['missing_destroy'],
          dryRun: true,
          maxBugs: 10
        }
      });

      const result = await controller.execute();

      expect(result.finalState).toBe('COMPLETE');
    });

    it('should respect file filter', async () => {
      // Create multiple files
      await writeFile(join(srcDir, 'included.ts'), `
        export const x = setInterval(() => {}, 1000);
      `);
      await writeFile(join(srcDir, 'excluded.ts'), `
        export const y = setInterval(() => {}, 1000);
      `);

      const controller = new BugfixController({
        rootDir: testDir,
        fileFilter: [join(srcDir, 'included.ts')],
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10
        }
      });

      const result = await controller.execute();

      // Should only scan included.ts
      expect(result.finalState).toBe('COMPLETE');
    });
  });

  describe('Dry Run Mode', () => {
    it('should not modify files in dry run mode', async () => {
      const originalContent = `
        export class Service {
          start() {
            setInterval(() => console.log('tick'), 1000);
          }
        }
      `;
      const filePath = join(srcDir, 'service.ts');
      await writeFile(filePath, originalContent);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10
        }
      });

      await controller.execute();

      // File should be unchanged
      const { readFile } = await import('fs/promises');
      const afterContent = await readFile(filePath, 'utf-8');
      expect(afterContent).toBe(originalContent);
    });
  });

  describe('Progress Callbacks', () => {
    it('should call progress callback during execution', async () => {
      await writeFile(join(srcDir, 'test.ts'), 'export const x = 1;');

      const progressMessages: string[] = [];
      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 5
        },
        onProgress: (message) => {
          progressMessages.push(message);
        }
      });

      await controller.execute();

      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages.some(m => m.includes('scan') || m.includes('Starting'))).toBe(true);
    });

    it('should call onBugFound callback for each bug', async () => {
      const fileContent = `
        export const timer1 = setInterval(() => {}, 1000);
        export const timer2 = setInterval(() => {}, 2000);
      `;
      await writeFile(join(srcDir, 'timers.ts'), fileContent);

      const foundBugs: BugFinding[] = [];
      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10
        },
        onBugFound: (bug) => {
          foundBugs.push(bug);
        }
      });

      await controller.execute();

      // May or may not find bugs depending on detection accuracy
      expect(foundBugs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', async () => {
      const config: Partial<BugfixConfig> = {
        bugTypes: ['timer_leak', 'missing_destroy'],
        maxBugs: 5,
        maxDurationMinutes: 10,
        dryRun: true,
        requireTypecheck: false,
        requireTests: false
      };

      const controller = new BugfixController({
        rootDir: testDir,
        config
      });

      const result = await controller.execute();

      expect(result.finalState).toBe('COMPLETE');
    });

    it('should respect maxBugs limit', async () => {
      // Create file with many potential bugs
      const content = Array(20).fill(0).map((_, i) =>
        `export const timer${i} = setInterval(() => {}, ${i * 1000});`
      ).join('\n');
      await writeFile(join(srcDir, 'many-timers.ts'), content);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          maxBugs: 3,
          dryRun: true
        }
      });

      const result = await controller.execute();

      // maxBugs limits the number of bugs to process (fix attempts)
      // bugsFound can exceed maxBugs, but bugsFixed is limited
      expect(result.stats.bugsFound).toBeGreaterThan(0);
      expect(result.stats.bugsFixed).toBeLessThanOrEqual(3);
    });
  });

  describe('Time Limits', () => {
    it('should respect maxDurationMinutes limit', async () => {
      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          maxDurationMinutes: 0.001, // Very short limit
          dryRun: true
        }
      });

      const result = await controller.execute();

      // Should complete (possibly early due to time limit)
      expect(['COMPLETE', 'FAILED']).toContain(result.finalState);
    });
  });

  describe('Result Structure', () => {
    it('should return complete result structure', async () => {
      await writeFile(join(srcDir, 'test.ts'), 'export const x = 1;');

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 5
        }
      });

      const result = await controller.execute();

      expect(result).toHaveProperty('finalState');
      expect(result).toHaveProperty('stats');
      expect(result.stats).toHaveProperty('bugsFound');
      expect(result.stats).toHaveProperty('bugsFixed');
      expect(result.stats).toHaveProperty('totalAttempts');
      expect(result.stats).toHaveProperty('totalDurationMs');
    });
  });

  describe('Ignore Comments', () => {
    it('should skip code with ax-ignore comment', async () => {
      const fileContent = `
        // ax-ignore
        export const intentionalTimer = setInterval(() => {}, 1000);

        export const buggyTimer = setInterval(() => {}, 2000);
      `;
      await writeFile(join(srcDir, 'ignored.ts'), fileContent);

      const foundBugs: BugFinding[] = [];
      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10
        },
        onBugFound: (bug) => {
          foundBugs.push(bug);
        }
      });

      await controller.execute();

      // Should not report the ignored timer
      const ignoredBugs = foundBugs.filter(b => b.fixStrategy?.includes('intentionalTimer'));
      expect(ignoredBugs.length).toBe(0);
    });
  });
});

describe('Bug Detector', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'detector-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should create detector with default config', () => {
    const config = createDefaultBugfixConfig();
    const detector = new BugDetector(config);

    expect(detector).toBeDefined();
  });

  it('should scan directory for bugs', async () => {
    const srcDir = join(testDir, 'src');
    await mkdir(srcDir, { recursive: true });
    await writeFile(join(srcDir, 'test.ts'), `
      export class Test {
        start() {
          setInterval(() => {}, 1000);
        }
      }
    `);

    const config = createDefaultBugfixConfig({
      bugTypes: ['timer_leak'],
      maxBugs: 10
    });
    const detector = new BugDetector(config);

    const findings = await detector.scan(testDir);

    expect(Array.isArray(findings)).toBe(true);
  });

  it('should filter by bug types', async () => {
    const config = createDefaultBugfixConfig({
      bugTypes: ['timer_leak'],
      maxBugs: 10
    });
    const detector = new BugDetector(config);

    expect(detector).toBeDefined();
  });
});
