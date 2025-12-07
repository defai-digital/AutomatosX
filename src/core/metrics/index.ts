/**
 * Metrics Module
 *
 * Exports provider metrics infrastructure for observability.
 *
 * @module core/metrics
 */

export {
  ProviderMetricsCollector,
  getProviderMetrics,
  type ExecutionMode,
  type CircuitBreakerState,
  type ProviderExecutionMetrics,
  type ProviderMetricsData,
  type MCPSessionMetrics
} from './provider-metrics.js';
