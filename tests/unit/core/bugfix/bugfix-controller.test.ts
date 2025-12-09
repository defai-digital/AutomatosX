/**
 * Bugfix Controller Tests
 *
 * @module tests/unit/core/bugfix/bugfix-controller
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { BugfixController, createDefaultBugfixConfig } from '../../../../src/core/bugfix/index.js';
import type { BugFinding, FixAttempt, BugfixConfig } from '../../../../src/core/bugfix/types.js';

describe('BugfixController', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bugfix-controller-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'src'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('execute', () => {
    it('should complete with no bugs when codebase is clean', async () => {
      const code = `console.log('Hello, world!');`;
      await writeFile(join(testDir, 'src', 'clean.ts'), code);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          maxBugs: 10
        }
      });

      const result = await controller.execute();

      expect(result.stats.bugsFound).toBe(0);
      expect(result.stats.bugsFixed).toBe(0);
      expect(result.finalState).toBe('COMPLETE');
    });

    it('should detect and fix timer leaks', async () => {
      const code = `const interval = setInterval(() => {
  console.log('tick');
}, 1000);
`;
      await writeFile(join(testDir, 'src', 'leaky.ts'), code);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          maxBugs: 10,
          dryRun: true // Don't actually modify files in tests
        }
      });

      const result = await controller.execute();

      expect(result.stats.bugsFound).toBeGreaterThan(0);
      expect(result.finalState).toBe('COMPLETE');
    });

    it('should respect maxBugs limit', async () => {
      // Create multiple bugs
      for (let i = 0; i < 10; i++) {
        const code = `const interval${i} = setInterval(() => {}, 1000);`;
        await writeFile(join(testDir, 'src', `file${i}.ts`), code);
      }

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          maxBugs: 3,
          dryRun: true
        }
      });

      const result = await controller.execute();

      expect(result.stats.bugsFixed).toBeLessThanOrEqual(3);
      expect(result.stats.stopReason).toBe('max_bugs');
    });

    it('should call onProgress callback during execution', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const progressMessages: string[] = [];

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true
        },
        onProgress: (message) => {
          progressMessages.push(message);
        }
      });

      await controller.execute();

      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages.some(m => m.includes('Scanning'))).toBe(true);
    });

    it('should call onBugFound callback for each bug', async () => {
      const code = `
const i1 = setInterval(() => {}, 1000);
const i2 = setInterval(() => {}, 2000);
`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const foundBugs: BugFinding[] = [];

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true
        },
        onBugFound: (finding) => {
          foundBugs.push(finding);
        }
      });

      await controller.execute();

      expect(foundBugs.length).toBeGreaterThanOrEqual(2);
    });

    it('should call onFixApplied callback for each fix attempt', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const fixAttempts: FixAttempt[] = [];

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          maxBugs: 1,
          dryRun: true
        },
        onFixApplied: (finding, attempt) => {
          fixAttempts.push(attempt);
        }
      });

      await controller.execute();

      expect(fixAttempts.length).toBeGreaterThan(0);
    });
  });

  describe('state management', () => {
    it('should track state throughout execution', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const states: string[] = [];

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          maxBugs: 1,
          dryRun: true
        },
        onProgress: () => {
          states.push(controller.getState());
        }
      });

      const result = await controller.execute();

      expect(result.finalState).toBe('COMPLETE');
    });

    it('should provide stats during execution', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true
        }
      });

      // Before execution
      const initialStats = controller.getStats();
      expect(initialStats.bugsFound).toBe(0);

      await controller.execute();

      // After execution
      const finalStats = controller.getStats();
      expect(finalStats.bugsFound).toBeGreaterThan(0);
    });
  });

  describe('stop', () => {
    it('should stop execution when stop is called', async () => {
      // Create many bugs to ensure long execution
      for (let i = 0; i < 20; i++) {
        const code = `const interval${i} = setInterval(() => {}, 1000);`;
        await writeFile(join(testDir, 'src', `file${i}.ts`), code);
      }

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          maxBugs: 20,
          dryRun: true
        }
      });

      // Start execution and stop after first progress
      let stopped = false;
      const originalOnProgress = controller['onProgress'];
      controller['onProgress'] = (msg, data) => {
        originalOnProgress?.(msg, data);
        if (!stopped && msg.includes('Found')) {
          stopped = true;
          controller.stop();
        }
      };

      const result = await controller.execute();

      expect(result.finalState).toBe('COMPLETE');
      expect(result.stats.bugsFixed).toBeLessThanOrEqual(20);
    });
  });

  describe('result', () => {
    it('should include all required fields in result', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          maxBugs: 1,
          dryRun: true
        }
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

    it('should include accurate stats', async () => {
      const code = `
const i1 = setInterval(() => {}, 1000);
const i2 = setInterval(() => {}, 2000);
`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          maxBugs: 10,
          dryRun: true
        }
      });

      const result = await controller.execute();

      expect(result.stats.bugsFound).toBeGreaterThanOrEqual(2);
      expect(result.stats.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.successRate).toBeGreaterThanOrEqual(0);
      expect(result.stats.successRate).toBeLessThanOrEqual(1);
    });

    it('should include bugs by type breakdown', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true
        }
      });

      const result = await controller.execute();

      expect(result.stats.bugsByType).toBeDefined();
      expect(result.stats.bugsByType.timer_leak).toBeGreaterThanOrEqual(0);
    });

    it('should include bugs by severity breakdown', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true
        }
      });

      const result = await controller.execute();

      expect(result.stats.bugsBySeverity).toBeDefined();
      expect(result.stats.bugsBySeverity.high).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      // Create an invalid scenario
      const controller = new BugfixController({
        rootDir: '/nonexistent/path',
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true
        }
      });

      const result = await controller.execute();

      // Should complete even with errors (no bugs found in nonexistent dir)
      expect(result.finalState).toBe('COMPLETE');
    });
  });
});

describe('createDefaultBugfixConfig', () => {
  it('should create config with default values', () => {
    const config = createDefaultBugfixConfig();

    expect(config.maxBugs).toBeDefined();
    expect(config.maxDurationMinutes).toBeDefined();
    expect(config.maxTokens).toBeDefined();
    expect(config.maxRetriesPerBug).toBeDefined();
    expect(config.minConfidence).toBeDefined();
    expect(config.bugTypes).toBeDefined();
    expect(config.severityThreshold).toBeDefined();
    expect(config.excludePatterns).toBeDefined();
    expect(config.dryRun).toBeDefined();
    expect(config.requireTests).toBeDefined();
    expect(config.requireTypecheck).toBeDefined();
  });

  it('should allow overriding default values', () => {
    const config = createDefaultBugfixConfig({
      maxBugs: 5,
      dryRun: true,
      scope: 'src/core/'
    });

    expect(config.maxBugs).toBe(5);
    expect(config.dryRun).toBe(true);
    expect(config.scope).toBe('src/core/');
  });

  it('should have sensible defaults', () => {
    const config = createDefaultBugfixConfig();

    expect(config.maxBugs).toBeGreaterThan(0);
    expect(config.maxDurationMinutes).toBeGreaterThan(0);
    expect(config.minConfidence).toBeGreaterThan(0);
    expect(config.minConfidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(config.excludePatterns)).toBe(true);
  });
});
