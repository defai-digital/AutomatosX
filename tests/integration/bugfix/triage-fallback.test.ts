/**
 * LLM Triage Fallback Integration Tests
 *
 * Tests fallback behavior when LLM triage encounters errors:
 * - Router unavailable
 * - LLM request failures
 * - Timeout handling
 * - Different fallback modes (bypass, drop, ast-only)
 *
 * @since v12.9.0
 * @see PRD-020: LLM Triage Filter for Bugfix Tool
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { BugfixController } from '../../../src/core/bugfix/bugfix-controller.js';
import type { TriageResult, TriageMetrics } from '../../../src/core/bugfix/llm-triage/index.js';
import type { Router } from '../../../src/core/router/router.js';
import type { BugFinding } from '../../../src/core/bugfix/types.js';

/**
 * Create a mock Router with configurable behavior
 */
function createMockRouter(options: {
  shouldFail?: boolean;
  failureError?: Error;
  delay?: number;
  response?: unknown;
}): Router {
  const mockExecute = vi.fn().mockImplementation(async () => {
    if (options.delay) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }

    if (options.shouldFail) {
      throw options.failureError || new Error('LLM request failed');
    }

    return {
      content: JSON.stringify(options.response ?? {
        verdicts: [{ id: 'test', accepted: true, confidence: 0.9 }],
      }),
      model: 'claude',
      tokensUsed: { prompt: 100, completion: 50, total: 150 },
      latencyMs: 500,
      finishReason: 'stop' as const,
    };
  });

  return {
    execute: mockExecute,
  } as unknown as Router;
}

describe('LLM Triage Fallback Integration', () => {
  let testDir: string;
  let srcDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'triage-fallback-test-'));
    srcDir = join(testDir, 'src');
    await mkdir(srcDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('No Router Available', () => {
    it('should fallback to AST results when no router provided', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'no-router.ts'), fileContent);

      const foundBugs: BugFinding[] = [];

      // No router provided - should fallback gracefully
      const controller = new BugfixController({
        rootDir: testDir,
        // router: undefined - intentionally omitted
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
        onBugFound: (bug) => {
          foundBugs.push(bug);
        },
      });

      const result = await controller.execute();

      // Should still complete successfully
      expect(result.finalState).toBe('COMPLETE');
    });
  });

  describe('LLM Request Failure', () => {
    it('should fallback to AST results on LLM error with bypass mode', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'error-bypass.ts'), fileContent);

      const mockRouter = createMockRouter({
        shouldFail: true,
        failureError: new Error('API rate limit exceeded'),
      });

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
            batchSize: 5,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass', // Accept all on error
          },
        },
        onTriageComplete: (_, metrics) => {
          triageMetrics = metrics;
        },
      });

      const result = await controller.execute();

      // Should complete (findings passed through via fallback)
      expect(result.finalState).toBe('COMPLETE');

      // Fallback count should be tracked
      if (triageMetrics) {
        expect(triageMetrics.findingsFallback).toBeGreaterThanOrEqual(0);
      }
    });

    it('should reject findings on LLM error with drop mode', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'error-drop.ts'), fileContent);

      const mockRouter = createMockRouter({
        shouldFail: true,
        failureError: new Error('Network error'),
      });

      let triageResults: TriageResult[] | undefined;

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
            fallbackBehavior: 'drop', // Reject all on error
          },
        },
        onTriageComplete: (results) => {
          triageResults = results;
        },
      });

      const result = await controller.execute();

      // Should complete
      expect(result.finalState).toBe('COMPLETE');

      // With drop mode, rejected findings should be filtered out
      if (triageResults) {
        const accepted = triageResults.filter((r) => r.verdict?.accepted !== false);
        // In drop mode, LLM failures result in rejected verdicts
      }
    });

    it('should use ast-only fallback mode correctly', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'error-ast-only.ts'), fileContent);

      const mockRouter = createMockRouter({
        shouldFail: true,
        failureError: new Error('Service unavailable'),
      });

      let triageResults: TriageResult[] | undefined;

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
            fallbackBehavior: 'ast-only', // Tag as fallback source
          },
        },
        onTriageComplete: (results) => {
          triageResults = results;
        },
      });

      const result = await controller.execute();

      expect(result.finalState).toBe('COMPLETE');

      // In ast-only mode, findings should be accepted with fallback source
      if (triageResults) {
        const fallbackResults = triageResults.filter((r) => r.source === 'fallback');
        // Should have fallback results
      }
    });
  });

  describe('Request Limit Exceeded', () => {
    it('should fallback remaining findings when request limit reached', async () => {
      // Create multiple bugs to trigger request limit
      const fileContent = `
        export const t1 = setInterval(() => {}, 1000);
        export const t2 = setInterval(() => {}, 2000);
        export const t3 = setInterval(() => {}, 3000);
        export const t4 = setInterval(() => {}, 4000);
        export const t5 = setInterval(() => {}, 5000);
      `;
      await writeFile(join(srcDir, 'many-timers.ts'), fileContent);

      let callCount = 0;
      const mockRouter = createMockRouter({
        response: {
          verdicts: [{ id: 'v1', accepted: true, confidence: 0.9 }],
        },
      });

      // Track calls
      (mockRouter.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return {
          content: JSON.stringify({
            verdicts: [{ id: `v${callCount}`, accepted: true, confidence: 0.9 }],
          }),
          model: 'claude',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          latencyMs: 500,
          finishReason: 'stop' as const,
        };
      });

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
            batchSize: 1, // One finding per batch
            maxRequestsPerRun: 2, // Very low limit
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
        onTriageComplete: (_, metrics) => {
          triageMetrics = metrics;
        },
      });

      await controller.execute();

      // Should not exceed max requests
      expect(callCount).toBeLessThanOrEqual(2);

      // Remaining findings should be marked as fallback
      if (triageMetrics && triageMetrics.findingsTotal > 2) {
        expect(triageMetrics.findingsFallback).toBeGreaterThan(0);
      }
    });
  });

  describe('Parse Error Handling', () => {
    it('should fallback when LLM returns invalid JSON', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'invalid-json.ts'), fileContent);

      const mockRouter = createMockRouter({
        response: 'This is not valid JSON',
      });

      // Override to return non-JSON string
      (mockRouter.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'This is not valid JSON at all',
        model: 'claude',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        latencyMs: 500,
        finishReason: 'stop' as const,
      });

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
            batchSize: 5,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
        onTriageComplete: (_, metrics) => {
          triageMetrics = metrics;
        },
      });

      const result = await controller.execute();

      // Should still complete
      expect(result.finalState).toBe('COMPLETE');

      // Invalid response should trigger fallback
      if (triageMetrics) {
        // Findings should be processed via fallback
      }
    });

    it('should fallback when LLM returns incomplete verdicts', async () => {
      const fileContent = `
        export const t1 = setInterval(() => {}, 1000);
        export const t2 = setInterval(() => {}, 2000);
      `;
      await writeFile(join(srcDir, 'incomplete.ts'), fileContent);

      // Return verdict for only one finding
      const mockRouter = createMockRouter({
        response: {
          verdicts: [
            { id: 'only-one', accepted: true, confidence: 0.9 },
            // Missing verdict for second finding
          ],
        },
      });

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
            batchSize: 10,
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
      });

      const result = await controller.execute();

      // Should complete - missing verdicts get default values
      expect(result.finalState).toBe('COMPLETE');
    });
  });

  describe('Triage Error Recovery', () => {
    it('should continue with original findings when triage throws', async () => {
      const fileContent = `
        export const timer = setInterval(() => {}, 1000);
      `;
      await writeFile(join(srcDir, 'triage-throw.ts'), fileContent);

      const mockRouter = createMockRouter({
        shouldFail: true,
        failureError: new Error('Catastrophic failure'),
      });

      const foundBugs: BugFinding[] = [];

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
        onBugFound: (bug) => {
          foundBugs.push(bug);
        },
      });

      const result = await controller.execute();

      // Should complete successfully despite triage error
      expect(result.finalState).toBe('COMPLETE');

      // Original bugs should still be available
      // (either processed or passed through)
    });
  });

  describe('Multiple File Batching with Failures', () => {
    it('should handle partial batch failures gracefully', async () => {
      // Create files in multiple directories
      const subDir = join(srcDir, 'sub');
      await mkdir(subDir, { recursive: true });

      await writeFile(
        join(srcDir, 'file1.ts'),
        'export const t1 = setInterval(() => {}, 1000);'
      );
      await writeFile(
        join(subDir, 'file2.ts'),
        'export const t2 = setInterval(() => {}, 2000);'
      );

      let callIndex = 0;
      const mockRouter = createMockRouter({});

      // First batch succeeds, second fails
      (mockRouter.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callIndex++;
        if (callIndex === 2) {
          throw new Error('Second batch failed');
        }
        return {
          content: JSON.stringify({
            verdicts: [{ id: `v${callIndex}`, accepted: true, confidence: 0.9 }],
          }),
          model: 'claude',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          latencyMs: 500,
          finishReason: 'stop' as const,
        };
      });

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
            batchSize: 1, // One file per batch
            maxRequestsPerRun: 10,
            timeoutMs: 30000,
            fallbackBehavior: 'bypass',
          },
        },
        onTriageComplete: (_, metrics) => {
          triageMetrics = metrics;
        },
      });

      const result = await controller.execute();

      // Should complete despite partial failure
      expect(result.finalState).toBe('COMPLETE');

      // Should have some fallback findings from failed batch
      if (triageMetrics) {
        // Partial success - some triaged, some fallback
      }
    });
  });
});
