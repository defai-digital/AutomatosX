import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  // Store
  createConfigStore,
  expandPath,
  getConfigPath,
  CONFIG_PATHS,
  CONFIG_SUBDIRS,
  initConfigDirectory,
  isSetupComplete,
  type ConfigStore,

  // Operations
  parsePath,
  getValue,
  setValue,
  removeValue,
  mergeConfigs,
  diffConfigs,
  hasPath,
  getAllPaths,

  // Aggregate
  ConfigAggregate,
  createConfigAggregate,
  createAggregateFromConfig,
  type ConfigAggregateState,

  // Repository
  InMemoryConfigEventStore,
  createConfigRepository,
  getConfigRepository,
  setConfigRepository,
  resetConfigRepository,
  type ConfigRepository,

  // Migrator
  CURRENT_VERSION,
  MIN_SUPPORTED_VERSION,
  VERSION_ORDER,
  getConfigVersion,
  compareVersions,
  isVersionSupported,
  getMigrationPath,
  needsMigration,
  migrateConfig,
  safeMigrateConfig,
  getMigrationInfo,

  // Detection Port
  setDetectionAdapter,
  getDetectionAdapter,
  resetDetectionAdapter,
  nullDetectionAdapter,
  type ProviderDetectionPort,
} from '@automatosx/config-domain';
import { DEFAULT_CONFIG, ConfigErrorCode, ConfigError } from '@automatosx/contracts';

describe('Config Domain', () => {
  describe('Config Operations', () => {
    describe('parsePath', () => {
      it('should parse simple path', () => {
        expect(parsePath('logLevel')).toEqual(['logLevel']);
      });

      it('should parse nested path', () => {
        expect(parsePath('features.enableTracing')).toEqual([
          'features',
          'enableTracing',
        ]);
      });

      it('should parse array index path', () => {
        expect(parsePath('providers.0.providerId')).toEqual([
          'providers',
          '0',
          'providerId',
        ]);
      });

      it('should handle empty path', () => {
        expect(parsePath('')).toEqual([]);
      });
    });

    describe('getValue', () => {
      // Using type assertion for testing path traversal logic
      const config = {
        logLevel: 'info',
        features: { enableTracing: true },
        providers: [{ providerId: 'claude', priority: 1 }],
      } as unknown as Parameters<typeof getValue>[0];

      it('should get top-level value', () => {
        expect(getValue(config, 'logLevel')).toBe('info');
      });

      it('should get nested value', () => {
        expect(getValue(config, 'features.enableTracing')).toBe(true);
      });

      it('should get array element', () => {
        expect(getValue(config, 'providers.0.providerId')).toBe('claude');
      });

      it('should return undefined for non-existent path', () => {
        expect(getValue(config, 'nonexistent')).toBeUndefined();
        expect(getValue(config, 'features.nonexistent')).toBeUndefined();
      });

      it('should handle empty path', () => {
        expect(getValue(config, '')).toEqual(config);
      });
    });

    describe('setValue', () => {
      type ConfigType = Parameters<typeof setValue>[0];

      it('should set top-level value', () => {
        const config = { logLevel: 'info' as const } as ConfigType;
        const result = setValue(config, 'logLevel', 'debug');
        expect(result.logLevel).toBe('debug');
      });

      it('should set nested value', () => {
        const config = { features: { enableTracing: true } } as ConfigType;
        const result = setValue(config, 'features.enableTracing', false);
        expect(result.features.enableTracing).toBe(false);
      });

      it('should create intermediate objects', () => {
        const config = {} as ConfigType;
        const result = setValue(config, 'features.enableTracing', true);
        expect(result).toEqual({ features: { enableTracing: true } });
      });

      it('should not mutate original', () => {
        const config = { logLevel: 'info' as const } as ConfigType;
        setValue(config, 'logLevel', 'debug');
        expect(config.logLevel).toBe('info');
      });
    });

    describe('removeValue', () => {
      type ConfigType = Parameters<typeof removeValue>[0];

      it('should remove top-level value', () => {
        const config = { logLevel: 'info', telemetryEnabled: false } as unknown as ConfigType;
        const result = removeValue(config, 'telemetryEnabled');
        expect(result).not.toHaveProperty('telemetryEnabled');
        expect(result).toHaveProperty('logLevel');
      });

      it('should remove nested value', () => {
        const config = { features: { enableTracing: true, enableGuard: false } } as ConfigType;
        const result = removeValue(config, 'features.enableGuard');
        expect(result.features).not.toHaveProperty('enableGuard');
        expect(result.features).toHaveProperty('enableTracing');
      });
    });

    describe('hasPath', () => {
      type ConfigType = Parameters<typeof hasPath>[0];
      const config = { logLevel: 'info', features: { enableTracing: true } } as ConfigType;

      it('should return true for existing paths', () => {
        expect(hasPath(config, 'logLevel')).toBe(true);
        expect(hasPath(config, 'features.enableTracing')).toBe(true);
      });

      it('should return false for non-existent paths', () => {
        expect(hasPath(config, 'nonexistent')).toBe(false);
        expect(hasPath(config, 'features.nonexistent')).toBe(false);
      });
    });

    describe('getAllPaths', () => {
      type ConfigType = Parameters<typeof getAllPaths>[0];

      it('should get all paths', () => {
        const config = {
          logLevel: 'info',
          features: { enableTracing: true, enableGuard: false },
        } as ConfigType;
        const paths = getAllPaths(config);
        expect(paths).toContain('logLevel');
        expect(paths).toContain('features.enableTracing');
        expect(paths).toContain('features.enableGuard');
      });
    });

    describe('mergeConfigs', () => {
      type ConfigType = Parameters<typeof mergeConfigs>[0];

      it('should merge two configs', () => {
        const base = { logLevel: 'info' as const, telemetryEnabled: false } as unknown as ConfigType;
        const override = { logLevel: 'debug' as const } as unknown as ConfigType;
        const result = mergeConfigs(base, override);
        expect(result.logLevel).toBe('debug');
        expect(result.telemetryEnabled).toBe(false);
      });

      it('should deep merge nested objects', () => {
        const base = { features: { enableTracing: true, enableGuard: false } } as unknown as ConfigType;
        const override = { features: { enableGuard: true } } as unknown as ConfigType;
        const result = mergeConfigs(base, override);
        expect(result.features.enableTracing).toBe(true);
        expect(result.features.enableGuard).toBe(true);
      });
    });

    describe('diffConfigs', () => {
      it('should return empty for identical configs', () => {
        const a = { ...DEFAULT_CONFIG };
        const b = { ...DEFAULT_CONFIG };
        const diff = diffConfigs(a, b);
        expect(diff).toEqual([]);
      });

      it('should return differences', () => {
        const a = { ...DEFAULT_CONFIG, logLevel: 'info' as const };
        const b = { ...DEFAULT_CONFIG, logLevel: 'debug' as const };
        const diff = diffConfigs(a, b);
        expect(diff.length).toBe(1);
        expect(diff[0]?.path).toBe('logLevel');
        expect(diff[0]?.oldValue).toBe('info');
        expect(diff[0]?.newValue).toBe('debug');
      });
    });
  });

  describe('Config Aggregate', () => {
    let aggregate: ConfigAggregate;
    const correlationId = crypto.randomUUID();

    beforeEach(() => {
      aggregate = createConfigAggregate('global');
    });

    it('should start in uninitialized state', () => {
      expect(aggregate.getState().status).toBe('uninitialized');
    });

    it('should create config', () => {
      aggregate.create(DEFAULT_CONFIG, correlationId);
      const state = aggregate.getState();
      expect(state.status).toBe('valid');
      expect(state.config).toEqual(DEFAULT_CONFIG);
      expect(state.scope).toBe('global');
    });

    it('should update config', () => {
      aggregate.create(DEFAULT_CONFIG, correlationId);
      aggregate.update('logLevel', 'debug', correlationId);
      const state = aggregate.getState();
      expect(state.config?.logLevel).toBe('debug');
    });

    it('should reset config', () => {
      aggregate.create(DEFAULT_CONFIG, correlationId);
      aggregate.update('logLevel', 'debug', correlationId);
      aggregate.reset(correlationId);
      const state = aggregate.getState();
      // Reset puts config back to uninitialized
      expect(state.status).toBe('uninitialized');
      expect(state.config).toBeUndefined();
    });

    it('should delete config', () => {
      aggregate.create(DEFAULT_CONFIG, correlationId);
      aggregate.delete(correlationId);
      const state = aggregate.getState();
      expect(state.status).toBe('uninitialized');
      expect(state.config).toBeUndefined();
    });

    it('should get uncommitted events', () => {
      aggregate.create(DEFAULT_CONFIG, correlationId);
      aggregate.update('logLevel', 'debug', correlationId);
      const events = aggregate.getUncommittedEvents();
      expect(events).toHaveLength(2);
      expect(events[0]?.type).toBe('config.created');
      expect(events[1]?.type).toBe('config.updated');
    });

    it('should clear events after markEventsCommitted', () => {
      aggregate.create(DEFAULT_CONFIG, correlationId);
      aggregate.markEventsCommitted();
      const events = aggregate.getUncommittedEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe('createAggregateFromConfig', () => {
    it('should create aggregate from existing config', () => {
      const correlationId = crypto.randomUUID();
      const config = { ...DEFAULT_CONFIG, logLevel: 'debug' as const };
      const aggregate = createAggregateFromConfig('global', config, correlationId);
      const state = aggregate.getState();
      expect(state.status).toBe('valid');
      expect(state.config?.logLevel).toBe('debug');
    });
  });

  describe('Config Repository', () => {
    let repository: ConfigRepository;
    let eventStore: InMemoryConfigEventStore;

    beforeEach(() => {
      resetConfigRepository();
      eventStore = new InMemoryConfigEventStore();
      // Create repository with only in-memory event store (no file operations)
      repository = createConfigRepository({ eventStore });
    });

    it('should have load and save methods', () => {
      expect(typeof repository.load).toBe('function');
      expect(typeof repository.save).toBe('function');
      expect(typeof repository.getEvents).toBe('function');
      expect(typeof repository.exists).toBe('function');
      expect(typeof repository.delete).toBe('function');
    });

    it('should load aggregate for scope', async () => {
      // The repository loads from file if exists, or returns uninitialized if not
      const loaded = await repository.load('global');
      // Status can be 'valid' (if global config exists) or 'uninitialized' (if not)
      expect(['valid', 'uninitialized']).toContain(loaded.getState().status);
    });
  });

  describe('InMemoryConfigEventStore', () => {
    let eventStore: InMemoryConfigEventStore;

    beforeEach(() => {
      eventStore = new InMemoryConfigEventStore();
    });

    it('should append and retrieve events', async () => {
      const event = {
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        version: 1,
        correlationId: crypto.randomUUID(),
        type: 'config.created' as const,
        payload: {
          type: 'created' as const,
          scope: 'global' as const,
          config: DEFAULT_CONFIG,
        },
      };

      await eventStore.append('global', [event]);
      const events = await eventStore.getEvents('global');
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('config.created');
    });

    it('should get events since version', async () => {
      const events = [
        {
          eventId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          version: 1,
          correlationId: crypto.randomUUID(),
          type: 'config.created' as const,
          payload: { type: 'created' as const, scope: 'global' as const, config: DEFAULT_CONFIG },
        },
        {
          eventId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          version: 2,
          correlationId: crypto.randomUUID(),
          type: 'config.updated' as const,
          payload: { type: 'updated' as const, scope: 'global' as const, path: 'logLevel', oldValue: 'info', newValue: 'debug' },
        },
      ];

      await eventStore.append('global', events);
      const sinceV1 = await eventStore.getEventsSince('global', 1);
      expect(sinceV1).toHaveLength(1);
      expect(sinceV1[0]?.version).toBe(2);
    });

    it('should clear events for scope', async () => {
      const event = {
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        version: 1,
        correlationId: crypto.randomUUID(),
        type: 'config.created' as const,
        payload: { type: 'created' as const, scope: 'global' as const, config: DEFAULT_CONFIG },
      };

      await eventStore.append('global', [event]);
      await eventStore.clear('global');
      const events = await eventStore.getEvents('global');
      expect(events).toHaveLength(0);
    });
  });

  describe('Repository Singleton', () => {
    beforeEach(() => {
      resetConfigRepository();
    });

    it('should get and set repository', () => {
      const repo = createConfigRepository({ eventStore: new InMemoryConfigEventStore() });
      setConfigRepository(repo);
      expect(getConfigRepository()).toBe(repo);
    });

    it('should create default repository if not set', () => {
      const repo = getConfigRepository();
      expect(repo).toBeDefined();
    });
  });

  describe('Config Migrator', () => {
    describe('getConfigVersion', () => {
      it('should get version from config', () => {
        const config = { version: '1.0.0' };
        expect(getConfigVersion(config)).toBe('1.0.0');
      });

      it('should return undefined for missing version', () => {
        expect(getConfigVersion({})).toBeUndefined();
        expect(getConfigVersion(null)).toBeUndefined();
        expect(getConfigVersion(undefined)).toBeUndefined();
      });
    });

    describe('compareVersions', () => {
      it('should compare versions correctly', () => {
        expect(compareVersions('0.9.0', '0.9.1')).toBeLessThan(0);
        expect(compareVersions('0.9.1', '0.9.0')).toBeGreaterThan(0);
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      });
    });

    describe('isVersionSupported', () => {
      it('should return true for supported versions', () => {
        expect(isVersionSupported('0.9.0')).toBe(true);
        expect(isVersionSupported('1.0.0')).toBe(true);
      });

      it('should return false for unsupported versions', () => {
        expect(isVersionSupported('0.5.0')).toBe(false);
        expect(isVersionSupported('unknown')).toBe(false);
      });
    });

    describe('needsMigration', () => {
      it('should return false for current version', () => {
        const config = { version: CURRENT_VERSION };
        expect(needsMigration(config)).toBe(false);
      });

      it('should return true for older versions', () => {
        const config = { version: '0.9.0' };
        expect(needsMigration(config)).toBe(true);
      });

      it('should return true for missing version', () => {
        expect(needsMigration({})).toBe(true);
      });
    });

    describe('getMigrationPath', () => {
      it('should return migration path', () => {
        const path = getMigrationPath('0.9.0', '1.0.0');
        expect(path.length).toBeGreaterThan(0);
        expect(path[0]?.fromVersion).toBe('0.9.0');
      });

      it('should return empty for same version', () => {
        const path = getMigrationPath('1.0.0', '1.0.0');
        expect(path).toEqual([]);
      });
    });

    describe('migrateConfig', () => {
      it('should migrate old config to current version', () => {
        const oldConfig = {
          version: '0.9.0',
          logLevel: 'info',
          telemetryEnabled: false,
          providers: {},
        };

        const migrated = migrateConfig(oldConfig);
        expect(migrated.version).toBe(CURRENT_VERSION);
        expect(migrated.features).toBeDefined();
        expect(migrated.workspace).toBeDefined();
      });

      it('should return default config for null/undefined', () => {
        const migrated = migrateConfig(null);
        expect(migrated.version).toBe(CURRENT_VERSION);
      });

      it('should validate current version config', () => {
        const config = { ...DEFAULT_CONFIG };
        const migrated = migrateConfig(config);
        expect(migrated).toEqual(DEFAULT_CONFIG);
      });
    });

    describe('safeMigrateConfig', () => {
      it('should return success for valid migration', () => {
        const result = safeMigrateConfig({ ...DEFAULT_CONFIG });
        expect(result.success).toBe(true);
      });

      it('should return error for invalid config', () => {
        const result = safeMigrateConfig({ version: '0.1.0' }); // Unsupported version
        expect(result.success).toBe(false);
      });
    });

    describe('getMigrationInfo', () => {
      it('should return migration info', () => {
        const info = getMigrationInfo({ version: '0.9.0' });
        expect(info.currentVersion).toBe('0.9.0');
        expect(info.targetVersion).toBe(CURRENT_VERSION);
        expect(info.needsMigration).toBe(true);
        expect(info.migrationPath.length).toBeGreaterThan(0);
      });

      it('should show no migration needed for current', () => {
        const info = getMigrationInfo({ version: CURRENT_VERSION });
        expect(info.needsMigration).toBe(false);
        expect(info.migrationPath).toEqual([]);
      });
    });
  });

  describe('Detection Port', () => {
    beforeEach(() => {
      resetDetectionAdapter();
    });

    it('should use null adapter by default', () => {
      const adapter = getDetectionAdapter();
      expect(adapter).toBe(nullDetectionAdapter);
    });

    it('should set and get custom adapter', () => {
      const customAdapter: ProviderDetectionPort = {
        detectProvider: async () => ({
          providerId: 'claude' as const,
          detected: true,
          command: 'claude',
          version: '1.0.0',
          authenticated: true,
        }),
        detectAllProviders: async () => ({
          timestamp: new Date().toISOString(),
          results: [],
          detectedCount: 0,
          authenticatedCount: 0,
          totalProviders: 0,
        }),
      };

      setDetectionAdapter(customAdapter);
      expect(getDetectionAdapter()).toBe(customAdapter);
    });

    it('should reset to null adapter', () => {
      const customAdapter: ProviderDetectionPort = {
        detectProvider: async () => ({
          providerId: 'claude' as const,
          detected: false,
          command: 'claude',
          authenticated: false,
        }),
        detectAllProviders: async () => ({
          timestamp: new Date().toISOString(),
          results: [],
          detectedCount: 0,
          authenticatedCount: 0,
          totalProviders: 0,
        }),
      };

      setDetectionAdapter(customAdapter);
      resetDetectionAdapter();
      expect(getDetectionAdapter()).toBe(nullDetectionAdapter);
    });

    describe('nullDetectionAdapter', () => {
      it('should return not detected for any provider', async () => {
        const result = await nullDetectionAdapter.detectProvider('claude');
        expect(result.detected).toBe(false);
      });

      it('should return empty summary for detectAllProviders', async () => {
        const result = await nullDetectionAdapter.detectAllProviders();
        expect(result.detectedCount).toBe(0);
        expect(result.results).toEqual([]);
      });
    });
  });

  describe('Path Utilities', () => {
    describe('expandPath', () => {
      it('should expand ~ to home directory', () => {
        const expanded = expandPath('~/.automatosx');
        expect(expanded).toBe(path.join(os.homedir(), '.automatosx'));
      });

      it('should not modify absolute paths', () => {
        const absolute = '/var/lib/config';
        expect(expandPath(absolute)).toBe(absolute);
      });
    });

    describe('getConfigPath', () => {
      it('should return global config path', () => {
        const globalPath = getConfigPath('global');
        expect(globalPath).toBe(CONFIG_PATHS.global);
        expect(globalPath).toContain('.automatosx');
      });

      it('should return local config path', () => {
        const localPath = getConfigPath('local');
        expect(localPath).toBe(CONFIG_PATHS.local);
      });

      it('should default to global', () => {
        expect(getConfigPath()).toBe(CONFIG_PATHS.global);
      });
    });
  });

  describe('CONFIG_SUBDIRS', () => {
    it('should include required subdirectories', () => {
      expect(CONFIG_SUBDIRS).toContain('providers');
      expect(CONFIG_SUBDIRS).toContain('cache');
      expect(CONFIG_SUBDIRS).toContain('data');
    });
  });
});

describe('Config Store Integration', () => {
  let tempDir: string;
  let store: ConfigStore;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'config-test-')
    );
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  // Note: Full store tests would require mocking CONFIG_PATHS
  // These tests verify the store interface exists
  it('should create config store', () => {
    store = createConfigStore();
    expect(store).toBeDefined();
    expect(typeof store.exists).toBe('function');
    expect(typeof store.read).toBe('function');
    expect(typeof store.write).toBe('function');
    expect(typeof store.delete).toBe('function');
    expect(typeof store.getPath).toBe('function');
    expect(typeof store.readMerged).toBe('function');
  });

  it('should return correct path', () => {
    store = createConfigStore();
    const globalPath = store.getPath('global');
    expect(globalPath).toContain('.automatosx');
    expect(globalPath).toContain('config.json');
  });
});
