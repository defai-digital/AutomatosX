/**
 * Phase 3 Tests: RoutingStrategyManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RoutingStrategyManager, resetRoutingStrategyManager } from '../../src/core/routing-strategy.js';
import { getProviderMetricsTracker, resetProviderMetricsTracker } from '../../src/core/provider-metrics-tracker.js';

describe('Phase 3: RoutingStrategyManager', () => {
  beforeEach(() => {
    resetRoutingStrategyManager();
    resetProviderMetricsTracker();
  });

  describe('Pre-configured strategies', () => {
    it('should initialize with balanced strategy by default', () => {
      const manager = new RoutingStrategyManager();
      const strategy = manager.getStrategy();

      expect(strategy.name).toBe('balanced');
      expect(strategy.weights.cost).toBeCloseTo(0.33, 2);
      expect(strategy.weights.latency).toBeCloseTo(0.33, 2);
      expect(strategy.weights.quality).toBeCloseTo(0.33, 2);
    });

    it('should initialize with fast strategy', () => {
      const manager = new RoutingStrategyManager({ strategy: 'fast' });
      const strategy = manager.getStrategy();

      expect(strategy.name).toBe('fast');
      expect(strategy.weights.latency).toBe(0.70);
      expect(strategy.weights.quality).toBe(0.20);
      expect(strategy.weights.cost).toBe(0.10);
    });

    it('should initialize with cheap strategy', () => {
      const manager = new RoutingStrategyManager({ strategy: 'cheap' });
      const strategy = manager.getStrategy();

      expect(strategy.name).toBe('cheap');
      expect(strategy.weights.cost).toBe(0.70);
      expect(strategy.weights.quality).toBe(0.20);
      expect(strategy.weights.latency).toBe(0.10);
    });

    it('should initialize with quality strategy', () => {
      const manager = new RoutingStrategyManager({ strategy: 'quality' });
      const strategy = manager.getStrategy();

      expect(strategy.name).toBe('quality');
      expect(strategy.weights.quality).toBe(0.60);
      expect(strategy.weights.latency).toBe(0.30);
      expect(strategy.weights.cost).toBe(0.10);
    });
  });

  describe('Custom strategy', () => {
    it('should accept custom weights', () => {
      const manager = new RoutingStrategyManager({
        strategy: 'custom',
        customWeights: {
          cost: 0.5,
          latency: 0.3,
          quality: 0.15,
          availability: 0.05
        }
      });

      const weights = manager.getWeights();
      expect(weights.cost).toBe(0.5);
      expect(weights.latency).toBe(0.3);
      expect(weights.quality).toBe(0.15);
      expect(weights.availability).toBe(0.05);
    });
  });

  describe('selectProvider', () => {
    it('should fall back to priority when insufficient metrics', async () => {
      const manager = new RoutingStrategyManager({ strategy: 'balanced' });
      const providers = ['openai', 'gemini', 'claude'];

      const decision = await manager.selectProvider(providers, new Map(), true);

      expect(decision).not.toBeNull();
      expect(decision!.selectedProvider).toBe('openai'); // First in list
      expect(decision!.reason).toContain('Insufficient metrics data');
    });

    it('should return null when no data and fallback disabled', async () => {
      const manager = new RoutingStrategyManager({ strategy: 'balanced' });
      const providers = ['openai', 'gemini', 'claude'];

      const decision = await manager.selectProvider(providers, new Map(), false);

      expect(decision).toBeNull();
    });

    it('should select provider based on metrics when available', async () => {
      const manager = new RoutingStrategyManager({
        strategy: 'cheap',
        minRequestsForScoring: 5,  // Lower threshold for test
        metricsWindow: 100  // Create dedicated tracker with matching threshold
      });
      const tracker = manager.getMetricsTracker();

      // OpenAI: High cost, low latency
      for (let i = 0; i < 5; i++) {
        await tracker.recordRequest('openai', 1000, true, 'stop',
          { prompt: 100, completion: 50, total: 150 }, 0.010, 'gpt-4');
      }

      // Gemini: Low cost, medium latency
      for (let i = 0; i < 5; i++) {
        await tracker.recordRequest('gemini', 1500, true, 'stop',
          { prompt: 100, completion: 50, total: 150 }, 0.003, 'gemini-pro');
      }

      const providers = ['openai', 'gemini'];
      const decision = await manager.selectProvider(providers, new Map());

      expect(decision).not.toBeNull();
      // With cheap strategy, Gemini should win due to lower cost
      expect(decision!.selectedProvider).toBe('gemini');
      expect(decision!.strategy).toBe('cheap');
    });

    it('should apply health multipliers', async () => {
      const manager = new RoutingStrategyManager({
        strategy: 'balanced',
        minRequestsForScoring: 5,  // Lower threshold for test
        metricsWindow: 100  // Create dedicated tracker
      });
      const tracker = manager.getMetricsTracker();

      // Both providers have similar metrics
      for (let i = 0; i < 5; i++) {
        await tracker.recordRequest('openai', 1000, true, 'stop',
          { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');
        await tracker.recordRequest('gemini', 1000, true, 'stop',
          { prompt: 100, completion: 50, total: 150 }, 0.005, 'gemini-pro');
      }

      // Penalize OpenAI
      const healthMultipliers = new Map([
        ['openai', 0.5], // Penalized
        ['gemini', 1.0]   // Healthy
      ]);

      const decision = await manager.selectProvider(['openai', 'gemini'], healthMultipliers);

      expect(decision).not.toBeNull();
      // Gemini should win due to health multiplier
      expect(decision!.selectedProvider).toBe('gemini');
    });
  });

  describe('Decision tracking', () => {
    it('should track decision history', async () => {
      const manager = new RoutingStrategyManager({ strategy: 'balanced' });
      const providers = ['openai', 'gemini'];

      await manager.selectProvider(providers, new Map(), true);
      await manager.selectProvider(providers, new Map(), true);

      const history = manager.exportHistory();
      expect(history).toHaveLength(2);
      expect(history[0]!.selectedProvider).toBeDefined();
      expect(history[0]!.timestamp).toBeGreaterThan(0);
    });

    it('should provide routing statistics', async () => {
      const manager = new RoutingStrategyManager({ strategy: 'balanced' });
      const providers = ['openai', 'gemini'];

      await manager.selectProvider(providers, new Map(), true);
      await manager.selectProvider(providers, new Map(), true);
      await manager.selectProvider(providers, new Map(), true);

      const stats = manager.getRoutingStats();
      expect(stats.totalDecisions).toBe(3);
      expect(stats.providerUsage).toBeDefined();
    });

    it('should clear history', async () => {
      const manager = new RoutingStrategyManager({ strategy: 'balanced' });
      const providers = ['openai'];

      await manager.selectProvider(providers, new Map(), true);
      manager.clearHistory();

      const history = manager.exportHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Strategy updates', () => {
    it('should allow strategy updates', () => {
      const manager = new RoutingStrategyManager({ strategy: 'balanced' });

      manager.setStrategy('fast');
      const strategy = manager.getStrategy();

      expect(strategy.name).toBe('fast');
      expect(strategy.weights.latency).toBe(0.70);
    });

    it('should allow custom strategy updates', () => {
      const manager = new RoutingStrategyManager({ strategy: 'balanced' });

      manager.setStrategy('custom', {
        cost: 0.6,
        latency: 0.2,
        quality: 0.15,
        availability: 0.05
      });

      const weights = manager.getWeights();
      expect(weights.cost).toBe(0.6);
    });
  });
});
