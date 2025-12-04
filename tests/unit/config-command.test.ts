/**
 * Config Command Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configCommand } from '../../src/cli/commands/config.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';
import type { AutomatosXConfig } from '../../src/types/config.js';
import { loadConfigFile, saveConfigFile } from '../../src/core/config/loader.js';

// Mock config store - using a module to share state with mocks
const mockConfigState = {
  config: null as AutomatosXConfig | null,
  path: '/test-project/ax.config.json'
};

let mockConfig: AutomatosXConfig | null = null;
let mockConfigPath = '/test-project/ax.config.json'; // v9.2.0: Updated filename

// Mock the config module
vi.mock('../../src/core/config/loader.js');

// Mock the config utils module (v9.2.0: for resolveConfigPath and checkExists)
vi.mock('../../src/cli/commands/config/utils.js', async () => {
  // Import original utils to reuse actual implementation of getNestedValue and setNestedValue
  const actual = await vi.importActual<typeof import('../../src/cli/commands/config/utils.js')>('../../src/cli/commands/config/utils.js');

  return {
    resolveConfigPath: vi.fn(() => '/test-project/ax.config.json'),
    // checkExists uses mockConfigState which can be updated from tests
    checkExists: vi.fn(async (path: string) => {
      // Access the shared state object
      const hasConfig = mockConfigState.config !== null;
      return hasConfig && path.includes('ax.config.json');
    }),
    getNestedValue: actual.getNestedValue,  // Use actual implementation
    setNestedValue: actual.setNestedValue   // Use actual implementation
  };
});

describe('Config Command', () => {
  beforeEach(() => {
    // Clear mock config (both variables for backward compat)
    mockConfig = null;
    mockConfigState.config = null;
    mockConfigPath = '/test-project/ax.config.json'; // v9.2.0: Updated filename
    mockConfigState.path = '/test-project/ax.config.json';
    vi.clearAllMocks();

    // Setup mocks for config loading
    vi.mocked(loadConfigFile).mockImplementation(async () => {
      if (!mockConfig) {
        throw new Error('ENOENT: no such file or directory');
      }
      return mockConfig; // Returns AutomatosXConfig directly
    });

    vi.mocked(saveConfigFile).mockImplementation(async (path: string, config: AutomatosXConfig) => {
      mockConfig = config;
      mockConfigState.config = config; // Also update state
      mockConfigPath = path;
      mockConfigState.path = path;
    });
  });

  afterEach(() => {
    // Clear mock config (both)
    mockConfig = null;
    mockConfigState.config = null;
  });

  describe('handler', () => {
    it('should show error if config file not found', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        list: false,
        reset: false,
        verbose: false
      } as any);

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should list configuration', async () => {
      mockConfig = {
        ...DEFAULT_CONFIG,
        $schema: './schema/config.json',
        version: '4.0.0'
      };

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        list: true,
        reset: false,
        verbose: false
      } as any);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Configuration');
      expect(output).toContain('Providers');
      expect(output).toContain('Memory');
      expect(output).toContain('Logging');

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should get configuration value', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        logging: {
          ...DEFAULT_CONFIG.logging,
          level: 'debug' as const
        }
      };

      mockConfig = config;

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        get: 'logging.level',
        list: false,
        reset: false,
        verbose: false
      } as any);

      expect(consoleSpy).toHaveBeenCalledWith('debug');

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it.skip('should get nested object value', async () => {
      const config: AutomatosXConfig = {
        ...DEFAULT_CONFIG,
        logging: {
          level: 'debug',
          path: '.automatosx/logs',
          console: true,
          retention: {
            maxSizeBytes: 104857600,
            maxAgeDays: 30,
            compress: true
          }
        }
      };

      mockConfig = config;
      mockConfigState.config = config; // Also update state for checkExists mock

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        get: 'logging',
        list: false,
        reset: false,
        verbose: false
      } as any);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0];
      expect(output).toBeDefined();
      expect(output).toContain('level');

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should set configuration value', async () => {
      const config = {
        ...DEFAULT_CONFIG
      };

      mockConfig = config;

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        set: 'logging.level',
        value: 'debug',
        list: false,
        reset: false,
        verbose: false
      } as any);

      // Check saveConfigFile was called with updated config
      expect(saveConfigFile).toHaveBeenCalled();
      const savedConfig = vi.mocked(saveConfigFile).mock.calls[0]?.[1];
      expect(savedConfig?.logging.level).toBe('debug');
      expect(consoleSpy).toHaveBeenCalled();

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should set numeric value', async () => {
      const config = {
        ...DEFAULT_CONFIG
      };

      mockConfig = config;

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        set: 'memory.maxEntries',
        value: '20000',
        list: false,
        reset: false,
        verbose: false
      } as any);

      // Check saveConfigFile was called with updated config
      expect(saveConfigFile).toHaveBeenCalled();
      const savedConfig = vi.mocked(saveConfigFile).mock.calls[0]?.[1];
      expect(savedConfig?.memory.maxEntries).toBe(20000);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should set boolean value', async () => {
      const config = {
        ...DEFAULT_CONFIG
      };

      mockConfig = config;

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        set: 'workspace.autoCleanupTmp',
        value: 'false',
        list: false,
        reset: false,
        verbose: false
      } as any);

      // Check saveConfigFile was called with updated config
      expect(saveConfigFile).toHaveBeenCalled();
      const savedConfig = vi.mocked(saveConfigFile).mock.calls[0]?.[1];
      expect(savedConfig?.workspace.autoCleanupTmp).toBe(false);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should reset configuration to defaults', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        logging: {
          ...DEFAULT_CONFIG.logging,
          level: 'debug' as const
        }
      };

      mockConfig = config;

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        reset: true,
        list: false,
        verbose: false
      } as any);

      // Check saveConfigFile was called with reset config
      expect(saveConfigFile).toHaveBeenCalled();
      const resetConfig = vi.mocked(saveConfigFile).mock.calls[0]?.[1];
      expect(resetConfig).toBeDefined();
      expect(resetConfig?.logging.level).toBe(DEFAULT_CONFIG.logging.level);
      // Note: $schema is no longer included (not copied to user projects)
      expect(resetConfig?.$schema).toBeUndefined();
      // Version should be dynamically read from package.json
      expect(resetConfig?.version).toMatch(/^\d+\.\d+\.\d+/); // Semantic version format

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should show error for invalid key in get', async () => {
      const config = {
        ...DEFAULT_CONFIG
      };

      mockConfig = config;

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        get: 'invalid.key',
        list: false,
        reset: false,
        verbose: false
      } as any);

      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should show error for invalid key in set', async () => {
      const config = {
        ...DEFAULT_CONFIG
      };

      mockConfig = config;

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        set: 'invalid.key',
        value: 'test',
        list: false,
        reset: false,
        verbose: false
      } as any);

      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should show error when --set without --value', async () => {
      const config = {
        ...DEFAULT_CONFIG
      };

      mockConfig = config;

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        set: 'logging.level',
        list: false,
        reset: false,
        verbose: false
      } as any);

      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should show config path when no options provided', async () => {
      const config = {
        ...DEFAULT_CONFIG
      };

      mockConfig = config;

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await configCommand.handler?.({
        _: [],
        $0: 'automatosx',
        list: false,
        reset: false,
        verbose: false
      } as any);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Configuration file');
      // The actual path will be returned by loadConfigFile mock
      expect(loadConfigFile).toHaveBeenCalled();
      expect(output).toContain('config.json'); // At least check it shows a config path

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});
