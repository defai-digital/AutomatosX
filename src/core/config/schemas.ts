/**
 * Zod Schemas for AutomatosX Configuration Validation
 *
 * Provides runtime type validation for configuration files using Zod.
 * Ensures all config values are valid before use, preventing runtime errors.
 *
 * Benefits over manual validation:
 * - Type inference from schemas (no type duplication)
 * - Better error messages with exact path and issue
 * - Composable schemas with transformers and refinements
 * - Automatic coercion (strings to numbers, etc.)
 */

import { z } from 'zod';
import { VALIDATION_LIMITS } from '../validation-limits.js';

// ========================================
// Helper Schemas
// ========================================

/**
 * Provider name whitelist for security
 * Prevents command injection via provider names
 * v12.0.0: Removed 'ax-cli' (deprecated), added native 'glm' and 'grok' providers
 */
export const providerNameSchema = z.enum([
  'claude',
  'claude-code',
  'gemini',
  'gemini-cli',
  'openai',
  'codex',
  'glm',           // v12.0.0: Native GLM provider (Zhipu AI)
  'ax-glm',        // v12.0.0: Alias for glm
  'grok',          // v12.0.0: Native Grok provider (xAI)
  'ax-grok',       // v12.0.0: Alias for grok
  'test-provider'
]).describe('Provider name (whitelisted for security)');

/**
 * Command name schema for CLI commands
 * Prevents command injection via shell metacharacters
 */
const commandSchema = z.string()
  .min(1, 'command is required')
  .max(VALIDATION_LIMITS.MAX_COMMAND_LENGTH)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Command must be alphanumeric with dash/underscore only (prevents command injection)'
  )
  .describe('CLI command name');

/**
 * Safe name schema for identifiers
 * Prevents name injection attacks
 */
const safeNameSchema = z.string()
  .min(1)
  .max(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Name must be alphanumeric with dash/underscore only'
  )
  .describe('Safe identifier name');

/**
 * Relative path schema (prevents path traversal)
 */
const relativePathSchema = z.string()
  .min(1)
  .refine(
    (path) => !path.includes('..') && !path.startsWith('/'),
    'Path must be relative (no ../, no absolute paths)'
  )
  .describe('Relative path within project');

/**
 * File extension schema
 */
const fileExtensionSchema = z.string()
  .regex(
    /^\.[a-zA-Z0-9]{1,10}$/,
    'Extension must start with dot and be alphanumeric (max 10 chars)'
  )
  .describe('File extension');

/**
 * Positive integer schema
 */
const positiveIntSchema = z.number()
  .int()
  .positive('must be a positive integer')
  .describe('Positive integer');

/**
 * Non-negative integer schema
 */
const nonNegativeIntSchema = z.number()
  .int()
  .nonnegative()
  .describe('Non-negative integer');

/**
 * Timeout schema (with min/max validation)
 */
const timeoutSchema = z.number()
  .int()
  .min(VALIDATION_LIMITS.MIN_TIMEOUT, `Timeout must be >= ${VALIDATION_LIMITS.MIN_TIMEOUT}ms`)
  .max(VALIDATION_LIMITS.MAX_TIMEOUT, `Timeout must be <= ${VALIDATION_LIMITS.MAX_TIMEOUT}ms`)
  .describe('Timeout in milliseconds');

/**
 * Interval schema (with min validation)
 */
const intervalSchema = z.number()
  .int()
  .min(VALIDATION_LIMITS.MIN_INTERVAL, `Interval must be >= ${VALIDATION_LIMITS.MIN_INTERVAL}ms`)
  .max(VALIDATION_LIMITS.MAX_TIMEOUT, `Interval must be <= ${VALIDATION_LIMITS.MAX_TIMEOUT}ms`)
  .describe('Interval in milliseconds');

// ========================================
// Provider Configuration Schemas
// ========================================

const healthCheckConfigSchema = z.object({
  enabled: z.boolean().default(true),
  interval: intervalSchema,
  timeout: timeoutSchema.min(100, 'Health check timeout must be >= 100ms')
}).describe('Health check configuration');

const circuitBreakerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  failureThreshold: z.number().int().min(1).max(10).default(3),
  recoveryTimeout: timeoutSchema
}).describe('Circuit breaker configuration');

const processManagementConfigSchema = z.object({
  gracefulShutdownTimeout: timeoutSchema,
  forceKillDelay: positiveIntSchema
}).describe('Process management configuration');

const versionDetectionConfigSchema = z.object({
  timeout: timeoutSchema,
  forceKillDelay: positiveIntSchema,
  cacheEnabled: z.boolean().default(true)
}).describe('Version detection configuration');

const limitTrackingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  window: z.enum(['daily', 'weekly', 'custom']).default('daily'),
  resetHourUtc: z.number().int().min(0).max(23).default(0),
  customResetMs: positiveIntSchema.optional()
}).describe('Provider limit tracking configuration');

/**
 * Provider type for SDK-based providers
 * v12.0.0: Added for GLM and Grok providers that use SDK instead of CLI
 */
const providerTypeSchema = z.enum(['cli', 'sdk', 'hybrid']).default('cli');

const providerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  priority: positiveIntSchema,
  timeout: timeoutSchema,
  type: providerTypeSchema.optional(),
  command: commandSchema.optional(),  // Optional for SDK providers (glm, grok)
  description: z.string().optional(),  // Provider description
  model: z.string().optional(),  // Model name override
  healthCheck: healthCheckConfigSchema.optional(),
  circuitBreaker: circuitBreakerConfigSchema.optional(),
  processManagement: processManagementConfigSchema.optional(),
  versionDetection: versionDetectionConfigSchema.optional(),
  limitTracking: limitTrackingConfigSchema.optional()
}).refine(
  (data) => {
    // CLI and hybrid providers require a command
    // SDK providers don't need a command
    if (data.type === 'sdk') {
      return true;  // SDK providers don't need command
    }
    return data.command !== undefined;  // CLI/hybrid providers need command
  },
  {
    message: 'CLI and hybrid providers require a command field',
    path: ['command']
  }
).describe('Provider configuration');

const providersConfigSchema = z.record(
  safeNameSchema,
  providerConfigSchema
).describe('Providers configuration map');

// ========================================
// Execution Configuration Schemas
// ========================================

const retryConfigSchema = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(3),
  initialDelay: nonNegativeIntSchema.max(VALIDATION_LIMITS.MAX_TIMEOUT),
  maxDelay: timeoutSchema,
  backoffFactor: z.number()
    .min(VALIDATION_LIMITS.MIN_BACKOFF_FACTOR)
    .max(VALIDATION_LIMITS.MAX_BACKOFF_FACTOR)
    .default(2),
  retryableErrors: z.array(z.string()).max(VALIDATION_LIMITS.MAX_ARRAY_LENGTH).optional()
}).refine(
  (data) => data.maxDelay >= data.initialDelay,
  'maxDelay must be >= initialDelay'
).describe('Retry configuration');

const providerExecutionConfigSchema = z.object({
  maxWaitMs: timeoutSchema
}).describe('Provider execution configuration');

const concurrencyConfigSchema = z.object({
  maxConcurrentAgents: z.number()
    .int()
    .min(1)
    .max(VALIDATION_LIMITS.MAX_CONCURRENT_AGENTS)
    .optional(),
  autoDetect: z.boolean().default(false),
  cpuMultiplier: z.number().min(0.1).max(10).default(1),
  minConcurrency: positiveIntSchema.default(2),
  maxConcurrency: positiveIntSchema.max(VALIDATION_LIMITS.MAX_CONCURRENT_AGENTS).default(16)
}).describe('Concurrency configuration');

const stagesConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultTimeout: timeoutSchema.default(1800000),
  checkpointPath: relativePathSchema.default('.automatosx/checkpoints'),
  autoSaveCheckpoint: z.boolean().default(true),
  cleanupAfterDays: positiveIntSchema.max(365).default(7),
  retry: z.object({
    defaultMaxRetries: nonNegativeIntSchema.default(1),
    defaultRetryDelay: positiveIntSchema.default(2000)
  }).optional(),
  prompts: z.object({
    timeout: timeoutSchema.default(600000),
    autoConfirm: z.boolean().default(false),
    locale: z.string().default('en')
  }).optional(),
  progress: z.object({
    updateInterval: positiveIntSchema.default(2000),
    syntheticProgress: z.boolean().default(true)
  }).optional()
}).describe('Stages configuration');

const executionConfigSchema = z.object({
  defaultTimeout: timeoutSchema,
  concurrency: concurrencyConfigSchema.optional(),
  retry: retryConfigSchema,
  provider: providerExecutionConfigSchema,
  stages: stagesConfigSchema.optional()
}).describe('Execution configuration');

// ========================================
// Orchestration Configuration Schemas
// ========================================

const sessionConfigSchema = z.object({
  maxSessions: positiveIntSchema.max(VALIDATION_LIMITS.MAX_SESSIONS),
  maxMetadataSize: positiveIntSchema
    .min(VALIDATION_LIMITS.MIN_BYTES)
    .max(VALIDATION_LIMITS.MAX_FILE_SIZE),
  saveDebounce: nonNegativeIntSchema.max(VALIDATION_LIMITS.MAX_TIMEOUT),
  cleanupAfterDays: positiveIntSchema.max(365),
  maxUuidAttempts: positiveIntSchema.max(1000),
  persistPath: relativePathSchema
}).describe('Session configuration');

const delegationConfigSchema = z.object({
  maxDepth: positiveIntSchema.max(5, 'Delegation depth limited to 5 to prevent deep chains'),
  timeout: timeoutSchema,
  enableCycleDetection: z.boolean().default(true)
}).describe('Delegation configuration');

const orchestrationConfigSchema = z.object({
  session: sessionConfigSchema,
  delegation: delegationConfigSchema
}).describe('Orchestration configuration');

// ========================================
// Memory Configuration Schemas
// ========================================

const memorySearchConfigSchema = z.object({
  defaultLimit: positiveIntSchema.max(1000),
  maxLimit: positiveIntSchema.max(10000),
  timeout: timeoutSchema.min(100)
}).refine(
  (data) => data.maxLimit >= data.defaultLimit,
  'maxLimit must be >= defaultLimit'
).describe('Memory search configuration');

const memoryConfigSchema = z.object({
  maxEntries: positiveIntSchema.max(VALIDATION_LIMITS.MAX_ENTRIES),
  persistPath: relativePathSchema.default('.automatosx/memory'),
  autoCleanup: z.boolean().default(true),
  cleanupDays: positiveIntSchema.max(365).default(30),
  busyTimeout: positiveIntSchema.default(5000),
  search: memorySearchConfigSchema.optional()
}).describe('Memory configuration');

// ========================================
// Abilities Configuration Schemas
// ========================================

const abilitiesCacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxEntries: positiveIntSchema.max(1000),
  ttl: intervalSchema.max(VALIDATION_LIMITS.MAX_TTL),
  maxSize: positiveIntSchema
    .min(VALIDATION_LIMITS.MIN_BYTES)
    .max(VALIDATION_LIMITS.MAX_CACHE_SIZE),
  cleanupInterval: intervalSchema
}).describe('Abilities cache configuration');

const abilitiesLimitsConfigSchema = z.object({
  maxFileSize: positiveIntSchema
    .min(VALIDATION_LIMITS.MIN_FILE_SIZE)
    .max(VALIDATION_LIMITS.MAX_FILE_SIZE)
}).describe('Abilities limits configuration');

const abilitiesConfigSchema = z.object({
  basePath: relativePathSchema,
  fallbackPath: relativePathSchema,
  cache: abilitiesCacheConfigSchema,
  limits: abilitiesLimitsConfigSchema
}).describe('Abilities configuration');

// ========================================
// Workspace Configuration Schemas
// ========================================

const workspaceConfigSchema = z.object({
  prdPath: z.string().min(1),
  tmpPath: z.string().min(1),
  autoCleanupTmp: z.boolean().default(true),
  tmpCleanupDays: positiveIntSchema.max(365)
}).describe('Workspace configuration');

// ========================================
// Logging Configuration Schemas
// ========================================

const loggingRetentionConfigSchema = z.object({
  maxSizeBytes: positiveIntSchema
    .min(VALIDATION_LIMITS.MIN_BYTES)
    .max(VALIDATION_LIMITS.MAX_FILE_SIZE * 10),
  maxAgeDays: positiveIntSchema.max(365),
  compress: z.boolean().default(true)
}).describe('Logging retention configuration');

const loggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  path: relativePathSchema,
  console: z.boolean().default(true),
  retention: loggingRetentionConfigSchema.optional()
}).describe('Logging configuration');

// ========================================
// Performance Configuration Schemas
// ========================================

const cacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxEntries: positiveIntSchema.max(10000),
  ttl: intervalSchema.max(VALIDATION_LIMITS.MAX_TTL),
  cleanupInterval: intervalSchema
}).describe('Cache configuration');

const adaptiveCacheConfigSchema = z.object({
  maxEntries: positiveIntSchema.max(10000),
  baseTTL: intervalSchema,
  minTTL: intervalSchema,
  maxTTL: intervalSchema.max(VALIDATION_LIMITS.MAX_TTL),
  adaptiveMultiplier: z.number().min(1).max(10),
  lowFreqDivisor: z.number().min(1).max(10),
  frequencyThreshold: positiveIntSchema,
  cleanupInterval: intervalSchema
}).refine(
  (data) => data.maxTTL >= data.baseTTL && data.baseTTL >= data.minTTL,
  'TTL order must be: minTTL <= baseTTL <= maxTTL'
).describe('Adaptive cache configuration');

const responseCacheConfigSchema = z.object({
  enabled: z.boolean().default(false),
  ttl: positiveIntSchema,
  maxSize: positiveIntSchema,
  maxMemorySize: positiveIntSchema,
  dbPath: relativePathSchema
}).describe('Response cache configuration');

const rateLimitConfigSchema = z.object({
  enabled: z.boolean().default(false),
  requestsPerMinute: positiveIntSchema.max(1000),
  burstSize: positiveIntSchema.max(100)
}).describe('Rate limit configuration');

const performanceConfigSchema = z.object({
  profileCache: cacheConfigSchema,
  teamCache: cacheConfigSchema,
  providerCache: cacheConfigSchema,
  adaptiveCache: adaptiveCacheConfigSchema,
  responseCache: responseCacheConfigSchema.optional(),
  rateLimit: rateLimitConfigSchema.optional()
}).describe('Performance configuration');

// ========================================
// Advanced Configuration Schemas
// ========================================

const embeddingConfigSchema = z.object({
  timeout: timeoutSchema,
  retryDelay: positiveIntSchema,
  dimensions: positiveIntSchema.max(10000),
  maxRetries: nonNegativeIntSchema.max(10)
}).describe('Embedding configuration');

const securityConfigSchema = z.object({
  enablePathValidation: z.boolean().default(true),
  allowedExtensions: z.array(fileExtensionSchema)
    .max(VALIDATION_LIMITS.MAX_ARRAY_LENGTH)
    .optional()
}).describe('Security configuration');

const developmentConfigSchema = z.object({
  mockProviders: z.boolean().default(false),
  profileMode: z.boolean().default(false)
}).describe('Development configuration');

const advancedConfigSchema = z.object({
  embedding: embeddingConfigSchema.optional(),
  security: securityConfigSchema.optional(),
  development: developmentConfigSchema.optional()
}).describe('Advanced configuration');

// ========================================
// Integration Configuration Schemas
// ========================================

const vscodeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  apiPort: z.number()
    .int()
    .min(VALIDATION_LIMITS.MIN_PORT)
    .max(VALIDATION_LIMITS.MAX_PORT),
  autoStart: z.boolean().default(true),
  outputPanel: z.boolean().default(true),
  notifications: z.boolean().default(true)
}).describe('VSCode integration configuration');

const integrationConfigSchema = z.object({
  vscode: vscodeConfigSchema.optional()
}).describe('Integration configuration');

// ========================================
// CLI Configuration Schemas
// ========================================

const cliRunConfigSchema = z.object({
  defaultMemory: z.boolean().default(true),
  defaultSaveMemory: z.boolean().default(true),
  defaultFormat: z.enum(['text', 'json']).default('text'),
  defaultVerbose: z.boolean().default(false)
}).describe('CLI run configuration');

const cliSessionConfigSchema = z.object({
  defaultShowAgents: z.boolean().default(true)
}).describe('CLI session configuration');

const cliMemoryConfigSchema = z.object({
  defaultLimit: positiveIntSchema.default(10)
}).describe('CLI memory configuration');

const cliConfigSchema = z.object({
  run: cliRunConfigSchema.optional(),
  session: cliSessionConfigSchema.optional(),
  memory: cliMemoryConfigSchema.optional()
}).describe('CLI configuration');

// ========================================
// Router Configuration Schemas
// ========================================

const routerConfigSchema = z.object({
  healthCheckInterval: intervalSchema,
  providerCooldownMs: positiveIntSchema,
  circuitBreakerThreshold: positiveIntSchema.max(10).optional(),  // v8.3.2: Make optional to match interface
  enableFreeTierPrioritization: z.boolean().default(true),
  enableWorkloadAwareRouting: z.boolean().default(true)
}).describe('Router configuration');

// ========================================
// Main Configuration Schema
// ========================================

/**
 * Complete AutomatosX configuration schema
 *
 * This is the master schema that validates the entire configuration.
 * Use this for loading and validating automatosx.config.json files.
 *
 * Note: Most fields are optional because they have defaults in DEFAULT_CONFIG.
 * Only validate what the user provides.
 */
export const automatosXConfigSchema = z.object({
  providers: providersConfigSchema.optional(),
  execution: executionConfigSchema.optional(),
  orchestration: orchestrationConfigSchema.optional(),
  memory: memoryConfigSchema.optional(),
  abilities: abilitiesConfigSchema.optional(),
  workspace: workspaceConfigSchema.optional(),
  logging: loggingConfigSchema.optional(),
  performance: performanceConfigSchema.optional(),
  advanced: advancedConfigSchema.optional(),
  integration: integrationConfigSchema.optional(),
  cli: cliConfigSchema.optional(),
  router: routerConfigSchema.optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format (x.y.z)').optional()
}).describe('AutomatosX configuration');

// Export type inference from schema
export type AutomatosXConfigZod = z.infer<typeof automatosXConfigSchema>;

// ========================================
// Validation Helper Functions
// ========================================

/**
 * Validate configuration with detailed error messages
 *
 * @param config - Configuration object to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateConfigWithZod(config: unknown): string[] {
  const result = automatosXConfigSchema.safeParse(config);
  if (result.success) {
    return [];
  }
  // Note: Zod v3.x uses 'issues' instead of 'errors'
  return result.error.issues.map(err => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}

/**
 * Safely validate configuration (returns result object instead of throwing)
 *
 * @param config - Configuration object to validate
 * @returns Success or error result
 */
export function safeValidateConfig(config: unknown) {
  return automatosXConfigSchema.safeParse(config);
}

/**
 * Partial validation (for updates)
 *
 * Allows validating partial configuration objects for incremental updates.
 *
 * NOTE: Zod's .partial() only makes top-level fields optional, not nested ones.
 * Nested objects now have defaults for required fields (e.g., memory.persistPath, memory.cleanupDays)
 * to enable partial updates.
 */
export const partialConfigSchema = automatosXConfigSchema.partial().passthrough();

/**
 * Validate partial configuration
 *
 * @param config - Partial configuration object
 * @returns Validation result
 */
export function validatePartialConfig(config: unknown) {
  return partialConfigSchema.safeParse(config);
}
