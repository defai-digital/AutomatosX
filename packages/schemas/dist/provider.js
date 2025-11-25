// src/provider.ts
import { z as z2 } from "zod";

// src/common.ts
import { z } from "zod";
var AgentId = z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/, "Agent ID must be lowercase alphanumeric with hyphens").brand();
var SessionId = z.string().uuid().brand();
var MemoryId = z.number().int().positive().brand();
var CheckpointId = z.string().uuid().brand();
var ProviderType = z.enum(["claude", "gemini", "ax-cli", "openai"]);
var IntegrationMode = z.enum(["mcp", "sdk", "bash"]);
var TaskStatus = z.enum(["pending", "running", "completed", "failed", "cancelled"]);
var MemoryType = z.enum(["conversation", "code", "document", "task", "decision"]);
var LogLevel = z.enum(["debug", "info", "warn", "error", "fatal"]);
var ISODateString = z.string().datetime();
var DurationMs = z.number().int().nonnegative();
var Percentage = z.number().min(0).max(100);
var NormalizedScore = z.number().min(0).max(1);
var NonEmptyStringArray = z.array(z.string()).min(1);
var Metadata = z.record(z.string(), z.unknown());
var TokenUsage = z.object({
  input: z.number().int().nonnegative().optional(),
  output: z.number().int().nonnegative().optional(),
  total: z.number().int().nonnegative().optional()
});
var ErrorInfo = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  stack: z.string().optional(),
  cause: z.string().optional()
});

// src/provider.ts
var CircuitBreakerConfigSchema = z2.object({
  /** Whether circuit breaker is enabled */
  enabled: z2.boolean().default(true),
  /** Number of failures before opening circuit */
  failureThreshold: z2.number().int().min(1).max(10).default(3),
  /** Time to wait before attempting recovery (ms) */
  recoveryTimeout: DurationMs.default(6e4),
  /** Time window for counting failures (ms) */
  failureWindow: DurationMs.default(3e5)
});
var HealthCheckConfigSchema = z2.object({
  /** Whether health checks are enabled */
  enabled: z2.boolean().default(true),
  /** Interval between health checks (ms) */
  interval: DurationMs.default(6e4),
  /** Timeout for health check (ms) */
  timeout: DurationMs.default(5e3),
  /** Number of retries before marking unhealthy */
  retries: z2.number().int().min(0).max(5).default(2)
});
var ProviderConfigSchema = z2.object({
  /** Provider type identifier */
  type: ProviderType,
  /** Whether this provider is enabled */
  enabled: z2.boolean().default(true),
  /** Priority for routing (lower = higher priority) */
  priority: z2.number().int().min(1).max(100).default(10),
  /** Integration mode (mcp, sdk, bash) */
  integrationMode: IntegrationMode,
  /** Default timeout for requests (ms) */
  timeout: DurationMs.default(3e5),
  /** Maximum concurrent requests */
  maxConcurrency: z2.number().int().min(1).max(100).default(4),
  /** Circuit breaker configuration */
  circuitBreaker: CircuitBreakerConfigSchema.default({}),
  /** Health check configuration */
  healthCheck: HealthCheckConfigSchema.default({}),
  /** Command to execute (for bash mode) */
  command: z2.string().optional(),
  /** Arguments for command */
  args: z2.array(z2.string()).default([]),
  /** Environment variables */
  env: z2.record(z2.string(), z2.string()).optional(),
  /** Custom metadata */
  metadata: z2.record(z2.string(), z2.unknown()).optional()
});
var ProviderHealthSchema = z2.object({
  /** Whether provider is healthy */
  healthy: z2.boolean(),
  /** Last health check timestamp */
  lastCheck: z2.date(),
  /** Number of consecutive failures */
  consecutiveFailures: z2.number().int().nonnegative(),
  /** Average latency in milliseconds */
  latencyMs: DurationMs,
  /** Success rate (0-1) */
  successRate: NormalizedScore,
  /** Circuit breaker state */
  circuitState: z2.enum(["closed", "open", "half-open"]).default("closed"),
  /** Error message if unhealthy */
  errorMessage: z2.string().optional()
});
var ExecutionRequestSchema = z2.object({
  /** Task description/prompt */
  task: z2.string().min(1),
  /** Optional agent identifier */
  agent: z2.string().optional(),
  /** Additional context for execution */
  context: z2.record(z2.string(), z2.unknown()).optional(),
  /** Timeout in milliseconds */
  timeout: DurationMs.default(3e5),
  /** Whether to stream output */
  stream: z2.boolean().default(false),
  /** Session ID for context continuity */
  sessionId: z2.string().uuid().optional(),
  /** Request priority */
  priority: z2.enum(["low", "normal", "high"]).default("normal")
});
var ExecutionMetadataSchema = z2.object({
  /** Provider that handled the request */
  provider: ProviderType,
  /** Integration mode used */
  integrationMode: IntegrationMode,
  /** Execution duration in milliseconds */
  duration: DurationMs,
  /** Token usage if available */
  tokens: TokenUsage.optional(),
  /** Request ID for tracing */
  requestId: z2.string().uuid().optional(),
  /** Model used if applicable */
  model: z2.string().optional()
});
var ExecutionResponseSchema = z2.object({
  /** Whether execution was successful */
  success: z2.boolean(),
  /** Output from execution */
  output: z2.string(),
  /** Execution metadata */
  metadata: ExecutionMetadataSchema,
  /** Error message if failed */
  error: z2.string().optional(),
  /** Detailed error info */
  errorDetails: z2.object({
    code: z2.string(),
    message: z2.string(),
    retryable: z2.boolean().default(false),
    details: z2.unknown().optional()
  }).optional()
});
var ProviderRegistrationSchema = z2.object({
  /** Provider configuration */
  config: ProviderConfigSchema,
  /** Current health status */
  health: ProviderHealthSchema,
  /** Registration timestamp */
  registeredAt: z2.date(),
  /** Total requests handled */
  requestCount: z2.number().int().nonnegative().default(0),
  /** Successful requests */
  successCount: z2.number().int().nonnegative().default(0),
  /** Total tokens used */
  totalTokens: z2.number().int().nonnegative().default(0)
});
var RoutingContextSchema = z2.object({
  /** Type of task being routed */
  taskType: z2.string().default("general"),
  /** Estimated complexity (1-10) */
  complexity: z2.number().int().min(1).max(10).default(5),
  /** Prefer MCP providers */
  preferMcp: z2.boolean().default(true),
  /** Required capabilities */
  requiredCapabilities: z2.array(z2.string()).default([]),
  /** Excluded providers */
  excludeProviders: z2.array(ProviderType).default([]),
  /** Force specific provider */
  forceProvider: ProviderType.optional()
});
var RoutingDecisionSchema = z2.object({
  /** Selected provider */
  provider: ProviderType,
  /** Score that led to selection */
  score: z2.number(),
  /** Reason for selection */
  reason: z2.string(),
  /** Alternative providers considered */
  alternatives: z2.array(z2.object({
    provider: ProviderType,
    score: z2.number(),
    reason: z2.string()
  })).default([])
});
function validateExecutionRequest(data) {
  return ExecutionRequestSchema.parse(data);
}
function validateProviderConfig(data) {
  return ProviderConfigSchema.parse(data);
}
var DEFAULT_HEALTH_VALUES = {
  healthy: true,
  consecutiveFailures: 0,
  latencyMs: 0,
  successRate: 1,
  circuitState: "closed"
};
function createDefaultHealth() {
  return {
    ...DEFAULT_HEALTH_VALUES,
    lastCheck: /* @__PURE__ */ new Date()
  };
}
export {
  CircuitBreakerConfigSchema,
  DEFAULT_HEALTH_VALUES,
  ExecutionMetadataSchema,
  ExecutionRequestSchema,
  ExecutionResponseSchema,
  HealthCheckConfigSchema,
  ProviderConfigSchema,
  ProviderHealthSchema,
  ProviderRegistrationSchema,
  RoutingContextSchema,
  RoutingDecisionSchema,
  createDefaultHealth,
  validateExecutionRequest,
  validateProviderConfig
};
//# sourceMappingURL=provider.js.map