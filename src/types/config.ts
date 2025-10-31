/**
 * Configuration types for AutomatosX v5.0+
 *
 * Complete configuration system with YAML support.
 * All hardcoded values moved to configuration.
 */

import type { LogLevel } from './logger.js';
import type { TimeoutConfig } from './timeout.js';
import type { AdaptiveCacheConfig as AdaptiveCacheConfigImpl } from '../core/adaptive-cache.js';

// ========================================
// Provider Configuration
// ========================================

export interface ProviderHealthCheckConfig {
  enabled: boolean;
  interval: number;  // milliseconds
  timeout: number;   // milliseconds
}

/**
 * Provider default model parameters (v5.0+)
 */
export interface ProviderDefaultsConfig {
  maxTokens?: number;      // Default max output tokens
  temperature?: number;    // Default temperature (0-1)
  topP?: number;           // Default top_p (0-1)
}

/**
 * Circuit Breaker Configuration (v5.6.18+)
 * Prevents cascading failures by temporarily disabling failed providers
 */
export interface CircuitBreakerConfig {
  enabled: boolean;               // Enable circuit breaker
  failureThreshold: number;       // Number of failures before opening circuit
  recoveryTimeout: number;        // Time to wait before attempting recovery (ms)
}

/**
 * Process Management Configuration (v5.6.18+)
 * Controls process lifecycle and cleanup behavior
 */
export interface ProcessManagementConfig {
  gracefulShutdownTimeout: number;  // Max time to wait for graceful shutdown (ms)
  forceKillDelay: number;           // Delay before force killing process (ms)
}

/**
 * Version Detection Configuration (v5.6.18+)
 * Controls provider version detection behavior
 */
export interface VersionDetectionConfig {
  timeout: number;          // Version check timeout (ms)
  forceKillDelay: number;   // Delay before force killing version check (ms)
  cacheEnabled: boolean;    // Cache version detection results
}

/**
 * Provider Limit Tracking Configuration (v5.7.0+)
 * Controls usage limit detection and automatic rotation
 */
export interface ProviderLimitTrackingConfig {
  enabled: boolean;          // Enable limit tracking (default: true)
  window: 'daily' | 'weekly' | 'custom';  // Reset window type
  resetHourUtc: number;      // Reset hour in UTC (0-23, default: 0 for midnight)
  customResetMs?: number;    // Custom reset interval in ms (for 'custom' window only)
}

/**
 * Claude Code Provider Configuration (v5.8.6+)
 * Provider-specific settings for Claude Code CLI
 */
export interface ClaudeProviderConfig {
  allowedTools?: string[];   // Tools accessible to Claude (default: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'])
  allowedDirs?: string[];    // Directories Claude can access (default: ['.'])
  printMode?: boolean;       // Enable --print flag (default: true)
}

/**
 * Gemini CLI Provider Configuration (v5.8.6+)
 * Provider-specific settings for Gemini CLI
 */
export interface GeminiProviderConfig {
  approvalMode?: 'auto' | 'always' | 'never' | 'auto_edit';  // File edit approval mode (default: 'auto_edit')
  embeddingModel?: string;   // Embedding model to use (default: 'text-embedding-004')
  enableRealEmbeddings?: boolean;  // Enable real embeddings instead of mock (default: false)
}

/**
 * OpenAI/Codex MCP Configuration (v5.13.0+)
 * Provider-specific settings for OpenAI Codex CLI with MCP support
 */
export interface OpenAIMCPConfig {
  enabled: boolean;           // Enable MCP server (default: false)
  command: string;            // CLI command for MCP server (default: 'codex')
  transport: 'stdio';         // Transport protocol (stdio only for now)
  autoStart?: boolean;        // Auto-start MCP server on provider init (default: false)
  configOverrides?: Record<string, any>;  // Additional config overrides for MCP server
}

/**
 * Integration Mode (v5.13.0 Phase 1+, v6.0.7 Phase 2)
 * Determines how provider communicates with AI API
 * - 'cli': Use subprocess (compatible with firewalls, requires CLI installation)
 * - 'sdk': Use native SDK (faster, requires API key and direct API access)
 * - 'mcp': Use MCP protocol (future, not yet implemented)
 * - 'auto': Auto-detect best mode based on environment (recommended)
 */
export type IntegrationMode = 'sdk' | 'cli' | 'mcp' | 'auto';

/**
 * Sandbox Mode (v6.0.7 Phase 3)
 * Security sandbox for code execution
 */
export type SandboxMode = 'none' | 'workspace-read' | 'workspace-write' | 'full';

/**
 * Sandbox Configuration (v6.0.7 Phase 3)
 * Configure code execution sandbox for OpenAI provider
 */
export interface SandboxConfig {
  default: SandboxMode;      // Default sandbox mode (recommended: 'workspace-write')
  allowOverride: boolean;    // Allow per-execution override via --sandbox flag
}

/**
 * OpenAI SDK Configuration (v5.13.0 Phase 1+)
 * Native SDK integration for OpenAI
 */
export interface OpenAISDKConfig {
  apiKey?: string;           // API key (default: process.env.OPENAI_API_KEY)
  organization?: string;     // Organization ID
  baseURL?: string;          // Custom base URL (for Azure OpenAI, etc.)
  timeout?: number;          // Request timeout (ms)
  maxRetries?: number;       // Max retries for failed requests
  defaultModel?: string;     // Default model if not specified in request
}

/**
 * Connection Pool Configuration (v5.13.0 Phase 1+)
 * Connection pooling for SDK-based providers
 */
export interface ConnectionPoolConfig {
  enabled: boolean;          // Enable connection pooling (default: true)
  minConnections: number;    // Minimum connections to maintain (default: 2)
  maxConnections: number;    // Maximum connections per provider (default: 10)
  idleTimeout: number;       // Max idle time before cleanup (default: 300000ms = 5 min)
  maxAge: number;            // Max connection age (default: 3600000ms = 1 hour)
  healthCheckInterval: number; // Health check interval (default: 60000ms = 1 min)
  warmupOnInit: boolean;     // Pre-create connections on init (default: true)
}

export interface ProviderConfig {
  enabled: boolean;
  priority: number;
  timeout: number;
  command: string;
  healthCheck?: ProviderHealthCheckConfig;
  defaults?: ProviderDefaultsConfig;  // v5.0: Default model parameters

  // Phase 2 (v5.6.2): Enhanced CLI detection
  /** Custom CLI path override (takes precedence over PATH detection) */
  customPath?: string;
  /** Custom version check argument (default: --version) */
  versionArg?: string;
  /** Minimum required version (semantic versioning) */
  minVersion?: string;

  // v5.6.18: Process management and reliability
  circuitBreaker?: CircuitBreakerConfig;        // Circuit breaker configuration
  processManagement?: ProcessManagementConfig;  // Process lifecycle management
  versionDetection?: VersionDetectionConfig;    // Version detection configuration

  // v5.7.0: Usage limit tracking and automatic rotation
  limitTracking?: ProviderLimitTrackingConfig;  // Usage limit tracking configuration

  // v5.8.6: Provider-specific configuration
  claude?: ClaudeProviderConfig;  // Claude Code specific configuration
  gemini?: GeminiProviderConfig;  // Gemini CLI specific configuration

  // v5.13.0: OpenAI/Codex MCP configuration
  mcp?: OpenAIMCPConfig;          // OpenAI Codex MCP server configuration

  // v5.13.0 Phase 1: SDK Integration and Connection Pooling
  /** Integration mode: "sdk" (native SDK), "cli" (subprocess), "mcp" (MCP protocol) */
  integration?: IntegrationMode;  // Default: "cli" for backward compatibility
  /** OpenAI SDK configuration (when integration === "sdk") */
  sdk?: OpenAISDKConfig;
  /** Connection pooling configuration (for SDK/MCP providers) */
  connectionPool?: ConnectionPoolConfig;
  /** Automatic fallback to CLI if SDK fails (default: true) */
  fallbackToCLI?: boolean;

  // v6.0.7 Phase 3: Sandbox security configuration
  /** Sandbox mode configuration for file system access control */
  sandbox?: SandboxConfig;
}

// ========================================
// Execution Configuration
// ========================================

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;      // milliseconds
  maxDelay: number;          // milliseconds
  backoffFactor: number;     // exponential backoff multiplier
  retryableErrors?: string[]; // error codes/messages that trigger retry (optional, has defaults)
}

export interface ExecutionProviderConfig {
  maxWaitMs: number;      // max wait time for provider response
  fallbackDelay?: number; // v5.0: delay before trying fallback provider (ms)
}

/**
 * Stage Execution Configuration (v5.3.0+)
 */
export interface StageRetryConfig {
  defaultMaxRetries: number;    // default max retries per stage
  defaultRetryDelay: number;    // default retry delay (ms)
}

export interface StagePromptConfig {
  timeout: number;              // prompt timeout (ms)
  autoConfirm: boolean;         // auto-confirm (skip prompts)
  locale: 'en' | 'zh';          // prompt language
}

export interface StageProgressConfig {
  updateInterval: number;       // progress update interval (ms)
  syntheticProgress: boolean;   // enable synthetic progress for non-streaming providers
}

export interface StageMemorySharingConfig {
  enabled: boolean;             // enable memory sharing between tasks (Phase 3)
  contextDepth: number;         // number of prior tasks to include in context
}

export interface StageExecutionConfigOptions {
  enabled: boolean;             // enable stage-based execution
  defaultTimeout: number;       // default timeout per stage (ms)
  checkpointPath: string;       // checkpoint storage path
  autoSaveCheckpoint: boolean;  // auto-save checkpoints after each stage
  cleanupAfterDays: number;     // cleanup checkpoints after N days
  retry: StageRetryConfig;      // stage retry configuration
  prompts: StagePromptConfig;   // prompt configuration
  progress: StageProgressConfig; // progress configuration
  memorySharing?: StageMemorySharingConfig; // Phase 3 (v5.12.0): context sharing between tasks
}

/**
 * Concurrency Configuration (v5.6.18+)
 * Controls parallel execution and CPU utilization
 */
export interface ConcurrencyConfig {
  maxConcurrentAgents?: number;  // Max agents to run in parallel (if set, overrides autoDetect)
  autoDetect: boolean;           // Auto-detect based on CPU cores
  cpuMultiplier: number;         // Multiplier for CPU core count (default: 1.0)
  minConcurrency: number;        // Minimum concurrent agents (default: 2)
  maxConcurrency: number;        // Maximum concurrent agents (default: 16)
}

export interface SpecExecutionConfig {
  maxConcurrentTasks: number;  // Phase 3 (v5.12.0): Max concurrent spec tasks
}

export interface ExecutionConfig {
  defaultTimeout: number;  // default execution timeout (ms)
  retry: RetryConfig;
  provider: ExecutionProviderConfig;
  maxConcurrentAgents?: number;  // DEPRECATED: use concurrency.maxConcurrentAgents
  concurrency?: ConcurrencyConfig;  // v5.6.18: Advanced concurrency control
  stages?: StageExecutionConfigOptions;  // v5.3.0: stage-based execution
  timeouts?: TimeoutConfig;  // v5.4.0: layered timeout configuration (optional)
  spec?: SpecExecutionConfig;  // Phase 3 (v5.12.0): Spec-Kit execution config
}

// ========================================
// Orchestration Configuration
// ========================================

export interface SessionConfig {
  maxSessions: number;         // max sessions in memory
  maxMetadataSize: number;     // max metadata size (bytes)
  saveDebounce: number;        // save debounce delay (ms)
  cleanupAfterDays: number;    // cleanup old sessions after N days
  maxUuidAttempts: number;     // max UUID generation attempts
  persistPath: string;         // session persistence path
}

export interface DelegationConfig {
  maxDepth: number;            // max delegation chain depth
  timeout: number;             // delegation timeout (ms)
  enableCycleDetection: boolean;
}

/**
 * Workspace System Configuration (v5.2.0 - Simplified)
 *
 * Manages automatosx/ directory structure:
 * - PRD/: Planning documents (permanent)
 * - tmp/: Temporary files (auto-cleanup)
 */
// v5.2: WorkspaceSystemConfig removed - workspace moved to root level
// Use WorkspaceConfig instead (defined below in Legacy section)

export interface OrchestrationConfigSystem {
  session: SessionConfig;
  delegation: DelegationConfig;
  // v5.2: workspace moved to root level of AutomatosXConfig
}

// ========================================
// Memory Configuration
// ========================================

export interface MemorySearchConfig {
  defaultLimit: number;  // default search result limit
  maxLimit: number;      // max search result limit
  timeout: number;       // search timeout (ms)
}

export interface MemoryConfig {
  maxEntries: number;
  persistPath: string;
  autoCleanup: boolean;
  cleanupDays: number;
  busyTimeout?: number;         // v5.6.18: SQLite busy timeout in ms (default: 5000)
  search?: MemorySearchConfig;  // Optional for backward compatibility
}

// ========================================
// Abilities Configuration
// ========================================

export interface AbilitiesCacheConfig {
  enabled: boolean;
  maxEntries: number;
  ttl: number;           // time to live (ms)
  maxSize: number;       // max cache size (bytes)
  cleanupInterval: number; // cleanup interval (ms)
}

export interface AbilitiesLimitsConfig {
  maxFileSize: number;   // max ability file size (bytes)
}

export interface AbilitiesConfig {
  basePath: string;
  fallbackPath: string;
  cache: AbilitiesCacheConfig;
  limits: AbilitiesLimitsConfig;
}

// ========================================
// Logging Configuration
// ========================================

export interface LoggingRetentionConfig {
  maxSizeBytes: number;
  maxAgeDays: number;
  compress: boolean;
}

export interface LoggingConfig {
  level: LogLevel;
  path: string;
  console: boolean;
  retention?: LoggingRetentionConfig;  // Optional for backward compatibility
}

// ========================================
// Performance Configuration
// ========================================

export interface CacheConfig {
  enabled: boolean;
  maxEntries: number;
  ttl: number;           // time to live (ms)
  cleanupInterval: number; // cleanup interval (ms)
}

export interface ProfileCacheConfig extends CacheConfig {}

export interface TeamCacheConfig extends CacheConfig {}

export interface ProviderCacheConfig extends CacheConfig {}

/**
 * Adaptive Cache Configuration (v5.6.18+)
 * Re-export from adaptive-cache.ts for type safety
 */
export type AdaptiveCacheConfig = AdaptiveCacheConfigImpl;

/**
 * Response Cache Configuration (v5.5.3+)
 * SQLite-backed response caching for provider calls
 */
export interface ResponseCacheConfig {
  enabled: boolean;
  ttl: number;                  // Time-to-live in seconds (default: 86400 = 24 hours)
  maxSize: number;              // Max L2 (SQLite) entries (default: 1000)
  maxMemorySize: number;        // Max L1 (RAM) entries (default: 100)
  dbPath: string;               // Path to cache database (default: .automatosx/cache/responses.db)
}

export interface RateLimitConfig {
  enabled: boolean;
  requestsPerMinute: number;
  burstSize: number;
}

export interface PerformanceConfig {
  profileCache: ProfileCacheConfig;
  teamCache: TeamCacheConfig;
  providerCache: ProviderCacheConfig;
  adaptiveCache?: AdaptiveCacheConfig;  // v5.6.18: Optional adaptive cache with dynamic TTL
  responseCache?: ResponseCacheConfig;  // v5.5.3: Optional provider response cache
  rateLimit: RateLimitConfig;
}

// ========================================
// Advanced Configuration
// ========================================

export interface EmbeddingConfig {
  timeout: number;
  retryDelay: number;
  dimensions: number;
  maxRetries: number;
}

export interface SecurityConfig {
  enablePathValidation: boolean;
  allowedExtensions: string[];
}

export interface DevelopmentConfig {
  mockProviders: boolean;
  profileMode: boolean;
}

export interface AdvancedConfig {
  embedding?: EmbeddingConfig;
  security: SecurityConfig;
  development: DevelopmentConfig;
}

// ========================================
// Integration Configuration (v5.5+ VS Code)
// ========================================

export interface VSCodeIntegrationConfig {
  enabled: boolean;
  apiPort: number;
  autoStart: boolean;
  outputPanel: boolean;
  notifications: boolean;
}

export interface IntegrationConfig {
  vscode: VSCodeIntegrationConfig;
}

// ========================================
// CLI Configuration (Optional)
// ========================================

export interface CLIRunConfig {
  defaultMemory: boolean;
  defaultSaveMemory: boolean;
  defaultFormat: 'text' | 'json' | 'markdown';
  defaultVerbose: boolean;
}

export interface CLISessionConfig {
  defaultShowAgents: boolean;
}

export interface CLIMemoryConfig {
  defaultLimit: number;
}

export interface CLIConfig {
  run: CLIRunConfig;
  session: CLISessionConfig;
  memory: CLIMemoryConfig;
}

// ========================================
// Legacy (for backward compatibility)
// ========================================

export interface WorkspaceConfig {
  prdPath: string;        // v5.2: Path to PRD directory
  tmpPath: string;        // v5.2: Path to tmp directory
  autoCleanupTmp: boolean;  // v5.2: Auto-cleanup temporary files
  tmpCleanupDays: number;   // v5.2: Cleanup tmp files older than N days
}

export interface OpenAIConfig {
  apiKey?: string;
  model?: string;
}

// ========================================
// Main Configuration
// ========================================

// ========================================
// Router Configuration (v5.7.0+)
// ========================================

export interface RouterConfig {
  healthCheckInterval?: number;  // Background health check interval (ms), optional
  providerCooldownMs?: number;   // Cooldown period for failed providers (ms)
}

// ========================================
// Telemetry Configuration (v6.0.7+)
// Phase 4: Observability & Analytics
// ========================================

/**
 * Telemetry Configuration
 *
 * Controls telemetry collection for usage analytics and cost optimization.
 * Privacy-first: All data stored locally, never transmitted externally.
 */
export interface TelemetryConfig {
  enabled: boolean;               // Enable/disable telemetry collection (opt-in, default: false)
  dbPath?: string;                // SQLite database path (default: .automatosx/telemetry/events.db)
  flushIntervalMs?: number;       // Auto-flush interval in ms (default: 30000)
  retentionDays?: number;         // Data retention period in days (default: 30)
  bufferSize?: number;            // Max buffered events before flush (default: 100)
}

export interface AutomatosXConfig {
  $schema?: string;
  version?: string;
  providers: Record<string, ProviderConfig>;
  execution?: ExecutionConfig;
  orchestration?: OrchestrationConfigSystem;
  memory: MemoryConfig;
  abilities?: AbilitiesConfig;
  workspace: WorkspaceConfig;  // legacy, kept for backward compatibility
  logging: LoggingConfig;
  performance?: PerformanceConfig;
  advanced?: AdvancedConfig;
  integration?: IntegrationConfig;
  cli?: CLIConfig;
  openai?: OpenAIConfig;  // legacy
  router?: RouterConfig;  // v5.7.0: Router configuration
  telemetry?: TelemetryConfig;  // v6.0.7: Phase 4 - Observability & Analytics
}

// ========================================
// Default Configuration
// ========================================

// v5.6.18: Global provider defaults for circuit breaker, process management, and version detection
// v5.7.0: Added limitTracking defaults
const GLOBAL_PROVIDER_DEFAULTS = {
  circuitBreaker: {
    enabled: true,
    failureThreshold: 3,
    recoveryTimeout: 60000  // 60 seconds
  },
  processManagement: {
    gracefulShutdownTimeout: 5000,  // 5 seconds
    forceKillDelay: 1000             // 1 second
  },
  versionDetection: {
    timeout: 5000,           // 5 seconds
    forceKillDelay: 1000,    // 1 second
    cacheEnabled: true
  },
  limitTracking: {
    enabled: true,           // Enabled by default
    window: 'daily' as const,  // Daily reset by default
    resetHourUtc: 0          // Midnight UTC
  }
};

export const DEFAULT_CONFIG: AutomatosXConfig = {
  providers: {
    'claude-code': {
      enabled: true,
      priority: 3,
      timeout: 2700000,  // 45 minutes (v5.1.0: increased from 15 min based on user feedback)
      command: 'claude',
      healthCheck: {
        enabled: true,
        interval: 300000,  // 5 minutes (v5.0: reduced frequency from 1 min)
        timeout: 5000      // 5 seconds
      },
      // v5.6.18: Circuit breaker, process management, and version detection
      circuitBreaker: GLOBAL_PROVIDER_DEFAULTS.circuitBreaker,
      processManagement: GLOBAL_PROVIDER_DEFAULTS.processManagement,
      versionDetection: GLOBAL_PROVIDER_DEFAULTS.versionDetection,
      // v5.7.0: Usage limit tracking
      limitTracking: {
        ...GLOBAL_PROVIDER_DEFAULTS.limitTracking,
        window: 'weekly'  // Claude Code has weekly limits
      }
      // v5.0.5: Removed defaults - let provider CLI use optimal defaults
      // Users can still set provider.defaults in config for specific needs
    },
    'gemini-cli': {
      enabled: true,
      priority: 2,
      timeout: 2700000,  // 45 minutes (v5.1.0: increased from 15 min based on user feedback)
      command: 'gemini',
      healthCheck: {
        enabled: true,
        interval: 300000,  // 5 minutes (v5.0: reduced frequency)
        timeout: 5000
      },
      // v5.6.18: Circuit breaker, process management, and version detection
      circuitBreaker: GLOBAL_PROVIDER_DEFAULTS.circuitBreaker,
      processManagement: GLOBAL_PROVIDER_DEFAULTS.processManagement,
      versionDetection: GLOBAL_PROVIDER_DEFAULTS.versionDetection,
      // v5.7.0: Usage limit tracking
      limitTracking: GLOBAL_PROVIDER_DEFAULTS.limitTracking  // Gemini: daily limits
      // v5.0.5: Removed defaults - let provider CLI use optimal defaults
    },
    'openai': {
      enabled: true,
      priority: 1,
      timeout: 2700000,  // 45 minutes (v5.1.0: increased from 15 min based on user feedback)
      command: 'codex',
      healthCheck: {
        enabled: true,
        interval: 300000,  // 5 minutes (v5.0: reduced frequency)
        timeout: 5000
      },
      // v5.6.18: Circuit breaker, process management, and version detection
      circuitBreaker: GLOBAL_PROVIDER_DEFAULTS.circuitBreaker,
      processManagement: GLOBAL_PROVIDER_DEFAULTS.processManagement,
      versionDetection: GLOBAL_PROVIDER_DEFAULTS.versionDetection,
      // v5.7.0: Usage limit tracking
      limitTracking: GLOBAL_PROVIDER_DEFAULTS.limitTracking  // OpenAI: daily limits
      // v5.0.5: Removed defaults - let provider CLI use optimal defaults
    }
  },

  execution: {
    defaultTimeout: 2700000,  // 45 minutes (v5.1.0: increased from 15 min based on user feedback)
    // v5.6.18: Advanced concurrency configuration with CPU auto-detection
    concurrency: {
      maxConcurrentAgents: 4,   // Default: 4 concurrent agents
      autoDetect: false,        // Disabled by default for backward compatibility
      cpuMultiplier: 1.0,       // 1 agent per CPU core
      minConcurrency: 2,        // Minimum 2 concurrent agents
      maxConcurrency: 16        // Maximum 16 concurrent agents
    },
    retry: {
      maxAttempts: 3,
      initialDelay: 1000,    // 1 second
      maxDelay: 10000,       // 10 seconds
      backoffFactor: 2,
      retryableErrors: [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'rate_limit',
        'overloaded',
        'timeout'
      ]
    },
    provider: {
      maxWaitMs: 60000,      // 1 minute
      fallbackDelay: 5000    // v5.0: Wait 5s before trying fallback provider
    },
    // v5.3.0: Stage-based execution configuration
    stages: {
      enabled: true,         // v5.6.1: Always enabled, legacy executors removed (StageExecutionController is the only option)
      defaultTimeout: 1800000,  // 30 minutes per stage
      checkpointPath: '.automatosx/checkpoints',
      autoSaveCheckpoint: true,
      cleanupAfterDays: 7,
      retry: {
        defaultMaxRetries: 1,
        defaultRetryDelay: 2000  // 2 seconds
      },
      prompts: {
        timeout: 600000,      // 10 minutes for user decision
        autoConfirm: false,   // Require user confirmation
        locale: 'en'          // Default to English
      },
      progress: {
        updateInterval: 2000,       // Update every 2 seconds
        syntheticProgress: true     // Enable synthetic progress
      }
    }
  },

  orchestration: {
    session: {
      maxSessions: 100,
      maxMetadataSize: 10240,     // 10 KB
      saveDebounce: 1000,         // 1 second (v5.0: increased from 100ms to reduce I/O)
      cleanupAfterDays: 7,
      maxUuidAttempts: 100,
      persistPath: '.automatosx/sessions'
    },
    delegation: {
      maxDepth: 2,
      timeout: 2700000,  // 45 minutes (v5.1.0: increased from 15 min based on user feedback)
      enableCycleDetection: true
    }
    // v5.2: workspace moved to root level
  },

  memory: {
    maxEntries: 10000,
    persistPath: '.automatosx/memory',
    autoCleanup: true,
    cleanupDays: 30,
    busyTimeout: 5000,      // 5 seconds (v5.6.18: SQLite lock wait timeout)
    search: {
      defaultLimit: 10,
      maxLimit: 100,
      timeout: 5000  // 5 seconds
    }
  },

  abilities: {
    basePath: '.automatosx/abilities',
    fallbackPath: 'examples/abilities',
    cache: {
      enabled: true,
      maxEntries: 50,
      ttl: 600000,         // 10 minutes
      maxSize: 5242880,    // 5 MB
      cleanupInterval: 120000  // 2 minutes
    },
    limits: {
      maxFileSize: 524288  // 500 KB
    }
  },

  workspace: {
    prdPath: 'automatosx/PRD',
    tmpPath: 'automatosx/tmp',
    autoCleanupTmp: true,
    tmpCleanupDays: 7
  },

  logging: {
    level: 'info',
    path: '.automatosx/logs',
    console: true,
    retention: {
      maxSizeBytes: 104857600,  // 100 MB
      maxAgeDays: 30,
      compress: true
    }
  },

  performance: {
    profileCache: {
      enabled: true,
      maxEntries: 20,
      ttl: 600000,         // 10 minutes (v5.0: standardized from 5 min)
      cleanupInterval: 120000  // 2 minutes (v5.0: standardized)
    },
    teamCache: {
      enabled: true,
      maxEntries: 10,
      ttl: 600000,         // 10 minutes
      cleanupInterval: 120000  // 2 minutes
    },
    providerCache: {
      enabled: true,       // v5.0: enabled by default (safe for deterministic responses)
      maxEntries: 100,
      ttl: 600000,         // 10 minutes (v5.0: reduced from 1 hour)
      cleanupInterval: 120000  // 2 minutes (v5.0: standardized)
    },
    adaptiveCache: {
      maxEntries: 1000,
      baseTTL: 300000,        // 5 minutes
      minTTL: 60000,          // 1 minute
      maxTTL: 3600000,        // 1 hour
      adaptiveMultiplier: 2,  // Double TTL for high-frequency items
      lowFreqDivisor: 2,      // Halve TTL for low-frequency items
      frequencyThreshold: 5,  // 5 accesses = high frequency
      cleanupInterval: 60000  // 1 minute
    },
    responseCache: {
      enabled: false,      // v5.5.3: Disabled by default (opt-in feature)
      ttl: 86400,          // 24 hours
      maxSize: 1000,       // Max 1000 entries in SQLite
      maxMemorySize: 100,  // Max 100 entries in RAM
      dbPath: '.automatosx/cache/responses.db'
    },
    rateLimit: {
      enabled: false,      // Keep disabled by default (opt-in)
      requestsPerMinute: 60,
      burstSize: 10
    }
  },

  advanced: {
    embedding: {
      timeout: 30000,
      retryDelay: 1000,
      dimensions: 1536,
      maxRetries: 3
    },
    security: {
      enablePathValidation: true,
      allowedExtensions: [
        '.ts', '.js', '.tsx', '.jsx',
        '.py', '.go', '.rs', '.java',
        '.yaml', '.yml', '.json', '.toml',
        '.md', '.txt', '.csv'
      ]
    },
    development: {
      mockProviders: false,
      profileMode: false
    }
  },

  integration: {
    vscode: {
      enabled: false,  // v5.5+ will enable
      apiPort: 3000,
      autoStart: true,
      outputPanel: true,
      notifications: true
    }
  },

  cli: {
    run: {
      defaultMemory: true,
      defaultSaveMemory: true,
      defaultFormat: 'text',
      defaultVerbose: false
    },
    session: {
      defaultShowAgents: true
    },
    memory: {
      defaultLimit: 10
    }
  },

  // v5.7.0: Router configuration for background health checks
  router: {
    healthCheckInterval: 60000,  // 60 seconds (default: enabled)
    providerCooldownMs: 30000    // 30 seconds cooldown for failed providers
  }
};
