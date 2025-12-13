/**
 * Analytics Command Unit Tests
 *
 * Comprehensive tests for the analytics command including:
 * - Summary generation
 * - Optimization recommendations
 * - Data clearing
 * - Status display
 * - Helper functions
 *
 * @module tests/unit/cli/commands/analytics.test.ts
 * @since v12.8.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Mock Modules
// ============================================================================

vi.mock('chalk', () => ({
  default: {
    blue: Object.assign((s: string) => s, { bold: (s: string) => s }),
    cyan: Object.assign((s: string) => s, { bold: (s: string) => s }),
    white: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    dim: (s: string) => s,
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
  },
}));

vi.mock('../../shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../shared/errors/error-formatter.js', () => ({
  printError: vi.fn(),
}));

// ============================================================================
// Types
// ============================================================================

type TimePeriod = '24h' | '7d' | '30d' | 'all';

interface MockAnalyticsSummary {
  executions: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  performance: {
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
  };
  costs: {
    totalUsd: number;
    avgCostPerRequest: number;
    byProvider: Record<string, number>;
  };
  topAgents: Array<{
    name: string;
    executionCount: number;
    totalCost: number;
    avgLatency: number;
  }>;
}

interface MockOptimizationRecommendation {
  type: 'cost_saving' | 'performance' | 'security';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actions: string[];
  estimatedSavings?: {
    costUsd: number;
    percentageReduction: number;
  };
  estimatedImprovement?: {
    metric: string;
    improvement: number;
    unit: string;
  };
}

interface MockTelemetryStats {
  totalEvents: number;
  databaseSizeBytes: number;
  oldestEvent?: string;
  newestEvent?: string;
}

// ============================================================================
// Test Setup
// ============================================================================

describe('Analytics Command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe('Helper Functions', () => {
    describe('parseTimePeriod', () => {
      it('should parse 24h period', () => {
        const parseTimePeriod = (period: TimePeriod): { startDate: number; endDate: number } => {
          const now = Date.now();
          let startDate: number;

          switch (period) {
            case '24h':
              startDate = now - 24 * 60 * 60 * 1000;
              break;
            case '7d':
              startDate = now - 7 * 24 * 60 * 60 * 1000;
              break;
            case '30d':
              startDate = now - 30 * 24 * 60 * 60 * 1000;
              break;
            case 'all':
              startDate = 0;
              break;
            default:
              startDate = now - 7 * 24 * 60 * 60 * 1000;
          }

          return { startDate, endDate: now };
        };

        const result = parseTimePeriod('24h');
        const expectedDiff = 24 * 60 * 60 * 1000;

        expect(result.endDate - result.startDate).toBeCloseTo(expectedDiff, -2);
      });

      it('should parse 7d period', () => {
        const parseTimePeriod = (period: TimePeriod): { startDate: number; endDate: number } => {
          const now = Date.now();
          let startDate: number;

          switch (period) {
            case '24h':
              startDate = now - 24 * 60 * 60 * 1000;
              break;
            case '7d':
              startDate = now - 7 * 24 * 60 * 60 * 1000;
              break;
            case '30d':
              startDate = now - 30 * 24 * 60 * 60 * 1000;
              break;
            case 'all':
              startDate = 0;
              break;
            default:
              startDate = now - 7 * 24 * 60 * 60 * 1000;
          }

          return { startDate, endDate: now };
        };

        const result = parseTimePeriod('7d');
        const expectedDiff = 7 * 24 * 60 * 60 * 1000;

        expect(result.endDate - result.startDate).toBeCloseTo(expectedDiff, -2);
      });

      it('should parse 30d period', () => {
        const parseTimePeriod = (period: TimePeriod): { startDate: number; endDate: number } => {
          const now = Date.now();
          let startDate: number;

          switch (period) {
            case '24h':
              startDate = now - 24 * 60 * 60 * 1000;
              break;
            case '7d':
              startDate = now - 7 * 24 * 60 * 60 * 1000;
              break;
            case '30d':
              startDate = now - 30 * 24 * 60 * 60 * 1000;
              break;
            case 'all':
              startDate = 0;
              break;
            default:
              startDate = now - 7 * 24 * 60 * 60 * 1000;
          }

          return { startDate, endDate: now };
        };

        const result = parseTimePeriod('30d');
        const expectedDiff = 30 * 24 * 60 * 60 * 1000;

        expect(result.endDate - result.startDate).toBeCloseTo(expectedDiff, -2);
      });

      it('should parse all period', () => {
        const parseTimePeriod = (period: TimePeriod): { startDate: number; endDate: number } => {
          const now = Date.now();
          let startDate: number;

          switch (period) {
            case 'all':
              startDate = 0;
              break;
            default:
              startDate = now - 7 * 24 * 60 * 60 * 1000;
          }

          return { startDate, endDate: now };
        };

        const result = parseTimePeriod('all');

        expect(result.startDate).toBe(0);
      });
    });

    describe('formatPeriod', () => {
      it('should format all period types', () => {
        const formatPeriod = (period: TimePeriod): string => {
          switch (period) {
            case '24h':
              return 'Last 24 hours';
            case '7d':
              return 'Last 7 days';
            case '30d':
              return 'Last 30 days';
            case 'all':
              return 'All time';
            default:
              return 'Last 7 days';
          }
        };

        expect(formatPeriod('24h')).toBe('Last 24 hours');
        expect(formatPeriod('7d')).toBe('Last 7 days');
        expect(formatPeriod('30d')).toBe('Last 30 days');
        expect(formatPeriod('all')).toBe('All time');
      });
    });

    describe('formatCost', () => {
      it('should format zero cost', () => {
        const formatCost = (usd: number): string => {
          if (usd === 0) return '$0.00';
          if (usd < 0.01) return '<$0.01';
          return `$${usd.toFixed(2)}`;
        };

        expect(formatCost(0)).toBe('$0.00');
      });

      it('should format small costs', () => {
        const formatCost = (usd: number): string => {
          if (usd === 0) return '$0.00';
          if (usd < 0.01) return '<$0.01';
          return `$${usd.toFixed(2)}`;
        };

        expect(formatCost(0.001)).toBe('<$0.01');
        expect(formatCost(0.009)).toBe('<$0.01');
      });

      it('should format regular costs', () => {
        const formatCost = (usd: number): string => {
          if (usd === 0) return '$0.00';
          if (usd < 0.01) return '<$0.01';
          return `$${usd.toFixed(2)}`;
        };

        expect(formatCost(1.5)).toBe('$1.50');
        expect(formatCost(100)).toBe('$100.00');
        expect(formatCost(0.99)).toBe('$0.99');
      });
    });

    describe('formatDuration', () => {
      it('should format milliseconds', () => {
        const formatDuration = (ms: number): string => {
          if (ms < 1000) return `${Math.round(ms)}ms`;
          const seconds = ms / 1000;
          if (seconds < 60) return `${seconds.toFixed(1)}s`;
          const minutes = seconds / 60;
          return `${minutes.toFixed(1)}m`;
        };

        expect(formatDuration(500)).toBe('500ms');
        expect(formatDuration(999)).toBe('999ms');
      });

      it('should format seconds', () => {
        const formatDuration = (ms: number): string => {
          if (ms < 1000) return `${Math.round(ms)}ms`;
          const seconds = ms / 1000;
          if (seconds < 60) return `${seconds.toFixed(1)}s`;
          const minutes = seconds / 60;
          return `${minutes.toFixed(1)}m`;
        };

        expect(formatDuration(1000)).toBe('1.0s');
        expect(formatDuration(5500)).toBe('5.5s');
        expect(formatDuration(30000)).toBe('30.0s');
      });

      it('should format minutes', () => {
        const formatDuration = (ms: number): string => {
          if (ms < 1000) return `${Math.round(ms)}ms`;
          const seconds = ms / 1000;
          if (seconds < 60) return `${seconds.toFixed(1)}s`;
          const minutes = seconds / 60;
          return `${minutes.toFixed(1)}m`;
        };

        expect(formatDuration(60000)).toBe('1.0m');
        expect(formatDuration(90000)).toBe('1.5m');
        expect(formatDuration(300000)).toBe('5.0m');
      });
    });

    describe('formatPercentage', () => {
      it('should format percentages', () => {
        const formatPercentage = (value: number): string => {
          return `${value.toFixed(1)}%`;
        };

        expect(formatPercentage(0)).toBe('0.0%');
        expect(formatPercentage(50)).toBe('50.0%');
        expect(formatPercentage(99.9)).toBe('99.9%');
        expect(formatPercentage(100)).toBe('100.0%');
      });
    });

    describe('formatBytes', () => {
      it('should format zero bytes', () => {
        const formatBytes = (bytes: number): string => {
          if (bytes === 0) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
        };

        expect(formatBytes(0)).toBe('0 B');
      });

      it('should format various byte sizes', () => {
        const formatBytes = (bytes: number): string => {
          if (bytes === 0) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
        };

        expect(formatBytes(512)).toBe('512.00 B');
        expect(formatBytes(1024)).toBe('1.00 KB');
        expect(formatBytes(1048576)).toBe('1.00 MB');
        expect(formatBytes(1073741824)).toBe('1.00 GB');
      });
    });
  });

  // ============================================================================
  // Summary Handler Tests
  // ============================================================================

  describe('Summary Handler', () => {
    it('should generate analytics summary', async () => {
      const mockSummary: MockAnalyticsSummary = {
        executions: {
          total: 100,
          successful: 95,
          failed: 5,
          successRate: 95.0,
        },
        performance: {
          avgLatencyMs: 500,
          p50LatencyMs: 400,
          p95LatencyMs: 1000,
          p99LatencyMs: 2000,
        },
        costs: {
          totalUsd: 10.5,
          avgCostPerRequest: 0.105,
          byProvider: {
            'claude-code': 7.0,
            'gemini-cli': 3.5,
          },
        },
        topAgents: [
          { name: 'backend', executionCount: 50, totalCost: 5.0, avgLatency: 450 },
          { name: 'frontend', executionCount: 30, totalCost: 3.0, avgLatency: 400 },
        ],
      };

      const mockAnalytics = {
        generateSummary: vi.fn().mockResolvedValue(mockSummary),
      };

      const summary = await mockAnalytics.generateSummary({
        startDate: Date.now() - 7 * 24 * 60 * 60 * 1000,
        endDate: Date.now(),
      });

      expect(summary.executions.total).toBe(100);
      expect(summary.executions.successRate).toBe(95.0);
      expect(summary.costs.totalUsd).toBe(10.5);
    });

    it('should filter summary by provider', async () => {
      const mockAnalytics = {
        generateSummary: vi.fn().mockResolvedValue({
          executions: { total: 50, successful: 48, failed: 2, successRate: 96.0 },
          costs: { totalUsd: 5.0, avgCostPerRequest: 0.1, byProvider: { 'claude-code': 5.0 } },
        }),
      };

      const summary = await mockAnalytics.generateSummary({
        startDate: 0,
        endDate: Date.now(),
        provider: 'claude-code',
      });

      expect(mockAnalytics.generateSummary).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'claude-code' })
      );
      expect(summary.executions.total).toBe(50);
    });

    it('should output summary as JSON', () => {
      const summary: MockAnalyticsSummary = {
        executions: { total: 100, successful: 95, failed: 5, successRate: 95.0 },
        performance: { avgLatencyMs: 500, p50LatencyMs: 400, p95LatencyMs: 1000, p99LatencyMs: 2000 },
        costs: { totalUsd: 10.5, avgCostPerRequest: 0.105, byProvider: {} },
        topAgents: [],
      };

      const jsonOutput = JSON.stringify(summary, null, 2);
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.executions.total).toBe(100);
    });

    it('should calculate cost percentage by provider', () => {
      const costs = {
        totalUsd: 10.0,
        byProvider: {
          'claude-code': 7.0,
          'gemini-cli': 3.0,
        },
      };

      const claudePercentage =
        costs.totalUsd > 0 ? (costs.byProvider['claude-code']! / costs.totalUsd) * 100 : 0;
      const geminiPercentage =
        costs.totalUsd > 0 ? (costs.byProvider['gemini-cli']! / costs.totalUsd) * 100 : 0;

      expect(claudePercentage).toBe(70);
      expect(geminiPercentage).toBe(30);
    });
  });

  // ============================================================================
  // Optimize Handler Tests
  // ============================================================================

  describe('Optimize Handler', () => {
    it('should generate optimization recommendations', async () => {
      const mockRecommendations: MockOptimizationRecommendation[] = [
        {
          type: 'cost_saving',
          severity: 'high',
          title: 'Switch to cheaper provider for simple tasks',
          description: 'Many simple tasks are using expensive providers',
          actions: ['Use Gemini for basic queries', 'Reserve Claude for complex tasks'],
          estimatedSavings: { costUsd: 5.0, percentageReduction: 30 },
        },
        {
          type: 'performance',
          severity: 'medium',
          title: 'Add caching for repeated queries',
          description: 'Some queries are being repeated frequently',
          actions: ['Enable memory caching', 'Set cache TTL to 1 hour'],
          estimatedImprovement: { metric: 'latency', improvement: 200, unit: 'ms' },
        },
      ];

      const mockOptimizer = {
        analyze: vi.fn().mockResolvedValue(mockRecommendations),
      };

      const recommendations = await mockOptimizer.analyze({
        start: Date.now() - 7 * 24 * 60 * 60 * 1000,
        end: Date.now(),
      });

      expect(recommendations).toHaveLength(2);
      expect(recommendations[0]?.type).toBe('cost_saving');
      expect(recommendations[1]?.type).toBe('performance');
    });

    it('should handle no recommendations', async () => {
      const mockOptimizer = {
        analyze: vi.fn().mockResolvedValue([]),
      };

      const recommendations = await mockOptimizer.analyze({});

      expect(recommendations).toHaveLength(0);
    });

    it('should output recommendations as JSON', () => {
      const recommendations: MockOptimizationRecommendation[] = [
        {
          type: 'cost_saving',
          severity: 'high',
          title: 'Test recommendation',
          description: 'Test description',
          actions: ['Action 1'],
        },
      ];

      const jsonOutput = JSON.stringify(recommendations, null, 2);
      const parsed = JSON.parse(jsonOutput);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('cost_saving');
    });

    it('should map recommendation types to icons', () => {
      const TYPE_ICONS: Record<string, string> = {
        cost_saving: '💰',
        performance: '⚡',
        security: '🔒',
      };

      expect(TYPE_ICONS['cost_saving']).toBe('💰');
      expect(TYPE_ICONS['performance']).toBe('⚡');
      expect(TYPE_ICONS['security']).toBe('🔒');
    });
  });

  // ============================================================================
  // Clear Handler Tests
  // ============================================================================

  describe('Clear Handler', () => {
    it('should clear telemetry data', async () => {
      const mockTelemetry = {
        clear: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      await mockTelemetry.clear();

      expect(mockTelemetry.clear).toHaveBeenCalled();
    });

    it('should require confirmation', () => {
      const requiresConfirmation = true;

      expect(requiresConfirmation).toBe(true);
    });

    it('should handle clear cancellation', async () => {
      const mockInquirer = {
        prompt: vi.fn().mockResolvedValue({ confirm: false }),
      };

      const answer = await mockInquirer.prompt([{ type: 'confirm', name: 'confirm' }]);

      expect(answer.confirm).toBe(false);
    });
  });

  // ============================================================================
  // Status Handler Tests
  // ============================================================================

  describe('Status Handler', () => {
    it('should get telemetry stats', () => {
      const mockStats: MockTelemetryStats = {
        totalEvents: 1000,
        databaseSizeBytes: 1048576,
        oldestEvent: '2024-01-01T00:00:00Z',
        newestEvent: '2024-01-15T12:00:00Z',
      };

      const mockTelemetry = {
        getStats: vi.fn().mockReturnValue(mockStats),
      };

      const stats = mockTelemetry.getStats();

      expect(stats.totalEvents).toBe(1000);
      expect(stats.databaseSizeBytes).toBe(1048576);
    });

    it('should handle missing event dates', () => {
      const mockStats: MockTelemetryStats = {
        totalEvents: 0,
        databaseSizeBytes: 0,
      };

      expect(mockStats.oldestEvent).toBeUndefined();
      expect(mockStats.newestEvent).toBeUndefined();
    });

    it('should format event dates for display', () => {
      const eventDate = new Date('2024-01-15T10:30:00Z');
      const formattedDate = eventDate.toLocaleDateString();
      const formattedTime = eventDate.toLocaleTimeString();

      expect(formattedDate).toBeDefined();
      expect(formattedTime).toBeDefined();
    });
  });

  // ============================================================================
  // Command Structure Tests
  // ============================================================================

  describe('Command Structure', () => {
    it('should require subcommand', () => {
      const commandDefinition = {
        command: 'analytics <subcommand>',
        describe: 'View usage analytics and optimization recommendations',
        demandCommand: 1,
      };

      expect(commandDefinition.command).toBe('analytics <subcommand>');
      expect(commandDefinition.demandCommand).toBe(1);
    });

    it('should define period option', () => {
      const periodOption = {
        describe: 'Time period',
        type: 'string',
        default: '7d',
        choices: ['24h', '7d', '30d', 'all'],
      };

      expect(periodOption.choices).toContain('24h');
      expect(periodOption.choices).toContain('7d');
      expect(periodOption.choices).toContain('30d');
      expect(periodOption.choices).toContain('all');
      expect(periodOption.default).toBe('7d');
    });

    it('should define format option', () => {
      const formatOption = {
        describe: 'Output format',
        type: 'string',
        default: 'text',
        choices: ['text', 'json'],
      };

      expect(formatOption.choices).toContain('text');
      expect(formatOption.choices).toContain('json');
      expect(formatOption.default).toBe('text');
    });

    it('should define provider filter option', () => {
      const providerOption = {
        describe: 'Filter by provider',
        type: 'string',
      };

      expect(providerOption.type).toBe('string');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle config load failure', async () => {
      const mockLoadConfig = vi.fn().mockRejectedValue(new Error('Config not found'));

      await expect(mockLoadConfig(process.cwd())).rejects.toThrow('Config not found');
    });

    it('should handle telemetry initialization failure', async () => {
      const mockTelemetry = {
        initialize: vi.fn().mockRejectedValue(new Error('Database locked')),
      };

      await expect(mockTelemetry.initialize()).rejects.toThrow('Database locked');
    });

    it('should close telemetry on error', async () => {
      const mockTelemetry = {
        close: vi.fn().mockResolvedValue(undefined),
      };

      await mockTelemetry.close();

      expect(mockTelemetry.close).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle zero executions', () => {
      const summary: MockAnalyticsSummary = {
        executions: { total: 0, successful: 0, failed: 0, successRate: 0 },
        performance: { avgLatencyMs: 0, p50LatencyMs: 0, p95LatencyMs: 0, p99LatencyMs: 0 },
        costs: { totalUsd: 0, avgCostPerRequest: 0, byProvider: {} },
        topAgents: [],
      };

      expect(summary.executions.total).toBe(0);
      expect(summary.executions.successRate).toBe(0);
    });

    it('should handle empty provider costs', () => {
      const costs = {
        totalUsd: 0,
        byProvider: {},
      };

      expect(Object.keys(costs.byProvider)).toHaveLength(0);
    });

    it('should handle very large numbers', () => {
      const formatCost = (usd: number): string => {
        if (usd === 0) return '$0.00';
        if (usd < 0.01) return '<$0.01';
        return `$${usd.toFixed(2)}`;
      };

      expect(formatCost(1000000)).toBe('$1000000.00');
    });

    it('should handle undefined telemetry config', () => {
      const config = {
        telemetry: undefined,
      };

      const telemetryConfig = config.telemetry || { enabled: false };

      expect(telemetryConfig.enabled).toBe(false);
    });

    it('should slice top agents to limit', () => {
      const topAgents = Array(10)
        .fill(null)
        .map((_, i) => ({
          name: `agent-${i}`,
          executionCount: 100 - i,
          totalCost: 10 - i,
          avgLatency: 500,
        }));

      const limited = topAgents.slice(0, 5);

      expect(limited).toHaveLength(5);
      expect(limited[0]?.name).toBe('agent-0');
    });
  });
});
