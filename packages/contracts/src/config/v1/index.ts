/**
 * Configuration Contract V1
 *
 * Re-exports all configuration schemas, types, and utilities.
 */

// Main configuration schema
export {
  // Constants
  CONFIG_VERSION,
  // Schemas
  LogLevelSchema,
  OutputFormatSchema,
  ConfigScopeSchema,
  ConfigReadScopeSchema,
  // Provider configuration schemas (matches old working design)
  // Note: Prefixed with "Config" to avoid conflicts with provider/v1 runtime schemas
  ConfigHealthCheckSchema,
  ConfigCircuitBreakerSchema,
  ConfigProcessManagementSchema,
  ConfigVersionDetectionSchema,
  ConfigLimitTrackingSchema,
  ConfigProviderTypeSchema,
  ProviderConfigSchema,
  ProvidersConfigSchema,
  ExecutionPolicySchema,
  FeatureFlagsSchema,
  WorkspaceConfigSchema,
  UserPreferencesSchema,
  MonitorConfigSchema,
  // Shadow Guard configuration schemas
  ShadowGuardTriggerSchema,
  ShadowGuardNotificationsSchema,
  ShadowGuardAutoFixSchema,
  ShadowGuardConfigSchema,
  AutomatosXConfigSchema,
  // Types
  type LogLevel,
  type OutputFormat,
  type ConfigScope,
  type ConfigReadScope,
  // Provider configuration types
  type ConfigHealthCheck,
  type ConfigCircuitBreaker,
  type ConfigProcessManagement,
  type ConfigVersionDetection,
  type ConfigLimitTracking,
  type ConfigProviderType,
  type ProviderConfig,
  type ProvidersConfig,
  type ExecutionPolicy,
  type FeatureFlags,
  type WorkspaceConfig,
  type UserPreferences,
  type MonitorConfig,
  // Shadow Guard types
  type ShadowGuardTrigger,
  type ShadowGuardNotifications,
  type ShadowGuardAutoFix,
  type ShadowGuardConfig,
  type AutomatosXConfig,
  // Functions
  validateConfig,
  safeValidateConfig,
  validateConfigWithErrors,
  // Defaults
  DEFAULT_CONFIG,
} from './config.js';

// Provider configuration schema
export {
  // Constants
  KNOWN_PROVIDERS,
  PROVIDER_DEFAULTS,
  // Schemas
  ProviderIdSchema,
  ProviderDetectionResultSchema,
  ProviderDetectionSummarySchema,
  // Types
  type ProviderId,
  type ProviderDetectionResult,
  type ProviderDetectionSummary,
  type ProviderDefault,
  // Functions
  isKnownProvider,
  getProviderDefault,
  createEmptyDetectionResult,
  createDetectionSummary,
} from './provider-config.js';

// Event schemas
export {
  // Constants
  CONFIG_TRANSITIONS,
  // Schemas
  ConfigStatusSchema,
  ConfigEventTypeSchema,
  ConfigBaseEventSchema,
  ConfigCreatedPayloadSchema,
  ConfigUpdatedPayloadSchema,
  ConfigResetPayloadSchema,
  ConfigMigratedPayloadSchema,
  ConfigDeletedPayloadSchema,
  ConfigValidationFailedPayloadSchema,
  ConfigEventPayloadSchema,
  ConfigEventSchema,
  // Types
  type ConfigStatus,
  type ConfigEventType,
  type ConfigBaseEvent,
  type ConfigEventPayload,
  type ConfigEvent,
  // Functions
  isValidConfigTransition,
  createConfigEvent,
  createConfigCreatedEvent,
  createConfigUpdatedEvent,
  createConfigResetEvent,
  createConfigMigratedEvent,
  createConfigDeletedEvent,
  createConfigValidationFailedEvent,
} from './events.js';

// Operation schemas
export {
  // Schemas
  SetupInputSchema,
  SetupOutputSchema,
  ConfigGetInputSchema,
  ConfigGetOutputSchema,
  ConfigSetInputSchema,
  ConfigSetOutputSchema,
  ConfigShowInputSchema,
  ConfigShowOutputSchema,
  ConfigResetInputSchema,
  ConfigResetOutputSchema,
  ConfigPathOutputSchema,
  DetectProvidersInputSchema,
  // Types
  type SetupInput,
  type SetupOutput,
  type ConfigGetInput,
  type ConfigGetOutput,
  type ConfigSetInput,
  type ConfigSetOutput,
  type ConfigShowInput,
  type ConfigShowOutput,
  type ConfigResetInput,
  type ConfigResetOutput,
  type ConfigPathOutput,
  type DetectProvidersInput,
  // Functions
  validateSetupInput,
  validateConfigGetInput,
  validateConfigSetInput,
  validateConfigResetInput,
} from './operations.js';

// Error codes and error class
export {
  // Constants
  ConfigErrorCode,
  CONFIG_ERROR_HINTS,
  // Types
  type ConfigErrorCode as ConfigErrorCodeType,
  // Class
  ConfigError,
  // Functions
  getRecoveryHint,
  configNotFoundError,
  configValidationError,
  providerNotDetectedError,
  providerNotAuthenticatedError,
  configInvalidTransitionError,
  configPathNotFoundError,
  isConfigError,
} from './errors.js';
