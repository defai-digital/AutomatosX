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
import {
  DATA_DIR_NAME,
  MEMORY_DB_FILENAME,
  TRACE_DB_FILENAME,
  SESSION_DB_FILENAME,
  TIMEOUT_WORKFLOW_STEP,
  TIMEOUT_HEALTH_CHECK,
  TIMEOUT_GRACEFUL_SHUTDOWN,
  TIMEOUT_FORCE_KILL,
  TIMEOUT_AGENT_STEP_DEFAULT,
  TIMEOUT_AGENT_STEP_MIN,
  TIMEOUT_AGENT_STEP_MAX,
  INTERVAL_HEALTH_CHECK,
  CIRCUIT_RECOVERY_TIMEOUT,
  RETRY_MAX_DEFAULT,
  RETRY_DELAY_DEFAULT,
  PRIORITY_DEFAULT,
} from '../../constants.js';

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
  interval: z.number().int().min(1000).max(3600000).default(INTERVAL_HEALTH_CHECK),
  timeout: z.number().int().min(100).max(60000).default(TIMEOUT_HEALTH_CHECK),
});
export type ConfigHealthCheck = z.infer<typeof ConfigHealthCheckSchema>;

/**
 * Circuit breaker configuration for resilience (config file format)
 */
export const ConfigCircuitBreakerSchema = z.object({
  enabled: z.boolean().default(true),
  failureThreshold: z.number().int().min(1).max(10).default(3),
  recoveryTimeout: z.number().int().min(1000).max(600000).default(CIRCUIT_RECOVERY_TIMEOUT),
});
export type ConfigCircuitBreaker = z.infer<typeof ConfigCircuitBreakerSchema>;

/**
 * Process management configuration
 */
export const ConfigProcessManagementSchema = z.object({
  gracefulShutdownTimeout: z.number().int().min(1000).max(60000).default(TIMEOUT_GRACEFUL_SHUTDOWN),
  forceKillDelay: z.number().int().min(100).max(10000).default(TIMEOUT_FORCE_KILL),
});
export type ConfigProcessManagement = z.infer<typeof ConfigProcessManagementSchema>;

/**
 * Version detection configuration
 */
export const ConfigVersionDetectionSchema = z.object({
  timeout: z.number().int().min(1000).max(30000).default(TIMEOUT_HEALTH_CHECK),
  forceKillDelay: z.number().int().min(100).max(10000).default(TIMEOUT_FORCE_KILL),
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
  priority: z.number().int().min(1).max(100).default(PRIORITY_DEFAULT),
  timeout: z.number().int().min(1000).max(7200000).default(TIMEOUT_WORKFLOW_STEP),
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
  defaultTimeoutMs: z.number().int().min(TIMEOUT_AGENT_STEP_MIN).max(TIMEOUT_AGENT_STEP_MAX).default(TIMEOUT_AGENT_STEP_DEFAULT),
  maxRetries: z.number().int().min(0).max(10).default(RETRY_MAX_DEFAULT),
  retryDelayMs: z.number().int().min(100).max(60000).default(RETRY_DELAY_DEFAULT),
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
  dataDir: z.string().default(DATA_DIR_NAME),
  memoryDbPath: z.string().default(MEMORY_DB_FILENAME),
  traceDbPath: z.string().default(TRACE_DB_FILENAME),
  sessionDbPath: z.string().default(SESSION_DB_FILENAME),
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
// Monitor Configuration Schema
// ============================================================================

/**
 * Monitor (web dashboard) configuration
 */
export const MonitorConfigSchema = z.object({
  portMin: z.number().int().min(1024).max(65535).default(3000),
  portMax: z.number().int().min(1024).max(65535).default(3999),
  autoOpen: z.boolean().default(true),
});
export type MonitorConfig = z.infer<typeof MonitorConfigSchema>;

// ============================================================================
// Shadow Guard Configuration Schema
// ============================================================================

/**
 * Shadow Guard trigger pattern configuration
 */
export const ShadowGuardTriggerSchema = z.object({
  pattern: z.string().min(1),
  exclude: z.boolean().default(false),
});
export type ShadowGuardTrigger = z.infer<typeof ShadowGuardTriggerSchema>;

/**
 * Shadow Guard notifications configuration
 */
export const ShadowGuardNotificationsSchema = z.object({
  terminal: z.boolean().default(true),
  dashboard: z.boolean().default(true),
  sound: z.boolean().default(false),
});
export type ShadowGuardNotifications = z.infer<typeof ShadowGuardNotificationsSchema>;

/**
 * Shadow Guard auto-fix configuration
 */
export const ShadowGuardAutoFixSchema = z.object({
  enabled: z.boolean().default(false),
  requireApproval: z.boolean().default(true),
  maxAutoFixes: z.number().int().min(0).max(10).default(3),
});
export type ShadowGuardAutoFix = z.infer<typeof ShadowGuardAutoFixSchema>;

/**
 * Shadow Guard configuration for background policy enforcement
 * Stored in .automatosx/shadow-guard.yaml
 */
export const ShadowGuardConfigSchema = z.object({
  enabled: z.boolean().default(false),
  triggers: z.array(ShadowGuardTriggerSchema).default([
    { pattern: '**/*.ts' },
    { pattern: '**/*.tsx' },
    { pattern: '**/*.js' },
    { pattern: '**/*.jsx' },
    { pattern: '**/node_modules/**', exclude: true },
    { pattern: '**/dist/**', exclude: true },
  ]),
  debounceMs: z.number().int().min(500).max(10000).default(2000),
  policies: z.array(z.string()).default(['project-rules']),
  focusAreas: z.array(z.enum(['security', 'architecture', 'performance', 'maintainability', 'correctness'])).default(['security']),
  minConfidence: z.number().min(0).max(1).default(0.8),
  notifications: ShadowGuardNotificationsSchema.default({}),
  autoFix: ShadowGuardAutoFixSchema.default({}),
});
export type ShadowGuardConfig = z.infer<typeof ShadowGuardConfigSchema>;

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

  // Monitor (web dashboard) settings
  monitor: MonitorConfigSchema.default({}),
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
      timeout: TIMEOUT_WORKFLOW_STEP,
      command: 'claude',
      healthCheck: {
        enabled: true,
        interval: INTERVAL_HEALTH_CHECK,
        timeout: TIMEOUT_HEALTH_CHECK,
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: RETRY_MAX_DEFAULT,
        recoveryTimeout: CIRCUIT_RECOVERY_TIMEOUT,
      },
      processManagement: {
        gracefulShutdownTimeout: TIMEOUT_GRACEFUL_SHUTDOWN,
        forceKillDelay: TIMEOUT_FORCE_KILL,
      },
      versionDetection: {
        timeout: TIMEOUT_HEALTH_CHECK,
        forceKillDelay: TIMEOUT_FORCE_KILL,
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
      timeout: TIMEOUT_WORKFLOW_STEP,
      command: 'gemini',
      healthCheck: {
        enabled: true,
        interval: INTERVAL_HEALTH_CHECK,
        timeout: TIMEOUT_HEALTH_CHECK,
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: RETRY_MAX_DEFAULT,
        recoveryTimeout: CIRCUIT_RECOVERY_TIMEOUT,
      },
      processManagement: {
        gracefulShutdownTimeout: TIMEOUT_GRACEFUL_SHUTDOWN,
        forceKillDelay: TIMEOUT_FORCE_KILL,
      },
      versionDetection: {
        timeout: TIMEOUT_HEALTH_CHECK,
        forceKillDelay: TIMEOUT_FORCE_KILL,
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
      timeout: TIMEOUT_WORKFLOW_STEP,
      command: 'codex',
      healthCheck: {
        enabled: true,
        interval: INTERVAL_HEALTH_CHECK,
        timeout: TIMEOUT_HEALTH_CHECK,
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: RETRY_MAX_DEFAULT,
        recoveryTimeout: CIRCUIT_RECOVERY_TIMEOUT,
      },
      processManagement: {
        gracefulShutdownTimeout: TIMEOUT_GRACEFUL_SHUTDOWN,
        forceKillDelay: TIMEOUT_FORCE_KILL,
      },
      versionDetection: {
        timeout: TIMEOUT_HEALTH_CHECK,
        forceKillDelay: TIMEOUT_FORCE_KILL,
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
    defaultTimeoutMs: TIMEOUT_AGENT_STEP_DEFAULT,
    maxRetries: RETRY_MAX_DEFAULT,
    retryDelayMs: RETRY_DELAY_DEFAULT,
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
    dataDir: DATA_DIR_NAME,
    memoryDbPath: MEMORY_DB_FILENAME,
    traceDbPath: TRACE_DB_FILENAME,
    sessionDbPath: SESSION_DB_FILENAME,
  },

  preferences: {
    colorOutput: true,
    verboseErrors: false,
    confirmDestructive: true,
    defaultOutputFormat: 'text',
  },

  monitor: {
    portMin: 3000,
    portMax: 3999,
    autoOpen: true,
  },
};
