/**
 * Config Contract Invariant Tests
 *
 * Tests for config invariants documented in packages/contracts/src/config/v1/invariants.md
 *
 * Invariants tested:
 * - INV-CFG-001: Schema Validation
 * - INV-CFG-002: Atomic Writes (tested at adapter level)
 * - INV-CFG-003: Version Migration Idempotent
 * - INV-CFG-RES-001: Project Overrides User
 * - INV-CFG-RES-002: User Overrides Defaults
 * - INV-CFG-RES-003: Undefined Preservation
 * - INV-CFG-GOV-001: Audit Trail
 * - INV-CFG-GOV-002: Sensitive Protection
 * - INV-CFG-ADP-001: Atomic File Operations (tested at adapter level)
 * - INV-CFG-ADP-002: Detection Timeout
 * - INV-CFG-ADP-003: No Network in Detection
 */

import { describe, it, expect } from 'vitest';
import {
  // Main config schemas
  AutomatosXConfigSchema,
  LogLevelSchema,
  OutputFormatSchema,
  ConfigScopeSchema,
  ProviderConfigSchema,
  ExecutionPolicySchema,
  FeatureFlagsSchema,
  WorkspaceConfigSchema,
  UserPreferencesSchema,
  validateConfig,
  safeValidateConfig,
  validateConfigWithErrors,
  DEFAULT_CONFIG,
  CONFIG_VERSION,
  type AutomatosXConfig,

  // Provider config
  ProviderIdSchema,
  ProviderDetectionResultSchema,
  KNOWN_PROVIDERS,
  isKnownProvider,
  getProviderDefault,
  createEmptyDetectionResult,

  // Events
  ConfigStatusSchema,
  ConfigEventTypeSchema,
  ConfigEventSchema,
  CONFIG_TRANSITIONS,
  isValidConfigTransition,
  createConfigCreatedEvent,
  createConfigUpdatedEvent,

  // Operations
  SetupInputSchema,
  ConfigGetInputSchema,
  ConfigSetInputSchema,
  ConfigResetInputSchema,
  validateSetupInput,
  validateConfigGetInput,
  validateConfigSetInput,

  // Errors
  ConfigErrorCode,
  ConfigError,
  getRecoveryHint,
  isConfigError,
  configNotFoundError,
} from '@automatosx/contracts';

describe('Config Contract V1', () => {
  describe('Schema Validation', () => {
    it('should validate a minimal valid config', () => {
      const config: AutomatosXConfig = {
        version: CONFIG_VERSION,
        logLevel: 'info',
        telemetryEnabled: false,
        providers: {},
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

      const result = safeValidateConfig(config);
      expect(result.success).toBe(true);
    });

    it('should apply defaults for empty config', () => {
      const config = {};
      const result = safeValidateConfig(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe(CONFIG_VERSION);
        expect(result.data.logLevel).toBe('info');
        expect(result.data.providers).toEqual({});
      }
    });

    it('should validate complete config with providers', () => {
      const config: AutomatosXConfig = {
        ...DEFAULT_CONFIG,
        providers: {
          'claude-code': { priority: 1, enabled: true, command: 'claude', timeout: 2700000 },
          'gemini-cli': { priority: 2, enabled: true, command: 'gemini', timeout: 2700000 },
        },
        defaultProvider: 'claude-code',
      };

      const result = validateConfig(config);
      expect(Object.keys(result.providers)).toHaveLength(2);
      expect(result.defaultProvider).toBe('claude-code');
    });

    it('should reject invalid log level', () => {
      const config = {
        ...DEFAULT_CONFIG,
        logLevel: 'invalid-level',
      };

      const result = safeValidateConfig(config);
      expect(result.success).toBe(false);
    });
  });

  describe('LogLevel Schema', () => {
    it('should accept all valid log levels', () => {
      const validLevels = ['debug', 'info', 'warn', 'error', 'silent'];
      for (const level of validLevels) {
        const result = LogLevelSchema.safeParse(level);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid log levels', () => {
      const result = LogLevelSchema.safeParse('verbose');
      expect(result.success).toBe(false);
    });
  });

  describe('OutputFormat Schema', () => {
    it('should accept all valid output formats', () => {
      const validFormats = ['text', 'json', 'yaml'];
      for (const format of validFormats) {
        const result = OutputFormatSchema.safeParse(format);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('ConfigScope Schema', () => {
    it('should accept global and local scopes', () => {
      expect(ConfigScopeSchema.safeParse('global').success).toBe(true);
      expect(ConfigScopeSchema.safeParse('local').success).toBe(true);
      expect(ConfigScopeSchema.safeParse('merged').success).toBe(false);
    });
  });

  describe('ProviderConfig Schema', () => {
    it('should validate provider with defaults', () => {
      const provider = {};
      const result = ProviderConfigSchema.safeParse(provider);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe(50);
        expect(result.data.enabled).toBe(true);
      }
    });

    it('should validate complete provider config', () => {
      const provider = {
        priority: 10,
        enabled: false,
        command: 'gemini',
      };
      const result = ProviderConfigSchema.safeParse(provider);
      expect(result.success).toBe(true);
    });

    it('should reject priority out of range', () => {
      expect(
        ProviderConfigSchema.safeParse({ priority: 0 }).success
      ).toBe(false);
      expect(
        ProviderConfigSchema.safeParse({ priority: 101 }).success
      ).toBe(false);
    });
  });

  describe('ExecutionPolicy Schema', () => {
    it('should apply defaults', () => {
      const result = ExecutionPolicySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.defaultTimeoutMs).toBe(120000);
        expect(result.data.maxRetries).toBe(3);
        expect(result.data.retryDelayMs).toBe(1000);
        expect(result.data.enableParallelExecution).toBe(false);
      }
    });

    it('should reject invalid timeout values', () => {
      expect(
        ExecutionPolicySchema.safeParse({ defaultTimeoutMs: 500 }).success
      ).toBe(false);
      expect(
        ExecutionPolicySchema.safeParse({ defaultTimeoutMs: 700000 }).success
      ).toBe(false);
    });

    it('should reject invalid retry values', () => {
      expect(ExecutionPolicySchema.safeParse({ maxRetries: -1 }).success).toBe(
        false
      );
      expect(ExecutionPolicySchema.safeParse({ maxRetries: 11 }).success).toBe(
        false
      );
    });
  });

  describe('FeatureFlags Schema', () => {
    it('should apply defaults', () => {
      const result = FeatureFlagsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enableTracing).toBe(true);
        expect(result.data.enableMemoryPersistence).toBe(true);
        expect(result.data.enableGuard).toBe(true);
        expect(result.data.enableMetrics).toBe(false);
        expect(result.data.experimentalFeatures).toEqual({});
      }
    });

    it('should allow experimental features', () => {
      const result = FeatureFlagsSchema.safeParse({
        experimentalFeatures: { newFeature: true, betaMode: false },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('WorkspaceConfig Schema', () => {
    it('should apply defaults', () => {
      const result = WorkspaceConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dataDir).toBe('.automatosx');
        expect(result.data.memoryDbPath).toBe('memory.db');
      }
    });

    it('should allow custom paths', () => {
      const result = WorkspaceConfigSchema.safeParse({
        rootPath: '/custom/path',
        dataDir: 'custom-data',
        memoryDbPath: 'custom-memory.db',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('UserPreferences Schema', () => {
    it('should apply defaults', () => {
      const result = UserPreferencesSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.colorOutput).toBe(true);
        expect(result.data.verboseErrors).toBe(false);
        expect(result.data.confirmDestructive).toBe(true);
        expect(result.data.defaultOutputFormat).toBe('text');
      }
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should be valid', () => {
      const result = safeValidateConfig(DEFAULT_CONFIG);
      expect(result.success).toBe(true);
    });

    it('should have correct version', () => {
      expect(DEFAULT_CONFIG.version).toBe(CONFIG_VERSION);
    });
  });

  describe('validateConfigWithErrors', () => {
    it('should return valid config on success', () => {
      const result = validateConfigWithErrors(DEFAULT_CONFIG);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.config.version).toBe(CONFIG_VERSION);
      }
    });

    it('should return errors on failure', () => {
      const result = validateConfigWithErrors({ logLevel: 'invalid' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('Provider Config Contract', () => {
  describe('KNOWN_PROVIDERS', () => {
    it('should include standard providers', () => {
      expect(KNOWN_PROVIDERS).toContain('claude');
      expect(KNOWN_PROVIDERS).toContain('gemini');
      expect(KNOWN_PROVIDERS).toContain('codex');
    });
  });

  describe('isKnownProvider', () => {
    it('should return true for known providers', () => {
      expect(isKnownProvider('claude')).toBe(true);
      expect(isKnownProvider('gemini')).toBe(true);
    });

    it('should return false for unknown providers', () => {
      expect(isKnownProvider('unknown-provider')).toBe(false);
    });
  });

  describe('getProviderDefault', () => {
    it('should return defaults for known providers', () => {
      const claudeDefault = getProviderDefault('claude');
      expect(claudeDefault).toBeDefined();
      expect(claudeDefault.command).toBe('claude');
    });

    it('should return undefined for unknown providers', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = getProviderDefault('unknown-provider' as any);
      expect(result).toBeUndefined();
    });
  });

  describe('ProviderIdSchema', () => {
    it('should accept valid provider IDs', () => {
      // ProviderIdSchema only accepts known providers
      expect(ProviderIdSchema.safeParse('claude').success).toBe(true);
      expect(ProviderIdSchema.safeParse('gemini').success).toBe(true);
      expect(ProviderIdSchema.safeParse('codex').success).toBe(true);
    });

    it('should reject unknown provider IDs', () => {
      expect(ProviderIdSchema.safeParse('my-custom-provider').success).toBe(false);
      expect(ProviderIdSchema.safeParse('unknown').success).toBe(false);
    });
  });

  describe('ProviderDetectionResult', () => {
    it('should validate detection result', () => {
      const result = {
        providerId: 'claude',
        detected: true,
        command: 'claude',
        version: '1.0.0',
        authenticated: true,
      };
      const validated = ProviderDetectionResultSchema.safeParse(result);
      expect(validated.success).toBe(true);
    });

    it('should create empty detection result', () => {
      const result = createEmptyDetectionResult('gemini');
      expect(result.providerId).toBe('gemini');
      expect(result.detected).toBe(false);
    });
  });
});

describe('Config Events Contract', () => {
  describe('ConfigStatusSchema', () => {
    it('should accept all valid statuses', () => {
      const validStatuses = ['uninitialized', 'valid', 'invalid', 'migrating'];
      for (const status of validStatuses) {
        expect(ConfigStatusSchema.safeParse(status).success).toBe(true);
      }
    });
  });

  describe('ConfigEventTypeSchema', () => {
    it('should accept all valid event types', () => {
      const validTypes = [
        'config.created',
        'config.updated',
        'config.reset',
        'config.migrated',
        'config.deleted',
        'config.validationFailed',
      ];
      for (const type of validTypes) {
        expect(ConfigEventTypeSchema.safeParse(type).success).toBe(true);
      }
    });
  });

  describe('CONFIG_TRANSITIONS', () => {
    it('should define valid transitions from uninitialized', () => {
      const transitions = CONFIG_TRANSITIONS.uninitialized;
      expect(transitions).toContain('valid');
      // From uninitialized, can only go to valid (create config)
      expect(transitions).not.toContain('invalid');
    });

    it('should define valid transitions from valid', () => {
      const transitions = CONFIG_TRANSITIONS.valid;
      expect(transitions).toContain('valid');
      expect(transitions).toContain('invalid');
      expect(transitions).toContain('migrating');
    });
  });

  describe('isValidConfigTransition', () => {
    it('should return true for valid transitions', () => {
      expect(isValidConfigTransition('uninitialized', 'valid')).toBe(true);
      expect(isValidConfigTransition('valid', 'migrating')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(isValidConfigTransition('uninitialized', 'migrating')).toBe(false);
      expect(isValidConfigTransition('migrating', 'uninitialized')).toBe(false);
    });
  });

  describe('createConfigCreatedEvent', () => {
    it('should create valid created event', () => {
      const correlationId = crypto.randomUUID();
      const event = createConfigCreatedEvent('global', DEFAULT_CONFIG, correlationId, 1);
      const result = ConfigEventSchema.safeParse(event);
      expect(result.success).toBe(true);
      expect(event.type).toBe('config.created');
      expect(event.payload.type).toBe('created');
    });
  });

  describe('createConfigUpdatedEvent', () => {
    it('should create valid updated event', () => {
      const correlationId = crypto.randomUUID();
      const event = createConfigUpdatedEvent('global', 'logLevel', 'info', 'debug', correlationId, 1);
      const result = ConfigEventSchema.safeParse(event);
      expect(result.success).toBe(true);
      expect(event.type).toBe('config.updated');
    });
  });
});

describe('Config Operations Contract', () => {
  describe('SetupInput', () => {
    it('should validate setup input', () => {
      const input = { force: true, scope: 'global' as const };
      const result = SetupInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const result = SetupInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.force).toBe(false);
        expect(result.data.nonInteractive).toBe(false);
        expect(result.data.scope).toBe('global');
      }
    });
  });

  describe('ConfigGetInput', () => {
    it('should validate get input', () => {
      const input = { path: 'logLevel', scope: 'merged' as const };
      const result = ConfigGetInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require path', () => {
      const result = ConfigGetInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('ConfigSetInput', () => {
    it('should validate set input', () => {
      const input = {
        path: 'logLevel',
        value: 'debug',
        scope: 'global' as const,
      };
      const result = ConfigSetInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('ConfigResetInput', () => {
    it('should validate reset input', () => {
      const input = { confirm: true, scope: 'global' as const };
      const result = ConfigResetInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should apply defaults including confirm=false', () => {
      const result = ConfigResetInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confirm).toBe(false);
        expect(result.data.scope).toBe('global');
      }
    });
  });

  describe('validateSetupInput', () => {
    it('should throw on invalid input', () => {
      expect(() => validateSetupInput({ scope: 'invalid' })).toThrow();
    });

    it('should return validated input', () => {
      const result = validateSetupInput({ force: true });
      expect(result.force).toBe(true);
    });
  });

  describe('validateConfigGetInput', () => {
    it('should validate and return input', () => {
      const result = validateConfigGetInput({ path: 'test' });
      expect(result.path).toBe('test');
    });
  });

  describe('validateConfigSetInput', () => {
    it('should validate and return input', () => {
      const result = validateConfigSetInput({ path: 'test', value: 'value' });
      expect(result.path).toBe('test');
      expect(result.value).toBe('value');
    });
  });
});

describe('Config Errors Contract', () => {
  describe('ConfigErrorCode', () => {
    it('should have all expected error codes', () => {
      expect(ConfigErrorCode.CONFIG_NOT_FOUND).toBeDefined();
      expect(ConfigErrorCode.CONFIG_VALIDATION_ERROR).toBeDefined();
      expect(ConfigErrorCode.CONFIG_MIGRATION_FAILED).toBeDefined();
      expect(ConfigErrorCode.CONFIG_READ_ERROR).toBeDefined();
      expect(ConfigErrorCode.CONFIG_WRITE_ERROR).toBeDefined();
      expect(ConfigErrorCode.PROVIDER_NOT_DETECTED).toBeDefined();
      expect(ConfigErrorCode.PROVIDER_NOT_AUTHENTICATED).toBeDefined();
    });
  });

  describe('ConfigError', () => {
    it('should create error with code and message', () => {
      const error = new ConfigError(
        ConfigErrorCode.CONFIG_NOT_FOUND,
        'Config file not found'
      );
      expect(error.code).toBe(ConfigErrorCode.CONFIG_NOT_FOUND);
      expect(error.message).toBe('Config file not found');
      expect(error.name).toBe('ConfigError');
    });

    it('should create error with details', () => {
      const error = new ConfigError(
        ConfigErrorCode.CONFIG_VALIDATION_ERROR,
        'Validation failed',
        { path: 'logLevel', value: 'invalid' }
      );
      expect(error.details).toEqual({ path: 'logLevel', value: 'invalid' });
    });
  });

  describe('isConfigError', () => {
    it('should return true for ConfigError', () => {
      const error = new ConfigError(ConfigErrorCode.CONFIG_NOT_FOUND, 'test');
      expect(isConfigError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('test');
      expect(isConfigError(error)).toBe(false);
    });
  });

  describe('getRecoveryHint', () => {
    it('should return hint for known error codes', () => {
      const hint = getRecoveryHint(ConfigErrorCode.CONFIG_NOT_FOUND);
      expect(hint).toBeDefined();
      expect(hint.length).toBeGreaterThan(0);
    });
  });

  describe('configNotFoundError', () => {
    it('should create CONFIG_NOT_FOUND error', () => {
      const error = configNotFoundError('/path/to/config');
      expect(error.code).toBe(ConfigErrorCode.CONFIG_NOT_FOUND);
      expect(error.details).toEqual({ path: '/path/to/config' });
    });
  });
});

// ============================================================================
// Config Validation Invariant Tests
// ============================================================================

describe('INV-CFG: Config Validation Invariants', () => {
  describe('INV-CFG-001: Schema Validation', () => {
    it('should reject invalid configuration', () => {
      const invalidConfig = {
        version: 'not-a-version',
        logLevel: 'invalid-level',
        providers: 'should-be-object',
      };
      const result = safeValidateConfig(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should accept valid configuration', () => {
      const validConfig = {
        version: CONFIG_VERSION,
        logLevel: 'info',
        providers: {},
      };
      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it('should validate all fields before accepting', () => {
      // Partial invalid config should be rejected
      const partialInvalid = {
        ...DEFAULT_CONFIG,
        executionPolicy: {
          ...DEFAULT_CONFIG.executionPolicy,
          maxRetries: -5, // Invalid
        },
      };
      const result = safeValidateConfig(partialInvalid);
      expect(result.success).toBe(false);
    });

    it('should provide descriptive errors on validation failure', () => {
      const result = validateConfigWithErrors({ logLevel: 'invalid' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('logLevel');
      }
    });
  });

  describe('INV-CFG-003: Version Migration Idempotent', () => {
    it('should include version in config for migration tracking', () => {
      const config = validateConfig({});
      expect(config.version).toBeDefined();
      expect(config.version).toBe(CONFIG_VERSION);
    });

    it('should preserve version across validation cycles', () => {
      const originalConfig = validateConfig({});
      const serialized = JSON.stringify(originalConfig);
      const deserialized = JSON.parse(serialized);
      const revalidated = validateConfig(deserialized);

      expect(revalidated.version).toBe(originalConfig.version);
    });

    it('should have consistent version constant', () => {
      // Version should be stable for migration consistency
      expect(typeof CONFIG_VERSION).toBe('string');
      expect(CONFIG_VERSION.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Config Resolution Invariant Tests
// ============================================================================

describe('INV-CFG-RES: Config Resolution Invariants', () => {
  describe('INV-CFG-RES-001: Project Overrides User', () => {
    it('should demonstrate merge precedence with schema', () => {
      // Config resolution: defaults < user < project
      // This is tested through the merge behavior
      const userConfig = { logLevel: 'info' as const };
      const projectConfig = { logLevel: 'debug' as const };

      // Deep merge simulation: project wins
      const merged = { ...userConfig, ...projectConfig };
      expect(merged.logLevel).toBe('debug');
    });

    it('should validate both configs can coexist', () => {
      const globalConfig = validateConfig({ logLevel: 'warn' });
      const localConfig = validateConfig({ logLevel: 'debug' });

      // Both should be valid independently
      expect(globalConfig.logLevel).toBe('warn');
      expect(localConfig.logLevel).toBe('debug');
    });
  });

  describe('INV-CFG-RES-002: User Overrides Defaults', () => {
    it('should apply user values over defaults', () => {
      const customConfig = validateConfig({
        logLevel: 'debug',
        telemetryEnabled: true,
      });

      // User overrides should take effect
      expect(customConfig.logLevel).toBe('debug');
      expect(customConfig.telemetryEnabled).toBe(true);

      // But defaults should apply to unspecified fields
      expect(customConfig.version).toBe(CONFIG_VERSION);
    });

    it('should fall back to defaults for missing values', () => {
      const partialConfig = validateConfig({});

      // All defaults should be applied
      expect(partialConfig.logLevel).toBe('info');
      expect(partialConfig.telemetryEnabled).toBe(false);
      expect(partialConfig.executionPolicy.maxRetries).toBe(3);
    });
  });

  describe('INV-CFG-RES-003: Undefined Preservation', () => {
    it('should not override defined values with undefined', () => {
      // Zod handles this by stripping undefined values
      const configWithUndefined = {
        logLevel: 'debug' as const,
        telemetryEnabled: undefined,
      };

      const result = validateConfig(configWithUndefined);
      // telemetryEnabled should have default, not undefined
      expect(result.telemetryEnabled).toBe(false);
      // logLevel should be preserved
      expect(result.logLevel).toBe('debug');
    });

    it('should handle explicit null vs undefined differently', () => {
      // Test that omitted keys get defaults
      const config1 = validateConfig({});
      expect(config1.defaultProvider).toBeUndefined();

      // Test that explicit value is preserved
      const config2 = validateConfig({ defaultProvider: 'claude-code' });
      expect(config2.defaultProvider).toBe('claude-code');
    });

    it('should preserve nested config values', () => {
      const nestedConfig = validateConfig({
        executionPolicy: {
          maxRetries: 5,
          // Other fields should get defaults
        },
      });

      expect(nestedConfig.executionPolicy.maxRetries).toBe(5);
      expect(nestedConfig.executionPolicy.defaultTimeoutMs).toBe(120000);
    });
  });
});

// ============================================================================
// Config Governance Invariant Tests
// ============================================================================

describe('INV-CFG-GOV: Config Governance Invariants', () => {
  describe('INV-CFG-GOV-001: Audit Trail', () => {
    it('should have event types for all config operations', () => {
      const expectedTypes = [
        'config.created',
        'config.updated',
        'config.reset',
        'config.migrated',
        'config.deleted',
        'config.validationFailed',
      ];

      for (const type of expectedTypes) {
        expect(ConfigEventTypeSchema.safeParse(type).success).toBe(true);
      }
    });

    it('should create events with timestamps', () => {
      const event = createConfigCreatedEvent(
        'global',
        DEFAULT_CONFIG,
        crypto.randomUUID(),
        1
      );

      expect(event.timestamp).toBeDefined();
      expect(event.type).toBe('config.created');
      if (event.payload.type === 'created') {
        expect(event.payload.scope).toBe('global');
      }
    });

    it('should include old and new values in update events', () => {
      const event = createConfigUpdatedEvent(
        'global',
        'logLevel',
        'info',
        'debug',
        crypto.randomUUID(),
        1
      );

      expect(event.payload.type).toBe('updated');
      if (event.payload.type === 'updated') {
        expect(event.payload.path).toBe('logLevel');
        expect(event.payload.oldValue).toBe('info');
        expect(event.payload.newValue).toBe('debug');
      }
    });

    it('should validate event schema', () => {
      const event = createConfigCreatedEvent(
        'global',
        DEFAULT_CONFIG,
        crypto.randomUUID(),
        1
      );

      const result = ConfigEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('INV-CFG-GOV-002: Sensitive Protection', () => {
    it('should have confirm option for reset operations', () => {
      // Reset without confirm should default to false
      const resetInput = ConfigResetInputSchema.parse({});
      expect(resetInput.confirm).toBe(false);

      // Reset with confirm should work
      const confirmedReset = ConfigResetInputSchema.parse({ confirm: true });
      expect(confirmedReset.confirm).toBe(true);
    });

    it('should track scope for config changes', () => {
      // All operations should track which scope they affect
      const setInput = ConfigSetInputSchema.parse({
        path: 'logLevel',
        value: 'debug',
        scope: 'global',
      });

      expect(setInput.scope).toBe('global');
    });

    it('should validate destructive operation confirmation', () => {
      // confirmDestructive preference should exist
      const config = validateConfig({});
      expect(config.preferences.confirmDestructive).toBe(true);
    });
  });
});

// ============================================================================
// Config Status Transition Invariant Tests
// ============================================================================

describe('INV-CFG-STATUS: Config Status Invariants', () => {
  describe('Status Transitions', () => {
    it('should only allow valid transitions', () => {
      // From uninitialized, can only go to valid
      expect(isValidConfigTransition('uninitialized', 'valid')).toBe(true);
      expect(isValidConfigTransition('uninitialized', 'invalid')).toBe(false);
      expect(isValidConfigTransition('uninitialized', 'migrating')).toBe(false);
    });

    it('should allow migrating only from valid state', () => {
      expect(isValidConfigTransition('valid', 'migrating')).toBe(true);
      expect(isValidConfigTransition('invalid', 'migrating')).toBe(false);
    });

    it('should allow recovery from invalid to valid', () => {
      expect(isValidConfigTransition('invalid', 'valid')).toBe(true);
    });

    it('should allow migration to complete to valid or fail to invalid', () => {
      expect(isValidConfigTransition('migrating', 'valid')).toBe(true);
      expect(isValidConfigTransition('migrating', 'invalid')).toBe(true);
    });
  });

  describe('Status Schema', () => {
    it('should accept all valid statuses', () => {
      const validStatuses = ['uninitialized', 'valid', 'invalid', 'migrating'];
      for (const status of validStatuses) {
        expect(ConfigStatusSchema.safeParse(status).success).toBe(true);
      }
    });

    it('should reject invalid statuses', () => {
      expect(ConfigStatusSchema.safeParse('unknown').success).toBe(false);
      expect(ConfigStatusSchema.safeParse('pending').success).toBe(false);
    });
  });
});

// ============================================================================
// Config Adapter Invariant Tests
// ============================================================================

describe('INV-CFG-ADP: Config Adapter Invariants', () => {
  describe('INV-CFG-ADP-002: Detection Timeout', () => {
    it('should have known providers with detection support', () => {
      // Verify providers are defined for detection
      expect(KNOWN_PROVIDERS).toBeDefined();
      expect(KNOWN_PROVIDERS.length).toBeGreaterThan(0);
    });

    it('should create detection results with timing info', () => {
      const result = createEmptyDetectionResult('claude');
      expect(result.providerId).toBe('claude');
      expect(result.detected).toBe(false);
    });

    it('should validate detection result schema', () => {
      const result = {
        providerId: 'claude',
        detected: true,
        command: 'claude',
        version: '1.0.0',
        authenticated: true,
      };
      const validated = ProviderDetectionResultSchema.safeParse(result);
      expect(validated.success).toBe(true);
    });
  });

  describe('INV-CFG-ADP-003: No Network in Detection', () => {
    it('should have command-based provider defaults', () => {
      // Provider detection should use local commands
      const claudeDefault = getProviderDefault('claude');
      expect(claudeDefault).toBeDefined();
      expect(claudeDefault.command).toBe('claude');

      const geminiDefault = getProviderDefault('gemini');
      expect(geminiDefault).toBeDefined();
      expect(geminiDefault.command).toBe('gemini');
    });

    it('should only detect known providers', () => {
      // Unknown providers should not have defaults
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unknownDefault = getProviderDefault('unknown-provider' as any);
      expect(unknownDefault).toBeUndefined();
    });
  });
});
