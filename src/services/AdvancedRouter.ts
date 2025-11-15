/**
 * AdvancedRouter.ts
 *
 * Advanced routing strategies for intelligent provider selection.
 * Implements latency-based, cost-based, and adaptive routing.
 *
 * Phase 3 Week 2 Day 6-7: Advanced Routing Strategies
 */

import { getDatabase } from '../database/connection.js';
import type { ProviderType, ProviderRequest } from '../types/schemas/provider.schema.js';
import {
  type AdvancedRoutingConfig,
  type RoutingRule,
  type WeightedProvider,
  DEFAULT_ROUTING_CONFIG,
  matchesRoutingRule,
  selectProviderByWeight,
  calculateRequestCost,
  getProviderPricing,
} from '../config/routing.js';

/**
 * Provider Performance Metrics
 */
interface ProviderMetrics {
  provider: ProviderType;
  model: string;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
  avgCost: number;
  requestCount: number;
  lastUpdated: number;
}

/**
 * Routing Decision
 */
export interface RoutingDecision {
  provider: ProviderType;
  model: string;
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
  confidence: number; // 0-1
  alternatives: Array<{
    provider: ProviderType;
    model: string;
    score: number;
  }>;
}

/**
 * AdvancedRouter provides intelligent provider selection
 */
export class AdvancedRouter {
  private db: any;
  private config: AdvancedRoutingConfig;
  private metricsCache: Map<string, ProviderMetrics>;
  private readonly cacheTTL = 60000; // 1 minute

  constructor(config?: Partial<AdvancedRoutingConfig>) {
    this.db = getDatabase();
    this.config = { ...DEFAULT_ROUTING_CONFIG, ...config };
    this.metricsCache = new Map();
  }

  /**
   * Select best provider based on routing strategy
   */
  async selectProvider(request: ProviderRequest): Promise<RoutingDecision> {
    const { strategy } = this.config;

    switch (strategy) {
      case 'latency-based':
        return this.selectByLatency(request);
      case 'cost-based':
        return this.selectByCost(request);
      case 'weighted':
        return this.selectByWeight(request);
      case 'model-specific':
        return this.selectByModel(request);
      case 'round-robin':
        return this.selectRoundRobin(request);
      case 'failover':
      default:
        return this.selectFailover(request);
    }
  }

  /**
   * Latency-based routing - select fastest provider
   */
  private async selectByLatency(request: ProviderRequest): Promise<RoutingDecision> {
    const metrics = await this.getAllProviderMetrics();

    if (metrics.length === 0) {
      return this.selectFailover(request);
    }

    // Sort by P95 latency (more stable than average)
    const sorted = metrics
      .filter(m => m.successRate > 0.8) // Only consider reliable providers
      .sort((a, b) => a.p95Latency - b.p95Latency);

    if (sorted.length === 0) {
      return this.selectFailover(request);
    }

    const best = sorted[0];
    const alternatives = sorted.slice(1, 4).map((m, i) => ({
      provider: m.provider,
      model: m.model,
      score: 1 - (i + 1) * 0.2,
    }));

    return {
      provider: best.provider,
      model: best.model,
      reason: `Lowest P95 latency: ${Math.round(best.p95Latency)}ms`,
      estimatedCost: best.avgCost,
      estimatedLatency: best.p95Latency,
      confidence: Math.min(best.requestCount / this.config.minSampleSize, 1),
      alternatives,
    };
  }

  /**
   * Cost-based routing - select cheapest provider
   */
  private async selectByCost(request: ProviderRequest): Promise<RoutingDecision> {
    const metrics = await this.getAllProviderMetrics();

    if (metrics.length === 0) {
      return this.selectFailover(request);
    }

    // Estimate tokens based on request
    const estimatedInputTokens = this.estimateInputTokens(request);
    const estimatedOutputTokens = request.maxTokens || 1000;

    // Calculate cost for each provider
    const costsWithMetrics = metrics.map(m => ({
      ...m,
      estimatedCost: calculateRequestCost(
        m.provider,
        m.model,
        estimatedInputTokens,
        estimatedOutputTokens
      ),
    }));

    // Sort by estimated cost
    const sorted = costsWithMetrics
      .filter(m => m.successRate > 0.8)
      .sort((a, b) => a.estimatedCost - b.estimatedCost);

    if (sorted.length === 0) {
      return this.selectFailover(request);
    }

    const best = sorted[0];
    const alternatives = sorted.slice(1, 4).map((m, i) => ({
      provider: m.provider,
      model: m.model,
      score: 1 - (i + 1) * 0.2,
    }));

    return {
      provider: best.provider,
      model: best.model,
      reason: `Lowest cost: $${best.estimatedCost.toFixed(6)}`,
      estimatedCost: best.estimatedCost,
      estimatedLatency: best.p95Latency,
      confidence: Math.min(best.requestCount / this.config.minSampleSize, 1),
      alternatives,
    };
  }

  /**
   * Weighted routing - combine latency and cost
   */
  private async selectByWeight(request: ProviderRequest): Promise<RoutingDecision> {
    const metrics = await this.getAllProviderMetrics();

    if (metrics.length === 0) {
      return this.selectFailover(request);
    }

    const estimatedInputTokens = this.estimateInputTokens(request);
    const estimatedOutputTokens = request.maxTokens || 1000;

    // Calculate scores combining latency and cost
    const scored = metrics
      .filter(m => m.successRate > 0.8)
      .map(m => {
        const cost = calculateRequestCost(m.provider, m.model, estimatedInputTokens, estimatedOutputTokens);

        // Normalize latency and cost to 0-1 range
        const maxLatency = Math.max(...metrics.map(x => x.p95Latency));
        const maxCost = Math.max(...metrics.map(x => calculateRequestCost(x.provider, x.model, estimatedInputTokens, estimatedOutputTokens)));

        // Fixed: Guard against division by zero when all values are 0
        const latencyScore = maxLatency > 0 ? 1 - (m.p95Latency / maxLatency) : 0;
        const costScore = maxCost > 0 ? 1 - (cost / maxCost) : 0;

        // Weighted combination
        const latencyWeight = this.config.latencyWeightPercentage / 100;
        const costWeight = this.config.costWeightPercentage / 100;
        const totalScore = (latencyScore * latencyWeight) + (costScore * costWeight);

        return {
          ...m,
          cost,
          latencyScore,
          costScore,
          totalScore,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);

    if (scored.length === 0) {
      return this.selectFailover(request);
    }

    const best = scored[0];
    const alternatives = scored.slice(1, 4).map((m, i) => ({
      provider: m.provider,
      model: m.model,
      score: m.totalScore,
    }));

    return {
      provider: best.provider,
      model: best.model,
      reason: `Best weighted score: ${best.totalScore.toFixed(2)} (latency: ${best.latencyScore.toFixed(2)}, cost: ${best.costScore.toFixed(2)})`,
      estimatedCost: best.cost,
      estimatedLatency: best.p95Latency,
      confidence: Math.min(best.requestCount / this.config.minSampleSize, 1),
      alternatives,
    };
  }

  /**
   * Model-specific routing - match request requirements to model capabilities
   */
  private async selectByModel(request: ProviderRequest): Promise<RoutingDecision> {
    // Find matching routing rule
    const matchingRule = this.config.rules.find(rule =>
      matchesRoutingRule(rule, {
        maxTokens: request.maxTokens,
        requiresVision: false, // Would need to detect from request
        requiresTools: false,  // Would need to detect from request
      })
    );

    if (matchingRule) {
      const selected = selectProviderByWeight(matchingRule.preferredProviders);
      const metrics = await this.getProviderMetrics(selected.provider, selected.model || '');

      return {
        provider: selected.provider,
        model: selected.model || this.getDefaultModel(selected.provider),
        reason: `Matched routing rule: ${matchingRule.name}`,
        estimatedCost: metrics?.avgCost || 0,
        estimatedLatency: metrics?.p95Latency || 1000,
        confidence: 0.9,
        alternatives: matchingRule.preferredProviders
          .filter(p => p.provider !== selected.provider)
          .slice(0, 3)
          .map(p => ({
            provider: p.provider,
            model: p.model || this.getDefaultModel(p.provider),
            score: p.weight / 100,
          })),
      };
    }

    return this.selectFailover(request);
  }

  /**
   * Round-robin routing
   */
  private async selectRoundRobin(request: ProviderRequest): Promise<RoutingDecision> {
    const providers: ProviderType[] = ['claude', 'gemini', 'openai'];
    const count = await this.getTotalRequestCount();
    const index = count % providers.length;
    const provider = providers[index];
    const model = this.getDefaultModel(provider);
    const metrics = await this.getProviderMetrics(provider, model);

    return {
      provider,
      model,
      reason: 'Round-robin selection',
      estimatedCost: metrics?.avgCost || 0,
      estimatedLatency: metrics?.p95Latency || 1000,
      confidence: 1,
      alternatives: providers
        .filter(p => p !== provider)
        .map((p, i) => ({
          provider: p,
          model: this.getDefaultModel(p),
          score: 1 - (i + 1) * 0.3,
        })),
    };
  }

  /**
   * Failover routing - use primary with fallbacks
   */
  private selectFailover(request: ProviderRequest): RoutingDecision {
    const provider = request.provider || 'claude';
    const model = request.model || this.getDefaultModel(provider);

    return {
      provider,
      model,
      reason: 'Default failover selection',
      estimatedCost: 0.001,
      estimatedLatency: 1000,
      confidence: 0.5,
      alternatives: [
        { provider: 'gemini', model: 'gemini-1.5-pro-latest', score: 0.8 },
        { provider: 'openai', model: 'gpt-4-turbo-preview', score: 0.6 },
      ],
    };
  }

  /**
   * Get provider metrics
   */
  private async getProviderMetrics(provider: ProviderType, model: string): Promise<ProviderMetrics | null> {
    const cacheKey = `${provider}:${model}`;
    const cached = this.metricsCache.get(cacheKey);

    if (cached && Date.now() - cached.lastUpdated < this.cacheTTL) {
      return cached;
    }

    // Query database for metrics
    const result = this.db.prepare(`
      SELECT
        provider,
        model,
        COUNT(*) as request_count,
        AVG(duration) as avg_latency,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate,
        AVG(total_tokens * 0.00001) as avg_cost
      FROM provider_metrics
      WHERE provider = ? AND model = ?
      AND created_at > ?
      GROUP BY provider, model
    `).get(provider, model, Date.now() - 24 * 60 * 60 * 1000);

    if (!result) {
      return null;
    }

    // Calculate percentiles (simplified - would need full dataset for accuracy)
    const metrics: ProviderMetrics = {
      provider,
      model,
      avgLatency: result.avg_latency || 1000,
      p50Latency: result.avg_latency * 0.9 || 900,
      p95Latency: result.avg_latency * 1.5 || 1500,
      p99Latency: result.avg_latency * 2.0 || 2000,
      successRate: result.success_rate || 1.0,
      avgCost: result.avg_cost || 0.001,
      requestCount: result.request_count || 0,
      lastUpdated: Date.now(),
    };

    this.metricsCache.set(cacheKey, metrics);
    return metrics;
  }

  /**
   * Get all provider metrics
   */
  private async getAllProviderMetrics(): Promise<ProviderMetrics[]> {
    const results = this.db.prepare(`
      SELECT
        provider,
        model,
        COUNT(*) as request_count,
        AVG(duration) as avg_latency,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate,
        AVG(total_tokens * 0.00001) as avg_cost
      FROM provider_metrics
      WHERE created_at > ?
      GROUP BY provider, model
      HAVING request_count >= 10
      ORDER BY request_count DESC
    `).all(Date.now() - 24 * 60 * 60 * 1000);

    return results.map((result: any) => ({
      provider: result.provider,
      model: result.model,
      avgLatency: result.avg_latency || 1000,
      p50Latency: result.avg_latency * 0.9 || 900,
      p95Latency: result.avg_latency * 1.5 || 1500,
      p99Latency: result.avg_latency * 2.0 || 2000,
      successRate: result.success_rate || 1.0,
      avgCost: result.avg_cost || 0.001,
      requestCount: result.request_count || 0,
      lastUpdated: Date.now(),
    }));
  }

  /**
   * Helper methods
   */

  private getDefaultModel(provider: ProviderType): string {
    const defaults: Record<ProviderType, string> = {
      claude: 'claude-3-5-sonnet-20241022',
      gemini: 'gemini-1.5-pro-latest',
      openai: 'gpt-4-turbo-preview',
    };
    return defaults[provider];
  }

  private estimateInputTokens(request: ProviderRequest): number {
    // Rough estimation: ~4 characters per token
    const totalChars = request.messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  private async getTotalRequestCount(): Promise<number> {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM provider_metrics').get();
    return result?.count || 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AdvancedRoutingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear metrics cache
   */
  clearCache(): void {
    this.metricsCache.clear();
  }
}
