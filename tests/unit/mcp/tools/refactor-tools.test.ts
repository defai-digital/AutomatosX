/**
 * MCP Refactor Tools Tests
 *
 * Tests for refactor_scan and refactor_run MCP tools.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRefactorScanHandler } from '../../../../src/mcp/tools/refactor-scan.js';
import { createRefactorRunHandler } from '../../../../src/mcp/tools/refactor-run.js';

// Track constructor calls for assertions
let lastControllerConfig: any = null;

// Mock the refactor module with proper class mock
vi.mock('../../../../src/core/refactor/index.js', () => {
  // Create a mock class
  const MockRefactorController = vi.fn().mockImplementation(function(this: any, config: any) {
    lastControllerConfig = config;
    this.scan = vi.fn().mockResolvedValue({ findings: [], metrics: {} });
    this.execute = vi.fn().mockResolvedValue({
      sessionId: 'mock-session',
      finalState: 'COMPLETE',
      stats: { opportunitiesFound: 0, refactorsApplied: 0, refactorsSkipped: 0, successRate: 0, iterationsCompleted: 0, stopReason: 'Done' },
      metricsBefore: { linesOfCode: 0, avgCyclomaticComplexity: 0, duplicationPercentage: 0, maintainabilityIndex: 100 },
      metricsAfter: { linesOfCode: 0, avgCyclomaticComplexity: 0, duplicationPercentage: 0, maintainabilityIndex: 100 },
      improvements: [],
      findings: []
    });
    return this;
  });

  return {
    RefactorController: MockRefactorController,
    createDefaultRefactorConfig: vi.fn().mockImplementation((options: any) => ({
      focusAreas: options?.focusAreas || ['dead_code', 'type_safety'],
      severityThreshold: options?.severityThreshold || 'low',
      maxFindings: options?.maxFindings || 50,
      dryRun: options?.dryRun || false,
      conservative: options?.conservative !== false,
      useLLMForDetection: options?.useLLMForDetection !== false,
      useLLMForRefactoring: options?.useLLMForRefactoring !== false,
      maxIterations: options?.maxIterations || 1,
      maxChangesPerFile: options?.maxChangesPerFile || 3,
      minImprovementThreshold: options?.minImprovementThreshold || 0.1,
    }))
  };
});

// Mock streaming notifier
vi.mock('../../../../src/mcp/streaming-notifier.js', () => ({
  sendMcpProgress: vi.fn(),
  sendMcpProgressBegin: vi.fn().mockReturnValue('progress-token'),
  sendMcpProgressEnd: vi.fn()
}));

describe('MCP Refactor Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastControllerConfig = null;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================
  // refactor_scan tests
  // ==========================================
  describe('refactor_scan', () => {
    it('should scan and return findings', async () => {
      const mockFindings = [
        {
          file: 'src/utils.ts',
          lineStart: 10,
          type: 'dead_code',
          severity: 'medium',
          message: 'Unused import',
          suggestedFix: 'Remove import',
          confidence: 0.95
        },
        {
          file: 'src/api.ts',
          lineStart: 25,
          type: 'type_safety',
          severity: 'high',
          message: 'Using any type',
          suggestedFix: 'Add proper type',
          confidence: 0.9
        }
      ];

      const mockMetrics = {
        linesOfCode: 5000,
        avgCyclomaticComplexity: 3.5,
        duplicationPercentage: 12,
        maintainabilityIndex: 75
      };

      const { RefactorController } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.scan = vi.fn().mockResolvedValue({ findings: mockFindings, metrics: mockMetrics });
        return this;
      });

      const handler = createRefactorScanHandler();
      const result = await handler({});

      expect(result.total).toBe(2);
      expect(result.findings).toHaveLength(2);
      expect(result.byType['dead_code']).toBe(1);
      expect(result.byType['type_safety']).toBe(1);
      expect(result.bySeverity['medium']).toBe(1);
      expect(result.bySeverity['high']).toBe(1);
      expect(result.metrics.linesOfCode).toBe(5000);
      expect(result.metrics.avgComplexity).toBe(3.5);
      expect(result.metrics.duplicationPercent).toBe(12);
      expect(result.metrics.maintainabilityIndex).toBe(75);
    });

    it('should filter by focus areas', async () => {
      const { RefactorController, createDefaultRefactorConfig } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.scan = vi.fn().mockResolvedValue({
          findings: [],
          metrics: { linesOfCode: 0, avgCyclomaticComplexity: 0, duplicationPercentage: 0, maintainabilityIndex: 100 }
        });
        return this;
      });

      const handler = createRefactorScanHandler();
      await handler({ focus: ['dead_code', 'naming'] });

      expect(createDefaultRefactorConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          focusAreas: ['dead_code', 'naming']
        })
      );
    });

    it('should use static-only mode when noLlm is true', async () => {
      const { RefactorController, createDefaultRefactorConfig } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.scan = vi.fn().mockResolvedValue({
          findings: [],
          metrics: { linesOfCode: 0, avgCyclomaticComplexity: 0, duplicationPercentage: 0, maintainabilityIndex: 100 }
        });
        return this;
      });

      const handler = createRefactorScanHandler();
      await handler({ noLlm: true });

      expect(createDefaultRefactorConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          useLLMForDetection: false,
          useLLMForRefactoring: false
        })
      );
    });

    it('should respect limit parameter', async () => {
      const mockFindings = Array.from({ length: 100 }, (_, i) => ({
        file: `src/file${i}.ts`,
        lineStart: i,
        type: 'dead_code',
        severity: 'low',
        message: `Finding ${i}`,
        confidence: 0.8
      }));

      const { RefactorController } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.scan = vi.fn().mockResolvedValue({
          findings: mockFindings,
          metrics: { linesOfCode: 10000, avgCyclomaticComplexity: 5, duplicationPercentage: 20, maintainabilityIndex: 60 }
        });
        return this;
      });

      const handler = createRefactorScanHandler();
      const result = await handler({ limit: 20 });

      expect(result.total).toBe(100);
      expect(result.findings).toHaveLength(20);
    });

    it('should handle scan failure', async () => {
      const { RefactorController } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.scan = vi.fn().mockRejectedValue(new Error('Scan failed'));
        return this;
      });

      const handler = createRefactorScanHandler();

      await expect(handler({})).rejects.toThrow('Scan failed');
    });

    it('should use custom path', async () => {
      const { RefactorController } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any, config: any) {
        lastControllerConfig = config;
        this.scan = vi.fn().mockResolvedValue({
          findings: [],
          metrics: { linesOfCode: 0, avgCyclomaticComplexity: 0, duplicationPercentage: 0, maintainabilityIndex: 100 }
        });
        return this;
      });

      const handler = createRefactorScanHandler();
      await handler({ path: '/custom/project' });

      expect(lastControllerConfig.rootDir).toBe('/custom/project');
    });
  });

  // ==========================================
  // refactor_run tests
  // ==========================================
  describe('refactor_run', () => {
    it('should execute refactoring workflow', async () => {
      const mockResult = {
        sessionId: 'refactor-session-123',
        finalState: 'COMPLETE',
        stats: {
          opportunitiesFound: 10,
          refactorsApplied: 7,
          refactorsSkipped: 3,
          successRate: 0.7,
          iterationsCompleted: 1,
          stopReason: 'All iterations completed'
        },
        metricsBefore: {
          linesOfCode: 5000,
          avgCyclomaticComplexity: 5,
          duplicationPercentage: 15,
          maintainabilityIndex: 65
        },
        metricsAfter: {
          linesOfCode: 4800,
          avgCyclomaticComplexity: 4,
          duplicationPercentage: 10,
          maintainabilityIndex: 72
        },
        improvements: [
          { metric: 'complexity', before: 5, after: 4, improvementPercent: 20, meetsThreshold: true }
        ],
        findings: [
          { file: 'src/a.ts', lineStart: 10, type: 'dead_code', severity: 'medium', message: 'Fixed' }
        ]
      };

      const { RefactorController } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue(mockResult);
        return this;
      });

      const handler = createRefactorRunHandler();
      const result = await handler({});

      expect(result.status).toBe('completed');
      expect(result.sessionId).toBe('refactor-session-123');
      expect(result.stats.opportunitiesFound).toBe(10);
      expect(result.stats.refactorsApplied).toBe(7);
      expect(result.stats.successRate).toBe(0.7);
      expect(result.metricsBefore.linesOfCode).toBe(5000);
      expect(result.metricsAfter.linesOfCode).toBe(4800);
      expect(result.improvements).toHaveLength(1);
    });

    it('should support dry run mode', async () => {
      const { RefactorController, createDefaultRefactorConfig } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          sessionId: 'dry-run',
          finalState: 'COMPLETE',
          stats: {
            opportunitiesFound: 5,
            refactorsApplied: 0,
            refactorsSkipped: 5,
            successRate: 0,
            iterationsCompleted: 0,
            stopReason: 'Dry run'
          },
          metricsBefore: { linesOfCode: 1000, avgCyclomaticComplexity: 3, duplicationPercentage: 5, maintainabilityIndex: 80 },
          metricsAfter: { linesOfCode: 1000, avgCyclomaticComplexity: 3, duplicationPercentage: 5, maintainabilityIndex: 80 },
          improvements: [],
          findings: []
        });
        return this;
      });

      const handler = createRefactorRunHandler();
      const result = await handler({ dryRun: true });

      expect(result.stats.refactorsApplied).toBe(0);
      expect(createDefaultRefactorConfig).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true })
      );
    });

    it('should use conservative mode by default', async () => {
      const { RefactorController, createDefaultRefactorConfig } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          sessionId: 'session',
          finalState: 'COMPLETE',
          stats: { opportunitiesFound: 0, refactorsApplied: 0, refactorsSkipped: 0, successRate: 0, iterationsCompleted: 0, stopReason: 'Done' },
          metricsBefore: { linesOfCode: 0, avgCyclomaticComplexity: 0, duplicationPercentage: 0, maintainabilityIndex: 100 },
          metricsAfter: { linesOfCode: 0, avgCyclomaticComplexity: 0, duplicationPercentage: 0, maintainabilityIndex: 100 },
          improvements: [],
          findings: []
        });
        return this;
      });

      const handler = createRefactorRunHandler();
      await handler({});

      // Verify createDefaultRefactorConfig was called with conservative=true (default)
      expect(createDefaultRefactorConfig).toHaveBeenCalledWith(
        expect.objectContaining({ conservative: true })
      );
    });

    it('should support multiple iterations', async () => {
      const { RefactorController, createDefaultRefactorConfig } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          sessionId: 'session',
          finalState: 'COMPLETE',
          stats: { opportunitiesFound: 15, refactorsApplied: 12, refactorsSkipped: 3, successRate: 0.8, iterationsCompleted: 3, stopReason: 'All iterations completed' },
          metricsBefore: { linesOfCode: 5000, avgCyclomaticComplexity: 6, duplicationPercentage: 20, maintainabilityIndex: 55 },
          metricsAfter: { linesOfCode: 4500, avgCyclomaticComplexity: 4, duplicationPercentage: 8, maintainabilityIndex: 75 },
          improvements: [],
          findings: []
        });
        return this;
      });

      const handler = createRefactorRunHandler();
      const result = await handler({ iterations: 3 });

      expect(result.stats.iterationsCompleted).toBe(3);
      expect(createDefaultRefactorConfig).toHaveBeenCalledWith(
        expect.objectContaining({ maxIterations: 3 })
      );
    });

    it('should respect maxChangesPerFile', async () => {
      const { RefactorController, createDefaultRefactorConfig } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          sessionId: 'session',
          finalState: 'COMPLETE',
          stats: { opportunitiesFound: 0, refactorsApplied: 0, refactorsSkipped: 0, successRate: 0, iterationsCompleted: 0, stopReason: 'Done' },
          metricsBefore: { linesOfCode: 0, avgCyclomaticComplexity: 0, duplicationPercentage: 0, maintainabilityIndex: 100 },
          metricsAfter: { linesOfCode: 0, avgCyclomaticComplexity: 0, duplicationPercentage: 0, maintainabilityIndex: 100 },
          improvements: [],
          findings: []
        });
        return this;
      });

      const handler = createRefactorRunHandler();
      await handler({ maxChangesPerFile: 5 });

      expect(createDefaultRefactorConfig).toHaveBeenCalledWith(
        expect.objectContaining({ maxChangesPerFile: 5 })
      );
    });

    it('should respect minImprovement threshold', async () => {
      const { RefactorController, createDefaultRefactorConfig } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          sessionId: 'session',
          finalState: 'COMPLETE',
          stats: { opportunitiesFound: 0, refactorsApplied: 0, refactorsSkipped: 0, successRate: 0, iterationsCompleted: 0, stopReason: 'Done' },
          metricsBefore: { linesOfCode: 0, avgCyclomaticComplexity: 0, duplicationPercentage: 0, maintainabilityIndex: 100 },
          metricsAfter: { linesOfCode: 0, avgCyclomaticComplexity: 0, duplicationPercentage: 0, maintainabilityIndex: 100 },
          improvements: [],
          findings: []
        });
        return this;
      });

      const handler = createRefactorRunHandler();
      await handler({ minImprovement: 0.2 });

      expect(createDefaultRefactorConfig).toHaveBeenCalledWith(
        expect.objectContaining({ minImprovementThreshold: 0.2 })
      );
    });

    it('should handle execution failure', async () => {
      const { RefactorController } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockRejectedValue(new Error('Refactoring failed'));
        return this;
      });

      const handler = createRefactorRunHandler();

      await expect(handler({})).rejects.toThrow('Refactoring failed');
    });

    it('should filter out zero-improvement metrics', async () => {
      const { RefactorController } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          sessionId: 'session',
          finalState: 'COMPLETE',
          stats: { opportunitiesFound: 3, refactorsApplied: 2, refactorsSkipped: 1, successRate: 0.67, iterationsCompleted: 1, stopReason: 'Done' },
          metricsBefore: { linesOfCode: 1000, avgCyclomaticComplexity: 5, duplicationPercentage: 10, maintainabilityIndex: 70 },
          metricsAfter: { linesOfCode: 1000, avgCyclomaticComplexity: 4, duplicationPercentage: 10, maintainabilityIndex: 75 },
          improvements: [
            { metric: 'linesOfCode', before: 1000, after: 1000, improvementPercent: 0, meetsThreshold: false },
            { metric: 'complexity', before: 5, after: 4, improvementPercent: 20, meetsThreshold: true },
            { metric: 'duplication', before: 10, after: 10, improvementPercent: 0, meetsThreshold: false }
          ],
          findings: []
        });
        return this;
      });

      const handler = createRefactorRunHandler();
      const result = await handler({});

      // Should only include complexity improvement (non-zero)
      expect(result.improvements).toHaveLength(1);
      expect(result.improvements[0]?.metric).toBe('complexity');
    });

    it('should return failed status for failed state', async () => {
      const { RefactorController } = await import('../../../../src/core/refactor/index.js');
      vi.mocked(RefactorController).mockImplementation(function(this: any) {
        this.execute = vi.fn().mockResolvedValue({
          sessionId: 'session',
          finalState: 'FAILED',
          stats: { opportunitiesFound: 5, refactorsApplied: 0, refactorsSkipped: 5, successRate: 0, iterationsCompleted: 0, stopReason: 'All refactors failed verification' },
          metricsBefore: { linesOfCode: 1000, avgCyclomaticComplexity: 5, duplicationPercentage: 10, maintainabilityIndex: 70 },
          metricsAfter: { linesOfCode: 1000, avgCyclomaticComplexity: 5, duplicationPercentage: 10, maintainabilityIndex: 70 },
          improvements: [],
          findings: []
        });
        return this;
      });

      const handler = createRefactorRunHandler();
      const result = await handler({});

      expect(result.status).toBe('failed');
    });
  });
});
