/**
 * Routing Strategy
 *
 * Intelligent provider selection based on multiple factors:
 * - Cost (minimize spend)
 * - Latency (minimize response time)
 * - Quality (maximize success rate)
 * - Availability (maximize uptime)
 *
 * Phase 3: Multi-factor routing for cost optimization and performance
 *
 * @module core/routing-strategy
 */

import { DisposableEventEmitter } from '../../shared/utils/disposable.js';
import type {
  RoutingStrategy,
  RoutingWeights,
  RoutingDecision,
  ProviderScore,
  StrategyName,
  RoutingConfig
} from '../../types/routing.js';
import { ROUTING_STRATEGIES } from '../../types/routing.js';
import { ProviderMetricsTracker, getProviderMetricsTracker } from '../provider-metrics-tracker.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * Provider Selection Strategy Manager
 *
 * Implements multi-factor routing based on configurable weights
 */
export class RoutingStrategyManager extends DisposableEventEmitter {
  private strategy: RoutingStrategy;
  private metricsTracker: ProviderMetricsTracker;
  private minRequestsForScoring: number;
  private enableLogging: boolean;
  private decisionHistory: RoutingDecision[] = [];
  private maxHistorySize = 100;

  constructor(config: Partial<RoutingConfig> = {}) {
    super();

    // Get metrics tracker
    this.metricsTracker = getProviderMetricsTracker();

    // Set configuration
    const strategyName = config.strategy || 'balanced';
    this.strategy = this.loadStrategy(strategyName, config.customWeights);
    this.minRequestsForScoring = config.minRequestsForScoring || 10;
    this.enableLogging = config.enableLogging || false;

    // Configure metrics tracker window if provided
    // NOTE: Providing metricsWindow creates an isolated tracker for this manager.
    // Use this for testing or when you want independent metrics per strategy.
    // For production, omit metricsWindow to use the shared global tracker.
    if (config.metricsWindow) {
      this.metricsTracker = new ProviderMetricsTracker({
        windowSize: config.metricsWindow,
        minRequests: this.minRequestsForScoring
      });

      logger.info('RoutingStrategyManager using isolated metrics tracker', {
        windowSize: config.metricsWindow,
        minRequests: this.minRequestsForScoring
      });
    }

    logger.info('RoutingStrategyManager initialized', {
      strategy: this.strategy.name,
      weights: this.strategy.weights,
      minRequestsForScoring: this.minRequestsForScoring
    });
  }

  /**
   * Load strategy configuration by name
   */
  private loadStrategy(name: StrategyName, customWeights?: RoutingWeights): RoutingStrategy {
    if (name === 'custom' && customWeights) {
      // Validate custom weights
      const total = Object.values(customWeights).reduce((sum, w) => sum + w, 0);
      if (Math.abs(total - 1.0) > 0.01) {
        logger.warn('Custom routing weights do not sum to 1.0', {
          weights: customWeights,
          total
        });
      }

      return {
        name: 'custom',
        weights: customWeights
      };
    }

    const strategy = ROUTING_STRATEGIES[name];
    if (!strategy) {
      logger.warn('Unknown routing strategy, falling back to balanced', { name });
      return ROUTING_STRATEGIES.balanced;
    }

    return strategy;
  }

  /**
   * Select best provider based on current strategy
   *
   * @param providers - Available providers
   * @param healthMultipliers - Health scores from circuit breaker (0-1)
   * @param fallbackToPriority - Use priority-based selection if insufficient metrics
   * @returns Selected provider name or null if none available
   */
  async selectProvider(
    providers: string[],
    healthMultipliers: Map<string, number>,
    fallbackToPriority: boolean = true
  ): Promise<RoutingDecision | null> {
    if (providers.length === 0) {
      return null;
    }

    // Check if we have sufficient data for metrics-based routing
    // Use this manager's minRequestsForScoring, not the global tracker's minRequests
    const sufficientData = providers.some(p => this.metricsTracker.getRequestCount(p) >= this.minRequestsForScoring);

    if (!sufficientData) {
      if (fallbackToPriority) {
        // Not enough metrics data, use first healthy provider (priority-based with health check)
        // Filter out unhealthy providers (health multiplier < 0.1 means effectively dead)
        const healthyProviders = providers.filter(p => {
          const health = healthMultipliers.get(p) ?? 1.0;
          return health >= 0.1;  // Only consider providers with at least 10% health
        });

        if (healthyProviders.length === 0) {
          // All providers are unhealthy
          return null;
        }

        // FIXED (v6.5.11): Explicit bounds check before array access
        const selected = healthyProviders[0];
        if (!selected) {
          return null;
        }

        const decision: RoutingDecision = {
          selectedProvider: selected,
          strategy: this.strategy.name as StrategyName,
          scores: [],
          reason: 'Insufficient metrics data, using priority-based selection with health check',
          timestamp: Date.now()
        };

        this.recordDecision(decision);
        return decision;
      } else {
        // No data and fallback disabled - return null
        return null;
      }
    }

    // Calculate scores for all providers
    const scores = await this.metricsTracker.getAllScores(
      providers,
      this.strategy.weights,
      healthMultipliers
    );

    if (scores.length === 0) {
      return null;
    }

    // FIXED (v6.5.11): Explicit bounds check before array access
    const best = scores[0];
    if (!best) {
      return null;
    }

    // Generate reason
    const reason = this.generateReason(best, scores);

    const decision: RoutingDecision = {
      selectedProvider: best.provider,
      strategy: this.strategy.name as StrategyName,
      scores,
      reason,
      timestamp: Date.now()
    };

    this.recordDecision(decision);

    // Log decision if enabled
    if (this.enableLogging) {
      logger.info('Routing decision made', {
        selected: best.provider,
        strategy: this.strategy.name,
        totalScore: best.totalScore.toFixed(3),
        breakdown: {
          cost: best.breakdown.costScore.toFixed(3),
          latency: best.breakdown.latencyScore.toFixed(3),
          quality: best.breakdown.qualityScore.toFixed(3),
          availability: best.breakdown.availabilityScore.toFixed(3)
        },
        reason
      });
    }

    // Emit decision event
    this.emit('decision', decision);

    return decision;
  }

  /**
   * Generate human-readable reason for provider selection
   */
  private generateReason(best: ProviderScore, allScores: ProviderScore[]): string {
    const reasons: string[] = [];

    // Identify dominant factor
    const breakdown = best.breakdown;
    const weights = this.strategy.weights;

    // Find weighted scores
    const weightedScores = {
      cost: breakdown.costScore * weights.cost,
      latency: breakdown.latencyScore * weights.latency,
      quality: breakdown.qualityScore * weights.quality,
      availability: breakdown.availabilityScore * weights.availability
    };

    // Find top contributor
    const topFactor = Object.entries(weightedScores)
      .sort(([, a], [, b]) => b - a)[0];

    // FIXED (v6.5.11): Explicit bounds check for array destructuring
    if (!topFactor) {
      return `Selected ${best.provider}`;
    }

    const [factor, score] = topFactor;

    // Generate reason based on strategy
    switch (this.strategy.name) {
      case 'fast':
        reasons.push(`Lowest latency (${best.metadata?.avgLatencyMs?.toFixed(0)}ms avg)`);
        break;
      case 'cheap':
        reasons.push(`Lowest cost ($${best.metadata?.avgCostPer1M?.toFixed(2)}/1M tokens)`);
        break;
      case 'quality':
        reasons.push(`Highest quality (${(best.breakdown.qualityScore * 100).toFixed(1)}% score)`);
        break;
      case 'balanced':
        reasons.push(`Best overall balance (score: ${best.totalScore.toFixed(3)})`);
        break;
      default:
        reasons.push(`Custom strategy (${factor} weighted ${(score * 100).toFixed(1)}%)`);
    }

    // Add health multiplier if significant
    if (best.healthMultiplier < 1.0) {
      reasons.push(`adjusted for health (${(best.healthMultiplier * 100).toFixed(0)}%)`);
    }

    return reasons.join(', ');
  }

  /**
   * Record routing decision in history
   */
  private recordDecision(decision: RoutingDecision): void {
    this.decisionHistory.push(decision);

    // Trim history
    if (this.decisionHistory.length > this.maxHistorySize) {
      this.decisionHistory.shift();
    }
  }

  /**
   * Get recent routing decisions
   */
  getDecisionHistory(limit: number = 10): RoutingDecision[] {
    return this.decisionHistory.slice(-limit);
  }

  /**
   * Get routing statistics
   */
  getStats(): {
    strategy: string;
    totalDecisions: number;
    providerUsage: Record<string, number>;
    avgScores: Record<string, number>;
  } {
    const stats = {
      strategy: this.strategy.name,
      totalDecisions: this.decisionHistory.length,
      providerUsage: {} as Record<string, number>,
      avgScores: {} as Record<string, number>
    };

    // Count provider usage
    for (const decision of this.decisionHistory) {
      const provider = decision.selectedProvider;
      stats.providerUsage[provider] = (stats.providerUsage[provider] || 0) + 1;
    }

    // Calculate average scores per provider
    const scoresByProvider: Record<string, number[]> = {};
    for (const decision of this.decisionHistory) {
      for (const score of decision.scores) {
        if (!scoresByProvider[score.provider]) {
          scoresByProvider[score.provider] = [];
        }
        scoresByProvider[score.provider]!.push(score.totalScore);
      }
    }

    for (const [provider, scores] of Object.entries(scoresByProvider)) {
      // v6.2.5: Bug fix #31 - Prevent division by zero
      if (scores.length === 0) {
        stats.avgScores[provider] = 0;
        continue;
      }
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      stats.avgScores[provider] = avg;
    }

    return stats;
  }

  /**
   * Get routing statistics (alias for getStats)
   */
  getRoutingStats(): {
    strategy: string;
    totalDecisions: number;
    providerUsage: Record<string, number>;
    avgScores: Record<string, number>;
  } {
    return this.getStats();
  }

  /**
   * Update strategy
   */
  setStrategy(name: StrategyName, customWeights?: RoutingWeights): void {
    this.strategy = this.loadStrategy(name, customWeights);

    logger.info('Routing strategy updated', {
      strategy: this.strategy.name,
      weights: this.strategy.weights
    });

    this.emit('strategy-changed', this.strategy);
  }

  /**
   * Get current strategy
   */
  getStrategy(): RoutingStrategy {
    return { ...this.strategy };
  }

  /**
   * Get current weights
   */
  getWeights(): RoutingWeights {
    return { ...this.strategy.weights };
  }

  /**
   * Enable/disable logging
   */
  setLogging(enabled: boolean): void {
    this.enableLogging = enabled;
  }

  /**
   * Get metrics tracker (for advanced use)
   */
  getMetricsTracker(): ProviderMetricsTracker {
    return this.metricsTracker;
  }

  /**
   * Clear decision history
   */
  clearHistory(): void {
    this.decisionHistory = [];
    logger.debug('Routing decision history cleared');
  }

  /**
   * Export decision history for analysis
   */
  exportHistory(): RoutingDecision[] {
    return [...this.decisionHistory];  // Return copy
  }
}

/**
 * Global singleton instance
 */
let globalRoutingStrategy: RoutingStrategyManager | null = null;

/**
 * Get or create global routing strategy manager
 */
export function getRoutingStrategyManager(config?: RoutingConfig): RoutingStrategyManager {
  if (!globalRoutingStrategy) {
    globalRoutingStrategy = new RoutingStrategyManager(config);
  }
  return globalRoutingStrategy;
}

/**
 * Reset global routing strategy (for testing)
 */
export function resetRoutingStrategyManager(): void {
  globalRoutingStrategy = null;
}
