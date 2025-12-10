/**
 * Unit Tests for Dynamic Optimizer (v14.0.0)
 *
 * Tests runtime performance-based provider optimization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DynamicOptimizer,
  getDynamicOptimizer,
  resetDynamicOptimizer,
  type DynamicOptimizerConfig,
  type ProviderPerformanceSnapshot,
  type OptimizationRecommendation
} from '../../../src/core/router/dynamic-optimizer.js';
import * as metricsModule from '../../../src/core/provider-metrics-tracker.js';
import type { ProviderMetrics } from '../../../src/types/routing.js';

// Mock metrics data
const mockMetrics: ProviderMetrics = {
  provider: 'claude-code',
  window: 100,
  firstRequest: Date.now() - 86400000, // 1 day ago
  lastRequest: Date.now(),
  latency: {
    avg: 500,
    p50: 450,
    p95: 800,
    p99: 1200,
    min: 200,
    max: 2000
  },
  quality: {
    totalRequests: 100,
    successfulRequests: 95,
    failedRequests: 5,
    successRate: 0.95,
    stopFinishes: 90,
    lengthFinishes: 5,
    errorFinishes: 5,
    properStopRate: 0.947
  },
  cost: {
    totalCostUsd: 10.5,
    avgCostPerRequest: 0.105,
    avgCostPer1MTokens: 3.5
  },
  availability: {
    uptime: 0.99,
    lastFailure: Date.now() - 86400000,
    lastSuccess: Date.now(),
    consecutiveFailures: 0
  },
  lastUpdated: Date.now()
};

// Mock metrics tracker
const mockMetricsTracker = {
  getMetrics: vi.fn(),
  getAllScores: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn()
};

describe('DynamicOptimizer', () => {
  let optimizer: DynamicOptimizer;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetDynamicOptimizer();

    // Mock getProviderMetricsTracker
    vi.spyOn(metricsModule, 'getProviderMetricsTracker').mockReturnValue(
      mockMetricsTracker as unknown as metricsModule.ProviderMetricsTracker
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetDynamicOptimizer();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      optimizer = new DynamicOptimizer();

      const stats = optimizer.getStats();
      expect(stats.isInitialized).toBe(false);
      expect(stats.providersTracked).toBe(0);
      expect(stats.adaptivePriorities).toEqual({});
    });

    it('should initialize with custom config', () => {
      const config: Partial<DynamicOptimizerConfig> = {
        enableAdaptivePriorities: false,
        minRequestsForOptimization: 50,
        optimizationIntervalMs: 60000
      };

      optimizer = new DynamicOptimizer(config);

      const stats = optimizer.getStats();
      expect(stats.isInitialized).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize optimizer and start loop', async () => {
      optimizer = new DynamicOptimizer();

      await optimizer.initialize();

      const stats = optimizer.getStats();
      expect(stats.isInitialized).toBe(true);
    });

    it('should be idempotent', async () => {
      optimizer = new DynamicOptimizer();

      await optimizer.initialize();
      await optimizer.initialize(); // Second call should be no-op

      const stats = optimizer.getStats();
      expect(stats.isInitialized).toBe(true);
    });

    it('should register metrics listener', async () => {
      optimizer = new DynamicOptimizer();

      await optimizer.initialize();

      expect(mockMetricsTracker.on).toHaveBeenCalledWith(
        'metrics-updated',
        expect.any(Function)
      );
    });
  });

  describe('getPerformanceSnapshot', () => {
    beforeEach(async () => {
      optimizer = new DynamicOptimizer();
      await optimizer.initialize();
    });

    it('should return null for unknown provider', async () => {
      mockMetricsTracker.getMetrics.mockResolvedValue(null);

      const snapshot = await optimizer.getPerformanceSnapshot('unknown-provider');

      expect(snapshot).toBeNull();
    });

    it('should return snapshot for known provider', async () => {
      mockMetricsTracker.getMetrics.mockResolvedValue(mockMetrics);

      const snapshot = await optimizer.getPerformanceSnapshot('claude-code');

      expect(snapshot).not.toBeNull();
      expect(snapshot?.provider).toBe('claude-code');
      expect(snapshot?.avgLatencyMs).toBe(500);
      expect(snapshot?.successRate).toBe(0.95);
      expect(snapshot?.priorityScore).toBeGreaterThan(0);
    });

    it('should calculate priority score correctly', async () => {
      mockMetricsTracker.getMetrics.mockResolvedValue(mockMetrics);

      const snapshot = await optimizer.getPerformanceSnapshot('claude-code');

      // Score should be a weighted combination
      expect(snapshot?.priorityScore).toBeGreaterThan(0);
      expect(snapshot?.priorityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('getAllPerformanceSnapshots', () => {
    beforeEach(async () => {
      optimizer = new DynamicOptimizer();
      await optimizer.initialize();
    });

    it('should return empty array when no metrics available', async () => {
      mockMetricsTracker.getMetrics.mockResolvedValue(null);

      const snapshots = await optimizer.getAllPerformanceSnapshots(['provider1', 'provider2']);

      expect(snapshots).toEqual([]);
    });

    it('should return snapshots sorted by priority score', async () => {
      // First provider: high performance
      const highPerfMetrics = { ...mockMetrics, quality: { ...mockMetrics.quality, successRate: 0.99 } };
      // Second provider: lower performance
      const lowPerfMetrics = { ...mockMetrics, quality: { ...mockMetrics.quality, successRate: 0.7 } };

      mockMetricsTracker.getMetrics
        .mockResolvedValueOnce(highPerfMetrics)
        .mockResolvedValueOnce(lowPerfMetrics);

      const snapshots = await optimizer.getAllPerformanceSnapshots(['provider1', 'provider2']);

      expect(snapshots.length).toBe(2);
      // Higher score should come first
      expect(snapshots[0]!.priorityScore).toBeGreaterThanOrEqual(snapshots[1]!.priorityScore);
    });
  });

  describe('generateRecommendations', () => {
    beforeEach(async () => {
      optimizer = new DynamicOptimizer({
        enableAdaptivePriorities: true,
        enableCostOptimization: true,
        minRequestsForOptimization: 10
      });
      await optimizer.initialize();
    });

    it('should return empty array when no providers', async () => {
      mockMetricsTracker.getMetrics.mockResolvedValue(null);

      const recommendations = await optimizer.generateRecommendations([]);

      expect(recommendations).toEqual([]);
    });

    it('should generate health warning for consecutive failures', async () => {
      const unhealthyMetrics = {
        ...mockMetrics,
        availability: { ...mockMetrics.availability, consecutiveFailures: 5 }
      };
      mockMetricsTracker.getMetrics.mockResolvedValue(unhealthyMetrics);

      const recommendations = await optimizer.generateRecommendations(['unhealthy-provider']);

      const healthWarning = recommendations.find(r => r.type === 'health_warning');
      expect(healthWarning).toBeDefined();
      expect(healthWarning?.impact).toBe('high');
    });

    it('should generate disable recommendation for low success rate', async () => {
      const lowSuccessMetrics = {
        ...mockMetrics,
        quality: { ...mockMetrics.quality, successRate: 0.3, totalRequests: 50 }
      };
      mockMetricsTracker.getMetrics.mockResolvedValue(lowSuccessMetrics);

      const recommendations = await optimizer.generateRecommendations(['low-success-provider']);

      const disableRec = recommendations.find(r => r.type === 'disable_provider');
      expect(disableRec).toBeDefined();
      expect(disableRec?.impact).toBe('high');
    });

    it('should sort recommendations by impact and confidence', async () => {
      // Multiple issues to generate multiple recommendations
      const problematicMetrics = {
        ...mockMetrics,
        quality: { ...mockMetrics.quality, successRate: 0.4, totalRequests: 100 },
        availability: { ...mockMetrics.availability, consecutiveFailures: 3 }
      };
      mockMetricsTracker.getMetrics.mockResolvedValue(problematicMetrics);

      const recommendations = await optimizer.generateRecommendations(['problem-provider']);

      expect(recommendations.length).toBeGreaterThan(0);
      // High impact should come first
      if (recommendations.length > 1) {
        const impactOrder = { high: 3, medium: 2, low: 1 };
        for (let i = 0; i < recommendations.length - 1; i++) {
          const curr = recommendations[i]!;
          const next = recommendations[i + 1]!;
          expect(impactOrder[curr.impact]).toBeGreaterThanOrEqual(impactOrder[next.impact]);
        }
      }
    });
  });

  describe('applyRecommendation', () => {
    beforeEach(async () => {
      optimizer = new DynamicOptimizer();
      await optimizer.initialize();
    });

    it('should apply priority adjustment', async () => {
      const recommendation: OptimizationRecommendation = {
        type: 'priority_adjustment',
        provider: 'test-provider',
        currentValue: 50,
        recommendedValue: 20,
        reason: 'Better performance',
        confidence: 0.9,
        impact: 'medium'
      };

      const result = await optimizer.applyRecommendation(recommendation);

      expect(result).toBe(true);
      const priorities = optimizer.getAdaptivePriorities();
      expect(priorities['test-provider']).toBe(20);
    });

    it('should apply disable provider recommendation', async () => {
      const recommendation: OptimizationRecommendation = {
        type: 'disable_provider',
        provider: 'bad-provider',
        currentValue: 0.3,
        recommendedValue: 'disabled',
        reason: 'Low success rate',
        confidence: 0.85,
        impact: 'high'
      };

      const result = await optimizer.applyRecommendation(recommendation);

      expect(result).toBe(true);
      const priorities = optimizer.getAdaptivePriorities();
      expect(priorities['bad-provider']).toBe(999);
    });

    it('should emit event on apply', async () => {
      const eventHandler = vi.fn();
      optimizer.on('optimization-applied', eventHandler);

      const recommendation: OptimizationRecommendation = {
        type: 'priority_adjustment',
        provider: 'test-provider',
        currentValue: 50,
        recommendedValue: 30,
        reason: 'Test',
        confidence: 0.8,
        impact: 'medium'
      };

      await optimizer.applyRecommendation(recommendation);

      expect(eventHandler).toHaveBeenCalledWith(recommendation);
    });
  });

  describe('reorderByPerformance', () => {
    beforeEach(async () => {
      optimizer = new DynamicOptimizer({
        enableHealthReordering: true,
        enableAdaptivePriorities: true
      });
      await optimizer.initialize();
    });

    it('should return original order when no data', async () => {
      mockMetricsTracker.getMetrics.mockResolvedValue(null);

      const providers = ['provider-a', 'provider-b', 'provider-c'];
      const healthStatus = new Map([
        ['provider-a', true],
        ['provider-b', true],
        ['provider-c', true]
      ]);

      const result = await optimizer.reorderByPerformance(providers, healthStatus);

      expect(result).toEqual(providers);
    });

    it('should move unhealthy providers to the end', async () => {
      mockMetricsTracker.getMetrics.mockResolvedValue(mockMetrics);

      const providers = ['unhealthy', 'healthy1', 'healthy2'];
      const healthStatus = new Map([
        ['unhealthy', false],
        ['healthy1', true],
        ['healthy2', true]
      ]);

      const result = await optimizer.reorderByPerformance(providers, healthStatus);

      expect(result[result.length - 1]).toBe('unhealthy');
    });

    it('should respect adaptive priorities', async () => {
      mockMetricsTracker.getMetrics.mockResolvedValue(mockMetrics);

      // Set adaptive priorities (lower = better)
      await optimizer.applyRecommendation({
        type: 'priority_adjustment',
        provider: 'provider-b',
        currentValue: 50,
        recommendedValue: 10, // High priority
        reason: 'Test',
        confidence: 0.9,
        impact: 'medium'
      });

      const providers = ['provider-a', 'provider-b', 'provider-c'];
      const healthStatus = new Map([
        ['provider-a', true],
        ['provider-b', true],
        ['provider-c', true]
      ]);

      const result = await optimizer.reorderByPerformance(providers, healthStatus);

      // provider-b should be first due to lower priority number
      expect(result[0]).toBe('provider-b');
    });
  });

  describe('cost tracking', () => {
    beforeEach(async () => {
      optimizer = new DynamicOptimizer();
      await optimizer.initialize();
    });

    it('should track costs correctly', () => {
      optimizer.trackCost('provider-a', 0.05);
      optimizer.trackCost('provider-a', 0.03);
      optimizer.trackCost('provider-b', 0.10);

      const summary = optimizer.getCostSummary();

      expect(summary.totalCostUsd).toBeCloseTo(0.18);
      expect(summary.costByProvider['provider-a']).toBeCloseTo(0.08);
      expect(summary.costByProvider['provider-b']).toBeCloseTo(0.10);
    });

    it('should return top spenders', () => {
      optimizer.trackCost('cheap', 0.01);
      optimizer.trackCost('expensive', 0.50);
      optimizer.trackCost('medium', 0.10);

      const summary = optimizer.getCostSummary();

      expect(summary.topSpenders[0]?.provider).toBe('expensive');
      expect(summary.topSpenders[0]?.costUsd).toBe(0.50);
    });

    it('should reset cost tracking', () => {
      optimizer.trackCost('provider', 1.00);

      optimizer.resetCostTracking();

      const summary = optimizer.getCostSummary();
      expect(summary.totalCostUsd).toBe(0);
      expect(Object.keys(summary.costByProvider)).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', async () => {
      optimizer = new DynamicOptimizer();
      await optimizer.initialize();

      optimizer.trackCost('provider', 0.10);

      const stats = optimizer.getStats();

      expect(stats).toHaveProperty('isInitialized', true);
      expect(stats).toHaveProperty('lastOptimizationAt');
      expect(stats).toHaveProperty('providersTracked');
      expect(stats).toHaveProperty('totalAppliedOptimizations');
      expect(stats).toHaveProperty('adaptivePriorities');
      expect(stats).toHaveProperty('costTracking');
      expect(stats.costTracking.totalCostUsd).toBe(0.10);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      optimizer = new DynamicOptimizer();
      await optimizer.initialize();

      optimizer.destroy();

      const stats = optimizer.getStats();
      expect(stats.isInitialized).toBe(false);
    });

    it('should clear interval', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      optimizer = new DynamicOptimizer();
      await optimizer.initialize();

      optimizer.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});

describe('getDynamicOptimizer singleton', () => {
  beforeEach(() => {
    resetDynamicOptimizer();
    vi.spyOn(metricsModule, 'getProviderMetricsTracker').mockReturnValue(
      mockMetricsTracker as unknown as metricsModule.ProviderMetricsTracker
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetDynamicOptimizer();
  });

  it('should return singleton instance', () => {
    const optimizer1 = getDynamicOptimizer();
    const optimizer2 = getDynamicOptimizer();

    expect(optimizer1).toBe(optimizer2);
  });

  it('should initialize with config on first call', () => {
    const config: Partial<DynamicOptimizerConfig> = {
      enableAdaptivePriorities: false
    };

    const optimizer = getDynamicOptimizer(config);

    expect(optimizer).toBeDefined();
  });
});

describe('resetDynamicOptimizer', () => {
  beforeEach(() => {
    vi.spyOn(metricsModule, 'getProviderMetricsTracker').mockReturnValue(
      mockMetricsTracker as unknown as metricsModule.ProviderMetricsTracker
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetDynamicOptimizer();
  });

  it('should create new instance after reset', async () => {
    const optimizer1 = getDynamicOptimizer();
    await optimizer1.initialize();

    resetDynamicOptimizer();

    const optimizer2 = getDynamicOptimizer();

    expect(optimizer2).not.toBe(optimizer1);
    expect(optimizer2.getStats().isInitialized).toBe(false);
  });

  it('should destroy optimizer on reset', async () => {
    const optimizer = getDynamicOptimizer();
    await optimizer.initialize();
    const destroySpy = vi.spyOn(optimizer, 'destroy');

    resetDynamicOptimizer();

    expect(destroySpy).toHaveBeenCalled();
  });
});
