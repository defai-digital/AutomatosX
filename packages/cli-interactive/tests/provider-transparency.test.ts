/**
 * Tests for Provider Transparency
 *
 * Comprehensive test suite for provider routing visualization,
 * metrics tracking, and transparency features.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderProviderRoute,
  renderProviderMetrics,
  renderInlineRoutingNotification,
  renderCostComparison,
  renderProviderHealth,
  createRouteFromTrace,
  ProviderUsageTracker,
  type ProviderRoute,
  type AlternativeProvider,
  type ProviderMetrics
} from '../src/provider-transparency.js';

describe('Provider Transparency', () => {
  describe('renderProviderRoute', () => {
    it('should render compact format', () => {
      const route: ProviderRoute = {
        selectedProvider: 'claude',
        reason: 'Best cost/performance',
        alternatives: [],
        estimatedCost: 0.0025,
        estimatedLatency: 1200
      };

      const result = renderProviderRoute(route, { compact: true });

      expect(result).toContain('claude');
      expect(result).toContain('Best cost/performance');
      expect(result).toContain('$0.0025');
    });

    it('should render detailed format', () => {
      const route: ProviderRoute = {
        selectedProvider: 'gemini',
        reason: 'Free tier available',
        alternatives: [
          {
            provider: 'claude',
            reason: 'Higher quality but more expensive',
            costDiff: 0.003,
            latencyDiff: -200,
            available: true
          }
        ],
        estimatedCost: 0.0,
        estimatedLatency: 1500,
        policyMode: 'cost-optimized',
        constraints: ['max_cost: $0.01', 'min_latency: 2000ms']
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('Provider Routing Decision');
      expect(result).toContain('Selected: gemini');
      expect(result).toContain('Free tier available');
      expect(result).toContain('$0.0000');
      expect(result).toContain('1500ms');
      expect(result).toContain('cost-optimized');
      expect(result).toContain('max_cost: $0.01');
      expect(result).toContain('Alternatives:');
      expect(result).toContain('claude');
    });

    it('should handle route without cost', () => {
      const route: ProviderRoute = {
        selectedProvider: 'openai',
        reason: 'Selected by policy',
        alternatives: []
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('openai');
      expect(result).toContain('Selected by policy');
      expect(result).not.toContain('Est. Cost:');
    });

    it('should handle route without alternatives', () => {
      const route: ProviderRoute = {
        selectedProvider: 'claude-code',
        reason: 'Only provider available',
        alternatives: []
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('claude-code');
      expect(result).not.toContain('Alternatives:');
    });

    it('should show cost differences correctly', () => {
      const route: ProviderRoute = {
        selectedProvider: 'gemini',
        reason: 'Cheapest option',
        alternatives: [
          {
            provider: 'openai',
            reason: 'More expensive',
            costDiff: 0.005,
            available: true
          },
          {
            provider: 'claude',
            reason: 'Premium option',
            costDiff: 0.008,
            available: true
          }
        ]
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('+$0.0050');
      expect(result).toContain('+$0.0080');
    });

    it('should show latency differences correctly', () => {
      const route: ProviderRoute = {
        selectedProvider: 'claude',
        reason: 'Fastest response',
        alternatives: [
          {
            provider: 'gemini',
            reason: 'Slower',
            latencyDiff: 500,
            available: true
          }
        ]
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('+500ms');
    });

    it('should show unavailable alternatives', () => {
      const route: ProviderRoute = {
        selectedProvider: 'claude',
        reason: 'Only available provider',
        alternatives: [
          {
            provider: 'openai',
            reason: 'Rate limit exceeded',
            available: false
          }
        ]
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('openai');
      expect(result).toContain('✗');
      expect(result).toContain('Rate limit exceeded');
    });
  });

  describe('renderProviderMetrics', () => {
    it('should render metrics table', () => {
      const metrics: ProviderMetrics[] = [
        {
          provider: 'claude',
          requestCount: 50,
          totalCost: 0.125,
          avgLatency: 1200,
          successRate: 0.98,
          lastUsed: new Date(Date.now() - 3600000) // 1 hour ago
        },
        {
          provider: 'gemini',
          requestCount: 100,
          totalCost: 0.0,
          avgLatency: 1500,
          successRate: 0.95,
          lastUsed: new Date(Date.now() - 300000) // 5 minutes ago
        }
      ];

      const result = renderProviderMetrics(metrics);

      expect(result).toContain('Provider Usage Summary');
      expect(result).toContain('claude');
      expect(result).toContain('gemini');
      expect(result).toContain('50');
      expect(result).toContain('100');
      expect(result).toContain('$0.13');
      expect(result).toContain('$0.00');
      expect(result).toContain('98%');
      expect(result).toContain('95%');
      expect(result).toContain('Total');
      expect(result).toContain('150'); // Total requests
    });

    it('should handle empty metrics', () => {
      const result = renderProviderMetrics([]);

      expect(result).toContain('Provider Usage Summary');
      expect(result).toContain('No provider usage data');
    });

    it('should calculate totals correctly', () => {
      const metrics: ProviderMetrics[] = [
        {
          provider: 'claude',
          requestCount: 25,
          totalCost: 0.05,
          avgLatency: 1000,
          successRate: 1.0,
          lastUsed: new Date()
        },
        {
          provider: 'openai',
          requestCount: 75,
          totalCost: 0.15,
          avgLatency: 1500,
          successRate: 0.96,
          lastUsed: new Date()
        }
      ];

      const result = renderProviderMetrics(metrics);

      expect(result).toContain('100'); // Total requests
      expect(result).toContain('$0.20'); // Total cost
      expect(result).toContain('98%'); // Average success rate
    });
  });

  describe('renderInlineRoutingNotification', () => {
    it('should render inline notification', () => {
      const route: ProviderRoute = {
        selectedProvider: 'claude',
        reason: 'Best for code generation',
        alternatives: []
      };

      const result = renderInlineRoutingNotification(route);

      expect(result).toContain('Routing to');
      expect(result).toContain('claude');
      expect(result).toContain('Best for code generation');
    });

    it('should include provider icon', () => {
      const route: ProviderRoute = {
        selectedProvider: 'gemini',
        reason: 'Free tier',
        alternatives: []
      };

      const result = renderInlineRoutingNotification(route);

      expect(result).toContain('✨'); // Gemini icon
    });
  });

  describe('renderCostComparison', () => {
    it('should render cost comparison table', () => {
      const routes = [
        { provider: 'claude', cost: 0.003, reason: 'Premium quality' },
        { provider: 'gemini', cost: 0.0, reason: 'Free tier' },
        { provider: 'openai', cost: 0.002, reason: 'Good balance' }
      ];

      const result = renderCostComparison(routes);

      expect(result).toContain('Cost Comparison');
      expect(result).toContain('gemini');
      expect(result).toContain('openai');
      expect(result).toContain('claude');
      expect(result).toContain('$0.0000');
      expect(result).toContain('$0.0020');
      expect(result).toContain('$0.0030');
      expect(result).toContain('Potential savings:');
    });

    it('should sort by cost ascending', () => {
      const routes = [
        { provider: 'expensive', cost: 0.01 },
        { provider: 'cheap', cost: 0.001 },
        { provider: 'medium', cost: 0.005 }
      ];

      const result = renderCostComparison(routes);

      const cheapIndex = result.indexOf('cheap');
      const mediumIndex = result.indexOf('medium');
      const expensiveIndex = result.indexOf('expensive');

      expect(cheapIndex).toBeLessThan(mediumIndex);
      expect(mediumIndex).toBeLessThan(expensiveIndex);
    });

    it('should show cheapest with star', () => {
      const routes = [
        { provider: 'gemini', cost: 0.0 },
        { provider: 'claude', cost: 0.003 }
      ];

      const result = renderCostComparison(routes);

      expect(result).toContain('★');
    });

    it('should calculate savings percentage', () => {
      const routes = [
        { provider: 'cheap', cost: 0.001 },
        { provider: 'expensive', cost: 0.005 }
      ];

      const result = renderCostComparison(routes);

      expect(result).toContain('$0.0040'); // Savings amount
      expect(result).toContain('80%'); // Savings percentage
    });
  });

  describe('renderProviderHealth', () => {
    it('should render health status', () => {
      const providers = [
        { provider: 'claude', available: true, latency: 1200, errorRate: 0.02 },
        { provider: 'gemini', available: true, latency: 1500, errorRate: 0.05 },
        { provider: 'openai', available: false }
      ];

      const result = renderProviderHealth(providers);

      expect(result).toContain('Provider Health Status');
      expect(result).toContain('claude');
      expect(result).toContain('gemini');
      expect(result).toContain('openai');
      expect(result).toContain('● Online');
      expect(result).toContain('● Offline');
      expect(result).toContain('1200ms');
      expect(result).toContain('2.0% errors');
      expect(result).toContain('5.0% errors');
    });

    it('should handle providers without latency', () => {
      const providers = [
        { provider: 'claude', available: true }
      ];

      const result = renderProviderHealth(providers);

      expect(result).toContain('claude');
      expect(result).toContain('● Online');
      expect(result).not.toContain('ms');
    });

    it('should handle providers without error rate', () => {
      const providers = [
        { provider: 'claude', available: true, latency: 1200 }
      ];

      const result = renderProviderHealth(providers);

      expect(result).toContain('claude');
      expect(result).toContain('1200ms');
      expect(result).not.toContain('errors');
    });
  });

  describe('createRouteFromTrace', () => {
    it('should create route from trace', () => {
      const trace = {
        selectedProvider: 'claude',
        reason: 'Best score',
        candidates: [
          { provider: 'claude', score: 0.95, available: true },
          { provider: 'gemini', score: 0.85, available: true },
          { provider: 'openai', score: 0.75, available: false }
        ],
        estimatedCost: 0.003,
        estimatedLatency: 1200,
        policyMode: 'balanced'
      };

      const route = createRouteFromTrace(trace);

      expect(route.selectedProvider).toBe('claude');
      expect(route.reason).toBe('Best score');
      expect(route.estimatedCost).toBe(0.003);
      expect(route.estimatedLatency).toBe(1200);
      expect(route.policyMode).toBe('balanced');
      expect(route.alternatives).toHaveLength(2);
      expect(route.alternatives[0].provider).toBe('gemini');
      expect(route.alternatives[1].provider).toBe('openai');
    });

    it('should handle trace without candidates', () => {
      const trace = {
        selectedProvider: 'claude',
        reason: 'Only available'
      };

      const route = createRouteFromTrace(trace);

      expect(route.selectedProvider).toBe('claude');
      expect(route.alternatives).toHaveLength(0);
    });

    it('should exclude selected provider from alternatives', () => {
      const trace = {
        selectedProvider: 'claude',
        reason: 'Best option',
        candidates: [
          { provider: 'claude', score: 0.95, available: true },
          { provider: 'gemini', score: 0.85, available: true }
        ]
      };

      const route = createRouteFromTrace(trace);

      expect(route.alternatives).toHaveLength(1);
      expect(route.alternatives[0].provider).toBe('gemini');
    });

    it('should show unavailable reason correctly', () => {
      const trace = {
        selectedProvider: 'claude',
        reason: 'Available',
        candidates: [
          { provider: 'claude', score: 0.95, available: true },
          { provider: 'openai', score: 0.90, available: false }
        ]
      };

      const route = createRouteFromTrace(trace);

      expect(route.alternatives[0].reason).toBe('Unavailable');
      expect(route.alternatives[0].available).toBe(false);
    });

    it('should show score for available candidates', () => {
      const trace = {
        selectedProvider: 'claude',
        reason: 'Best',
        candidates: [
          { provider: 'claude', score: 0.95, available: true },
          { provider: 'gemini', score: 0.85, available: true }
        ]
      };

      const route = createRouteFromTrace(trace);

      expect(route.alternatives[0].reason).toBe('Score: 0.85');
    });
  });

  describe('ProviderUsageTracker', () => {
    let tracker: ProviderUsageTracker;

    beforeEach(() => {
      tracker = new ProviderUsageTracker();
    });

    it('should record first usage', () => {
      tracker.recordUsage('claude', 0.003, 1200, true);

      const metrics = tracker.getProviderMetrics('claude');

      expect(metrics).toBeDefined();
      expect(metrics!.provider).toBe('claude');
      expect(metrics!.requestCount).toBe(1);
      expect(metrics!.totalCost).toBe(0.003);
      expect(metrics!.avgLatency).toBe(1200);
      expect(metrics!.successRate).toBe(1);
      expect(metrics!.lastUsed).toBeInstanceOf(Date);
    });

    it('should accumulate multiple usages', () => {
      tracker.recordUsage('claude', 0.003, 1200, true);
      tracker.recordUsage('claude', 0.002, 1000, true);
      tracker.recordUsage('claude', 0.004, 1400, false);

      const metrics = tracker.getProviderMetrics('claude');

      expect(metrics!.requestCount).toBe(3);
      expect(metrics!.totalCost).toBeCloseTo(0.009, 5);
      expect(metrics!.avgLatency).toBeCloseTo(1200, 0);
      expect(metrics!.successRate).toBeCloseTo(0.667, 2);
    });

    it('should track multiple providers', () => {
      tracker.recordUsage('claude', 0.003, 1200, true);
      tracker.recordUsage('gemini', 0.0, 1500, true);
      tracker.recordUsage('openai', 0.002, 1100, true);

      const allMetrics = tracker.getMetrics();

      expect(allMetrics).toHaveLength(3);
      expect(allMetrics.map(m => m.provider)).toEqual(
        expect.arrayContaining(['claude', 'gemini', 'openai'])
      );
    });

    it('should calculate average latency correctly', () => {
      tracker.recordUsage('claude', 0.003, 1000, true);
      tracker.recordUsage('claude', 0.003, 1200, true);
      tracker.recordUsage('claude', 0.003, 1400, true);

      const metrics = tracker.getProviderMetrics('claude');

      expect(metrics!.avgLatency).toBeCloseTo(1200, 0);
    });

    it('should calculate success rate correctly', () => {
      tracker.recordUsage('claude', 0.003, 1200, true);
      tracker.recordUsage('claude', 0.003, 1200, true);
      tracker.recordUsage('claude', 0.003, 1200, true);
      tracker.recordUsage('claude', 0.003, 1200, false);

      const metrics = tracker.getProviderMetrics('claude');

      expect(metrics!.successRate).toBe(0.75);
    });

    it('should update last used timestamp', () => {
      const before = Date.now();
      tracker.recordUsage('claude', 0.003, 1200, true);
      const after = Date.now();

      const metrics = tracker.getProviderMetrics('claude');
      const lastUsedTime = metrics!.lastUsed.getTime();

      expect(lastUsedTime).toBeGreaterThanOrEqual(before);
      expect(lastUsedTime).toBeLessThanOrEqual(after);
    });

    it('should handle zero cost', () => {
      tracker.recordUsage('gemini', 0.0, 1500, true);

      const metrics = tracker.getProviderMetrics('gemini');

      expect(metrics!.totalCost).toBe(0);
    });

    it('should handle failed requests', () => {
      tracker.recordUsage('claude', 0.003, 1200, false);

      const metrics = tracker.getProviderMetrics('claude');

      expect(metrics!.successRate).toBe(0);
    });

    it('should clear all metrics', () => {
      tracker.recordUsage('claude', 0.003, 1200, true);
      tracker.recordUsage('gemini', 0.0, 1500, true);

      tracker.clear();

      const allMetrics = tracker.getMetrics();
      expect(allMetrics).toHaveLength(0);
    });

    it('should return undefined for unknown provider', () => {
      const metrics = tracker.getProviderMetrics('unknown');
      expect(metrics).toBeUndefined();
    });

    it('should handle high request counts', () => {
      for (let i = 0; i < 1000; i++) {
        tracker.recordUsage('claude', 0.003, 1200 + (i % 100), i % 10 !== 0);
      }

      const metrics = tracker.getProviderMetrics('claude');

      expect(metrics!.requestCount).toBe(1000);
      expect(metrics!.successRate).toBeCloseTo(0.9, 2);
    });

    it('should handle very small costs', () => {
      tracker.recordUsage('claude', 0.0001, 1200, true);
      tracker.recordUsage('claude', 0.0002, 1200, true);

      const metrics = tracker.getProviderMetrics('claude');

      expect(metrics!.totalCost).toBeCloseTo(0.0003, 6);
    });

    it('should handle very large latencies', () => {
      tracker.recordUsage('claude', 0.003, 50000, true);

      const metrics = tracker.getProviderMetrics('claude');

      expect(metrics!.avgLatency).toBe(50000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long provider names', () => {
      const route: ProviderRoute = {
        selectedProvider: 'very-long-provider-name-for-testing-purposes',
        reason: 'Testing',
        alternatives: []
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('very-long-provider-name-for-testing-purposes');
    });

    it('should handle very long reason text', () => {
      const longReason = 'This is a very long reason that explains in great detail why this particular provider was selected over all other available alternatives considering multiple factors such as cost, latency, availability, and policy constraints.';

      const route: ProviderRoute = {
        selectedProvider: 'claude',
        reason: longReason,
        alternatives: []
      };

      const result = renderProviderRoute(route);

      expect(result).toContain(longReason);
    });

    it('should handle many alternatives', () => {
      const alternatives: AlternativeProvider[] = [];
      for (let i = 0; i < 10; i++) {
        alternatives.push({
          provider: `provider-${i}`,
          reason: `Reason ${i}`,
          available: i % 2 === 0
        });
      }

      const route: ProviderRoute = {
        selectedProvider: 'claude',
        reason: 'Selected',
        alternatives
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('provider-0');
      expect(result).toContain('provider-9');
    });

    it('should handle zero cost', () => {
      const route: ProviderRoute = {
        selectedProvider: 'gemini',
        reason: 'Free tier',
        alternatives: [],
        estimatedCost: 0.0
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('$0.0000');
    });

    it('should handle very high cost', () => {
      const route: ProviderRoute = {
        selectedProvider: 'premium',
        reason: 'Premium service',
        alternatives: [],
        estimatedCost: 10.5
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('$10.5000');
    });

    it('should handle zero latency', () => {
      const route: ProviderRoute = {
        selectedProvider: 'instant',
        reason: 'Cached',
        alternatives: [],
        estimatedLatency: 0
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('0ms');
    });

    it('should handle very high latency', () => {
      const route: ProviderRoute = {
        selectedProvider: 'slow',
        reason: 'Slow but thorough',
        alternatives: [],
        estimatedLatency: 60000
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('60000ms');
    });

    it('should handle empty constraints array', () => {
      const route: ProviderRoute = {
        selectedProvider: 'claude',
        reason: 'No constraints',
        alternatives: [],
        constraints: []
      };

      const result = renderProviderRoute(route);

      expect(result).not.toContain('Constraints:');
    });

    it('should handle special characters in provider names', () => {
      const route: ProviderRoute = {
        selectedProvider: 'provider-with-dashes_and_underscores',
        reason: 'Testing special chars',
        alternatives: []
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('provider-with-dashes_and_underscores');
    });

    it('should handle unknown provider icon', () => {
      const route: ProviderRoute = {
        selectedProvider: 'unknown-provider-xyz',
        reason: 'Unknown',
        alternatives: []
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('🔌'); // Default icon
    });

    it('should handle negative cost difference', () => {
      const route: ProviderRoute = {
        selectedProvider: 'claude',
        reason: 'Selected',
        alternatives: [
          {
            provider: 'gemini',
            reason: 'Cheaper',
            costDiff: -0.002,
            available: true
          }
        ]
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('-$0.0020');
    });

    it('should handle negative latency difference', () => {
      const route: ProviderRoute = {
        selectedProvider: 'claude',
        reason: 'Selected',
        alternatives: [
          {
            provider: 'fast-provider',
            reason: 'Faster',
            latencyDiff: -500,
            available: true
          }
        ]
      };

      const result = renderProviderRoute(route);

      expect(result).toContain('-500ms');
    });
  });
});
