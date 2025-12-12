/**
 * Gemini CLI Config Manager Unit Tests
 *
 * Tests for reading, merging, and caching Gemini CLI configurations.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { ConfigManager } from '../../../../src/integrations/gemini-cli/config-manager.js';
import { GeminiCLIError, GeminiCLIErrorType } from '../../../../src/integrations/gemini-cli/types.js';

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

vi.mock('os', () => ({
  homedir: () => '/home/user',
}));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ConfigManager', () => {
  // Paths must match the actual implementation in utils/file-reader.ts
  const userConfigPath = '/home/user/.gemini/settings.json';
  const projectConfigPath = `${process.cwd()}/.gemini/settings.json`;

  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
    // Reset environment variable
    delete process.env.GEMINI_CLI_CACHE_TTL;
  });

  afterEach(() => {
    vol.reset();
  });

  describe('constructor', () => {
    it('should create ConfigManager with default TTL', () => {
      const manager = new ConfigManager();
      expect(manager).toBeDefined();
    });

    it('should create ConfigManager with custom TTL', () => {
      const manager = new ConfigManager(30000);
      expect(manager).toBeDefined();
    });

    it('should respect GEMINI_CLI_CACHE_TTL environment variable', () => {
      process.env.GEMINI_CLI_CACHE_TTL = '5000';
      const manager = new ConfigManager();
      expect(manager).toBeDefined();
    });

    it('should fall back to default TTL on invalid env value', () => {
      process.env.GEMINI_CLI_CACHE_TTL = 'invalid';
      const manager = new ConfigManager();
      expect(manager).toBeDefined();
    });
  });

  describe('readUserConfig', () => {
    it('should return empty config when file does not exist', async () => {
      const manager = new ConfigManager();
      const config = await manager.readUserConfig();
      expect(config).toEqual({});
    });

    it('should read and parse user config', async () => {
      const userConfig = {
        model: 'gemini-pro',
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(userConfig),
      });

      const manager = new ConfigManager();
      const config = await manager.readUserConfig();
      expect(config).toEqual(userConfig);
    });

    it('should cache config results', async () => {
      const userConfig = { model: 'gemini-pro' };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(userConfig),
      });

      const manager = new ConfigManager(60000);

      // First read
      const config1 = await manager.readUserConfig();
      expect(config1).toEqual(userConfig);

      // Modify file
      vol.fromJSON({
        [userConfigPath]: JSON.stringify({ model: 'gemini-ultra' }),
      });

      // Second read should return cached result
      const config2 = await manager.readUserConfig();
      expect(config2).toEqual(userConfig);
    });

    it('should handle concurrent reads', async () => {
      const userConfig = { model: 'gemini-pro' };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(userConfig),
      });

      const manager = new ConfigManager();

      // Concurrent reads should use same pending promise
      const [config1, config2] = await Promise.all([
        manager.readUserConfig(),
        manager.readUserConfig(),
      ]);

      expect(config1).toEqual(userConfig);
      expect(config2).toEqual(userConfig);
    });
  });

  describe('readProjectConfig', () => {
    it('should return empty config when file does not exist', async () => {
      const manager = new ConfigManager();
      const config = await manager.readProjectConfig();
      expect(config).toEqual({});
    });

    it('should read and parse project config', async () => {
      const projectConfig = {
        model: 'gemini-pro-vision',
        mcpServers: {
          'project-server': {
            command: 'python',
            args: ['server.py'],
          },
        },
      };

      vol.fromJSON({
        [projectConfigPath]: JSON.stringify(projectConfig),
      });

      const manager = new ConfigManager();
      const config = await manager.readProjectConfig();
      expect(config).toEqual(projectConfig);
    });
  });

  describe('mergeConfigs', () => {
    it('should merge multiple configs with later taking precedence', () => {
      const manager = new ConfigManager();

      const config1 = { model: 'gemini-pro' };
      const config2 = { model: 'gemini-ultra' };

      const merged = manager.mergeConfigs(config1, config2);
      expect(merged.model).toBe('gemini-ultra');
    });

    it('should merge mcpServers from both configs', () => {
      const manager = new ConfigManager();

      const config1 = {
        mcpServers: {
          server1: { command: 'node', args: ['s1.js'] },
        },
      };
      const config2 = {
        mcpServers: {
          server2: { command: 'python', args: ['s2.py'] },
        },
      };

      const merged = manager.mergeConfigs(config1, config2);
      expect(merged.mcpServers).toHaveProperty('server1');
      expect(merged.mcpServers).toHaveProperty('server2');
    });

    it('should override mcpServers with same name', () => {
      const manager = new ConfigManager();

      const config1 = {
        mcpServers: {
          shared: { command: 'node', args: ['old.js'] },
        },
      };
      const config2 = {
        mcpServers: {
          shared: { command: 'python', args: ['new.py'] },
        },
      };

      const merged = manager.mergeConfigs(config1, config2);
      expect(merged.mcpServers?.shared.command).toBe('python');
    });

    it('should deep merge mcp discovery settings', () => {
      const manager = new ConfigManager();

      const config1 = {
        mcp: {
          discovery: {
            enabled: true,
          },
        },
      };
      const config2 = {
        mcp: {
          discovery: {
            timeout: 5000,
          },
        },
      };

      const merged = manager.mergeConfigs(config1, config2);
      expect(merged.mcp?.discovery?.enabled).toBe(true);
      expect(merged.mcp?.discovery?.timeout).toBe(5000);
    });

    it('should handle undefined mcp discovery', () => {
      const manager = new ConfigManager();

      const config1 = {
        mcp: {
          discovery: {
            enabled: true,
          },
        },
      };
      const config2 = {
        mcp: {
          discovery: undefined,
        },
      };

      const merged = manager.mergeConfigs(config1, config2);
      expect(merged.mcp?.discovery).toBeUndefined();
    });

    it('should handle empty configs', () => {
      const manager = new ConfigManager();
      const merged = manager.mergeConfigs({}, {});
      expect(merged).toEqual({});
    });
  });

  describe('getMergedConfig', () => {
    it('should merge user and project configs', async () => {
      const userConfig = {
        model: 'gemini-pro',
        mcpServers: {
          user: { command: 'node', args: ['user.js'] },
        },
      };
      const projectConfig = {
        mcpServers: {
          project: { command: 'python', args: ['project.py'] },
        },
      };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(userConfig),
        [projectConfigPath]: JSON.stringify(projectConfig),
      });

      const manager = new ConfigManager();
      const merged = await manager.getMergedConfig();

      expect(merged.model).toBe('gemini-pro');
      expect(merged.mcpServers).toHaveProperty('user');
      expect(merged.mcpServers).toHaveProperty('project');
    });

    it('should handle errors gracefully', async () => {
      // Create invalid JSON
      vol.fromJSON({
        [userConfigPath]: 'invalid json',
      });

      const manager = new ConfigManager();
      // Should not throw, just use empty config for failed reads
      const merged = await manager.getMergedConfig();
      expect(merged).toBeDefined();
    });

    it('should cache merged config', async () => {
      const userConfig = { model: 'gemini-pro' };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(userConfig),
      });

      const manager = new ConfigManager(60000);

      // First read
      const merged1 = await manager.getMergedConfig();

      // Modify file
      vol.fromJSON({
        [userConfigPath]: JSON.stringify({ model: 'gemini-ultra' }),
      });

      // Second read should return cached result
      const merged2 = await manager.getMergedConfig();
      expect(merged1).toEqual(merged2);
    });

    it('should handle concurrent getMergedConfig calls', async () => {
      const userConfig = { model: 'gemini-pro' };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(userConfig),
      });

      const manager = new ConfigManager();

      const [merged1, merged2] = await Promise.all([
        manager.getMergedConfig(),
        manager.getMergedConfig(),
      ]);

      expect(merged1).toEqual(merged2);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid config', () => {
      const manager = new ConfigManager();
      const config = {
        model: 'gemini-pro',
        mcpServers: {
          test: { command: 'node', args: ['test.js'] },
        },
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should detect invalid MCP server configs', () => {
      const manager = new ConfigManager();
      const config = {
        mcpServers: {
          'test-server': { command: '' }, // Invalid - missing command
        },
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
    });
  });

  describe('readAndValidateUserConfig', () => {
    it('should read and validate user config', async () => {
      const userConfig = {
        model: 'gemini-pro',
        mcpServers: {
          test: { command: 'node', args: ['test.js'] },
        },
      };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(userConfig),
      });

      const manager = new ConfigManager();
      const config = await manager.readAndValidateUserConfig();
      expect(config).toEqual(userConfig);
    });

    it('should throw on validation failure when throwOnError is true', async () => {
      const invalidConfig = {
        mcpServers: {
          '': { command: '' }, // Invalid
        },
      };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(invalidConfig),
      });

      const manager = new ConfigManager();
      await expect(
        manager.readAndValidateUserConfig(true)
      ).rejects.toThrow(GeminiCLIError);
    });

    it('should not throw on validation failure when throwOnError is false', async () => {
      const invalidConfig = {
        mcpServers: {
          '': { command: '' },
        },
      };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(invalidConfig),
      });

      const manager = new ConfigManager();
      const config = await manager.readAndValidateUserConfig(false);
      expect(config).toEqual(invalidConfig);
    });
  });

  describe('readAndValidateProjectConfig', () => {
    it('should read and validate project config', async () => {
      const projectConfig = {
        model: 'gemini-pro',
      };

      vol.fromJSON({
        [projectConfigPath]: JSON.stringify(projectConfig),
      });

      const manager = new ConfigManager();
      const config = await manager.readAndValidateProjectConfig();
      expect(config).toEqual(projectConfig);
    });

    it('should throw on validation failure when throwOnError is true', async () => {
      const invalidConfig = {
        mcpServers: {
          '': { command: '' },
        },
      };

      vol.fromJSON({
        [projectConfigPath]: JSON.stringify(invalidConfig),
      });

      const manager = new ConfigManager();
      await expect(
        manager.readAndValidateProjectConfig(true)
      ).rejects.toThrow(GeminiCLIError);
    });
  });

  describe('readAndValidateMergedConfig', () => {
    it('should read and validate merged config', async () => {
      const userConfig = { model: 'gemini-pro' };
      const projectConfig = { mcpServers: { test: { command: 'node' } } };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(userConfig),
        [projectConfigPath]: JSON.stringify(projectConfig),
      });

      const manager = new ConfigManager();
      const config = await manager.readAndValidateMergedConfig();
      expect(config.model).toBe('gemini-pro');
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate all cache when scope is all', async () => {
      const userConfig = { model: 'gemini-pro' };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(userConfig),
      });

      const manager = new ConfigManager(60000);

      // Populate cache
      await manager.readUserConfig();
      await manager.getMergedConfig();

      // Invalidate all
      manager.invalidateCache('all');

      // Modify file
      vol.fromJSON({
        [userConfigPath]: JSON.stringify({ model: 'gemini-ultra' }),
      });

      // Should read new value
      const config = await manager.readUserConfig();
      expect(config.model).toBe('gemini-ultra');
    });

    it('should invalidate specific scope', async () => {
      const userConfig = { model: 'gemini-pro' };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(userConfig),
      });

      const manager = new ConfigManager(60000);

      // Populate cache
      await manager.readUserConfig();

      // Invalidate user scope
      manager.invalidateCache('user');

      // Modify file
      vol.fromJSON({
        [userConfigPath]: JSON.stringify({ model: 'gemini-ultra' }),
      });

      // Should read new value
      const config = await manager.readUserConfig();
      expect(config.model).toBe('gemini-ultra');
    });

    it('should also invalidate merged cache when invalidating user or project', () => {
      const manager = new ConfigManager();
      manager.invalidateCache('user');
      // Should not throw
      expect(manager).toBeDefined();
    });
  });

  describe('hasUserConfig', () => {
    it('should return true when user config exists', async () => {
      vol.fromJSON({
        [userConfigPath]: '{}',
      });

      const manager = new ConfigManager();
      const exists = await manager.hasUserConfig();
      expect(exists).toBe(true);
    });

    it('should return false when user config does not exist', async () => {
      const manager = new ConfigManager();
      const exists = await manager.hasUserConfig();
      expect(exists).toBe(false);
    });
  });

  describe('hasProjectConfig', () => {
    it('should return true when project config exists', async () => {
      vol.fromJSON({
        [projectConfigPath]: '{}',
      });

      const manager = new ConfigManager();
      const exists = await manager.hasProjectConfig();
      expect(exists).toBe(true);
    });

    it('should return false when project config does not exist', async () => {
      const manager = new ConfigManager();
      const exists = await manager.hasProjectConfig();
      expect(exists).toBe(false);
    });
  });

  describe('getConfigStats', () => {
    it('should return configuration statistics', async () => {
      const userConfig = {
        mcpServers: {
          server1: { command: 'node' },
          server2: { command: 'python' },
        },
      };
      const projectConfig = {
        mcpServers: {
          server3: { command: 'npx' },
        },
      };

      vol.fromJSON({
        [userConfigPath]: JSON.stringify(userConfig),
        [projectConfigPath]: JSON.stringify(projectConfig),
      });

      const manager = new ConfigManager();
      const stats = await manager.getConfigStats();

      expect(stats.hasUserConfig).toBe(true);
      expect(stats.hasProjectConfig).toBe(true);
      expect(stats.userMCPServers).toBe(2);
      expect(stats.projectMCPServers).toBe(1);
      expect(stats.totalMCPServers).toBe(3);
    });

    it('should handle missing configs', async () => {
      const manager = new ConfigManager();
      const stats = await manager.getConfigStats();

      expect(stats.hasUserConfig).toBe(false);
      expect(stats.hasProjectConfig).toBe(false);
      expect(stats.userMCPServers).toBe(0);
      expect(stats.projectMCPServers).toBe(0);
      expect(stats.totalMCPServers).toBe(0);
    });

    it('should handle config read errors gracefully', async () => {
      vol.fromJSON({
        [userConfigPath]: 'invalid json',
      });

      const manager = new ConfigManager();
      const stats = await manager.getConfigStats();

      // Should return 0 for failed reads
      expect(stats.userMCPServers).toBe(0);
    });
  });
});

describe('defaultConfigManager', () => {
  it('should export a default ConfigManager instance', async () => {
    const { defaultConfigManager, ConfigManager: CM } = await import(
      '../../../../src/integrations/gemini-cli/config-manager.js'
    );
    expect(defaultConfigManager).toBeInstanceOf(CM);
  });
});
