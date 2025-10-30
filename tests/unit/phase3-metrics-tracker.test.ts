/**
 * Phase 3 Tests: ProviderMetricsTracker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderMetricsTracker, resetProviderMetricsTracker } from '../../src/core/provider-metrics-tracker.js';

describe('Phase 3: ProviderMetricsTracker', () => {
  let tracker: ProviderMetricsTracker;

  beforeEach(() => {
    resetProviderMetricsTracker();
    tracker = new ProviderMetricsTracker({ windowSize: 10, minRequests: 3 });
  });

  describe('recordRequest', () => {
    it('should record successful request', async () => {
      await tracker.recordRequest(
        'openai',
        1000, // latency
        true, // success
        'stop',
        { prompt: 100, completion: 50, total: 150 },
        0.005, // cost
        'gpt-4'
      );

      const metrics = await tracker.getMetrics('openai');
      expect(metrics).not.toBeNull();
      expect(metrics?.provider).toBe('openai');
      expect(metrics?.window).toBe(1);
      expect(metrics?.quality.successRate).toBe(1.0);
    });

    it('should record failed request', async () => {
      await tracker.recordRequest(
        'openai',
        0,
        false, // failure
        'error',
        { prompt: 0, completion: 0, total: 0 },
        0,
        undefined
      );

      const metrics = await tracker.getMetrics('openai');
      expect(metrics).not.toBeNull();
      expect(metrics?.quality.successRate).toBe(0);
    });

    it('should maintain rolling window', async () => {
      // Record 15 requests (window size is 10)
      for (let i = 0; i < 15; i++) {
        await tracker.recordRequest(
          'openai',
          1000,
          true,
          'stop',
          { prompt: 100, completion: 50, total: 150 },
          0.005,
          'gpt-4'
        );
      }

      const metrics = await tracker.getMetrics('openai');
      expect(metrics?.window).toBe(10); // Should only keep 10 most recent
    });
  });

  describe('getLatencyScore', () => {
    it('should return high score for low latency (< 2s)', async () => {
      await tracker.recordRequest('openai', 1500, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');
      await tracker.recordRequest('openai', 1600, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');
      await tracker.recordRequest('openai', 1700, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');

      const score = await tracker.getLatencyScore('openai');
      // With P95 = 1700ms, continuous scoring gives ~0.93
      expect(score).toBeGreaterThan(0.9);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should return lower score for high latency', async () => {
      await tracker.recordRequest('openai', 6000, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');
      await tracker.recordRequest('openai', 7000, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');
      await tracker.recordRequest('openai', 8000, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');

      const score = await tracker.getLatencyScore('openai');
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('getQualityScore', () => {
    it('should return 1.0 for all successful stop finishes', async () => {
      await tracker.recordRequest('openai', 1000, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');
      await tracker.recordRequest('openai', 1000, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');
      await tracker.recordRequest('openai', 1000, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');

      const score = await tracker.getQualityScore('openai');
      expect(score).toBeGreaterThan(0.9);
    });

    it('should return lower score for errors', async () => {
      await tracker.recordRequest('openai', 0, false, 'error', { prompt: 0, completion: 0, total: 0 }, 0, undefined);
      await tracker.recordRequest('openai', 0, false, 'error', { prompt: 0, completion: 0, total: 0 }, 0, undefined);
      await tracker.recordRequest('openai', 1000, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');

      const score = await tracker.getQualityScore('openai');
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('getAllScores', () => {
    it('should score multiple providers', async () => {
      // Record requests for two providers
      await tracker.recordRequest('openai', 1000, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');
      await tracker.recordRequest('openai', 1100, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');
      await tracker.recordRequest('openai', 1200, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');

      await tracker.recordRequest('gemini', 800, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.003, 'gemini-pro');
      await tracker.recordRequest('gemini', 900, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.003, 'gemini-pro');
      await tracker.recordRequest('gemini', 1000, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.003, 'gemini-pro');

      const weights = { cost: 0.25, latency: 0.25, quality: 0.25, availability: 0.25 };
      const scores = await tracker.getAllScores(['openai', 'gemini'], weights, new Map());

      expect(scores).toHaveLength(2);
      expect(scores[0]!.provider).toBeDefined();
      expect(scores[0]!.totalScore).toBeGreaterThan(0);
      // Gemini should score higher due to lower latency and cost
      const geminiScore = scores.find(s => s.provider === 'gemini');
      const openaiScore = scores.find(s => s.provider === 'openai');
      expect(geminiScore!.breakdown.latencyScore).toBeGreaterThan(openaiScore!.breakdown.latencyScore);
    });
  });

  describe('hasSufficientData', () => {
    it('should return false with insufficient data', () => {
      expect(tracker.hasSufficientData('openai')).toBe(false);
    });

    it('should return true with sufficient data', async () => {
      for (let i = 0; i < 5; i++) {
        await tracker.recordRequest('openai', 1000, true, 'stop', { prompt: 100, completion: 50, total: 150 }, 0.005, 'gpt-4');
      }
      expect(tracker.hasSufficientData('openai')).toBe(true);
    });
  });
});
