/**
 * Tests for LLM Triage Filter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMTriageFilter, createTriageFilter } from '@/core/bugfix/llm-triage/filter.js';
import { DEFAULT_LLM_TRIAGE_CONFIG } from '@/core/bugfix/llm-triage/constants.js';
import type { BugFinding } from '@/core/bugfix/types.js';
import type { Router } from '@/core/router/router.js';
import type { ExecutionResponse } from '@/types/provider.js';

function createMockFinding(overrides: Partial<BugFinding> = {}): BugFinding {
  return {
    id: 'test-finding-1',
    file: 'src/test.ts',
    lineStart: 10,
    lineEnd: 15,
    type: 'timer_leak',
    severity: 'medium',
    message: 'setInterval without cleanup',
    context: 'const interval = setInterval(() => tick(), 1000);',
    confidence: 0.75,
    detectionMethod: 'ast',
    detectedAt: new Date().toISOString(),
    ...overrides,
  };
}

interface MockRouterResult {
  router: Router;
  mockExecute: ReturnType<typeof vi.fn>;
}

function createMockRouter(response: Partial<ExecutionResponse> = {}): MockRouterResult {
  const mockExecute = vi.fn().mockResolvedValue({
    content: JSON.stringify({
      verdicts: [{ id: 'test-finding-1', accepted: true, confidence: 0.9, reason: 'Real bug' }],
    }),
    model: 'claude',
    tokensUsed: { prompt: 100, completion: 50, total: 150 },
    latencyMs: 500,
    finishReason: 'stop' as const,
    ...response,
  });

  return {
    router: {
      execute: mockExecute,
    } as unknown as Router,
    mockExecute,
  };
}

// Logger type that matches the filter's expected interface
type MockLogger = {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
};

describe('LLMTriageFilter', () => {
  let mockRouter: Router;
  let mockExecute: ReturnType<typeof vi.fn>;
  let mockLogger: MockLogger & {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const result = createMockRouter();
    mockRouter = result.router;
    mockExecute = result.mockExecute;
    mockLogger = {
      debug: vi.fn() as MockLogger['debug'] & ReturnType<typeof vi.fn>,
      info: vi.fn() as MockLogger['info'] & ReturnType<typeof vi.fn>,
      warn: vi.fn() as MockLogger['warn'] & ReturnType<typeof vi.fn>,
      error: vi.fn() as MockLogger['error'] & ReturnType<typeof vi.fn>,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create filter with default config', () => {
      const filter = new LLMTriageFilter({
        config: DEFAULT_LLM_TRIAGE_CONFIG,
        router: mockRouter,
      });

      expect(filter).toBeInstanceOf(LLMTriageFilter);
    });

    it('should merge config with defaults', () => {
      const filter = new LLMTriageFilter({
        config: { ...DEFAULT_LLM_TRIAGE_CONFIG, enabled: true, provider: 'gemini' },
        router: mockRouter,
      });

      expect(filter).toBeInstanceOf(LLMTriageFilter);
    });
  });

  describe('triage - disabled', () => {
    it('should pass through all findings when disabled', async () => {
      const filter = new LLMTriageFilter({
        config: { ...DEFAULT_LLM_TRIAGE_CONFIG, enabled: false },
        router: mockRouter,
      });

      const findings = [
        createMockFinding({ id: 'f1' }),
        createMockFinding({ id: 'f2' }),
      ];

      const results = await filter.triage(findings);

      expect(results).toHaveLength(2);
      results.forEach((r) => {
        expect(r.verdict).toBeNull();
        expect(r.source).toBe('ast');
      });

      // Router should not be called
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('triage - confidence filtering', () => {
    it('should skip high confidence findings', async () => {
      const filter = new LLMTriageFilter({
        config: { ...DEFAULT_LLM_TRIAGE_CONFIG, enabled: true, minConfidenceToSkip: 0.9 },
        router: mockRouter,
        logger: mockLogger,
      });

      const findings = [
        createMockFinding({ id: 'high', confidence: 0.95 }),
        createMockFinding({ id: 'low', confidence: 0.7 }),
      ];

      // Mock router to return verdict for low confidence finding
      mockExecute.mockResolvedValueOnce({
        content: JSON.stringify({
          verdicts: [{ id: 'low', accepted: true, confidence: 0.8 }],
        }),
        model: 'claude',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        latencyMs: 500,
        finishReason: 'stop' as const,
      });

      const results = await filter.triage(findings);

      expect(results).toHaveLength(2);

      // High confidence should be skipped
      const highResult = results.find((r) => r.original.id === 'high');
      expect(highResult?.source).toBe('ast');
      expect(highResult?.verdict).toBeNull();

      // Low confidence should be triaged
      const lowResult = results.find((r) => r.original.id === 'low');
      expect(lowResult?.source).toBe('llm');
      expect(lowResult?.verdict?.accepted).toBe(true);
    });
  });

  describe('triage - batching', () => {
    it('should batch findings by file', async () => {
      const filter = new LLMTriageFilter({
        config: { ...DEFAULT_LLM_TRIAGE_CONFIG, enabled: true, batchSize: 2 },
        router: mockRouter,
        logger: mockLogger,
      });

      const findings = [
        createMockFinding({ id: 'f1', file: 'src/a.ts', confidence: 0.7 }),
        createMockFinding({ id: 'f2', file: 'src/a.ts', confidence: 0.7 }),
        createMockFinding({ id: 'f3', file: 'src/b.ts', confidence: 0.7 }),
      ];

      mockExecute
        .mockResolvedValueOnce({
          content: JSON.stringify({
            verdicts: [
              { id: 'f1', accepted: true, confidence: 0.9 },
              { id: 'f2', accepted: false, confidence: 0.8 },
            ],
          }),
          model: 'claude',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          latencyMs: 500,
          finishReason: 'stop' as const,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            verdicts: [{ id: 'f3', accepted: true, confidence: 0.85 }],
          }),
          model: 'claude',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          latencyMs: 500,
          finishReason: 'stop' as const,
        });

      const results = await filter.triage(findings);

      expect(results).toHaveLength(3);
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  describe('triage - request limit', () => {
    it('should respect max requests limit', async () => {
      const filter = new LLMTriageFilter({
        config: { ...DEFAULT_LLM_TRIAGE_CONFIG, enabled: true, maxRequestsPerRun: 1, batchSize: 1 },
        router: mockRouter,
        logger: mockLogger,
      });

      const findings = [
        createMockFinding({ id: 'f1', confidence: 0.7 }),
        createMockFinding({ id: 'f2', confidence: 0.7 }),
        createMockFinding({ id: 'f3', confidence: 0.7 }),
      ];

      mockExecute.mockResolvedValueOnce({
        content: JSON.stringify({
          verdicts: [{ id: 'f1', accepted: true, confidence: 0.9 }],
        }),
        model: 'claude',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        latencyMs: 500,
        finishReason: 'stop' as const,
      });

      const results = await filter.triage(findings);

      expect(results).toHaveLength(3);
      expect(mockExecute).toHaveBeenCalledTimes(1);

      // Check that warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Request limit reached'),
        expect.any(Object)
      );
    });
  });

  describe('triage - fallback behavior', () => {
    it('should bypass and accept findings on LLM error', async () => {
      const filter = new LLMTriageFilter({
        config: { ...DEFAULT_LLM_TRIAGE_CONFIG, enabled: true, fallbackBehavior: 'bypass' },
        router: mockRouter,
        logger: mockLogger,
      });

      const findings = [createMockFinding({ id: 'f1', confidence: 0.7 })];

      mockExecute.mockRejectedValueOnce(new Error('LLM error'));

      const results = await filter.triage(findings);

      expect(results).toHaveLength(1);
      expect(results[0]?.verdict?.accepted).toBe(true);
      expect(results[0]?.source).toBe('fallback');
    });

    it('should drop findings when fallback is drop', async () => {
      const filter = new LLMTriageFilter({
        config: { ...DEFAULT_LLM_TRIAGE_CONFIG, enabled: true, fallbackBehavior: 'drop' },
        router: mockRouter,
        logger: mockLogger,
      });

      const findings = [createMockFinding({ id: 'f1', confidence: 0.7 })];

      mockExecute.mockRejectedValueOnce(new Error('LLM error'));

      const results = await filter.triage(findings);

      expect(results).toHaveLength(1);
      expect(results[0]?.verdict?.accepted).toBe(false);
    });
  });

  describe('triage - metrics', () => {
    it('should track metrics correctly', async () => {
      const filter = new LLMTriageFilter({
        config: { ...DEFAULT_LLM_TRIAGE_CONFIG, enabled: true, minConfidenceToSkip: 0.9 },
        router: mockRouter,
        logger: mockLogger,
      });

      const findings = [
        createMockFinding({ id: 'high', confidence: 0.95 }),
        createMockFinding({ id: 'low', confidence: 0.7 }),
      ];

      mockExecute.mockResolvedValueOnce({
        content: JSON.stringify({
          verdicts: [{ id: 'low', accepted: true, confidence: 0.8 }],
        }),
        model: 'claude',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        latencyMs: 500,
        finishReason: 'stop' as const,
      });

      await filter.triage(findings);

      const metrics = filter.getMetrics();

      expect(metrics.findingsTotal).toBe(2);
      expect(metrics.findingsSkipped).toBe(1);
      expect(metrics.findingsTriaged).toBe(1);
      expect(metrics.llmRequests).toBe(1);
      expect(metrics.llmTokensUsed).toBe(150);
      expect(metrics.triageDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics on new triage', async () => {
      const filter = new LLMTriageFilter({
        config: { ...DEFAULT_LLM_TRIAGE_CONFIG, enabled: false },
        router: mockRouter,
      });

      await filter.triage([createMockFinding()]);
      await filter.triage([createMockFinding(), createMockFinding()]);

      const metrics = filter.getMetrics();
      expect(metrics.findingsTotal).toBe(2);
    });
  });

  describe('triage - no router', () => {
    it('should fallback when router not available', async () => {
      const filter = new LLMTriageFilter({
        config: { ...DEFAULT_LLM_TRIAGE_CONFIG, enabled: true },
        // No router provided
        logger: mockLogger,
      });

      const findings = [createMockFinding({ id: 'f1', confidence: 0.7 })];
      const results = await filter.triage(findings);

      expect(results).toHaveLength(1);
      expect(results[0]?.source).toBe('fallback');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No router available')
      );
    });
  });

  describe('createTriageFilter', () => {
    it('should create filter with router and overrides', () => {
      const filter = createTriageFilter(mockRouter, {
        enabled: true,
        provider: 'gemini',
      });

      expect(filter).toBeInstanceOf(LLMTriageFilter);
    });
  });
});
