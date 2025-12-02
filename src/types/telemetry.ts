/**
 * Telemetry Types - Event tracking and analytics
 *
 * Phase 4 (v6.1.0): Observability, Analytics & Optimization
 */

/**
 * Telemetry event types
 */
export type TelemetryEventType =
  | 'execution_start'
  | 'execution_complete'
  | 'execution_error'
  | 'provider_selected'
  | 'provider_fallback'
  | 'rate_limit_hit'
  | 'cache_hit'
  | 'cache_miss';

/**
 * Telemetry event - single execution tracking point
 */
export interface TelemetryEvent {
  id: string;                    // Unique event ID (UUID)
  timestamp: number;              // Unix timestamp (ms)
  type: TelemetryEventType;       // Event type
  provider: string;               // Provider name (openai, gemini, claude)
  model?: string;                 // Model used
  agentName?: string;             // Agent name
  sessionId?: string;             // Session ID (if part of session)

  // Performance metrics
  latencyMs: number;              // Total latency
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };

  // Cost tracking
  cost: {
    estimatedUsd: number;         // Estimated cost
    provider: string;             // Which provider's pricing
  };

  // Execution metadata
  success: boolean;               // Did it succeed?
  errorCode?: string;             // Error code if failed
  errorMessage?: string;          // Error message if failed
  retryCount?: number;            // Number of retries

  // Context
  context?: Record<string, any>;  // Additional context
}

/**
 * Telemetry query filters
 */
export interface TelemetryQueryFilters {
  provider?: string;
  agentName?: string;
  sessionId?: string;
  type?: TelemetryEventType;
  startDate?: number;
  endDate?: number;
  success?: boolean;
  limit?: number;
}

/**
 * Telemetry configuration options
 */
export interface TelemetryOptions {
  enabled: boolean;               // Enable/disable telemetry
  dbPath: string;                 // SQLite database path
  flushIntervalMs: number;        // Auto-flush interval
  retentionDays: number;          // How long to keep events
  bufferSize: number;             // Max events before flush
}

/**
 * Analytics summary - aggregated metrics
 */
export interface AnalyticsSummary {
  timeRange: {
    start: number;
    end: number;
    durationMs: number;
  };

  executions: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };

  performance: {
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
  };

  costs: {
    totalUsd: number;
    avgCostPerRequest: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
  };

  tokens: {
    total: number;
    prompt: number;
    completion: number;
    avgPerRequest: number;
  };

  providers: {
    usage: Record<string, number>;           // Request count per provider
    avgLatency: Record<string, number>;      // Avg latency per provider
    errorRate: Record<string, number>;       // Error rate per provider
  };

  topAgents: Array<{
    name: string;
    executionCount: number;
    totalCost: number;
    avgLatency: number;
  }>;
}

/**
 * Analytics query options
 */
export interface AnalyticsOptions {
  startDate: number;
  endDate: number;
  provider?: string;
  agentName?: string;
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  id: string;
  type: 'cost_saving' | 'performance' | 'reliability';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  estimatedSavings?: {
    costUsd: number;
    percentageReduction: number;
  };
  estimatedImprovement?: {
    metric: string;
    improvement: number;
    unit: string;
  };
  actionable: boolean;
  actions: string[];
}

/**
 * Time period shortcuts
 */
export type TimePeriod = '24h' | '7d' | '30d' | 'all';
