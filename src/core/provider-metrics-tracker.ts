/**
 * Provider Metrics Tracker
 *
 * Tracks real-time performance metrics for provider routing decisions
 *
 * Phase 3: Multi-factor routing based on latency, quality, cost, availability
 *
 * Features:
 * - Rolling window metrics (last N requests)
 * - Percentile calculations (P50, P95, P99)
 * - Quality tracking (success rate, finish reasons)
 * - Cost tracking per provider
 * - In-memory storage (fast access)
 *
 * @module core/provider-metrics-tracker
 */

import { EventEmitter } from 'events';
import type { ProviderMetrics, ProviderScore, RoutingWeights, ModelPricing } from '../types/routing.js';
import { PROVIDER_PRICING } from '../types/routing.js';
import { logger } from '../utils/logger.js';

/**
 * Request record for metrics tracking
 */
interface RequestRecord {
  timestamp: number;
  latencyMs: number;
  success: boolean;
  finishReason: 'stop' | 'length' | 'error';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  model?: string;
}

/**
 * Provider Metrics Tracker
 *
 * Tracks real-time performance metrics for intelligent routing
 */
export class ProviderMetricsTracker extends EventEmitter {
  private metrics: Map<string, RequestRecord[]> = new Map();
  private windowSize: number;
  private minRequests: number;

  constructor(options: {
    windowSize?: number;      // Number of recent requests to track (default: 100)
    minRequests?: number;     // Minimum requests before scoring (default: 10)
  } = {}) {
    super();
    this.windowSize = options.windowSize || 100;
    this.minRequests = options.minRequests || 10;

    logger.debug('ProviderMetricsTracker initialized', {
      windowSize: this.windowSize,
      minRequests: this.minRequests
    });
  }

  /**
   * Record a request for metrics tracking
   */
  async recordRequest(
    provider: string,
    latencyMs: number,
    success: boolean,
    finishReason: 'stop' | 'length' | 'error',
    tokenUsage: {
      prompt: number;
      completion: number;
      total: number;
    },
    costUsd: number,
    model?: string
  ): Promise<void> {
    // v6.2.4: Bug fix #28 - Input validation to prevent data corruption
    if (!provider || provider.trim().length === 0) {
      throw new Error('Provider name cannot be empty');
    }
    if (!Number.isFinite(latencyMs)) {
      throw new Error(`Invalid latencyMs value: ${latencyMs}. Must be a finite number.`);
    }
    if (latencyMs < 0) {
      throw new Error(`Invalid latencyMs value: ${latencyMs}. Cannot be negative.`);
    }
    if (!Number.isFinite(costUsd)) {
      throw new Error(`Invalid costUsd value: ${costUsd}. Must be a finite number.`);
    }
    if (costUsd < 0) {
      throw new Error(`Invalid costUsd value: ${costUsd}. Cannot be negative.`);
    }
    if (!Number.isFinite(tokenUsage.prompt) || tokenUsage.prompt < 0) {
      throw new Error(`Invalid prompt tokens: ${tokenUsage.prompt}. Must be a non-negative finite number.`);
    }
    if (!Number.isFinite(tokenUsage.completion) || tokenUsage.completion < 0) {
      throw new Error(`Invalid completion tokens: ${tokenUsage.completion}. Must be a non-negative finite number.`);
    }
    if (!Number.isFinite(tokenUsage.total) || tokenUsage.total < 0) {
      throw new Error(`Invalid total tokens: ${tokenUsage.total}. Must be a non-negative finite number.`);
    }

    // Get or create provider's request history
    if (!this.metrics.has(provider)) {
      this.metrics.set(provider, []);
    }

    const records = this.metrics.get(provider)!;

    // Add new record
    records.push({
      timestamp: Date.now(),
      latencyMs,
      success,
      finishReason,
      promptTokens: tokenUsage.prompt,
      completionTokens: tokenUsage.completion,
      totalTokens: tokenUsage.total,
      costUsd,
      model
    });

    // Trim to window size (keep most recent)
    if (records.length > this.windowSize) {
      records.splice(0, records.length - this.windowSize);
    }

    logger.debug('Request recorded', {
      provider,
      latencyMs,
      success,
      totalRequests: records.length
    });

    // Emit metrics update event
    this.emit('metrics-updated', provider);
  }

  /**
   * Get current metrics for a provider
   */
  async getMetrics(provider: string): Promise<ProviderMetrics | null> {
    const records = this.metrics.get(provider);
    if (!records || records.length === 0) {
      return null;
    }

    const now = Date.now();
    const firstTimestamp = records[0]!.timestamp;
    const lastTimestamp = records[records.length - 1]!.timestamp;

    // Calculate latency metrics
    const latencies = records.map(r => r.latencyMs).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const p50Index = Math.floor(latencies.length * 0.50);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    // Calculate quality metrics
    const successful = records.filter(r => r.success);
    const failed = records.filter(r => !r.success);
    const stopFinishes = successful.filter(r => r.finishReason === 'stop');
    const lengthFinishes = successful.filter(r => r.finishReason === 'length');
    const errorFinishes = records.filter(r => r.finishReason === 'error');

    const successRate = successful.length / records.length;
    const properStopRate = successful.length > 0 ? stopFinishes.length / successful.length : 0;

    // Calculate cost metrics
    const totalCost = records.reduce((sum, r) => sum + r.costUsd, 0);
    const avgCostPerRequest = totalCost / records.length;
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
    const avgCostPer1M = totalTokens > 0 ? (totalCost / totalTokens) * 1_000_000 : 0;

    // Calculate availability metrics
    const lastSuccess = successful.length > 0 ? successful[successful.length - 1]!.timestamp : 0;
    const lastFailure = failed.length > 0 ? failed[failed.length - 1]!.timestamp : 0;

    // Count consecutive failures from the end
    let consecutiveFailures = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (!records[i]!.success) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    const uptime = successRate;  // Simplified: uptime = success rate

    return {
      provider,
      window: records.length,
      latency: {
        avg: avgLatency,
        p50: latencies[p50Index] ?? avgLatency,
        p95: latencies[p95Index] ?? latencies[latencies.length - 1]!,
        p99: latencies[p99Index] ?? latencies[latencies.length - 1]!,
        min: latencies[0]!,
        max: latencies[latencies.length - 1]!
      },
      quality: {
        totalRequests: records.length,
        successfulRequests: successful.length,
        failedRequests: failed.length,
        successRate,
        stopFinishes: stopFinishes.length,
        lengthFinishes: lengthFinishes.length,
        errorFinishes: errorFinishes.length,
        properStopRate
      },
      cost: {
        totalCostUsd: totalCost,
        avgCostPerRequest,
        avgCostPer1MTokens: avgCostPer1M
      },
      availability: {
        uptime,
        lastSuccess,
        lastFailure,
        consecutiveFailures
      },
      firstRequest: firstTimestamp,
      lastRequest: lastTimestamp,
      lastUpdated: now
    };
  }

  /**
   * Calculate latency score (0-1, 1 = best)
   * Based on P95 latency compared to threshold
   */
  async getLatencyScore(provider: string): Promise<number> {
    const metrics = await this.getMetrics(provider);
    if (!metrics || metrics.window < this.minRequests) {
      return 0.5;  // Neutral score if insufficient data
    }

    const p95 = metrics.latency.p95;

    // Continuous scoring with interpolation within ranges
    // < 1000ms: 1.00
    // 1000-2000ms: 1.00 - 0.90 (linear)
    // 2000-3000ms: 0.90 - 0.70 (linear)
    // 3000-4000ms: 0.70 - 0.50 (linear)
    // 4000-5000ms: 0.50 - 0.30 (linear)
    // > 5000ms: 0.30 - 0.10 (capped)

    if (p95 < 1000) return 1.00;
    if (p95 < 2000) return 1.00 - ((p95 - 1000) / 1000) * 0.10;  // 1.00 to 0.90
    if (p95 < 3000) return 0.90 - ((p95 - 2000) / 1000) * 0.20;  // 0.90 to 0.70
    if (p95 < 4000) return 0.70 - ((p95 - 3000) / 1000) * 0.20;  // 0.70 to 0.50
    if (p95 < 5000) return 0.50 - ((p95 - 4000) / 1000) * 0.20;  // 0.50 to 0.30
    return Math.max(0.10, 0.30 - ((p95 - 5000) / 5000) * 0.20);  // 0.30 to 0.10, capped at 0.10
  }

  /**
   * Calculate quality score (0-1, 1 = best)
   * Based on success rate and proper stop rate
   */
  async getQualityScore(provider: string): Promise<number> {
    const metrics = await this.getMetrics(provider);
    if (!metrics || metrics.window < this.minRequests) {
      return 0.5;  // Neutral score if insufficient data
    }

    // Quality primarily based on success rate
    // Only apply stopRate bonus when success rate is above 50%
    const successScore = metrics.quality.successRate;
    const stopScore = metrics.quality.properStopRate;

    if (successScore < 0.5) {
      // Low success rate: heavily penalize, minimal bonus from stop rate
      return successScore * 0.9 + stopScore * 0.1;
    } else {
      // Good success rate: standard weighting
      return (successScore * 0.7) + (stopScore * 0.3);
    }
  }

  /**
   * Calculate cost score (0-1, 1 = cheapest)
   * Relative to other providers
   */
  async getCostScore(provider: string, allProviders: string[]): Promise<number> {
    const metrics = await this.getMetrics(provider);
    if (!metrics || metrics.window < this.minRequests) {
      return 0.5;  // Neutral score if insufficient data
    }

    // Get costs for all providers
    const costs: number[] = [];
    for (const p of allProviders) {
      const m = await this.getMetrics(p);
      if (m && m.window >= this.minRequests) {
        costs.push(m.cost.avgCostPer1MTokens);
      }
    }

    if (costs.length === 0) {
      return 0.5;  // No data for comparison
    }

    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const providerCost = metrics.cost.avgCostPer1MTokens;

    // Normalize: 1 = cheapest, 0 = most expensive
    if (maxCost === minCost) {
      return 1.0;  // All same cost
    }

    return 1.0 - ((providerCost - minCost) / (maxCost - minCost));
  }

  /**
   * Calculate availability score (0-1, 1 = most available)
   */
  async getAvailabilityScore(provider: string): Promise<number> {
    const metrics = await this.getMetrics(provider);
    if (!metrics || metrics.window < this.minRequests) {
      return 0.5;  // Neutral score if insufficient data
    }

    // Base on uptime and consecutive failures
    const uptimeScore = metrics.availability.uptime;

    // Penalize consecutive failures
    const failurePenalty = Math.min(metrics.availability.consecutiveFailures * 0.1, 0.5);

    return Math.max(0, uptimeScore - failurePenalty);
  }

  /**
   * Calculate overall provider score based on weights
   */
  async calculateScore(
    provider: string,
    weights: RoutingWeights,
    allProviders: string[],
    healthMultiplier: number = 1.0
  ): Promise<ProviderScore> {
    const costScore = await this.getCostScore(provider, allProviders);
    const latencyScore = await this.getLatencyScore(provider);
    const qualityScore = await this.getQualityScore(provider);
    const availabilityScore = await this.getAvailabilityScore(provider);

    // Calculate weighted total
    const totalScore = (
      (weights.cost * costScore) +
      (weights.latency * latencyScore) +
      (weights.quality * qualityScore) +
      (weights.availability * availabilityScore)
    ) * healthMultiplier;

    // Get metrics for metadata
    const metrics = await this.getMetrics(provider);

    return {
      provider,
      totalScore,
      breakdown: {
        costScore,
        latencyScore,
        qualityScore,
        availabilityScore
      },
      healthMultiplier,
      metadata: metrics ? {
        avgLatencyMs: metrics.latency.avg,
        avgCostPer1M: metrics.cost.avgCostPer1MTokens,
        successRate: metrics.quality.successRate,
        lastUsed: metrics.lastRequest
      } : undefined
    };
  }

  /**
   * Get all provider scores sorted by total score (descending)
   */
  async getAllScores(
    providers: string[],
    weights: RoutingWeights,
    healthMultipliers: Map<string, number>
  ): Promise<ProviderScore[]> {
    const scores: ProviderScore[] = [];

    for (const provider of providers) {
      const health = healthMultipliers.get(provider) || 1.0;
      const score = await this.calculateScore(provider, weights, providers, health);
      scores.push(score);
    }

    // Sort by total score (descending)
    scores.sort((a, b) => b.totalScore - a.totalScore);

    return scores;
  }

  /**
   * Get number of requests tracked for a provider
   */
  getRequestCount(provider: string): number {
    const records = this.metrics.get(provider);
    return records ? records.length : 0;
  }

  /**
   * Check if provider has sufficient data for scoring
   */
  hasSufficientData(provider: string): boolean {
    return this.getRequestCount(provider) >= this.minRequests;
  }

  /**
   * Clear metrics for a provider
   */
  clearMetrics(provider: string): void {
    this.metrics.delete(provider);
    logger.debug('Metrics cleared', { provider });
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
    logger.debug('All metrics cleared');
  }

  /**
   * Get summary of all tracked providers
   */
  getSummary(): Record<string, { requests: number; hasSufficientData: boolean }> {
    const summary: Record<string, { requests: number; hasSufficientData: boolean }> = {};

    for (const [provider, records] of this.metrics.entries()) {
      summary[provider] = {
        requests: records.length,
        hasSufficientData: records.length >= this.minRequests
      };
    }

    return summary;
  }

  /**
   * Export metrics for debugging/analysis
   */
  async exportMetrics(provider: string): Promise<RequestRecord[] | null> {
    const records = this.metrics.get(provider);
    return records ? [...records] : null;  // Return copy
  }
}

/**
 * Global singleton instance
 */
let globalMetricsTracker: ProviderMetricsTracker | null = null;

/**
 * Get or create global metrics tracker
 */
export function getProviderMetricsTracker(): ProviderMetricsTracker {
  if (!globalMetricsTracker) {
    globalMetricsTracker = new ProviderMetricsTracker();
  }
  return globalMetricsTracker;
}

/**
 * Reset global metrics tracker (for testing)
 */
export function resetProviderMetricsTracker(): void {
  globalMetricsTracker = null;
}
