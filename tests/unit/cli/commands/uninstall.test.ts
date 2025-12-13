/**
 * Tests for uninstall CLI command
 * Full coverage for handler and all branches
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
    blue: vi.fn((s: string) => s)
  }
}));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Use vi.hoisted for stable mocks
const execSyncMock = vi.hoisted(() => ({
  execSync: vi.fn()
}));

const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
  access: vi.fn()
}));

const osMock = vi.hoisted(() => ({
  homedir: vi.fn()
}));

vi.mock('child_process', () => execSyncMock);
vi.mock('fs/promises', () => fsMock);
vi.mock('os', () => osMock);

describe('Uninstall Command', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    osMock.homedir.mockReturnValue('/home/user');
    fsMock.access.mockRejectedValue(new Error('ENOENT')); // File doesn't exist by default
    fsMock.readFile.mockResolvedValue('');
    fsMock.writeFile.mockResolvedValue(undefined);
    fsMock.rm.mockResolvedValue(undefined);
    execSyncMock.execSync.mockReturnValue('');

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    vi.resetModules();
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');
      expect(uninstallCommand.command).toBe('uninstall');
    });

    it('should have description', async () => {
      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');
      expect(uninstallCommand.describe).toContain('Remove AutomatosX MCP');
    });

    it('should have builder function', async () => {
      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');
      expect(typeof uninstallCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');
      expect(typeof uninstallCommand.handler).toBe('function');
    });

    it('should configure options in builder', async () => {
      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      const mockYargs: any = {
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis()
      };

      (uninstallCommand.builder as Function)(mockYargs);

      expect(mockYargs.option).toHaveBeenCalledWith('all', expect.objectContaining({
        alias: 'a',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('keep-data', expect.objectContaining({
        type: 'boolean',
        default: true
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('force', expect.objectContaining({
        alias: 'f',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.example).toHaveBeenCalledTimes(3);
    });
  });

  describe('Handler - Basic Execution', () => {
    it('should run handler without errors', async () => {
      // Claude not installed
      execSyncMock.execSync.mockImplementation((cmd: string) => {
        if (cmd === 'which claude') {
          throw new Error('not found');
        }
        return '';
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await expect(uninstallCommand.handler({
        all: false,
        'keep-data': true,
        force: false,
        _: ['uninstall'],
        $0: 'ax'
      } as any)).resolves.not.toThrow();
    });

    it('should show uninstaller title', async () => {
      execSyncMock.execSync.mockImplementation((cmd: string) => {
        if (cmd === 'which claude') {
          throw new Error('not found');
        }
        return '';
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        force: false,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('Uninstaller'))).toBe(true);
    });
  });

  describe('Claude MCP Removal', () => {
    it('should return not_found when claude is not installed', async () => {
      execSyncMock.execSync.mockImplementation((cmd: string) => {
        if (cmd === 'which claude') {
          throw new Error('not found');
        }
        return '';
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('not configured'))).toBe(true);
    });

    it('should return not_found when automatosx not in mcp list', async () => {
      execSyncMock.execSync.mockImplementation((cmd: string) => {
        if (cmd === 'which claude') {
          return '/usr/local/bin/claude';
        }
        if (cmd.includes('claude mcp list')) {
          return 'other-server\nanother-server';
        }
        return '';
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('not configured'))).toBe(true);
    });

    it('should remove automatosx from claude mcp', async () => {
      execSyncMock.execSync.mockImplementation((cmd: string) => {
        if (cmd === 'which claude') {
          return '/usr/local/bin/claude';
        }
        if (cmd.includes('claude mcp list')) {
          return 'automatosx\nother-server';
        }
        return '';
      });

      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      expect(logger.info).toHaveBeenCalledWith('Removed Claude Code MCP configuration');
      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('Claude Code MCP removed'))).toBe(true);
    });

    it('should handle claude mcp removal failure', async () => {
      execSyncMock.execSync.mockImplementation((cmd: string) => {
        if (cmd === 'which claude') {
          return '/usr/local/bin/claude';
        }
        if (cmd.includes('claude mcp list')) {
          return 'automatosx';
        }
        if (cmd.includes('claude mcp remove')) {
          throw new Error('removal failed');
        }
        return '';
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('removal failed'))).toBe(true);
    });
  });

  describe('Gemini MCP Removal', () => {
    it('should return not_found when settings file does not exist', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });
      fsMock.access.mockRejectedValue(new Error('ENOENT'));

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      // Should show not configured for Gemini
      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('Gemini CLI MCP not configured'))).toBe(true);
    });

    it('should return not_found when automatosx not in settings', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      // Simulate .gemini/settings.json exists but no automatosx
      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('.gemini/settings.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      fsMock.readFile.mockImplementation(async (path: string) => {
        if (path.includes('.gemini/settings.json')) {
          return JSON.stringify({
            mcpServers: {
              'other-server': { command: 'other' }
            }
          });
        }
        return '';
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('Gemini CLI MCP not configured'))).toBe(true);
    });

    it('should remove automatosx from gemini settings', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('.gemini/settings.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      fsMock.readFile.mockImplementation(async (path: string) => {
        if (path.includes('.gemini/settings.json')) {
          return JSON.stringify({
            mcpServers: {
              automatosx: { command: 'ax', args: ['mcp', 'server'] },
              'other-server': { command: 'other' }
            }
          });
        }
        return '';
      });

      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      expect(fsMock.writeFile).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Removed Gemini CLI MCP configuration',
        expect.any(Object)
      );
    });

    it('should clean up empty mcpServers object', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('.gemini/settings.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      fsMock.readFile.mockImplementation(async (path: string) => {
        if (path.includes('.gemini/settings.json')) {
          return JSON.stringify({
            mcpServers: {
              automatosx: { command: 'ax' }
            },
            otherSetting: 'value'
          });
        }
        return '';
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      // Check that mcpServers was removed from the written content
      const writeCall = fsMock.writeFile.mock.calls.find(c => c[0]?.includes('.gemini'));
      if (writeCall) {
        const writtenContent = JSON.parse(writeCall[1]);
        expect(writtenContent.mcpServers).toBeUndefined();
        expect(writtenContent.otherSetting).toBe('value');
      }
    });

    it('should handle gemini settings read/write failure', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('.gemini/settings.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      fsMock.readFile.mockRejectedValue(new Error('Read failed'));

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('removal failed'))).toBe(true);
    });
  });

  describe('Codex MCP Removal', () => {
    it('should return not_found when config file does not exist', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });
      fsMock.access.mockRejectedValue(new Error('ENOENT'));

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('Codex CLI MCP not configured'))).toBe(true);
    });

    it('should return not_found when automatosx section not in config', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('.codex/config.toml')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      fsMock.readFile.mockImplementation(async (path: string) => {
        if (path.includes('.codex/config.toml')) {
          return '[other]\nkey = "value"';
        }
        return '';
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('Codex CLI MCP not configured'))).toBe(true);
    });

    it('should remove automatosx section from codex config', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('.codex/config.toml')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      fsMock.readFile.mockImplementation(async (path: string) => {
        if (path.includes('.codex/config.toml')) {
          return `[mcp_servers.automatosx]
command = "ax"
args = ["mcp", "server"]

[other]
key = "value"`;
        }
        return '';
      });

      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      expect(fsMock.writeFile).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Removed Codex CLI MCP configuration',
        expect.any(Object)
      );

      // Check the written content
      const writeCall = fsMock.writeFile.mock.calls.find(c => c[0]?.includes('.codex'));
      if (writeCall) {
        expect(writeCall[1]).not.toContain('[mcp_servers.automatosx]');
        expect(writeCall[1]).toContain('[other]');
      }
    });

    it('should handle codex config read/write failure', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('.codex/config.toml')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      fsMock.readFile.mockImplementation(async (path: string) => {
        if (path.includes('.codex/config.toml')) {
          throw new Error('Read failed');
        }
        return '';
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('removal failed'))).toBe(true);
    });
  });

  describe('Project Data Removal', () => {
    it('should not remove .automatosx when keep-data is true', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      // rm should not be called for .automatosx
      const rmCalls = fsMock.rm.mock.calls;
      expect(rmCalls.every(c => !c[0]?.endsWith('.automatosx'))).toBe(true);
    });

    it('should remove .automatosx when all is true', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('.automatosx')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: true,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      expect(fsMock.rm).toHaveBeenCalledWith(
        expect.stringContaining('.automatosx'),
        expect.objectContaining({ recursive: true, force: true })
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Removed .automatosx directory',
        expect.any(Object)
      );
    });

    it('should remove .automatosx when keep-data is false', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('.automatosx')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': false,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      expect(fsMock.rm).toHaveBeenCalledWith(
        expect.stringContaining('.automatosx'),
        expect.objectContaining({ recursive: true, force: true })
      );
    });

    it('should show not found when .automatosx does not exist', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });
      fsMock.access.mockRejectedValue(new Error('ENOENT'));

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: true,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('.automatosx directory not found'))).toBe(true);
    });

    it('should handle removal failure', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('.automatosx')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      fsMock.rm.mockRejectedValue(new Error('Permission denied'));

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: true,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('Failed to remove'))).toBe(true);
    });
  });

  describe('Project MCP Configs Removal', () => {
    it('should remove project-level MCP config files', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('mcp-servers.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      expect(logger.info).toHaveBeenCalledWith('Removed project MCP config', expect.any(Object));
    });

    it('should show count of removed project configs', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      fsMock.access.mockImplementation(async (path: string) => {
        if (path.includes('mcp-servers.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('Removed') && c?.includes('project MCP config'))).toBe(true);
    });

    it('should show no configs found when none exist', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });
      fsMock.access.mockRejectedValue(new Error('ENOENT'));

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('No project MCP configs found'))).toBe(true);
    });
  });

  describe('Summary Output', () => {
    it('should show uninstall complete message', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('Uninstall complete'))).toBe(true);
    });

    it('should show removed count when configs were removed', async () => {
      execSyncMock.execSync.mockImplementation((cmd: string) => {
        if (cmd === 'which claude') {
          return '/usr/local/bin/claude';
        }
        if (cmd.includes('claude mcp list')) {
          return 'automatosx';
        }
        return '';
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('Removed') && c?.includes('MCP configuration'))).toBe(true);
    });

    it('should show reinstall instructions', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('npm install'))).toBe(true);
      expect(logCalls.some((c: string) => c?.includes('ax setup'))).toBe(true);
    });

    it('should show SDK mode note', async () => {
      execSyncMock.execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const { uninstallCommand } = await import('../../../../src/cli/commands/uninstall.js');

      await uninstallCommand.handler({
        all: false,
        'keep-data': true,
        _: ['uninstall'],
        $0: 'ax'
      } as any);

      const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((c: string) => c?.includes('SDK mode'))).toBe(true);
    });
  });

  describe('Default Export', () => {
    it('should have default export', async () => {
      const defaultExport = await import('../../../../src/cli/commands/uninstall.js');
      expect(defaultExport.default).toBeDefined();
      expect(defaultExport.default.command).toBe('uninstall');
    });
  });
});
