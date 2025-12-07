/**
 * Provider Metrics Infrastructure
 *
 * Tracks SDK/CLI execution metrics, fallback rates, and MCP connection stats
 * for observability into the new provider architecture.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 *
 * @module core/metrics/provider-metrics
 */

import { logger } from '@/shared/logging/logger.js';
import { shouldCollectProviderMetrics } from '../feature-flags/flags.js';

/**
 * Execution mode for provider metrics
 */
export type ExecutionMode = 'sdk' | 'cli' | 'mcp';

/**
 * Circuit breaker state for metrics
 */
export type CircuitBreakerState = 'closed' | 'half-open' | 'open';

/**
 * Provider execution metrics snapshot
 */
export interface ProviderExecutionMetrics {
  /** Total SDK executions */
  sdkExecutions: number;
  /** Total CLI executions */
  cliExecutions: number;
  /** Total MCP tool calls */
  mcpToolCalls: number;
  /** SDK failures that triggered fallback */
  sdkFallbacks: number;
  /** SDK execution errors (without fallback) */
  sdkErrors: number;
  /** CLI execution errors */
  cliErrors: number;
  /** MCP connection failures */
  mcpConnectionFailures: number;
  /** Average SDK latency in ms */
  avgSdkLatencyMs: number;
  /** Average CLI latency in ms */
  avgCliLatencyMs: number;
  /** Average MCP tool call latency in ms */
  avgMcpLatencyMs: number;
  /** Fallback rate (sdkFallbacks / sdkExecutions) */
  fallbackRate: number;
  /** SDK success rate */
  sdkSuccessRate: number;
  /** CLI success rate */
  cliSuccessRate: number;
  /** MCP connection success rate */
  mcpSuccessRate: number;
}

/**
 * Per-provider metrics
 */
export interface ProviderMetricsData {
  providerName: string;
  executionMode: ExecutionMode;
  circuitBreakerState: CircuitBreakerState;
  metrics: ProviderExecutionMetrics;
  lastUpdated: number;
}

/**
 * MCP session metrics
 */
export interface MCPSessionMetrics {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  totalToolCalls: number;
  avgToolCallLatencyMs: number;
  sessionsByProvider: Record<string, number>;
}

/**
 * Provider Metrics Collector
 *
 * Singleton class for collecting and reporting provider metrics.
 */
export class ProviderMetricsCollector {
  private static instance: ProviderMetricsCollector | null = null;

  // Per-provider metrics
  private providerMetrics: Map<string, ProviderMetricsData> = new Map();

  // MCP metrics
  private mcpMetrics: MCPSessionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0,
    totalToolCalls: 0,
    avgToolCallLatencyMs: 0,
    sessionsByProvider: {}
  };

  // Latency tracking (for averages)
  private sdkLatencies: Map<string, number[]> = new Map();
  private cliLatencies: Map<string, number[]> = new Map();
  private mcpLatencies: number[] = [];

  // Max samples to keep for latency averaging
  private readonly MAX_LATENCY_SAMPLES = 100;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ProviderMetricsCollector {
    if (!ProviderMetricsCollector.instance) {
      ProviderMetricsCollector.instance = new ProviderMetricsCollector();
    }
    return ProviderMetricsCollector.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ProviderMetricsCollector.instance = null;
  }

  /**
   * Check if metrics collection is enabled
   */
  private isEnabled(): boolean {
    return shouldCollectProviderMetrics();
  }

  /**
   * Get or create provider metrics data
   */
  private getOrCreateProviderMetrics(providerName: string): ProviderMetricsData {
    if (!this.providerMetrics.has(providerName)) {
      this.providerMetrics.set(providerName, {
        providerName,
        executionMode: 'cli',  // Default mode
        circuitBreakerState: 'closed',
        metrics: {
          sdkExecutions: 0,
          cliExecutions: 0,
          mcpToolCalls: 0,
          sdkFallbacks: 0,
          sdkErrors: 0,
          cliErrors: 0,
          mcpConnectionFailures: 0,
          avgSdkLatencyMs: 0,
          avgCliLatencyMs: 0,
          avgMcpLatencyMs: 0,
          fallbackRate: 0,
          sdkSuccessRate: 1,
          cliSuccessRate: 1,
          mcpSuccessRate: 1
        },
        lastUpdated: Date.now()
      });
    }
    return this.providerMetrics.get(providerName)!;
  }

  /**
   * Record SDK execution
   */
  recordSDKExecution(
    providerName: string,
    latencyMs: number,
    success: boolean
  ): void {
    if (!this.isEnabled()) return;

    const data = this.getOrCreateProviderMetrics(providerName);
    data.metrics.sdkExecutions++;

    if (!success) {
      data.metrics.sdkErrors++;
    }

    // Track latency
    this.addLatencySample(this.sdkLatencies, providerName, latencyMs);
    data.metrics.avgSdkLatencyMs = this.calculateAverageLatency(
      this.sdkLatencies.get(providerName) || []
    );

    // Update success rate
    data.metrics.sdkSuccessRate = this.calculateSuccessRate(
      data.metrics.sdkExecutions,
      data.metrics.sdkErrors
    );

    data.lastUpdated = Date.now();

    logger.debug('SDK execution recorded', {
      provider: providerName,
      latencyMs,
      success,
      totalExecutions: data.metrics.sdkExecutions
    });
  }

  /**
   * Record CLI execution
   */
  recordCLIExecution(
    providerName: string,
    latencyMs: number,
    success: boolean
  ): void {
    if (!this.isEnabled()) return;

    const data = this.getOrCreateProviderMetrics(providerName);
    data.metrics.cliExecutions++;

    if (!success) {
      data.metrics.cliErrors++;
    }

    // Track latency
    this.addLatencySample(this.cliLatencies, providerName, latencyMs);
    data.metrics.avgCliLatencyMs = this.calculateAverageLatency(
      this.cliLatencies.get(providerName) || []
    );

    // Update success rate
    data.metrics.cliSuccessRate = this.calculateSuccessRate(
      data.metrics.cliExecutions,
      data.metrics.cliErrors
    );

    data.lastUpdated = Date.now();

    logger.debug('CLI execution recorded', {
      provider: providerName,
      latencyMs,
      success,
      totalExecutions: data.metrics.cliExecutions
    });
  }

  /**
   * Record SDK fallback to CLI
   */
  recordSDKFallback(providerName: string, reason: string): void {
    if (!this.isEnabled()) return;

    const data = this.getOrCreateProviderMetrics(providerName);
    data.metrics.sdkFallbacks++;

    // Update fallback rate
    if (data.metrics.sdkExecutions > 0) {
      data.metrics.fallbackRate =
        data.metrics.sdkFallbacks / data.metrics.sdkExecutions;
    }

    data.lastUpdated = Date.now();

    logger.info('SDK fallback recorded', {
      provider: providerName,
      reason,
      fallbackRate: data.metrics.fallbackRate
    });
  }

  /**
   * Record MCP connection
   */
  recordMCPConnection(
    providerName: string,
    success: boolean
  ): void {
    if (!this.isEnabled()) return;

    this.mcpMetrics.totalConnections++;

    if (success) {
      this.mcpMetrics.activeConnections++;
      this.mcpMetrics.sessionsByProvider[providerName] =
        (this.mcpMetrics.sessionsByProvider[providerName] || 0) + 1;
    } else {
      this.mcpMetrics.failedConnections++;

      // Update per-provider metrics
      const data = this.getOrCreateProviderMetrics(providerName);
      data.metrics.mcpConnectionFailures++;
      data.lastUpdated = Date.now();
    }

    logger.debug('MCP connection recorded', {
      provider: providerName,
      success,
      activeConnections: this.mcpMetrics.activeConnections
    });
  }

  /**
   * Record MCP connection closed
   */
  recordMCPDisconnection(providerName: string): void {
    if (!this.isEnabled()) return;

    if (this.mcpMetrics.activeConnections > 0) {
      this.mcpMetrics.activeConnections--;
    }

    const currentCount = this.mcpMetrics.sessionsByProvider[providerName];
    if (currentCount !== undefined && currentCount > 0) {
      this.mcpMetrics.sessionsByProvider[providerName] = currentCount - 1;
    }

    logger.debug('MCP disconnection recorded', {
      provider: providerName,
      activeConnections: this.mcpMetrics.activeConnections
    });
  }

  /**
   * Record MCP tool call
   */
  recordMCPToolCall(
    providerName: string,
    toolName: string,
    latencyMs: number,
    success: boolean
  ): void {
    if (!this.isEnabled()) return;

    const data = this.getOrCreateProviderMetrics(providerName);
    data.metrics.mcpToolCalls++;
    this.mcpMetrics.totalToolCalls++;

    // Track latency
    this.mcpLatencies.push(latencyMs);
    if (this.mcpLatencies.length > this.MAX_LATENCY_SAMPLES) {
      this.mcpLatencies.shift();
    }

    data.metrics.avgMcpLatencyMs = this.calculateAverageLatency(this.mcpLatencies);
    this.mcpMetrics.avgToolCallLatencyMs = data.metrics.avgMcpLatencyMs;

    data.lastUpdated = Date.now();

    logger.debug('MCP tool call recorded', {
      provider: providerName,
      tool: toolName,
      latencyMs,
      success
    });
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitBreakerState(
    providerName: string,
    state: CircuitBreakerState
  ): void {
    if (!this.isEnabled()) return;

    const data = this.getOrCreateProviderMetrics(providerName);
    const previousState = data.circuitBreakerState;
    data.circuitBreakerState = state;
    data.lastUpdated = Date.now();

    if (previousState !== state) {
      logger.info('Circuit breaker state changed', {
        provider: providerName,
        from: previousState,
        to: state
      });
    }
  }

  /**
   * Update execution mode
   */
  updateExecutionMode(providerName: string, mode: ExecutionMode): void {
    if (!this.isEnabled()) return;

    const data = this.getOrCreateProviderMetrics(providerName);
    data.executionMode = mode;
    data.lastUpdated = Date.now();
  }

  /**
   * Get metrics for a specific provider
   */
  getProviderMetrics(providerName: string): ProviderMetricsData | undefined {
    return this.providerMetrics.get(providerName);
  }

  /**
   * Get all provider metrics
   */
  getAllProviderMetrics(): ProviderMetricsData[] {
    return Array.from(this.providerMetrics.values());
  }

  /**
   * Get MCP session metrics
   */
  getMCPMetrics(): MCPSessionMetrics {
    return { ...this.mcpMetrics };
  }

  /**
   * Get aggregated metrics summary
   */
  getMetricsSummary(): {
    totalSDKExecutions: number;
    totalCLIExecutions: number;
    totalMCPConnections: number;
    overallFallbackRate: number;
    avgSDKLatencyMs: number;
    avgCLILatencyMs: number;
    providersWithOpenCircuitBreaker: string[];
  } {
    let totalSDK = 0;
    let totalCLI = 0;
    let totalFallbacks = 0;
    let sdkLatencySum = 0;
    let cliLatencySum = 0;
    let sdkCount = 0;
    let cliCount = 0;
    const openCircuitBreakers: string[] = [];

    for (const data of this.providerMetrics.values()) {
      totalSDK += data.metrics.sdkExecutions;
      totalCLI += data.metrics.cliExecutions;
      totalFallbacks += data.metrics.sdkFallbacks;

      if (data.metrics.avgSdkLatencyMs > 0) {
        sdkLatencySum += data.metrics.avgSdkLatencyMs;
        sdkCount++;
      }

      if (data.metrics.avgCliLatencyMs > 0) {
        cliLatencySum += data.metrics.avgCliLatencyMs;
        cliCount++;
      }

      if (data.circuitBreakerState === 'open') {
        openCircuitBreakers.push(data.providerName);
      }
    }

    return {
      totalSDKExecutions: totalSDK,
      totalCLIExecutions: totalCLI,
      totalMCPConnections: this.mcpMetrics.totalConnections,
      overallFallbackRate: totalSDK > 0 ? totalFallbacks / totalSDK : 0,
      avgSDKLatencyMs: sdkCount > 0 ? sdkLatencySum / sdkCount : 0,
      avgCLILatencyMs: cliCount > 0 ? cliLatencySum / cliCount : 0,
      providersWithOpenCircuitBreaker: openCircuitBreakers
    };
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.providerMetrics.clear();
    this.sdkLatencies.clear();
    this.cliLatencies.clear();
    this.mcpLatencies = [];
    this.mcpMetrics = {
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      totalToolCalls: 0,
      avgToolCallLatencyMs: 0,
      sessionsByProvider: {}
    };
  }

  /**
   * Add latency sample to provider's latency array
   */
  private addLatencySample(
    latencyMap: Map<string, number[]>,
    providerName: string,
    latencyMs: number
  ): void {
    if (!latencyMap.has(providerName)) {
      latencyMap.set(providerName, []);
    }

    const latencies = latencyMap.get(providerName)!;
    latencies.push(latencyMs);

    // Keep only the last N samples
    if (latencies.length > this.MAX_LATENCY_SAMPLES) {
      latencies.shift();
    }
  }

  /**
   * Calculate average latency from samples
   */
  private calculateAverageLatency(latencies: number[]): number {
    if (latencies.length === 0) return 0;
    const sum = latencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / latencies.length);
  }

  /**
   * Calculate success rate
   */
  private calculateSuccessRate(total: number, errors: number): number {
    if (total === 0) return 1;
    return Math.max(0, (total - errors) / total);
  }
}

/**
 * Get the global provider metrics collector instance
 */
export function getProviderMetrics(): ProviderMetricsCollector {
  return ProviderMetricsCollector.getInstance();
}
