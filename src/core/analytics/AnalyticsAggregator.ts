/**
 * Analytics Aggregator - Aggregate telemetry into metrics
 *
 * Phase 4 (v6.1.0): Observability, Analytics & Optimization
 *
 * Aggregates raw telemetry events into actionable analytics summaries.
 * Features:
 * - Time-based aggregation
 * - Provider comparison
 * - Performance percentiles
 * - Cost analysis
 * - Top agents tracking
 */

import type {
  TelemetryEvent,
  AnalyticsSummary,
  AnalyticsOptions
} from '../../types/telemetry.js';
import type { TelemetryCollector } from '../telemetry/TelemetryCollector.js';
import { logger } from '../../utils/logger.js';

/**
 * Analytics Aggregator
 *
 * Processes telemetry events and generates analytics summaries.
 */
export class AnalyticsAggregator {
  constructor(private telemetry: TelemetryCollector) {}

  /**
   * Generate analytics summary for time range
   */
  async generateSummary(options: AnalyticsOptions): Promise<AnalyticsSummary> {
    logger.debug('Generating analytics summary', {
      startDate: options.startDate,
      endDate: options.endDate,
      provider: options.provider,
      agentName: options.agentName
    });

    // Query successful executions
    const successEvents = this.telemetry.query({
      startDate: options.startDate,
      endDate: options.endDate,
      provider: options.provider,
      agentName: options.agentName,
      type: 'execution_complete',
      success: true,
      limit: 10000
    });

    // Query cache hit events (also successful executions)
    const cacheHitEvents = this.telemetry.query({
      startDate: options.startDate,
      endDate: options.endDate,
      provider: options.provider,
      agentName: options.agentName,
      type: 'cache_hit',
      success: true,
      limit: 10000
    });

    // Query failed executions
    const errorEvents = this.telemetry.query({
      startDate: options.startDate,
      endDate: options.endDate,
      provider: options.provider,
      agentName: options.agentName,
      type: 'execution_error',
      success: false,
      limit: 10000
    });

    const summary: AnalyticsSummary = {
      timeRange: {
        start: options.startDate,
        end: options.endDate,
        durationMs: options.endDate - options.startDate
      },

      executions: this.aggregateExecutions(successEvents, cacheHitEvents, errorEvents),
      performance: this.aggregatePerformance(successEvents),
      costs: this.aggregateCosts(successEvents),
      tokens: this.aggregateTokens(successEvents),
      providers: this.aggregateProviders(successEvents, errorEvents),
      topAgents: this.aggregateTopAgents(successEvents)
    };

    logger.debug('Analytics summary generated', {
      totalExecutions: summary.executions.total,
      totalCost: summary.costs.totalUsd,
      successRate: summary.executions.successRate
    });

    return summary;
  }

  /**
   * Aggregate execution counts and success rates
   *
   * Note: Cache hits are successful executions served from cache,
   * so they're included in both total and successful counts.
   */
  private aggregateExecutions(
    successEvents: TelemetryEvent[],
    cacheHitEvents: TelemetryEvent[],
    errorEvents: TelemetryEvent[]
  ) {
    const successful = successEvents.length + cacheHitEvents.length;
    const failed = errorEvents.length;
    const total = successful + failed;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0
    };
  }

  /**
   * Aggregate performance metrics (latency percentiles)
   */
  private aggregatePerformance(events: TelemetryEvent[]) {
    if (events.length === 0) {
      return {
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0
      };
    }

    const latencies = events.map(e => e.latencyMs).sort((a, b) => a - b);
    const sum = latencies.reduce((acc, val) => acc + val, 0);

    return {
      avgLatencyMs: Math.round(sum / latencies.length),
      p50LatencyMs: this.percentile(latencies, 50),
      p95LatencyMs: this.percentile(latencies, 95),
      p99LatencyMs: this.percentile(latencies, 99)
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  /**
   * Aggregate cost metrics
   */
  private aggregateCosts(events: TelemetryEvent[]) {
    const totalUsd = events.reduce((sum, e) => sum + e.cost.estimatedUsd, 0);
    const avgCostPerRequest = events.length > 0 ? totalUsd / events.length : 0;

    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    for (const event of events) {
      // By provider
      byProvider[event.provider] = (byProvider[event.provider] || 0) + event.cost.estimatedUsd;

      // By model
      if (event.model) {
        byModel[event.model] = (byModel[event.model] || 0) + event.cost.estimatedUsd;
      }
    }

    return {
      totalUsd,
      avgCostPerRequest,
      byProvider,
      byModel
    };
  }

  /**
   * Aggregate token usage
   */
  private aggregateTokens(events: TelemetryEvent[]) {
    const total = events.reduce((sum, e) => sum + e.tokensUsed.total, 0);
    const prompt = events.reduce((sum, e) => sum + e.tokensUsed.prompt, 0);
    const completion = events.reduce((sum, e) => sum + e.tokensUsed.completion, 0);
    const avgPerRequest = events.length > 0 ? total / events.length : 0;

    return {
      total,
      prompt,
      completion,
      avgPerRequest
    };
  }

  /**
   * Aggregate provider-level metrics
   */
  private aggregateProviders(
    successEvents: TelemetryEvent[],
    errorEvents: TelemetryEvent[]
  ) {
    const usage: Record<string, number> = {};
    const avgLatency: Record<string, number> = {};
    const errorRate: Record<string, number> = {};

    // Count total usage per provider
    const allEvents = [...successEvents, ...errorEvents];
    for (const event of allEvents) {
      usage[event.provider] = (usage[event.provider] || 0) + 1;
    }

    // Calculate avg latency per provider
    const latencySum: Record<string, number> = {};
    const latencyCount: Record<string, number> = {};
    for (const event of successEvents) {
      latencySum[event.provider] = (latencySum[event.provider] || 0) + event.latencyMs;
      latencyCount[event.provider] = (latencyCount[event.provider] || 0) + 1;
    }
    for (const provider in latencySum) {
      const count = latencyCount[provider] || 1;
      const sum = latencySum[provider];
      if (sum !== undefined) {
        avgLatency[provider] = Math.round(sum / count);
      }
    }

    // Calculate error rate per provider
    const errorCount: Record<string, number> = {};
    for (const event of errorEvents) {
      errorCount[event.provider] = (errorCount[event.provider] || 0) + 1;
    }
    for (const provider in usage) {
      const errors = errorCount[provider] || 0;
      const total = usage[provider] || 1;
      errorRate[provider] = (errors / total) * 100;
    }

    return {
      usage,
      avgLatency,
      errorRate
    };
  }

  /**
   * Aggregate top agents by execution count
   */
  private aggregateTopAgents(events: TelemetryEvent[]) {
    const agentStats: Record<string, {
      executionCount: number;
      totalCost: number;
      totalLatency: number;
    }> = {};

    for (const event of events) {
      const agentName = event.agentName || 'unknown';
      if (!agentStats[agentName]) {
        agentStats[agentName] = {
          executionCount: 0,
          totalCost: 0,
          totalLatency: 0
        };
      }

      agentStats[agentName].executionCount++;
      agentStats[agentName].totalCost += event.cost.estimatedUsd;
      agentStats[agentName].totalLatency += event.latencyMs;
    }

    const agents = Object.entries(agentStats)
      .map(([name, stats]) => ({
        name,
        executionCount: stats.executionCount,
        totalCost: stats.totalCost,
        avgLatency: Math.round(stats.totalLatency / stats.executionCount)
      }))
      .sort((a, b) => b.executionCount - a.executionCount)
      .slice(0, 10);  // Top 10 agents

    return agents || [];
  }
}

/**
 * Singleton instance
 */
let analyticsAggregator: AnalyticsAggregator | null = null;

/**
 * Get analytics aggregator singleton
 *
 * Note: Always creates a new instance with provided telemetry
 * to ensure it uses the latest telemetry instance.
 */
export function getAnalyticsAggregator(telemetry: TelemetryCollector): AnalyticsAggregator {
  // Always create new instance to use latest telemetry
  analyticsAggregator = new AnalyticsAggregator(telemetry);
  return analyticsAggregator;
}
