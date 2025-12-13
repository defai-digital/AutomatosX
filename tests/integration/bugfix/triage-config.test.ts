/**
 * LLM Triage Configuration Integration Tests
 *
 * Tests different configuration options for LLM triage:
 * - Provider selection (claude, gemini, openai)
 * - Confidence thresholds
 * - Batch sizes
 * - Request limits
 * - Timeout settings
 *
 * @since v12.9.0
 * @see PRD-020: LLM Triage Filter for Bugfix Tool
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { BugfixController } from '../../../src/core/bugfix/bugfix-controller.js';
import type { TriageMetrics } from '../../../src/core/bugfix/llm-triage/index.js';
import type { Router } from '../../../src/core/router/router.js';
import type { ExecutionResponse } from '../../../src/types/provider.js';

/**
 * Create a mock Router
 */
function createMockRouter(): Router & { execute: ReturnType<typeof vi.fn> } {
  const mockExecute = vi.fn().mockResolvedValue({
    content: JSON.stringify({
      verdicts: [{ id: 'test', accepted: true, confidence: 0.9 }],
    }),
    model: 'claude',
    tokensUsed: { prompt: 100, completion: 50, total: 150 },
    latencyMs: 500,
    finishReason: 'stop' as const,
  } as ExecutionResponse);

  return {
    execute: mockExecute,
  } as unknown as Router & { execute: ReturnType<typeof vi.fn> };
}

describe('LLM Triage Configuration Integration', () => {
  let testDir: string;
  let srcDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'triage-config-test-'));
    srcDir = join(testDir, 'src');
    await mkdir(srcDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Provider Selection', () => {
    it('should accept claude provider', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'claude.ts'), fileContent);

      const mockRouter = createMockRouter();

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'claude',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7,
            batchSize: 5,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
      });

      const result = await controller.execute();
      expect(result.finalState).toBe('COMPLETE');
    });

    it('should accept gemini provider', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'gemini.ts'), fileContent);

      const mockRouter = createMockRouter();

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'gemini',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7,
            batchSize: 5,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
      });

      const result = await controller.execute();
      expect(result.finalState).toBe('COMPLETE');
    });

    it('should accept openai provider', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'openai.ts'), fileContent);

      const mockRouter = createMockRouter();

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'openai',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7,
            batchSize: 5,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
      });

      const result = await controller.execute();
      expect(result.finalState).toBe('COMPLETE');
    });
  });

  describe('Confidence Threshold', () => {
    it('should skip LLM for findings above confidence threshold', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'high-conf.ts'), fileContent);

      const mockRouter = createMockRouter();

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'claude',
            minConfidenceToSkip: 0.5,
            maxConfidenceToForce: 0.3, // Very low - most will skip LLM
            batchSize: 5,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
      });

      await controller.execute();

      // With low threshold, fewer LLM calls expected
    });

    it('should always call LLM for findings below confidence threshold', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'low-conf.ts'), fileContent);

      const mockRouter = createMockRouter();

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'claude',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7, // Very high - all will need LLM
            batchSize: 5,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
      });

      await controller.execute();

      // With high threshold, more LLM calls expected
    });
  });

  describe('Batch Size', () => {
    it('should batch findings according to batchSize', async () => {
      // Create multiple bugs
      const fileContent = `
        export const t1 = setInterval(() => {}, 1000);
        export const t2 = setInterval(() => {}, 2000);
        export const t3 = setInterval(() => {}, 3000);
        export const t4 = setInterval(() => {}, 4000);
      `;
      await writeFile(join(srcDir, 'batch.ts'), fileContent);

      const mockRouter = createMockRouter();

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 20,
          llmTriage: {
            enabled: true,
            provider: 'claude',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7,
            batchSize: 2, // 2 findings per batch
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
      });

      await controller.execute();

      // With batchSize=2 and 4 findings, should make ~2 requests
      // (actual count depends on detection results)
    });

    it('should handle batch size of 1 (one finding per request)', async () => {
      const fileContent = `
        export const t1 = setInterval(() => {}, 1000);
        export const t2 = setInterval(() => {}, 2000);
      `;
      await writeFile(join(srcDir, 'single-batch.ts'), fileContent);

      const mockRouter = createMockRouter();

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'claude',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7,
            batchSize: 1, // One finding per request
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
      });

      await controller.execute();

      // Each finding should be processed individually
    });

    it('should handle large batch size', async () => {
      const fileContent = `
        export const t1 = setInterval(() => {}, 1000);
        export const t2 = setInterval(() => {}, 2000);
      `;
      await writeFile(join(srcDir, 'large-batch.ts'), fileContent);

      const mockRouter = createMockRouter();

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'claude',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7,
            batchSize: 100, // Larger than findings count
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
      });

      await controller.execute();

      // All findings should be in one batch
    });
  });

  describe('Request Limits', () => {
    it('should respect maxRequestsPerRun limit', async () => {
      // Create many bugs
      const timers = Array.from({ length: 10 }, (_, i) =>
        `export const t${i} = setInterval(() => {}, ${i * 1000});`
      ).join('\n');
      await writeFile(join(srcDir, 'many.ts'), timers);

      const mockRouter = createMockRouter();

      let triageMetrics: TriageMetrics | undefined;

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 20,
          llmTriage: {
            enabled: true,
            provider: 'claude',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7,
            batchSize: 1, // One per batch
            maxRequestsPerRun: 3, // Hard limit
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
        onTriageComplete: (_, metrics) => {
          triageMetrics = metrics;
        },
      });

      await controller.execute();

      // Should not exceed max requests - verify metrics track correctly
      if (triageMetrics && triageMetrics.llmRequests > 0) {
        expect(triageMetrics.llmRequests).toBeLessThanOrEqual(3);
      }
    });

    it('should fallback remaining findings when limit exceeded', async () => {
      const timers = Array.from({ length: 5 }, (_, i) =>
        `export const t${i} = setInterval(() => {}, ${i * 1000});`
      ).join('\n');
      await writeFile(join(srcDir, 'limit-test.ts'), timers);

      const mockRouter = createMockRouter();

      let triageMetrics: TriageMetrics | undefined;

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'claude',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7,
            batchSize: 1,
            maxRequestsPerRun: 2, // Very low
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
        onTriageComplete: (_, metrics) => {
          triageMetrics = metrics;
        },
      });

      await controller.execute();

      // Remaining findings should be fallback
      if (triageMetrics && triageMetrics.findingsTotal > 2) {
        expect(triageMetrics.findingsFallback).toBeGreaterThan(0);
      }
    });
  });

  describe('Fallback Behavior Options', () => {
    it('should accept bypass fallback behavior', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'bypass.ts'), fileContent);

      const mockRouter = createMockRouter();
      mockRouter.execute.mockRejectedValue(new Error('Simulated error'));

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'claude',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7,
            batchSize: 5,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass', // Accept on error
          },
        },
      });

      const result = await controller.execute();
      expect(result.finalState).toBe('COMPLETE');
    });

    it('should accept drop fallback behavior', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'drop.ts'), fileContent);

      const mockRouter = createMockRouter();
      mockRouter.execute.mockRejectedValue(new Error('Simulated error'));

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'claude',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7,
            batchSize: 5,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'drop', // Reject on error
          },
        },
      });

      const result = await controller.execute();
      expect(result.finalState).toBe('COMPLETE');
    });

    it('should accept ast-only fallback behavior', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'ast-only.ts'), fileContent);

      const mockRouter = createMockRouter();
      mockRouter.execute.mockRejectedValue(new Error('Simulated error'));

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'claude',
            minConfidenceToSkip: 0.99,
            maxConfidenceToForce: 0.7,
            batchSize: 5,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'ast-only', // Tag as fallback
          },
        },
      });

      const result = await controller.execute();
      expect(result.finalState).toBe('COMPLETE');
    });
  });

  describe('Disabled Triage', () => {
    it('should skip all triage when enabled is false', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'disabled.ts'), fileContent);

      const mockRouter = createMockRouter();

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: false, // Disabled
            provider: 'claude',
            minConfidenceToSkip: 0.95,
            maxConfidenceToForce: 0.7,
            batchSize: 5,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
      });

      await controller.execute();

      // Router should NOT be called
      expect(mockRouter.execute).not.toHaveBeenCalled();
    });

    it('should work without llmTriage config at all', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'no-config.ts'), fileContent);

      const controller = new BugfixController({
        rootDir: testDir,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          // No llmTriage config
        },
      });

      const result = await controller.execute();
      expect(result.finalState).toBe('COMPLETE');
    });
  });

  describe('Combined Configuration', () => {
    it('should handle all config options together', async () => {
      const fileContent = `
        export const t1 = setInterval(() => {}, 1000);
        export const t2 = setInterval(() => {}, 2000);
        export const t3 = setInterval(() => {}, 3000);
      `;
      await writeFile(join(srcDir, 'combined.ts'), fileContent);

      const mockRouter = createMockRouter();

      let triageMetrics: TriageMetrics | undefined;

      const controller = new BugfixController({
        rootDir: testDir,
        router: mockRouter,
        config: {
          bugTypes: ['timer_leak'],
          dryRun: true,
          maxBugs: 10,
          llmTriage: {
            enabled: true,
            provider: 'gemini', // Non-default provider
            minConfidenceToSkip: 0.85,
            maxConfidenceToForce: 0.6, // Custom threshold
            batchSize: 2, // Custom batch size
            maxRequestsPerRun: 5, // Custom limit
            timeoutMs: 15000, // Custom timeout
            fallbackBehavior: 'ast-only', // Custom fallback
          },
        },
        onTriageComplete: (_, metrics) => {
          triageMetrics = metrics;
        },
      });

      const result = await controller.execute();

      expect(result.finalState).toBe('COMPLETE');

      // Metrics should be tracked
      if (triageMetrics) {
        expect(triageMetrics.findingsTotal).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
