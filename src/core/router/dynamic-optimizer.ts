/**
 * Dynamic Provider Optimizer (v14.0.0)
 *
 * Implements adaptive provider routing optimization based on runtime performance.
 * Part of Phase 4: Dynamic Optimization for the Provider Routing Auto-Configurator.
 *
 * Features:
 * - Runtime performance tracking with persistence
 * - Adaptive priority adjustment based on observed metrics
 * - Cost tracking and optimization
 * - Provider health-based reordering
 * - Automatic optimization recommendations
 *
 * @module core/router/dynamic-optimizer
 */

import { EventEmitter } from 'events';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { logger } from '../../shared/logging/logger.js';
import { getProviderMetricsTracker, type ProviderMetricsTracker } from '../provider-metrics-tracker.js';
import type { ProviderMetrics, ProviderScore, RoutingWeights } from '../../types/routing.js';
import type { RoutingConfig } from '../../types/config.js';

/**
 * Provider performance snapshot for optimization decisions
 */
export interface ProviderPerformanceSnapshot {
  provider: string;
  /** Average latency over the tracking window */
  avgLatencyMs: number;
  /** P95 latency */
  p95LatencyMs: number;
  /** Latency stats (for CLI display) */
  latency: {
    avg: number;
    p95: number;
  };
  /** Success rate (0-1) */
  successRate: number;
  /** Quality score (0-1) */
  qualityScore: number;
  /** Average cost per 1M tokens */
  avgCostPer1M: number;
  /** Total requests tracked */
  totalRequests: number;
  /** Consecutive failures */
  consecutiveFailures: number;
  /** Last successful request timestamp */
  lastSuccessAt: number;
  /** Calculated priority score (higher = better) */
  priorityScore: number;
  /** Timestamp of this snapshot */
  timestamp: number;
  /** Last updated timestamp (ISO string for display) */
  lastUpdatedAt: string;
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  /** Type of recommendation */
  type: 'priority_adjustment' | 'cost_optimization' | 'health_warning' | 'disable_provider';
  /** Provider affected */
  provider: string;
  /** Current value (e.g., current priority) */
  currentValue: number | string;
  /** Recommended value */
  recommendedValue: number | string;
  /** Reason for recommendation */
  reason: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Impact level */
  impact: 'low' | 'medium' | 'high';
}

/**
 * Dynamic optimizer state (persisted)
 */
export interface DynamicOptimizerState {
  /** Version for schema migrations */
  version: number;
  /** Last optimization run timestamp */
  lastOptimizationAt: number;
  /** Provider performance history */
  performanceHistory: Record<string, ProviderPerformanceSnapshot[]>;
  /** Applied optimizations */
  appliedOptimizations: Array<{
    recommendation: OptimizationRecommendation;
    appliedAt: number;
  }>;
  /** Current adaptive priorities */
  adaptivePriorities: Record<string, number>;
  /** Cost tracking */
  costTracking: {
    totalCostUsd: number;
    costByProvider: Record<string, number>;
    lastResetAt: number;
  };
}

/**
 * Dynamic optimizer configuration
 */
export interface DynamicOptimizerConfig {
  /** Enable automatic priority adjustment */
  enableAdaptivePriorities: boolean;
  /** Enable cost optimization */
  enableCostOptimization: boolean;
  /** Enable health-based reordering */
  enableHealthReordering: boolean;
  /** Minimum requests before making optimization decisions */
  minRequestsForOptimization: number;
  /** How often to run optimization (ms) */
  optimizationIntervalMs: number;
  /** Performance history retention (number of snapshots) */
  maxHistorySnapshots: number;
  /** Path for state persistence */
  statePath?: string;
  /** Weights for optimization scoring */
  weights: RoutingWeights;
}

const DEFAULT_CONFIG: DynamicOptimizerConfig = {
  enableAdaptivePriorities: true,
  enableCostOptimization: true,
  enableHealthReordering: true,
  minRequestsForOptimization: 20,
  optimizationIntervalMs: 5 * 60 * 1000, // 5 minutes
  maxHistorySnapshots: 100,
  weights: {
    latency: 0.3,
    quality: 0.35,
    cost: 0.2,
    availability: 0.15,
  },
};

const STATE_VERSION = 1;

/**
 * Dynamic Provider Optimizer
 *
 * Monitors provider performance and dynamically adjusts routing priorities
 * to optimize for latency, quality, cost, and availability.
 */
export class DynamicOptimizer extends EventEmitter {
  private config: DynamicOptimizerConfig;
  private state: DynamicOptimizerState;
  private metricsTracker: ProviderMetricsTracker;
  private optimizationInterval?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: Partial<DynamicOptimizerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metricsTracker = getProviderMetricsTracker();
    this.state = this.createEmptyState();

    logger.debug('DynamicOptimizer created', {
      enableAdaptivePriorities: this.config.enableAdaptivePriorities,
      enableCostOptimization: this.config.enableCostOptimization,
      enableHealthReordering: this.config.enableHealthReordering,
      optimizationIntervalMs: this.config.optimizationIntervalMs,
    });
  }

  /**
   * Initialize the optimizer (load persisted state, start optimization loop)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Load persisted state if available
    if (this.config.statePath) {
      await this.loadState();
    }

    // Start optimization loop
    this.startOptimizationLoop();

    // Listen for metrics updates
    this.metricsTracker.on('metrics-updated', (provider: string) => {
      this.handleMetricsUpdate(provider);
    });

    this.isInitialized = true;

    logger.info('DynamicOptimizer initialized', {
      hasPersistedState: !!this.config.statePath,
      providersTracked: Object.keys(this.state.performanceHistory).length,
    });
  }

  /**
   * Get current performance snapshot for a provider
   */
  async getPerformanceSnapshot(provider: string): Promise<ProviderPerformanceSnapshot | null> {
    const metrics = await this.metricsTracker.getMetrics(provider);
    if (!metrics) return null;

    const priorityScore = await this.calculatePriorityScore(provider, metrics);

    // Calculate quality score (success rate + proper stop rate weighted)
    const qualityScore = metrics.quality.successRate * 0.7 + metrics.quality.properStopRate * 0.3;

    return {
      provider,
      avgLatencyMs: metrics.latency.avg,
      p95LatencyMs: metrics.latency.p95,
      latency: {
        avg: metrics.latency.avg,
        p95: metrics.latency.p95,
      },
      successRate: metrics.quality.successRate,
      qualityScore,
      avgCostPer1M: metrics.cost.avgCostPer1MTokens,
      totalRequests: metrics.quality.totalRequests,
      consecutiveFailures: metrics.availability.consecutiveFailures,
      lastSuccessAt: metrics.availability.lastSuccess,
      priorityScore,
      timestamp: Date.now(),
      lastUpdatedAt: new Date(metrics.lastUpdated).toISOString(),
    };
  }

  /**
   * Get all provider performance snapshots
   */
  async getAllPerformanceSnapshots(providers: string[]): Promise<ProviderPerformanceSnapshot[]> {
    const snapshots: ProviderPerformanceSnapshot[] = [];

    for (const provider of providers) {
      const snapshot = await this.getPerformanceSnapshot(provider);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    // Sort by priority score (descending)
    return snapshots.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Calculate adaptive priority for a provider based on performance
   */
  private async calculatePriorityScore(
    provider: string,
    metrics: ProviderMetrics
  ): Promise<number> {
    const { weights } = this.config;

    // Latency score (lower is better, normalize to 0-1)
    const latencyScore = this.normalizeLatency(metrics.latency.p95);

    // Quality score (success rate + proper stop rate)
    const qualityScore = metrics.quality.successRate * 0.7 +
                         metrics.quality.properStopRate * 0.3;

    // Cost score (lower is better, normalize to 0-1)
    const costScore = this.normalizeCost(metrics.cost.avgCostPer1MTokens);

    // Availability score
    const availabilityScore = metrics.availability.uptime *
      (1 - Math.min(metrics.availability.consecutiveFailures * 0.1, 0.5));

    // Weighted combination
    const score = (
      weights.latency * latencyScore +
      weights.quality * qualityScore +
      weights.cost * costScore +
      weights.availability * availabilityScore
    );

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Normalize latency to 0-1 score (lower latency = higher score)
   */
  private normalizeLatency(p95Ms: number): number {
    if (p95Ms < 1000) return 1.0;
    if (p95Ms < 2000) return 0.9;
    if (p95Ms < 3000) return 0.7;
    if (p95Ms < 5000) return 0.5;
    if (p95Ms < 10000) return 0.3;
    return 0.1;
  }

  /**
   * Normalize cost to 0-1 score (lower cost = higher score)
   */
  private normalizeCost(costPer1M: number): number {
    // Free tier
    if (costPer1M === 0) return 1.0;
    // Very cheap (< $0.50 per 1M tokens)
    if (costPer1M < 0.5) return 0.9;
    // Cheap (< $2 per 1M tokens)
    if (costPer1M < 2) return 0.7;
    // Moderate (< $5 per 1M tokens)
    if (costPer1M < 5) return 0.5;
    // Expensive (< $15 per 1M tokens)
    if (costPer1M < 15) return 0.3;
    // Very expensive
    return 0.1;
  }

  /**
   * Generate optimization recommendations based on current performance
   */
  async generateRecommendations(providers: string[]): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const snapshots = await this.getAllPerformanceSnapshots(providers);

    if (snapshots.length === 0) {
      return recommendations;
    }

    // Get current adaptive priorities
    const currentPriorities = { ...this.state.adaptivePriorities };

    for (const snapshot of snapshots) {
      const { provider, priorityScore, successRate, consecutiveFailures, avgCostPer1M } = snapshot;

      // Health warning: High consecutive failures
      if (consecutiveFailures >= 3) {
        recommendations.push({
          type: 'health_warning',
          provider,
          currentValue: consecutiveFailures,
          recommendedValue: 0,
          reason: `Provider has ${consecutiveFailures} consecutive failures`,
          confidence: 0.9,
          impact: consecutiveFailures >= 5 ? 'high' : 'medium',
        });
      }

      // Disable recommendation: Very low success rate
      if (successRate < 0.5 && snapshot.totalRequests >= this.config.minRequestsForOptimization) {
        recommendations.push({
          type: 'disable_provider',
          provider,
          currentValue: successRate,
          recommendedValue: 'disabled',
          reason: `Success rate (${(successRate * 100).toFixed(1)}%) is below 50%`,
          confidence: 0.85,
          impact: 'high',
        });
      }

      // Priority adjustment
      if (this.config.enableAdaptivePriorities) {
        const currentPriority = currentPriorities[provider] ?? 50;
        const recommendedPriority = this.calculateRecommendedPriority(priorityScore);

        if (Math.abs(recommendedPriority - currentPriority) >= 5) {
          recommendations.push({
            type: 'priority_adjustment',
            provider,
            currentValue: currentPriority,
            recommendedValue: recommendedPriority,
            reason: `Performance score suggests priority change (score: ${priorityScore.toFixed(2)})`,
            confidence: Math.min(snapshot.totalRequests / 100, 0.95),
            impact: Math.abs(recommendedPriority - currentPriority) >= 20 ? 'high' : 'medium',
          });
        }
      }

      // Cost optimization
      if (this.config.enableCostOptimization && avgCostPer1M > 10) {
        // Find cheaper alternatives with similar quality
        const cheaperAlternatives = snapshots.filter(s =>
          s.provider !== provider &&
          s.avgCostPer1M < avgCostPer1M * 0.5 &&
          s.successRate >= successRate * 0.9
        );

        if (cheaperAlternatives.length > 0) {
          const best = cheaperAlternatives[0];
          if (best) {
            recommendations.push({
              type: 'cost_optimization',
              provider,
              currentValue: avgCostPer1M,
              recommendedValue: best.provider,
              reason: `${best.provider} offers similar quality at ${((1 - best.avgCostPer1M / avgCostPer1M) * 100).toFixed(0)}% lower cost`,
              confidence: 0.7,
              impact: 'medium',
            });
          }
        }
      }
    }

    // Sort by impact and confidence
    return recommendations.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
      if (impactDiff !== 0) return impactDiff;
      return b.confidence - a.confidence;
    });
  }

  /**
   * Calculate recommended priority based on score
   */
  private calculateRecommendedPriority(score: number): number {
    // Map score (0-1) to priority (1-100, lower is better)
    // High score = low priority number = high priority
    return Math.round(100 - score * 90);
  }

  /**
   * Apply an optimization recommendation
   */
  async applyRecommendation(recommendation: OptimizationRecommendation): Promise<boolean> {
    try {
      switch (recommendation.type) {
        case 'priority_adjustment':
          this.state.adaptivePriorities[recommendation.provider] =
            recommendation.recommendedValue as number;
          break;

        case 'disable_provider':
          // Mark as disabled (priority 999)
          this.state.adaptivePriorities[recommendation.provider] = 999;
          break;

        case 'health_warning':
        case 'cost_optimization':
          // These are informational, no automatic action
          break;
      }

      // Record applied optimization
      this.state.appliedOptimizations.push({
        recommendation,
        appliedAt: Date.now(),
      });

      // Persist state
      await this.saveState();

      this.emit('optimization-applied', recommendation);

      logger.info('Optimization recommendation applied', {
        type: recommendation.type,
        provider: recommendation.provider,
        recommendedValue: recommendation.recommendedValue,
      });

      return true;
    } catch (error) {
      logger.error('Failed to apply optimization', {
        recommendation,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Get adaptive priorities for provider reordering
   */
  getAdaptivePriorities(): Record<string, number> {
    return { ...this.state.adaptivePriorities };
  }

  /**
   * Reorder providers based on adaptive priorities and health
   */
  async reorderByPerformance(
    providers: string[],
    healthStatus: Map<string, boolean>
  ): Promise<string[]> {
    if (!this.config.enableHealthReordering && !this.config.enableAdaptivePriorities) {
      return providers;
    }

    // Get performance snapshots
    const snapshots = await this.getAllPerformanceSnapshots(providers);
    const snapshotMap = new Map(snapshots.map(s => [s.provider, s]));

    // Sort providers
    const sorted = [...providers].sort((a, b) => {
      // Health-based: unhealthy providers go to the end
      if (this.config.enableHealthReordering) {
        const aHealthy = healthStatus.get(a) ?? true;
        const bHealthy = healthStatus.get(b) ?? true;
        if (aHealthy !== bHealthy) {
          return aHealthy ? -1 : 1;
        }
      }

      // Adaptive priorities
      if (this.config.enableAdaptivePriorities) {
        const aPriority = this.state.adaptivePriorities[a] ?? 50;
        const bPriority = this.state.adaptivePriorities[b] ?? 50;
        if (aPriority !== bPriority) {
          return aPriority - bPriority; // Lower priority number = higher priority
        }
      }

      // Fall back to priority score
      const aSnapshot = snapshotMap.get(a);
      const bSnapshot = snapshotMap.get(b);
      const aScore = aSnapshot?.priorityScore ?? 0.5;
      const bScore = bSnapshot?.priorityScore ?? 0.5;
      return bScore - aScore; // Higher score = higher priority
    });

    logger.debug('Providers reordered by performance', {
      original: providers,
      reordered: sorted,
    });

    return sorted;
  }

  /**
   * Track cost for a request
   */
  trackCost(provider: string, costUsd: number): void {
    this.state.costTracking.totalCostUsd += costUsd;
    this.state.costTracking.costByProvider[provider] =
      (this.state.costTracking.costByProvider[provider] ?? 0) + costUsd;
  }

  /**
   * Get cost tracking summary
   */
  getCostSummary(): {
    totalCostUsd: number;
    costByProvider: Record<string, number>;
    topSpenders: Array<{ provider: string; costUsd: number }>;
  } {
    const costByProvider = { ...this.state.costTracking.costByProvider };
    const topSpenders = Object.entries(costByProvider)
      .map(([provider, costUsd]) => ({ provider, costUsd }))
      .sort((a, b) => b.costUsd - a.costUsd)
      .slice(0, 5);

    return {
      totalCostUsd: this.state.costTracking.totalCostUsd,
      costByProvider,
      topSpenders,
    };
  }

  /**
   * Get optimizer statistics
   */
  getStats(): {
    isInitialized: boolean;
    lastOptimizationAt: number;
    providersTracked: number;
    totalAppliedOptimizations: number;
    adaptivePriorities: Record<string, number>;
    costTracking: {
      totalCostUsd: number;
      sinceReset: string;
    };
  } {
    return {
      isInitialized: this.isInitialized,
      lastOptimizationAt: this.state.lastOptimizationAt,
      providersTracked: Object.keys(this.state.performanceHistory).length,
      totalAppliedOptimizations: this.state.appliedOptimizations.length,
      adaptivePriorities: { ...this.state.adaptivePriorities },
      costTracking: {
        totalCostUsd: this.state.costTracking.totalCostUsd,
        sinceReset: new Date(this.state.costTracking.lastResetAt).toISOString(),
      },
    };
  }

  /**
   * Reset cost tracking
   */
  resetCostTracking(): void {
    this.state.costTracking = {
      totalCostUsd: 0,
      costByProvider: {},
      lastResetAt: Date.now(),
    };
    this.emit('cost-tracking-reset');
  }

  /**
   * Handle metrics update event
   */
  private async handleMetricsUpdate(provider: string): Promise<void> {
    try {
      const snapshot = await this.getPerformanceSnapshot(provider);
      if (!snapshot) return;

      // Add to history
      if (!this.state.performanceHistory[provider]) {
        this.state.performanceHistory[provider] = [];
      }

      const history = this.state.performanceHistory[provider];
      history.push(snapshot);

      // Trim history
      if (history.length > this.config.maxHistorySnapshots) {
        history.splice(0, history.length - this.config.maxHistorySnapshots);
      }

      this.emit('performance-updated', provider, snapshot);
    } catch (error) {
      logger.warn('Failed to handle metrics update', {
        provider,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Start the optimization loop
   */
  private startOptimizationLoop(): void {
    if (this.optimizationInterval) return;

    this.optimizationInterval = setInterval(async () => {
      try {
        await this.runOptimization();
      } catch (error) {
        logger.error('Optimization loop failed', {
          error: (error as Error).message,
        });
      }
    }, this.config.optimizationIntervalMs);

    // Unref to not block process exit
    this.optimizationInterval.unref();

    logger.debug('Optimization loop started', {
      intervalMs: this.config.optimizationIntervalMs,
    });
  }

  /**
   * Run optimization analysis
   */
  private async runOptimization(): Promise<void> {
    const providers = Object.keys(this.state.performanceHistory);
    if (providers.length === 0) return;

    // Check if any provider has enough data
    const hasEnoughData = providers.some(p => {
      const history = this.state.performanceHistory[p];
      return history && history.length >= this.config.minRequestsForOptimization;
    });

    if (!hasEnoughData) return;

    const recommendations = await this.generateRecommendations(providers);

    this.state.lastOptimizationAt = Date.now();

    if (recommendations.length > 0) {
      this.emit('recommendations-generated', recommendations);

      logger.info('Optimization recommendations generated', {
        count: recommendations.length,
        types: recommendations.map(r => r.type),
      });

      // Auto-apply high-confidence priority adjustments
      for (const rec of recommendations) {
        if (
          rec.type === 'priority_adjustment' &&
          rec.confidence >= 0.8 &&
          this.config.enableAdaptivePriorities
        ) {
          await this.applyRecommendation(rec);
        }
      }
    }

    // Persist state periodically
    await this.saveState();
  }

  /**
   * Create empty state
   */
  private createEmptyState(): DynamicOptimizerState {
    return {
      version: STATE_VERSION,
      lastOptimizationAt: 0,
      performanceHistory: {},
      appliedOptimizations: [],
      adaptivePriorities: {},
      costTracking: {
        totalCostUsd: 0,
        costByProvider: {},
        lastResetAt: Date.now(),
      },
    };
  }

  /**
   * Load state from disk
   */
  private async loadState(): Promise<void> {
    if (!this.config.statePath) return;

    try {
      const data = await readFile(this.config.statePath, 'utf-8');
      const loaded = JSON.parse(data) as DynamicOptimizerState;

      // Validate version
      if (loaded.version !== STATE_VERSION) {
        logger.warn('State version mismatch, starting fresh', {
          expected: STATE_VERSION,
          found: loaded.version,
        });
        return;
      }

      this.state = loaded;

      logger.info('DynamicOptimizer state loaded', {
        providersTracked: Object.keys(this.state.performanceHistory).length,
        appliedOptimizations: this.state.appliedOptimizations.length,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('Failed to load optimizer state', {
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Save state to disk
   */
  private async saveState(): Promise<void> {
    if (!this.config.statePath) return;

    try {
      // Ensure directory exists
      await mkdir(dirname(this.config.statePath), { recursive: true });

      // Write atomically
      const tmpPath = `${this.config.statePath}.tmp`;
      await writeFile(tmpPath, JSON.stringify(this.state, null, 2));

      // Rename is atomic on most filesystems
      const { rename } = await import('fs/promises');
      await rename(tmpPath, this.config.statePath);

      logger.debug('DynamicOptimizer state saved');
    } catch (error) {
      logger.warn('Failed to save optimizer state', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Stop the optimizer and clean up
   */
  destroy(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = undefined;
    }

    this.removeAllListeners();
    this.isInitialized = false;

    logger.debug('DynamicOptimizer destroyed');
  }
}

/**
 * Singleton instance
 */
let globalOptimizer: DynamicOptimizer | null = null;

/**
 * Get the global DynamicOptimizer instance
 */
export function getDynamicOptimizer(config?: Partial<DynamicOptimizerConfig>): DynamicOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new DynamicOptimizer(config);
  }
  return globalOptimizer;
}

/**
 * Reset the global DynamicOptimizer (for testing)
 */
export function resetDynamicOptimizer(): void {
  if (globalOptimizer) {
    globalOptimizer.destroy();
    globalOptimizer = null;
  }
}
