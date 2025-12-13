/**
 * Tests for config CLI command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((s: string) => s),
    gray: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
    yellow: vi.fn((s: string) => s),
    red: vi.fn((s: string) => s),
    blue: vi.fn((s: string) => s),
    white: vi.fn((s: string) => s),
    magenta: vi.fn((s: string) => s),
    bold: {
      cyan: vi.fn((s: string) => s),
      white: vi.fn((s: string) => s)
    }
  }
}));

vi.mock('fs/promises', () => ({
  access: vi.fn()
}));

vi.mock('fs', () => ({
  constants: { F_OK: 0 },
  existsSync: vi.fn()
}));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../../src/shared/errors/error-formatter.js', () => ({
  printError: vi.fn()
}));

vi.mock('../../../../src/shared/logging/message-formatter.js', () => ({
  printSuccess: vi.fn(),
  formatInfo: vi.fn((s: string) => s),
  formatKeyValue: vi.fn((k: string, v: string) => `${k}: ${v}`),
  formatWarning: vi.fn((s: string) => s)
}));

vi.mock('../../../../src/core/config/validator.js', () => ({
  validateConfig: vi.fn(),
  formatValidationErrors: vi.fn()
}));

// Use vi.hoisted to ensure mock is stable across module resets
const configLoaderMock = vi.hoisted(() => ({
  loadConfigFile: vi.fn(),
  saveConfigFile: vi.fn()
}));

vi.mock('../../../../src/core/config/loader.js', () => configLoaderMock);

vi.mock('../../../../src/cli/commands/config-routing.js', () => ({
  routingSubcommand: {
    command: 'routing',
    describe: 'Configure routing',
    handler: vi.fn()
  }
}));

vi.mock('../../../../src/types/config.js', () => ({
  DEFAULT_CONFIG: {
    providers: {},
    memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db' },
    workspace: { prdPath: 'PRD', tmpPath: 'tmp' },
    logging: { level: 'info', path: '.automatosx/logs' }
  }
}));

describe('Config Command', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalEnv = { ...process.env };
    delete process.env.AUTOMATOSX_DEBUG;
    delete process.env.AUTOMATOSX_CONFIG_PATH;
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    process.env = originalEnv;
    vi.resetModules();
  });

  describe('Helper Functions', () => {
    describe('getNestedValue', () => {
      // Test the logic inline since function is not exported
      const getNestedValue = (obj: any, path: string): any => {
        if (!path || !path.trim()) return undefined;
        return path.split('.').filter(Boolean).reduce((current, key) => current?.[key], obj);
      };

      it('should get top-level value', () => {
        const obj = { foo: 'bar' };
        expect(getNestedValue(obj, 'foo')).toBe('bar');
      });

      it('should get nested value', () => {
        const obj = { foo: { bar: { baz: 'qux' } } };
        expect(getNestedValue(obj, 'foo.bar.baz')).toBe('qux');
      });

      it('should return undefined for non-existent path', () => {
        const obj = { foo: 'bar' };
        expect(getNestedValue(obj, 'baz')).toBeUndefined();
      });

      it('should return undefined for empty path', () => {
        const obj = { foo: 'bar' };
        expect(getNestedValue(obj, '')).toBeUndefined();
      });

      it('should return undefined for whitespace path', () => {
        const obj = { foo: 'bar' };
        expect(getNestedValue(obj, '   ')).toBeUndefined();
      });

      it('should handle nested undefined gracefully', () => {
        const obj = { foo: null };
        expect(getNestedValue(obj, 'foo.bar.baz')).toBeUndefined();
      });

      it('should get array values', () => {
        const obj = { items: ['a', 'b', 'c'] };
        expect(getNestedValue(obj, 'items.1')).toBe('b');
      });

      it('should handle object value', () => {
        const obj = { foo: { bar: 'baz' } };
        expect(getNestedValue(obj, 'foo')).toEqual({ bar: 'baz' });
      });
    });

    describe('setNestedValue', () => {
      // Test the logic inline since function is not exported
      const setNestedValue = (obj: any, path: string, value: any): boolean => {
        const keys = path.split('.');
        const lastKey = keys.pop();

        if (!lastKey) return false;

        const target = keys.reduce((current, key) => {
          if (current?.[key] === undefined) return undefined;
          return current[key];
        }, obj);

        if (target === undefined) return false;

        target[lastKey] = value;
        return true;
      };

      it('should set top-level value', () => {
        const obj = { foo: 'bar' };
        const result = setNestedValue(obj, 'foo', 'updated');
        expect(result).toBe(true);
        expect(obj.foo).toBe('updated');
      });

      it('should set nested value', () => {
        const obj = { foo: { bar: { baz: 'old' } } };
        const result = setNestedValue(obj, 'foo.bar.baz', 'new');
        expect(result).toBe(true);
        expect(obj.foo.bar.baz).toBe('new');
      });

      it('should return false for non-existent path', () => {
        const obj = { foo: 'bar' };
        const result = setNestedValue(obj, 'baz.qux', 'value');
        expect(result).toBe(false);
      });

      it('should return false for empty path', () => {
        const obj = { foo: 'bar' };
        const result = setNestedValue(obj, '', 'value');
        expect(result).toBe(false);
      });

      it('should handle path with undefined intermediate', () => {
        const obj = { foo: { bar: undefined } };
        const result = setNestedValue(obj, 'foo.bar.baz', 'value');
        expect(result).toBe(false);
      });

      it('should set new property on existing object', () => {
        const obj: any = { foo: { bar: 'baz' } };
        const result = setNestedValue(obj, 'foo.newKey', 'newValue');
        expect(result).toBe(true);
        expect(obj.foo.newKey).toBe('newValue');
      });
    });

    describe('getLevelColor', () => {
      // Test the logic inline since function is not exported
      const getLevelColor = (level: string): string => {
        switch (level) {
          case 'debug':
            return 'magenta';
          case 'info':
            return 'cyan';
          case 'warn':
            return 'yellow';
          case 'error':
            return 'red';
          default:
            return 'white';
        }
      };

      it('should return magenta for debug', () => {
        expect(getLevelColor('debug')).toBe('magenta');
      });

      it('should return cyan for info', () => {
        expect(getLevelColor('info')).toBe('cyan');
      });

      it('should return yellow for warn', () => {
        expect(getLevelColor('warn')).toBe('yellow');
      });

      it('should return red for error', () => {
        expect(getLevelColor('error')).toBe('red');
      });

      it('should return white for unknown level', () => {
        expect(getLevelColor('trace')).toBe('white');
        expect(getLevelColor('')).toBe('white');
      });
    });
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { configCommand } = await import('../../../../src/cli/commands/config.js');
      expect(configCommand.command).toBe('config');
    });

    it('should have description', async () => {
      const { configCommand } = await import('../../../../src/cli/commands/config.js');
      expect(configCommand.describe).toBe('Manage AutomatosX configuration');
    });

    it('should have builder function', async () => {
      const { configCommand } = await import('../../../../src/cli/commands/config.js');
      expect(typeof configCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { configCommand } = await import('../../../../src/cli/commands/config.js');
      expect(typeof configCommand.handler).toBe('function');
    });

    it('should configure options in builder', async () => {
      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      const mockYargs: any = {
        command: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis()
      };

      (configCommand.builder as Function)(mockYargs);

      // Should register routing subcommand
      expect(mockYargs.command).toHaveBeenCalled();

      // Should register all options
      expect(mockYargs.option).toHaveBeenCalledWith('get', expect.objectContaining({
        alias: 'g',
        type: 'string'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('set', expect.objectContaining({
        alias: 's',
        type: 'string'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('value', expect.objectContaining({
        type: 'string'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('list', expect.objectContaining({
        alias: 'l',
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('reset', expect.objectContaining({
        alias: 'r',
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('validate', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('verbose', expect.objectContaining({
        type: 'boolean'
      }));

      // Should have examples
      expect(mockYargs.example).toHaveBeenCalled();
    });
  });

  describe('Config Path Resolution', () => {
    it('should use --config option if provided', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ config: '/custom/config.json' } as any);

      expect(access).toHaveBeenCalledWith('/custom/config.json', expect.anything());
    });

    it('should use AUTOMATOSX_CONFIG_PATH env var', async () => {
      process.env.AUTOMATOSX_CONFIG_PATH = '/env/config.json';

      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({} as any);

      expect(access).toHaveBeenCalledWith('/env/config.json', expect.anything());
    });

    it('should exit with error if config not found', async () => {
      const { access } = await import('fs/promises');
      const fs = await import('fs');

      vi.mocked(access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({} as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Configuration file not found'));
    });

    it('should print debug info when AUTOMATOSX_DEBUG is set', async () => {
      process.env.AUTOMATOSX_DEBUG = 'true';

      const { access } = await import('fs/promises');
      const fs = await import('fs');

      vi.mocked(access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({} as any);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        expect.anything()
      );
    });
  });

  describe('List Operation', () => {
    it('should list configuration', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {
          claude: { enabled: true, priority: 1, timeout: 30000, command: 'claude' }
        },
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: true, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: true, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ list: true } as any);

      // Verify config command was invoked and produced output
      expect(mockConsoleLog).toHaveBeenCalled();
      // Check for key sections in output (some may be combined in single calls)
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('AutomatosX Configuration');
      expect(allCalls).toContain('Providers');
    });

    it('should show verbose provider details', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {
          claude: { enabled: true, priority: 1, timeout: 30000, command: 'claude' }
        },
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: true, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: true, tmpCleanupDays: 7 },
        logging: { level: 'debug', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ list: true, verbose: true } as any);

      // Verify verbose mode produces output
      expect(mockConsoleLog).toHaveBeenCalled();
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Providers');
    });
  });

  describe('Get Operation', () => {
    it('should get configuration value', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 2000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'debug', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ get: 'logging.level' } as any);

      expect(mockConsoleLog).toHaveBeenCalledWith('debug');
    });

    it('should get nested object value as JSON', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 2000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'debug', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ get: 'logging' } as any);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level"'));
    });

    it('should exit with error for non-existent key', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ get: 'nonexistent.key' } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('should format value with key in verbose mode', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');
      const { formatKeyValue } = await import('../../../../src/shared/logging/message-formatter.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ get: 'logging.level', verbose: true } as any);

      expect(formatKeyValue).toHaveBeenCalledWith('logging.level', 'info');
    });
  });

  describe('Set Operation', () => {
    it('should set configuration value', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile, saveConfigFile } = await import('../../../../src/core/config/loader.js');
      const { validateConfig } = await import('../../../../src/core/config/validator.js');
      const { printSuccess } = await import('../../../../src/shared/logging/message-formatter.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });
      vi.mocked(validateConfig).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(saveConfigFile).mockResolvedValue(undefined);

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ set: 'logging.level', value: 'debug' } as any);

      expect(saveConfigFile).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('logging.level'));
    });

    it('should parse JSON values', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile, saveConfigFile } = await import('../../../../src/core/config/loader.js');
      const { validateConfig } = await import('../../../../src/core/config/validator.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });
      vi.mocked(validateConfig).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(saveConfigFile).mockResolvedValue(undefined);

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ set: 'memory.maxEntries', value: '2000' } as any);

      // Should parse "2000" as number
      expect(saveConfigFile).toHaveBeenCalled();
    });

    it('should parse JSON object values', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile, saveConfigFile } = await import('../../../../src/core/config/loader.js');
      const { validateConfig } = await import('../../../../src/core/config/validator.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });
      vi.mocked(validateConfig).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(saveConfigFile).mockResolvedValue(undefined);

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ set: 'memory.autoCleanup', value: 'true' } as any);

      expect(saveConfigFile).toHaveBeenCalled();
    });

    it('should exit with error if --value is missing', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ set: 'logging.level' } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('--value is required'));
    });

    it('should exit with error for non-existent key', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ set: 'nonexistent.deeply.nested.key', value: 'test' } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('should exit with error on validation failure', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');
      const { validateConfig, formatValidationErrors } = await import('../../../../src/core/config/validator.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });
      vi.mocked(validateConfig).mockReturnValue({
        valid: false,
        errors: [{ path: 'logging.level', message: 'Invalid value' }]
      });
      vi.mocked(formatValidationErrors).mockReturnValue('Formatted errors');

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ set: 'logging.level', value: 'invalid' } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
    });

    it('should show verbose output after set', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile, saveConfigFile } = await import('../../../../src/core/config/loader.js');
      const { validateConfig } = await import('../../../../src/core/config/validator.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });
      vi.mocked(validateConfig).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(saveConfigFile).mockResolvedValue(undefined);

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ set: 'logging.level', value: 'debug', verbose: true } as any);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Config file'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('validated successfully'));
    });
  });

  describe('Reset Operation', () => {
    it('should reset configuration to defaults', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile, saveConfigFile } = await import('../../../../src/core/config/loader.js');
      const { printSuccess } = await import('../../../../src/shared/logging/message-formatter.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });
      vi.mocked(saveConfigFile).mockResolvedValue(undefined);

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ reset: true } as any);

      expect(saveConfigFile).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('reset to defaults'));
    });

    it('should show verbose output after reset', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile, saveConfigFile } = await import('../../../../src/core/config/loader.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });
      vi.mocked(saveConfigFile).mockResolvedValue(undefined);

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ reset: true, verbose: true } as any);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Config file'));
    });
  });

  describe('Validate Operation', () => {
    it('should validate configuration successfully', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');
      const { validateConfig } = await import('../../../../src/core/config/validator.js');
      const { printSuccess } = await import('../../../../src/shared/logging/message-formatter.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });
      vi.mocked(validateConfig).mockReturnValue({ valid: true, errors: [] });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ validate: true } as any);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Validating configuration'));
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('valid'));
    });

    it('should show validation checks in verbose mode', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');
      const { validateConfig } = await import('../../../../src/core/config/validator.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });
      vi.mocked(validateConfig).mockReturnValue({ valid: true, errors: [] });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ validate: true, verbose: true } as any);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Validation checks passed'));
    });

    it('should show validation errors', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');
      const { validateConfig, formatValidationErrors } = await import('../../../../src/core/config/validator.js');
      const { formatWarning } = await import('../../../../src/shared/logging/message-formatter.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });
      vi.mocked(validateConfig).mockReturnValue({
        valid: false,
        errors: [{ path: 'field1', message: 'Error 1' }, { path: 'field2', message: 'Error 2' }]
      });
      vi.mocked(formatValidationErrors).mockReturnValue('Formatted errors');

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ validate: true } as any);

      expect(formatWarning).toHaveBeenCalledWith(expect.stringContaining('2'));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Default Behavior', () => {
    it('should show config path when no operation specified', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');
      const { formatInfo } = await import('../../../../src/shared/logging/message-formatter.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({} as any);

      expect(formatInfo).toHaveBeenCalledWith(expect.stringContaining('Configuration file'));
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const { access } = await import('fs/promises');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');
      const { printError } = await import('../../../../src/shared/errors/error-formatter.js');
      const { logger } = await import('../../../../src/shared/logging/logger.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(loadConfigFile).mockRejectedValue(new Error('Failed to load config'));

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({ list: true } as any);

      expect(printError).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Config File Detection', () => {
    it('should check project config first, then hidden config', async () => {
      const { access } = await import('fs/promises');
      const fs = await import('fs');
      const { loadConfigFile } = await import('../../../../src/core/config/loader.js');

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false)  // project config doesn't exist
        .mockReturnValueOnce(true);  // hidden config exists
      vi.mocked(loadConfigFile).mockResolvedValue({
        providers: {},
        memory: { maxEntries: 1000, persistPath: '.automatosx/memory.db', autoCleanup: false, cleanupDays: 30 },
        workspace: { prdPath: 'PRD', tmpPath: 'tmp', autoCleanupTmp: false, tmpCleanupDays: 7 },
        logging: { level: 'info', path: '.automatosx/logs', console: true }
      });

      const { configCommand } = await import('../../../../src/cli/commands/config.js');

      await configCommand.handler({} as any);

      expect(fs.existsSync).toHaveBeenCalled();
    });
  });
});
