/**
 * Optimization Analyzer - Generate cost and performance recommendations
 *
 * Phase 4 (v6.1.0): Observability, Analytics & Optimization
 *
 * Analyzes usage patterns and generates actionable recommendations.
 * Features:
 * - Model downgrade opportunities
 * - Provider switching suggestions
 * - Caching recommendations
 * - Prompt optimization
 * - Performance improvements
 */

import type {
  AnalyticsSummary,
  OptimizationRecommendation,
  TelemetryEvent
} from '../../types/telemetry.js';
import type { AnalyticsAggregator } from './AnalyticsAggregator.js';
import type { TelemetryCollector } from '../telemetry/TelemetryCollector.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * Optimization Analyzer
 *
 * Analyzes usage and generates optimization recommendations.
 */
export class OptimizationAnalyzer {
  constructor(
    private analytics: AnalyticsAggregator,
    private telemetry: TelemetryCollector
  ) {}

  /**
   * Analyze usage and generate recommendations
   */
  async analyze(timeRange: { start: number; end: number; provider?: string }): Promise<OptimizationRecommendation[]> {
    logger.debug('Analyzing for optimization opportunities', {
      timeRange,
      provider: timeRange.provider
    });

    const summary = await this.analytics.generateSummary({
      startDate: timeRange.start,
      endDate: timeRange.end,
      provider: timeRange.provider
    });

    const recommendations: OptimizationRecommendation[] = [];

    // 1. Model downgrade opportunities
    recommendations.push(...this.findModelDowngradeOpportunities(summary));

    // 2. Provider switching opportunities
    recommendations.push(...this.findProviderSwitchingOpportunities(summary));

    // 3. Caching opportunities
    recommendations.push(...await this.findCachingOpportunities(summary, timeRange));

    // 4. Prompt optimization
    recommendations.push(...this.findPromptOptimizationOpportunities(summary));

    // 5. Performance improvements
    recommendations.push(...this.findPerformanceImprovements(summary));

    // Sort by severity and estimated savings
    return recommendations.sort((a, b) => {
      if (a.severity !== b.severity) {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      const aSavings = a.estimatedSavings?.costUsd || 0;
      const bSavings = b.estimatedSavings?.costUsd || 0;
      return bSavings - aSavings;
    });
  }

  /**
   * Find opportunities to use cheaper models
   */
  private findModelDowngradeOpportunities(summary: AnalyticsSummary): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check if gpt-4o is being used heavily
    const gpt4oCost = summary.costs.byModel['gpt-4o'] || 0;
    const totalCost = summary.costs.totalUsd;

    if (gpt4oCost > totalCost * 0.5 && totalCost > 0.10) {
      const potentialSavings = gpt4oCost * 0.85;

      recommendations.push({
        id: 'model-downgrade-gpt4o-mini',
        type: 'cost_saving',
        severity: 'high',
        title: 'Switch to gpt-4o-mini for routine tasks',
        description: `${(gpt4oCost / totalCost * 100).toFixed(1)}% of costs are from gpt-4o. gpt-4o-mini is 85% cheaper with similar quality for routine tasks.`,
        estimatedSavings: {
          costUsd: potentialSavings,
          percentageReduction: 85
        },
        actionable: true,
        actions: [
          'Review tasks using gpt-4o',
          'Identify routine tasks that don\'t require advanced reasoning',
          'Update agent configs: model: gpt-4o-mini',
          'Keep gpt-4o for complex reasoning only'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Find opportunities to switch providers
   */
  private findProviderSwitchingOpportunities(summary: AnalyticsSummary): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    const openaiCost = summary.costs.byProvider['openai'] || 0;
    const totalCost = summary.costs.totalUsd;

    if (openaiCost > totalCost * 0.7 && totalCost > 1.00) {
      const potentialSavings = openaiCost * 0.70;

      recommendations.push({
        id: 'provider-switch-gemini',
        type: 'cost_saving',
        severity: 'medium',
        title: 'Consider Gemini for cost-sensitive tasks',
        description: `${(openaiCost / totalCost * 100).toFixed(1)}% of costs from OpenAI. Gemini offers 70% cost savings.`,
        estimatedSavings: {
          costUsd: potentialSavings,
          percentageReduction: 70
        },
        actionable: true,
        actions: [
          'Enable Gemini in automatosx.config.json',
          'Test Gemini with sample tasks',
          'Update policy to prefer Gemini for cost-sensitive tasks',
          'Monitor quality and adjust'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Find caching opportunities
   */
  private async findCachingOpportunities(
    summary: AnalyticsSummary,
    timeRange: { start: number; end: number; provider?: string }
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    const cacheHitEvents = this.telemetry.query({
      type: 'cache_hit',
      startDate: timeRange.start,
      endDate: timeRange.end,
      provider: timeRange.provider,
      limit: 10000
    });

    const totalExecutions = summary.executions.total;
    const cacheHitRate = totalExecutions > 0 ? (cacheHitEvents.length / totalExecutions) * 100 : 0;

    if (cacheHitRate < 10 && totalExecutions > 100 && summary.costs.totalUsd > 0.50) {
      const potentialSavings = summary.costs.totalUsd * 0.30;

      recommendations.push({
        id: 'enable-caching',
        type: 'cost_saving',
        severity: 'medium',
        title: 'Enable response caching',
        description: `Cache hit rate is ${cacheHitRate.toFixed(1)}%. Caching could save 30%+ on repeated requests.`,
        estimatedSavings: {
          costUsd: potentialSavings,
          percentageReduction: 30
        },
        actionable: true,
        actions: [
          'Edit automatosx.config.json',
          'Set performance.responseCache.enabled: true',
          'Set TTL to 86400 (24 hours)',
          'Monitor cache hit rate with ax analytics'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Find prompt optimization opportunities
   */
  private findPromptOptimizationOpportunities(summary: AnalyticsSummary): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    const avgPromptTokens = summary.executions.total > 0
      ? summary.tokens.prompt / summary.executions.total
      : 0;

    if (avgPromptTokens > 2000 && summary.costs.totalUsd > 1.00) {
      const potentialSavings = summary.costs.totalUsd * 0.25;

      recommendations.push({
        id: 'optimize-prompts',
        type: 'cost_saving',
        severity: 'medium',
        title: 'Optimize prompt length',
        description: `Avg prompt: ${Math.round(avgPromptTokens)} tokens. Shorter prompts reduce costs.`,
        estimatedSavings: {
          costUsd: potentialSavings,
          percentageReduction: 25
        },
        actionable: true,
        actions: [
          'Review agent system prompts',
          'Remove redundant instructions',
          'Use concise language',
          'Consider prompt templates'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Find performance improvements
   */
  private findPerformanceImprovements(summary: AnalyticsSummary): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // High latency
    if (summary.performance.p95LatencyMs > 10000) {
      recommendations.push({
        id: 'reduce-latency',
        type: 'performance',
        severity: 'medium',
        title: 'High P95 latency detected',
        description: `P95 latency: ${(summary.performance.p95LatencyMs / 1000).toFixed(1)}s. Use faster models or SDK mode.`,
        estimatedImprovement: {
          metric: 'p95_latency',
          improvement: 50,
          unit: '%'
        },
        actionable: true,
        actions: [
          'Switch to faster models (gpt-4o-mini)',
          'Enable streaming for better UX',
          'Use SDK integration (set integration: "sdk")',
          'Enable connection pooling'
        ]
      });
    }

    // High error rate
    const errorRate = summary.executions.total > 0
      ? (summary.executions.failed / summary.executions.total) * 100
      : 0;

    if (errorRate > 5 && summary.executions.total > 20) {
      recommendations.push({
        id: 'reduce-errors',
        type: 'reliability',
        severity: 'high',
        title: 'High error rate detected',
        description: `Error rate: ${errorRate.toFixed(1)}%. Investigate common failure patterns.`,
        estimatedImprovement: {
          metric: 'success_rate',
          improvement: errorRate,
          unit: '%'
        },
        actionable: true,
        actions: [
          'Run: ax doctor',
          'Review error logs',
          'Implement retry logic',
          'Add circuit breakers'
        ]
      });
    }

    return recommendations;
  }
}

/**
 * Singleton instance with WeakMap to prevent memory leaks
 *
 * Uses WeakMap keyed by telemetry collector so instances can be
 * garbage collected when telemetry is no longer referenced.
 */
const optimizationAnalyzerCache = new WeakMap<TelemetryCollector, OptimizationAnalyzer>();

/**
 * Get optimization analyzer singleton
 *
 * Returns cached instance for the same telemetry collector to prevent
 * memory leaks from repeated calls. Uses WeakMap for automatic cleanup.
 */
export function getOptimizationAnalyzer(
  analytics: AnalyticsAggregator,
  telemetry: TelemetryCollector
): OptimizationAnalyzer {
  let instance = optimizationAnalyzerCache.get(telemetry);
  if (!instance) {
    instance = new OptimizationAnalyzer(analytics, telemetry);
    optimizationAnalyzerCache.set(telemetry, instance);
  }
  return instance;
}
