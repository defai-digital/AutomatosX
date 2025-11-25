/**
 * Provider schemas for AutomatosX
 * @module @ax/schemas/provider
 */

import { z } from 'zod';
import { ProviderType, IntegrationMode, DurationMs, NormalizedScore, TokenUsage } from './common.js';

// =============================================================================
// Provider Configuration
// =============================================================================

/**
 * Circuit breaker configuration for fault tolerance
 */
export const CircuitBreakerConfigSchema = z.object({
  /** Whether circuit breaker is enabled */
  enabled: z.boolean().default(true),
  /** Number of failures before opening circuit */
  failureThreshold: z.number().int().min(1).max(10).default(3),
  /** Time to wait before attempting recovery (ms) */
  recoveryTimeout: DurationMs.default(60000),
  /** Time window for counting failures (ms) */
  failureWindow: DurationMs.default(300000),
});
export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

/**
 * Health check configuration
 */
export const HealthCheckConfigSchema = z.object({
  /** Whether health checks are enabled */
  enabled: z.boolean().default(true),
  /** Interval between health checks (ms) */
  interval: DurationMs.default(60000),
  /** Timeout for health check (ms) */
  timeout: DurationMs.default(5000),
  /** Number of retries before marking unhealthy */
  retries: z.number().int().min(0).max(5).default(2),
});
export type HealthCheckConfig = z.infer<typeof HealthCheckConfigSchema>;

/**
 * Individual provider configuration
 */
export const ProviderConfigSchema = z.object({
  /** Provider type identifier */
  type: ProviderType,
  /** Whether this provider is enabled */
  enabled: z.boolean().default(true),
  /** Priority for routing (lower = higher priority) */
  priority: z.number().int().min(1).max(100).default(10),
  /** Integration mode (mcp, sdk, bash) */
  integrationMode: IntegrationMode,
  /** Default timeout for requests (ms) */
  timeout: DurationMs.default(300000),
  /** Maximum concurrent requests */
  maxConcurrency: z.number().int().min(1).max(100).default(4),
  /** Circuit breaker configuration */
  circuitBreaker: CircuitBreakerConfigSchema.default({}),
  /** Health check configuration */
  healthCheck: HealthCheckConfigSchema.default({}),
  /** Command to execute (for bash mode) */
  command: z.string().optional(),
  /** Arguments for command */
  args: z.array(z.string()).default([]),
  /** Environment variables */
  env: z.record(z.string(), z.string()).optional(),
  /** Custom metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// =============================================================================
// Provider Health Status
// =============================================================================

/**
 * Current health status of a provider
 */
export const ProviderHealthSchema = z.object({
  /** Whether provider is healthy */
  healthy: z.boolean(),
  /** Last health check timestamp */
  lastCheck: z.date(),
  /** Number of consecutive failures */
  consecutiveFailures: z.number().int().nonnegative(),
  /** Average latency in milliseconds */
  latencyMs: DurationMs,
  /** Success rate (0-1) */
  successRate: NormalizedScore,
  /** Circuit breaker state */
  circuitState: z.enum(['closed', 'open', 'half-open']).default('closed'),
  /** Error message if unhealthy */
  errorMessage: z.string().optional(),
});
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;

// =============================================================================
// Execution Request/Response
// =============================================================================

/**
 * Request to execute a task via provider
 */
export const ExecutionRequestSchema = z.object({
  /** Task description/prompt */
  task: z.string().min(1),
  /** Optional agent identifier */
  agent: z.string().optional(),
  /** Additional context for execution */
  context: z.record(z.string(), z.unknown()).optional(),
  /** Timeout in milliseconds */
  timeout: DurationMs.default(300000),
  /** Whether to stream output */
  stream: z.boolean().default(false),
  /** Session ID for context continuity */
  sessionId: z.string().uuid().optional(),
  /** Request priority */
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});
export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;

/**
 * Response metadata from execution
 */
export const ExecutionMetadataSchema = z.object({
  /** Provider that handled the request */
  provider: ProviderType,
  /** Integration mode used */
  integrationMode: IntegrationMode,
  /** Execution duration in milliseconds */
  duration: DurationMs,
  /** Token usage if available */
  tokens: TokenUsage.optional(),
  /** Request ID for tracing */
  requestId: z.string().uuid().optional(),
  /** Model used if applicable */
  model: z.string().optional(),
});
export type ExecutionMetadata = z.infer<typeof ExecutionMetadataSchema>;

/**
 * Response from provider execution
 */
export const ExecutionResponseSchema = z.object({
  /** Whether execution was successful */
  success: z.boolean(),
  /** Output from execution */
  output: z.string(),
  /** Execution metadata */
  metadata: ExecutionMetadataSchema,
  /** Error message if failed */
  error: z.string().optional(),
  /** Detailed error info */
  errorDetails: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean().default(false),
    details: z.unknown().optional(),
  }).optional(),
});
export type ExecutionResponse = z.infer<typeof ExecutionResponseSchema>;

// =============================================================================
// Provider Registry
// =============================================================================

/**
 * Provider registration in the registry
 */
export const ProviderRegistrationSchema = z.object({
  /** Provider configuration */
  config: ProviderConfigSchema,
  /** Current health status */
  health: ProviderHealthSchema,
  /** Registration timestamp */
  registeredAt: z.date(),
  /** Total requests handled */
  requestCount: z.number().int().nonnegative().default(0),
  /** Successful requests */
  successCount: z.number().int().nonnegative().default(0),
  /** Total tokens used */
  totalTokens: z.number().int().nonnegative().default(0),
});
export type ProviderRegistration = z.infer<typeof ProviderRegistrationSchema>;

// =============================================================================
// Routing Configuration
// =============================================================================

/**
 * Routing context for provider selection
 */
export const RoutingContextSchema = z.object({
  /** Type of task being routed */
  taskType: z.string().default('general'),
  /** Estimated complexity (1-10) */
  complexity: z.number().int().min(1).max(10).default(5),
  /** Prefer MCP providers */
  preferMcp: z.boolean().default(true),
  /** Required capabilities */
  requiredCapabilities: z.array(z.string()).default([]),
  /** Excluded providers */
  excludeProviders: z.array(ProviderType).default([]),
  /** Force specific provider */
  forceProvider: ProviderType.optional(),
});
export type RoutingContext = z.infer<typeof RoutingContextSchema>;

/**
 * Routing decision result
 */
export const RoutingDecisionSchema = z.object({
  /** Selected provider */
  provider: ProviderType,
  /** Score that led to selection */
  score: z.number(),
  /** Reason for selection */
  reason: z.string(),
  /** Alternative providers considered */
  alternatives: z.array(z.object({
    provider: ProviderType,
    score: z.number(),
    reason: z.string(),
  })).default([]),
});
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate execution request
 */
export function validateExecutionRequest(data: unknown): ExecutionRequest {
  return ExecutionRequestSchema.parse(data);
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(data: unknown): ProviderConfig {
  return ProviderConfigSchema.parse(data);
}

/**
 * Default health status values (without lastCheck which needs current time)
 */
export const DEFAULT_HEALTH_VALUES = {
  healthy: true,
  consecutiveFailures: 0,
  latencyMs: 0,
  successRate: 1,
  circuitState: 'closed',
} as const;

/**
 * Create default provider health
 */
export function createDefaultHealth(): ProviderHealth {
  return {
    ...DEFAULT_HEALTH_VALUES,
    lastCheck: new Date(),
  };
}
