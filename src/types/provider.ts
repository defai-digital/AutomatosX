/**
 * Provider Types - AI Provider Interface Definitions
 */

// v5.6.18: Import and re-export RetryConfig, and other v5.6.18 config types from config.ts for consistency
// v6.0.7 Phase 3: Added SandboxConfig import
// v6.1.0 Phase 4: Telemetry and analytics types
import type {
  RetryConfig as RetryConfigImpl,
  CircuitBreakerConfig,
  ProcessManagementConfig,
  VersionDetectionConfig,
  ClaudeProviderConfig,
  GeminiProviderConfig,
  IntegrationMode,
  OpenAISDKConfig,
  ProviderLimitTrackingConfig,
  SandboxConfig
} from './config.js';

// Re-export RetryConfig for backward compatibility
export type RetryConfig = RetryConfigImpl;

export interface ProviderConfig {
  name: string;
  enabled: boolean;
  priority: number;
  timeout: number;
  command: string;
  rateLimits?: RateLimitConfig;
  retryPolicy?: RetryConfig;

  // Phase 2 (v5.4.0): Enhanced CLI detection
  /** Custom CLI path override (takes precedence over PATH detection) */
  customPath?: string;
  /** Custom version check argument (default: --version) */
  versionArg?: string;
  /** Minimum required version (semantic versioning) */
  minVersion?: string;

  // v8.3.0: YAML configuration file support (Phase 1 - Grok Provider Integration)
  /** Path to YAML configuration file (if using YAML-based config) */
  configFile?: string;

  // v5.6.18: Process management and reliability
  circuitBreaker?: CircuitBreakerConfig;        // Circuit breaker configuration
  processManagement?: ProcessManagementConfig;  // Process lifecycle management
  versionDetection?: VersionDetectionConfig;    // Version detection configuration

  // v5.8.6: Provider-specific configuration
  claude?: ClaudeProviderConfig;  // Claude Code specific configuration
  gemini?: GeminiProviderConfig;  // Gemini CLI specific configuration

  // v6.0.7: OpenAI integration mode and SDK configuration
  integration?: IntegrationMode;  // Integration mode: 'cli', 'sdk', 'mcp', or 'auto'
  sdk?: OpenAISDKConfig;          // OpenAI SDK configuration (when integration === 'sdk')
  limitTracking?: ProviderLimitTrackingConfig;  // Usage limit tracking configuration
  sandbox?: SandboxConfig;        // v6.0.7 Phase 3: Sandbox security configuration

  // v9.1.0: ax-cli provider configuration
  axCli?: {
    /**
     * Provider name (optional)
     *
     * @deprecated Configure provider via `ax-cli setup` instead
     */
    provider?: string;
    model?: string;
    maxToolRounds?: number;
    apiKey?: string;
    baseUrl?: string;
    configPath?: string;
  };

  // v9.2.0: ax-cli execution mode
  /** Execution mode for ax-cli provider: "sdk", "cli", or "auto" (default: "auto") */
  mode?: 'sdk' | 'cli' | 'auto';

  // v9.2.0: ax-cli SDK-specific configuration
  axCliSdk?: {
    /** Enable streaming events */
    streamingEnabled?: boolean;
    /** Reuse agent instances between calls */
    reuseEnabled?: boolean;
  };
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  maxConcurrentRequests: number;
}

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsEmbedding: boolean;
  supportsVision: boolean;
  maxContextTokens: number;
  supportedModels: string[];
}

export interface HealthStatus {
  available: boolean;
  latencyMs: number;
  errorRate: number;
  lastError?: Error;
  consecutiveFailures: number;
  lastCheckTime?: number; // Phase 3: Timestamp of last health check
}

export interface RateLimitStatus {
  hasCapacity: boolean;
  requestsRemaining: number;
  tokensRemaining: number;
  resetAtMs: number;
}

export interface ExecutionRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  context?: Record<string, any>;
  signal?: AbortSignal;  // v5.0.7: Support for execution cancellation
  spec?: any;  // Phase 2.2: Optional spec for policy-driven routing
}

export interface ExecutionResponse {
  content: string;
  model: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
  finishReason: 'stop' | 'length' | 'error';
  cached?: boolean; // Indicates if response came from cache (v5.5.3)
}

export interface Cost {
  estimatedUsd: number;
  tokensUsed: number;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageLatencyMs: number;
  errorCount: number;
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

/**
 * Streaming Options (v5.3.0)
 *
 * Configuration for streaming execution.
 */
export interface StreamingOptions {
  /** Enable streaming mode */
  enabled: boolean;
  /** Callback for each token received */
  onToken?: (token: string) => void;
  /** Callback for progress updates (0-100) */
  onProgress?: (progress: number) => void;
}

/**
 * Production-ready provider interface
 * Supports rate limiting, cost estimation, health checks
 */
export interface Provider {
  // Metadata
  readonly name: string;
  readonly version: string;
  readonly priority: number;
  readonly capabilities: ProviderCapabilities;

  // Health & Availability
  isAvailable(): Promise<boolean>;
  getHealth(): Promise<HealthStatus>;

  // Execution
  execute(request: ExecutionRequest): Promise<ExecutionResponse>;

  // Streaming (v5.3.0)
  supportsStreaming(): boolean;
  executeStreaming?(
    request: ExecutionRequest,
    options: StreamingOptions
  ): Promise<ExecutionResponse>;

  // Embeddings
  generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]>;

  // Rate Limiting
  checkRateLimit(): Promise<RateLimitStatus>;
  waitForCapacity(): Promise<void>;

  // Cost Management
  estimateCost(request: ExecutionRequest): Promise<Cost>;
  getUsageStats(): Promise<UsageStats>;

  // Error Handling
  shouldRetry(error: Error): boolean;
  getRetryDelay(attempt: number): number;

  // Phase 3 (v5.6.3): Cache Observability
  getCacheMetrics(): {
    availability: {
      hits: number;
      misses: number;
      hitRate: number;
      avgAge: number;
      maxAge: number;
      lastHit?: number;
      lastMiss?: number;
    };
    version: {
      hits: number;
      misses: number;
      hitRate: number;
      size: number;
      avgAge: number;
      maxAge: number;
    };
    health: {
      consecutiveFailures: number;
      consecutiveSuccesses: number;
      lastCheckTime?: number;
      lastCheckDuration: number;
      uptime: number;
    };
  };
  clearCaches(): void;
}
