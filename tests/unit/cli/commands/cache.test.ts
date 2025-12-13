/**
 * Cache Command Unit Tests
 * Full coverage for statusCommand, statsCommand, clearCommand, and cacheCommand.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Create mock method functions with vi.hoisted for stability
const mockGetStats = vi.hoisted(() => vi.fn());
const mockClear = vi.hoisted(() => vi.fn());
const mockClose = vi.hoisted(() => vi.fn());
const mockLoadConfig = vi.hoisted(() => vi.fn());
const mockPrintSuccess = vi.hoisted(() => vi.fn());
const mockTablePush = vi.hoisted(() => vi.fn());
const mockTableToString = vi.hoisted(() => vi.fn().mockReturnValue('table'));

// Mock all dependencies
vi.mock('chalk', () => ({
  default: {
    red: (s: string) => s,
    yellow: (s: string) => s,
    green: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

vi.mock('cli-table3', () => ({
  default: function Table() {
    return {
      push: mockTablePush,
      toString: mockTableToString,
    };
  },
}));

vi.mock('../../../../src/core/cache/response-cache.js', () => ({
  ResponseCache: function ResponseCache() {
    return {
      getStats: mockGetStats,
      clear: mockClear,
      close: mockClose,
    };
  },
}));

vi.mock('../../../../src/core/config/loader.js', () => ({
  loadConfig: mockLoadConfig,
}));

vi.mock('../../../../src/shared/logging/message-formatter.js', () => ({
  printSuccess: mockPrintSuccess,
}));

vi.mock('../../../../src/core/validation-limits.js', () => ({
  AX_PATHS: {
    CACHE: '.automatosx/cache',
  },
}));

describe('Cache Commands', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockProcessExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clear call histories
    mockGetStats.mockClear();
    mockClear.mockClear();
    mockClose.mockClear();
    mockLoadConfig.mockClear();
    mockPrintSuccess.mockClear();
    mockTablePush.mockClear();
    mockTableToString.mockClear();

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Setup default mock return values
    mockGetStats.mockReturnValue({
      enabled: true,
      totalEntries: 100,
      l1Entries: 50,
      l2Entries: 50,
      totalHits: 80,
      totalMisses: 20,
      hitRate: 0.8,
      size: 1024 * 1024,
      oldestEntry: Date.now() - 86400000,
      newestEntry: Date.now(),
    });

    mockLoadConfig.mockResolvedValue({
      performance: {
        responseCache: {
          enabled: true,
          ttl: 86400,
          maxSize: 1000,
          maxMemorySize: 100,
          dbPath: '.automatosx/cache/responses.db',
        },
      },
    });
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  describe('statusCommand', () => {
    describe('Command Structure', () => {
      it('should have correct command name', async () => {
        const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
        expect(statusCommand.command).toBe('status');
      });

      it('should have description', async () => {
        const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
        expect(statusCommand.describe).toContain('response cache status');
      });

      it('should configure options in builder', async () => {
        const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
        const mockYargs: any = {
          option: vi.fn().mockReturnThis(),
        };

        (statusCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('output', expect.objectContaining({
          alias: 'o',
          type: 'string',
          choices: ['json', 'table'],
          default: 'table',
        }));

        expect(mockYargs.option).toHaveBeenCalledWith('db', expect.objectContaining({
          type: 'string',
        }));
      });
    });

    describe('Handler - Table Output', () => {
      it('should display cache status in table format', async () => {
        const { statusCommand } = await import('../../../../src/cli/commands/cache.js');

        await statusCommand.handler({
          output: 'table',
          _: ['cache', 'status'],
          $0: 'ax'
        } as any);

        expect(mockLoadConfig).toHaveBeenCalled();
        expect(mockGetStats).toHaveBeenCalled();
        expect(mockClose).toHaveBeenCalled();
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should show warning when cache is disabled', async () => {
        mockGetStats.mockReturnValue({
          enabled: false,
          totalEntries: 100,
          l1Entries: 50,
          l2Entries: 50,
          totalHits: 80,
          totalMisses: 20,
          hitRate: 0.8,
          size: 1024 * 1024,
          oldestEntry: Date.now(),
          newestEntry: Date.now(),
        });

        const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
        await statusCommand.handler({ output: 'table', _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should show tip when cache is empty', async () => {
        mockGetStats.mockReturnValue({
          enabled: true,
          totalEntries: 0,
          l1Entries: 0,
          l2Entries: 0,
          totalHits: 0,
          totalMisses: 0,
          hitRate: 0,
          size: 0,
          oldestEntry: null,
          newestEntry: null,
        });

        const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
        await statusCommand.handler({ output: 'table', _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should handle medium hit rate', async () => {
        mockGetStats.mockReturnValue({
          enabled: true,
          totalEntries: 100,
          l1Entries: 50,
          l2Entries: 50,
          totalHits: 30,
          totalMisses: 70,
          hitRate: 0.3,
          size: 1024 * 1024,
          oldestEntry: Date.now(),
          newestEntry: Date.now(),
        });

        const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
        await statusCommand.handler({ output: 'table', _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should handle low hit rate', async () => {
        mockGetStats.mockReturnValue({
          enabled: true,
          totalEntries: 100,
          l1Entries: 50,
          l2Entries: 50,
          totalHits: 10,
          totalMisses: 90,
          hitRate: 0.1,
          size: 1024 * 1024,
          oldestEntry: Date.now(),
          newestEntry: Date.now(),
        });

        const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
        await statusCommand.handler({ output: 'table', _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });
    });

    describe('Handler - JSON Output', () => {
      it('should display cache status in JSON format', async () => {
        const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
        await statusCommand.handler({ output: 'json', _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('{'));
      });
    });

    describe('Handler - Custom DB Path', () => {
      it('should use custom database path when provided', async () => {
        const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
        await statusCommand.handler({ output: 'table', db: '/custom/cache.db', _: [], $0: 'ax' } as any);
        expect(mockLoadConfig).toHaveBeenCalled();
      });
    });

    describe('Handler - Error Handling', () => {
      it('should handle errors and exit with code 1', async () => {
        mockLoadConfig.mockRejectedValue(new Error('Config error'));
        const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
        await statusCommand.handler({ output: 'table', _: [], $0: 'ax' } as any);
        expect(mockConsoleError).toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('statsCommand', () => {
    describe('Command Structure', () => {
      it('should have correct command name', async () => {
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        expect(statsCommand.command).toBe('stats');
      });

      it('should have description', async () => {
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        expect(statsCommand.describe).toContain('detailed cache statistics');
      });

      it('should configure options in builder', async () => {
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        const mockYargs: any = { option: vi.fn().mockReturnThis() };
        (statsCommand.builder as Function)(mockYargs);
        expect(mockYargs.option).toHaveBeenCalledWith('providers', expect.objectContaining({ alias: 'p' }));
      });
    });

    describe('Handler - Table Output', () => {
      it('should display detailed stats in table format', async () => {
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        await statsCommand.handler({ output: 'table', providers: true, _: [], $0: 'ax' } as any);
        expect(mockGetStats).toHaveBeenCalled();
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockClose).toHaveBeenCalled();
      });

      it('should show excellent hit rate insight', async () => {
        mockGetStats.mockReturnValue({
          enabled: true, totalEntries: 100, l1Entries: 50, l2Entries: 50,
          totalHits: 80, totalMisses: 20, hitRate: 0.8,
          size: 1024 * 1024, oldestEntry: Date.now(), newestEntry: Date.now(),
        });
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        await statsCommand.handler({ output: 'table', providers: true, _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should show moderate hit rate insight', async () => {
        mockGetStats.mockReturnValue({
          enabled: true, totalEntries: 100, l1Entries: 50, l2Entries: 50,
          totalHits: 30, totalMisses: 70, hitRate: 0.3,
          size: 1024 * 1024, oldestEntry: Date.now(), newestEntry: Date.now(),
        });
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        await statsCommand.handler({ output: 'table', providers: true, _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should show low hit rate insight when totalRequests > 10', async () => {
        mockGetStats.mockReturnValue({
          enabled: true, totalEntries: 100, l1Entries: 50, l2Entries: 50,
          totalHits: 5, totalMisses: 95, hitRate: 0.05,
          size: 1024 * 1024, oldestEntry: Date.now(), newestEntry: Date.now(),
        });
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        await statsCommand.handler({ output: 'table', providers: true, _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should show all-in-memory insight', async () => {
        mockGetStats.mockReturnValue({
          enabled: true, totalEntries: 30, l1Entries: 30, l2Entries: 0,
          totalHits: 80, totalMisses: 20, hitRate: 0.8,
          size: 1024 * 1024, oldestEntry: Date.now(), newestEntry: Date.now(),
        });
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        await statsCommand.handler({ output: 'table', providers: true, _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should show large cache warning when size > 50MB', async () => {
        mockGetStats.mockReturnValue({
          enabled: true, totalEntries: 100, l1Entries: 50, l2Entries: 50,
          totalHits: 80, totalMisses: 20, hitRate: 0.8,
          size: 60 * 1024 * 1024, oldestEntry: Date.now(), newestEntry: Date.now(),
        });
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        await statsCommand.handler({ output: 'table', providers: true, _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should show empty cache insight', async () => {
        mockGetStats.mockReturnValue({
          enabled: true, totalEntries: 0, l1Entries: 0, l2Entries: 0,
          totalHits: 0, totalMisses: 0, hitRate: 0,
          size: 0, oldestEntry: null, newestEntry: null,
        });
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        await statsCommand.handler({ output: 'table', providers: true, _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should show provider info when flag is true', async () => {
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        await statsCommand.handler({ output: 'table', providers: true, _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should skip provider info when flag is false', async () => {
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        await statsCommand.handler({ output: 'table', providers: false, _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
      });
    });

    describe('Handler - JSON Output', () => {
      it('should display stats in JSON format', async () => {
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        await statsCommand.handler({ output: 'json', providers: true, _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('{'));
      });
    });

    describe('Handler - Error Handling', () => {
      it('should handle errors and exit with code 1', async () => {
        mockLoadConfig.mockRejectedValue(new Error('Stats error'));
        const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
        await statsCommand.handler({ output: 'table', providers: true, _: [], $0: 'ax' } as any);
        expect(mockConsoleError).toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('clearCommand', () => {
    describe('Command Structure', () => {
      it('should have correct command name', async () => {
        const { clearCommand } = await import('../../../../src/cli/commands/cache.js');
        expect(clearCommand.command).toBe('clear');
      });

      it('should have description', async () => {
        const { clearCommand } = await import('../../../../src/cli/commands/cache.js');
        expect(clearCommand.describe).toContain('Clear all cache entries');
      });

      it('should configure options in builder', async () => {
        const { clearCommand } = await import('../../../../src/cli/commands/cache.js');
        const mockYargs: any = { option: vi.fn().mockReturnThis() };
        (clearCommand.builder as Function)(mockYargs);
        expect(mockYargs.option).toHaveBeenCalledWith('confirm', expect.objectContaining({ alias: 'y' }));
      });
    });

    describe('Handler - Empty Cache', () => {
      it('should show warning when cache is already empty', async () => {
        mockGetStats.mockReturnValue({
          enabled: true, totalEntries: 0, l1Entries: 0, l2Entries: 0,
          totalHits: 0, totalMisses: 0, hitRate: 0,
          size: 0, oldestEntry: null, newestEntry: null,
        });
        const { clearCommand } = await import('../../../../src/cli/commands/cache.js');
        await clearCommand.handler({ confirm: true, _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockClear).not.toHaveBeenCalled();
        expect(mockClose).toHaveBeenCalled();
      });
    });

    describe('Handler - No Confirmation', () => {
      it('should show confirmation message when --confirm not provided', async () => {
        const { clearCommand } = await import('../../../../src/cli/commands/cache.js');
        await clearCommand.handler({ confirm: false, _: [], $0: 'ax' } as any);
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockClear).not.toHaveBeenCalled();
        expect(mockClose).toHaveBeenCalled();
      });
    });

    describe('Handler - With Confirmation', () => {
      it('should clear cache when --confirm is provided', async () => {
        const { clearCommand } = await import('../../../../src/cli/commands/cache.js');
        await clearCommand.handler({ confirm: true, _: [], $0: 'ax' } as any);
        expect(mockClear).toHaveBeenCalled();
        expect(mockPrintSuccess).toHaveBeenCalled();
        expect(mockClose).toHaveBeenCalled();
      });
    });

    describe('Handler - Custom DB Path', () => {
      it('should use custom database path', async () => {
        const { clearCommand } = await import('../../../../src/cli/commands/cache.js');
        await clearCommand.handler({ confirm: true, db: '/custom/cache.db', _: [], $0: 'ax' } as any);
        expect(mockClear).toHaveBeenCalled();
      });
    });

    describe('Handler - Error Handling', () => {
      it('should handle errors and exit with code 1', async () => {
        mockLoadConfig.mockRejectedValue(new Error('Clear error'));
        const { clearCommand } = await import('../../../../src/cli/commands/cache.js');
        await clearCommand.handler({ confirm: true, _: [], $0: 'ax' } as any);
        expect(mockConsoleError).toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('cacheCommand', () => {
    describe('Command Structure', () => {
      it('should have correct command name', async () => {
        const { cacheCommand } = await import('../../../../src/cli/commands/cache.js');
        expect(cacheCommand.command).toBe('cache <command>');
      });

      it('should have description', async () => {
        const { cacheCommand } = await import('../../../../src/cli/commands/cache.js');
        expect(cacheCommand.describe).toContain('Manage provider response cache');
      });

      it('should configure subcommands in builder', async () => {
        const { cacheCommand } = await import('../../../../src/cli/commands/cache.js');
        const mockYargs: any = {
          command: vi.fn().mockReturnThis(),
          demandCommand: vi.fn().mockReturnThis(),
          help: vi.fn().mockReturnThis(),
        };
        (cacheCommand.builder as Function)(mockYargs);
        expect(mockYargs.command).toHaveBeenCalledTimes(3);
        expect(mockYargs.demandCommand).toHaveBeenCalled();
        expect(mockYargs.help).toHaveBeenCalled();
      });

      it('should have empty handler (parent command)', async () => {
        const { cacheCommand } = await import('../../../../src/cli/commands/cache.js');
        expect(() => (cacheCommand.handler as Function)({})).not.toThrow();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null oldest/newest entry dates', async () => {
      mockGetStats.mockReturnValue({
        enabled: true, totalEntries: 100, l1Entries: 50, l2Entries: 50,
        totalHits: 80, totalMisses: 20, hitRate: 0.8,
        size: 1024 * 1024, oldestEntry: null, newestEntry: null,
      });
      const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
      await statusCommand.handler({ output: 'table', _: [], $0: 'ax' } as any);
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle zero totalEntries for avgEntrySize', async () => {
      mockGetStats.mockReturnValue({
        enabled: true, totalEntries: 0, l1Entries: 0, l2Entries: 0,
        totalHits: 0, totalMisses: 0, hitRate: 0,
        size: 0, oldestEntry: null, newestEntry: null,
      });
      const { statsCommand } = await import('../../../../src/cli/commands/cache.js');
      await statsCommand.handler({ output: 'table', providers: true, _: [], $0: 'ax' } as any);
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should use default values when config is missing', async () => {
      mockLoadConfig.mockResolvedValue({ performance: {} });
      const { statusCommand } = await import('../../../../src/cli/commands/cache.js');
      await statusCommand.handler({ output: 'table', _: [], $0: 'ax' } as any);
      expect(mockLoadConfig).toHaveBeenCalled();
    });
  });
});
