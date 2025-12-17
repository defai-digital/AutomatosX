/**
 * Configuration Contract V1
 *
 * Main configuration schema for AutomatosX.
 *
 * Invariants:
 * - INV-CFG-CON-001: All config types derived from Zod schemas
 * - INV-CFG-CON-002: Config includes version for migrations
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/**
 * Configuration file version for migrations
 */
export const CONFIG_VERSION = '1.0.0';

// ============================================================================
// Basic Type Schemas
// ============================================================================

/**
 * Log level enum
 */
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'silent']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * Output format enum
 */
export const OutputFormatSchema = z.enum(['text', 'json', 'yaml']);
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

/**
 * Config scope enum
 */
export const ConfigScopeSchema = z.enum(['global', 'local']);
export type ConfigScope = z.infer<typeof ConfigScopeSchema>;

/**
 * Config read scope (includes merged)
 */
export const ConfigReadScopeSchema = z.enum(['global', 'local', 'merged']);
export type ConfigReadScope = z.infer<typeof ConfigReadScopeSchema>;

// ============================================================================
// Provider Configuration Schema (matches old working design)
// Note: Prefixed with "Config" to avoid conflicts with provider/v1 runtime schemas
// ============================================================================

/**
 * Health check configuration for a provider (config file format)
 */
export const ConfigHealthCheckSchema = z.object({
  enabled: z.boolean().default(true),
  interval: z.number().int().min(1000).max(3600000).default(300000), // 5 minutes
  timeout: z.number().int().min(100).max(60000).default(5000),
});
export type ConfigHealthCheck = z.infer<typeof ConfigHealthCheckSchema>;

/**
 * Circuit breaker configuration for resilience (config file format)
 */
export const ConfigCircuitBreakerSchema = z.object({
  enabled: z.boolean().default(true),
  failureThreshold: z.number().int().min(1).max(10).default(3),
  recoveryTimeout: z.number().int().min(1000).max(600000).default(60000),
});
export type ConfigCircuitBreaker = z.infer<typeof ConfigCircuitBreakerSchema>;

/**
 * Process management configuration
 */
export const ConfigProcessManagementSchema = z.object({
  gracefulShutdownTimeout: z.number().int().min(1000).max(60000).default(5000),
  forceKillDelay: z.number().int().min(100).max(10000).default(1000),
});
export type ConfigProcessManagement = z.infer<typeof ConfigProcessManagementSchema>;

/**
 * Version detection configuration
 */
export const ConfigVersionDetectionSchema = z.object({
  timeout: z.number().int().min(1000).max(30000).default(5000),
  forceKillDelay: z.number().int().min(100).max(10000).default(1000),
  cacheEnabled: z.boolean().default(true),
});
export type ConfigVersionDetection = z.infer<typeof ConfigVersionDetectionSchema>;

/**
 * Provider limit tracking configuration
 */
export const ConfigLimitTrackingSchema = z.object({
  enabled: z.boolean().default(true),
  window: z.enum(['daily', 'weekly', 'custom']).default('daily'),
  resetHourUtc: z.number().int().min(0).max(23).default(0),
  customResetMs: z.number().int().positive().optional(),
});
export type ConfigLimitTracking = z.infer<typeof ConfigLimitTrackingSchema>;

/**
 * Provider type enum
 */
export const ConfigProviderTypeSchema = z.enum(['cli', 'sdk', 'hybrid']);
export type ConfigProviderType = z.infer<typeof ConfigProviderTypeSchema>;

/**
 * Full provider configuration (matches old working design)
 * This is a Record<string, ProviderConfig> keyed by provider name
 */
export const ProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  priority: z.number().int().min(1).max(100).default(50),
  timeout: z.number().int().min(1000).max(7200000).default(2700000), // 45 minutes default
  type: ConfigProviderTypeSchema.optional(),
  command: z.string().min(1).optional(), // Optional for SDK providers
  description: z.string().optional(),
  model: z.string().optional(),
  healthCheck: ConfigHealthCheckSchema.optional(),
  circuitBreaker: ConfigCircuitBreakerSchema.optional(),
  processManagement: ConfigProcessManagementSchema.optional(),
  versionDetection: ConfigVersionDetectionSchema.optional(),
  limitTracking: ConfigLimitTrackingSchema.optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Providers configuration map (Record keyed by provider name)
 * This matches the old working design: providers: { "claude-code": {...}, "gemini-cli": {...} }
 */
export const ProvidersConfigSchema = z.record(z.string(), ProviderConfigSchema);
export type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>;


// ============================================================================
// Execution Policy Schema
// ============================================================================

/**
 * Execution policy configuration
 */
export const ExecutionPolicySchema = z.object({
  defaultTimeoutMs: z.number().int().min(1000).max(600000).default(120000),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryDelayMs: z.number().int().min(100).max(60000).default(1000),
  enableParallelExecution: z.boolean().default(false),
});
export type ExecutionPolicy = z.infer<typeof ExecutionPolicySchema>;

// ============================================================================
// Feature Flags Schema
// ============================================================================

/**
 * Feature flags configuration
 */
export const FeatureFlagsSchema = z.object({
  enableTracing: z.boolean().default(true),
  enableMemoryPersistence: z.boolean().default(true),
  enableGuard: z.boolean().default(true),
  enableMetrics: z.boolean().default(false),
  experimentalFeatures: z.record(z.string(), z.boolean()).default({}),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

// ============================================================================
// Workspace Config Schema
// ============================================================================

/**
 * Workspace configuration
 */
export const WorkspaceConfigSchema = z.object({
  rootPath: z.string().optional(),
  dataDir: z.string().default('.automatosx'),
  memoryDbPath: z.string().default('memory.db'),
  traceDbPath: z.string().default('traces.db'),
  sessionDbPath: z.string().default('sessions.db'),
});
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

// ============================================================================
// User Preferences Schema
// ============================================================================

/**
 * User preferences configuration
 */
export const UserPreferencesSchema = z.object({
  colorOutput: z.boolean().default(true),
  verboseErrors: z.boolean().default(false),
  confirmDestructive: z.boolean().default(true),
  defaultOutputFormat: OutputFormatSchema.default('text'),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// ============================================================================
// Main Configuration Schema
// ============================================================================

/**
 * Main AutomatosX configuration
 */
export const AutomatosXConfigSchema = z.object({
  // Metadata
  version: z.string().default(CONFIG_VERSION),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),

  // Core settings
  logLevel: LogLevelSchema.default('info'),
  telemetryEnabled: z.boolean().default(false),

  // Provider configuration (Record keyed by provider name - matches old working design)
  providers: ProvidersConfigSchema.default({}),
  defaultProvider: z.string().optional(),

  // Execution settings
  executionPolicy: ExecutionPolicySchema.default({}),

  // Feature flags
  features: FeatureFlagsSchema.default({}),

  // Workspace settings
  workspace: WorkspaceConfigSchema.default({}),

  // User preferences
  preferences: UserPreferencesSchema.default({}),
});

export type AutomatosXConfig = z.infer<typeof AutomatosXConfigSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates configuration (throws on error)
 *
 * INV-CFG-CON-001: All config types derived from Zod schemas
 */
export function validateConfig(data: unknown): AutomatosXConfig {
  return AutomatosXConfigSchema.parse(data);
}

/**
 * Safely validates configuration (returns result)
 */
export function safeValidateConfig(
  data: unknown
): { success: true; data: AutomatosXConfig } | { success: false; error: z.ZodError } {
  const result = AutomatosXConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates config and returns array of error messages
 */
export function validateConfigWithErrors(
  data: unknown
): { valid: true; config: AutomatosXConfig } | { valid: false; errors: string[] } {
  const result = AutomatosXConfigSchema.safeParse(data);
  if (result.success) {
    return { valid: true, config: result.data };
  }
  return {
    valid: false,
    errors: result.error.errors.map(
      (e) => `${e.path.join('.')}: ${e.message}`
    ),
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration for new installations
 */
export const DEFAULT_CONFIG: AutomatosXConfig = {
  version: CONFIG_VERSION,
  logLevel: 'info',
  telemetryEnabled: false,

  providers: {
    'claude-code': {
      enabled: true,
      priority: 3,
      timeout: 2700000,
      command: 'claude',
      healthCheck: {
        enabled: true,
        interval: 300000,
        timeout: 5000,
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        recoveryTimeout: 60000,
      },
      processManagement: {
        gracefulShutdownTimeout: 5000,
        forceKillDelay: 1000,
      },
      versionDetection: {
        timeout: 5000,
        forceKillDelay: 1000,
        cacheEnabled: true,
      },
      limitTracking: {
        enabled: true,
        window: 'weekly',
        resetHourUtc: 0,
      },
    },
    'gemini-cli': {
      enabled: true,
      priority: 2,
      timeout: 2700000,
      command: 'gemini',
      healthCheck: {
        enabled: true,
        interval: 300000,
        timeout: 5000,
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        recoveryTimeout: 60000,
      },
      processManagement: {
        gracefulShutdownTimeout: 5000,
        forceKillDelay: 1000,
      },
      versionDetection: {
        timeout: 5000,
        forceKillDelay: 1000,
        cacheEnabled: true,
      },
      limitTracking: {
        enabled: true,
        window: 'daily',
        resetHourUtc: 0,
      },
    },
    openai: {
      enabled: true,
      priority: 1,
      timeout: 2700000,
      command: 'codex',
      healthCheck: {
        enabled: true,
        interval: 300000,
        timeout: 5000,
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        recoveryTimeout: 60000,
      },
      processManagement: {
        gracefulShutdownTimeout: 5000,
        forceKillDelay: 1000,
      },
      versionDetection: {
        timeout: 5000,
        forceKillDelay: 1000,
        cacheEnabled: true,
      },
      limitTracking: {
        enabled: true,
        window: 'daily',
        resetHourUtc: 0,
      },
    },
  },
  defaultProvider: 'claude-code',

  executionPolicy: {
    defaultTimeoutMs: 120000,
    maxRetries: 3,
    retryDelayMs: 1000,
    enableParallelExecution: false,
  },

  features: {
    enableTracing: true,
    enableMemoryPersistence: true,
    enableGuard: true,
    enableMetrics: false,
    experimentalFeatures: {},
  },

  workspace: {
    dataDir: '.automatosx',
    memoryDbPath: 'memory.db',
    traceDbPath: 'traces.db',
    sessionDbPath: 'sessions.db',
  },

  preferences: {
    colorOutput: true,
    verboseErrors: false,
    confirmDestructive: true,
    defaultOutputFormat: 'text',
  },
};
