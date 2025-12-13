/**
 * Tests for shortcuts CLI commands (plan, iterate, review)
 * Full coverage for handlers and all branches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('chalk', () => ({
  default: {
    cyan: {
      bold: vi.fn((s: string) => s)
    },
    gray: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
    yellow: vi.fn((s: string) => s),
    red: {
      bold: vi.fn((s: string) => s)
    }
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

// Use vi.hoisted to ensure mock is stable across module resets
const workflowMock = vi.hoisted(() => ({
  saveModeState: vi.fn()
}));

const spawnMock = vi.hoisted(() => ({
  spawn: vi.fn()
}));

vi.mock('../../../../src/core/workflow/index.js', () => workflowMock);
vi.mock('child_process', () => spawnMock);

describe('Shortcuts Commands', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockChildProcess: {
    on: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    workflowMock.saveModeState.mockResolvedValue(true);

    // Mock child process
    mockChildProcess = {
      on: vi.fn((event: string, callback: Function) => {
        if (event === 'close') {
          // Simulate successful close by default
          setTimeout(() => callback(0), 0);
        }
        return mockChildProcess;
      })
    };

    spawnMock.spawn.mockReturnValue(mockChildProcess);

    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    vi.resetModules();
  });

  describe('Plan Command', () => {
    describe('Command Structure', () => {
      it('should have correct command name', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');
        expect(planCommand.command).toBe('plan [task]');
      });

      it('should have description', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');
        expect(planCommand.describe).toContain('plan mode');
      });

      it('should have builder function', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');
        expect(typeof planCommand.builder).toBe('function');
      });

      it('should have handler function', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');
        expect(typeof planCommand.handler).toBe('function');
      });

      it('should configure builder options', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        const mockYargs: any = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis(),
          example: vi.fn().mockReturnThis()
        };

        (planCommand.builder as Function)(mockYargs);

        expect(mockYargs.positional).toHaveBeenCalledWith('task', expect.objectContaining({
          type: 'string'
        }));
        expect(mockYargs.option).toHaveBeenCalledWith('agent', expect.objectContaining({
          alias: 'a',
          type: 'string'
        }));
        expect(mockYargs.option).toHaveBeenCalledWith('provider', expect.objectContaining({
          alias: 'p',
          type: 'string'
        }));
        expect(mockYargs.option).toHaveBeenCalledWith('verbose', expect.objectContaining({
          alias: 'v',
          type: 'boolean'
        }));
        expect(mockYargs.option).toHaveBeenCalledWith('quiet', expect.objectContaining({
          alias: 'q',
          type: 'boolean'
        }));
        expect(mockYargs.example).toHaveBeenCalled();
      });
    });

    describe('Handler', () => {
      it('should set plan mode and show activation message', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: undefined,
          quiet: false,
          _: ['plan'],
          $0: 'ax'
        } as any);

        expect(workflowMock.saveModeState).toHaveBeenCalledWith('plan', {
          setBy: 'shortcut',
          reason: 'ax plan command'
        });
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should warn when mode state save fails', async () => {
        workflowMock.saveModeState.mockResolvedValue(false);
        const { logger } = await import('../../../../src/shared/logging/logger.js');
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: undefined,
          quiet: false,
          _: ['plan'],
          $0: 'ax'
        } as any);

        expect(logger.warn).toHaveBeenCalledWith('Failed to persist mode state, continuing anyway');
      });

      it('should run task when provided', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: 'design auth system',
          quiet: false,
          _: ['plan'],
          $0: 'ax'
        } as any);

        expect(spawnMock.spawn).toHaveBeenCalled();
        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('run');
        expect(spawnArgs[1]).toContain('design auth system');
      });

      it('should include agent in run args when specified', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: 'design API',
          agent: 'architecture',
          quiet: false,
          _: ['plan'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('architecture');
      });

      it('should include provider in run args when specified', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: 'test',
          provider: 'claude',
          quiet: false,
          _: ['plan'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('--provider');
        expect(spawnArgs[1]).toContain('claude');
      });

      it('should include verbose flag when specified', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: 'test',
          verbose: true,
          quiet: false,
          _: ['plan'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('--verbose');
      });

      it('should include quiet flag in run args', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: 'test',
          quiet: true,
          _: ['plan'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('--quiet');
      });

      it('should suppress output in quiet mode', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: undefined,
          quiet: true,
          _: ['plan'],
          $0: 'ax'
        } as any);

        // Should not show Plan Mode Activated
        const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
        expect(logCalls.some((c: string) => c?.includes('Plan Mode'))).toBe(false);
      });

      it('should show no task message when task not provided', async () => {
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: undefined,
          quiet: false,
          _: ['plan'],
          $0: 'ax'
        } as any);

        const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
        expect(logCalls.some((c: string) => c?.includes('No task specified'))).toBe(true);
      });

      it('should handle command error and exit', async () => {
        mockChildProcess.on = vi.fn((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 0);
          }
          return mockChildProcess;
        });

        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: 'test',
          quiet: false,
          _: ['plan'],
          $0: 'ax'
        } as any);

        expect(mockConsoleError).toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(1);
      });

      it('should handle spawn error', async () => {
        mockChildProcess.on = vi.fn((event: string, callback: Function) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('spawn error')), 0);
          }
          return mockChildProcess;
        });

        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: 'test',
          quiet: false,
          _: ['plan'],
          $0: 'ax'
        } as any);

        expect(mockConsoleError).toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(1);
      });

      it('should handle missing process.argv', async () => {
        const originalArgv = process.argv;
        Object.defineProperty(process, 'argv', {
          value: [],
          writable: true,
          configurable: true
        });

        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: 'test',
          quiet: false,
          _: ['plan'],
          $0: 'ax'
        } as any);

        expect(mockConsoleError).toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(1);

        Object.defineProperty(process, 'argv', {
          value: originalArgv,
          writable: true,
          configurable: true
        });
      });

      it('should log execution info', async () => {
        const { logger } = await import('../../../../src/shared/logging/logger.js');
        const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await planCommand.handler({
          task: 'test task',
          agent: 'backend',
          quiet: false,
          _: ['plan'],
          $0: 'ax'
        } as any);

        expect(logger.info).toHaveBeenCalledWith('Plan shortcut executed', {
          task: 'test task',
          agent: 'backend'
        });
      });
    });
  });

  describe('Iterate Command', () => {
    describe('Command Structure', () => {
      it('should have correct command name', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');
        expect(iterateCommand.command).toBe('iterate [task]');
      });

      it('should have description', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');
        expect(iterateCommand.describe).toContain('iterate mode');
      });

      it('should configure builder options', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        const mockYargs: any = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis(),
          example: vi.fn().mockReturnThis()
        };

        (iterateCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('timeout', expect.objectContaining({
          alias: 't',
          type: 'number'
        }));
        expect(mockYargs.option).toHaveBeenCalledWith('max-tokens', expect.objectContaining({
          type: 'number'
        }));
      });
    });

    describe('Handler', () => {
      it('should set iterate mode and show activation message', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: undefined,
          quiet: false,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        expect(workflowMock.saveModeState).toHaveBeenCalledWith('iterate', {
          setBy: 'shortcut',
          reason: 'ax iterate command'
        });
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should warn when mode state save fails', async () => {
        workflowMock.saveModeState.mockResolvedValue(false);
        const { logger } = await import('../../../../src/shared/logging/logger.js');
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: undefined,
          quiet: false,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        expect(logger.warn).toHaveBeenCalledWith('Failed to persist mode state, continuing anyway');
      });

      it('should run task with --iterate flag when provided', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: 'implement auth',
          quiet: false,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('run');
        expect(spawnArgs[1]).toContain('implement auth');
        expect(spawnArgs[1]).toContain('--iterate');
      });

      it('should include timeout in run args', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: 'test',
          timeout: 60,
          quiet: false,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('--iterate-timeout');
        expect(spawnArgs[1]).toContain('60');
      });

      it('should include maxTokens in run args', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: 'test',
          maxTokens: 500000,
          quiet: false,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('--iterate-max-tokens');
        expect(spawnArgs[1]).toContain('500000');
      });

      it('should include agent in run args', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: 'fix bug',
          agent: 'backend',
          quiet: false,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('backend');
      });

      it('should include provider in run args', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: 'test',
          provider: 'gemini',
          quiet: false,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('--provider');
        expect(spawnArgs[1]).toContain('gemini');
      });

      it('should include verbose flag', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: 'test',
          verbose: true,
          quiet: false,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('--verbose');
      });

      it('should include quiet flag', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: 'test',
          quiet: true,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('--quiet');
      });

      it('should suppress output in quiet mode', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: undefined,
          quiet: true,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
        expect(logCalls.some((c: string) => c?.includes('Iterate Mode'))).toBe(false);
      });

      it('should show no task message when task not provided', async () => {
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: undefined,
          quiet: false,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
        expect(logCalls.some((c: string) => c?.includes('No task specified'))).toBe(true);
      });

      it('should handle command error and exit', async () => {
        mockChildProcess.on = vi.fn((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 0);
          }
          return mockChildProcess;
        });

        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: 'test',
          quiet: false,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        expect(mockConsoleError).toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(1);
      });

      it('should log execution info', async () => {
        const { logger } = await import('../../../../src/shared/logging/logger.js');
        const { iterateCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await iterateCommand.handler({
          task: 'test task',
          agent: 'frontend',
          quiet: false,
          _: ['iterate'],
          $0: 'ax'
        } as any);

        expect(logger.info).toHaveBeenCalledWith('Iterate shortcut executed', {
          task: 'test task',
          agent: 'frontend'
        });
      });
    });
  });

  describe('Review Command', () => {
    describe('Command Structure', () => {
      it('should have correct command name', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');
        expect(reviewCommand.command).toBe('review [path]');
      });

      it('should have description', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');
        expect(reviewCommand.describe).toContain('review mode');
      });

      it('should configure builder options', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        const mockYargs: any = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis(),
          example: vi.fn().mockReturnThis()
        };

        (reviewCommand.builder as Function)(mockYargs);

        expect(mockYargs.positional).toHaveBeenCalledWith('path', expect.objectContaining({
          type: 'string'
        }));
        expect(mockYargs.option).toHaveBeenCalledWith('agent', expect.objectContaining({
          alias: 'a',
          default: 'quality'
        }));
      });
    });

    describe('Handler', () => {
      it('should set review mode and show activation message', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: undefined,
          agent: 'quality',
          quiet: false,
          _: ['review'],
          $0: 'ax'
        } as any);

        expect(workflowMock.saveModeState).toHaveBeenCalledWith('review', {
          setBy: 'shortcut',
          reason: 'ax review command'
        });
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it('should warn when mode state save fails', async () => {
        workflowMock.saveModeState.mockResolvedValue(false);
        const { logger } = await import('../../../../src/shared/logging/logger.js');
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: undefined,
          agent: 'quality',
          quiet: false,
          _: ['review'],
          $0: 'ax'
        } as any);

        expect(logger.warn).toHaveBeenCalledWith('Failed to persist mode state, continuing anyway');
      });

      it('should run quality agent when path provided', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: 'src/core/',
          agent: 'quality',
          quiet: false,
          _: ['review'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('run');
        expect(spawnArgs[1]).toContain('quality');
        expect(spawnArgs[1].some((a: string) => a.includes('src/core/'))).toBe(true);
      });

      it('should use custom agent when specified', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: 'src/',
          agent: 'security',
          quiet: false,
          _: ['review'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('security');
      });

      it('should include provider in run args', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: 'src/api.ts',
          agent: 'quality',
          provider: 'claude',
          quiet: false,
          _: ['review'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('--provider');
        expect(spawnArgs[1]).toContain('claude');
      });

      it('should include verbose flag', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: 'src/',
          agent: 'quality',
          verbose: true,
          quiet: false,
          _: ['review'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('--verbose');
      });

      it('should include quiet flag', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: 'src/',
          agent: 'quality',
          quiet: true,
          _: ['review'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('--quiet');
      });

      it('should suppress output in quiet mode', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: undefined,
          agent: 'quality',
          quiet: true,
          _: ['review'],
          $0: 'ax'
        } as any);

        const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
        expect(logCalls.some((c: string) => c?.includes('Review Mode'))).toBe(false);
      });

      it('should show no path message when path not provided', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: undefined,
          agent: 'quality',
          quiet: false,
          _: ['review'],
          $0: 'ax'
        } as any);

        const logCalls = mockConsoleLog.mock.calls.map((c: unknown[]) => c[0]);
        expect(logCalls.some((c: string) => c?.includes('No path specified'))).toBe(true);
      });

      it('should handle command error and exit', async () => {
        mockChildProcess.on = vi.fn((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 0);
          }
          return mockChildProcess;
        });

        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: 'src/',
          agent: 'quality',
          quiet: false,
          _: ['review'],
          $0: 'ax'
        } as any);

        expect(mockConsoleError).toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(1);
      });

      it('should log execution info', async () => {
        const { logger } = await import('../../../../src/shared/logging/logger.js');
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: 'src/core/',
          agent: 'security',
          quiet: false,
          _: ['review'],
          $0: 'ax'
        } as any);

        expect(logger.info).toHaveBeenCalledWith('Review shortcut executed', {
          path: 'src/core/',
          agent: 'security'
        });
      });

      it('should default to quality agent when agent undefined', async () => {
        const { reviewCommand } = await import('../../../../src/cli/commands/shortcuts.js');

        await reviewCommand.handler({
          path: 'src/',
          agent: undefined,
          quiet: false,
          _: ['review'],
          $0: 'ax'
        } as any);

        const spawnArgs = spawnMock.spawn.mock.calls[0]!;
        expect(spawnArgs[1]).toContain('quality');
      });
    });
  });

  describe('runAxCommand Helper', () => {
    it('should use process.argv for node and script path', async () => {
      const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

      await planCommand.handler({
        task: 'test',
        quiet: false,
        _: ['plan'],
        $0: 'ax'
      } as any);

      expect(spawnMock.spawn).toHaveBeenCalledWith(
        process.argv[0],
        expect.arrayContaining([process.argv[1]]),
        expect.objectContaining({
          stdio: 'inherit',
          env: process.env
        })
      );
    });

    it('should reject when argv is missing node executable', async () => {
      const originalArgv = process.argv;
      Object.defineProperty(process, 'argv', {
        value: [undefined, '/path/to/script'],
        writable: true,
        configurable: true
      });

      vi.resetModules();
      const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

      await planCommand.handler({
        task: 'test',
        quiet: false,
        _: ['plan'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();

      Object.defineProperty(process, 'argv', {
        value: originalArgv,
        writable: true,
        configurable: true
      });
    });

    it('should reject when argv is missing script path', async () => {
      const originalArgv = process.argv;
      Object.defineProperty(process, 'argv', {
        value: ['/usr/bin/node'],
        writable: true,
        configurable: true
      });

      vi.resetModules();
      const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

      await planCommand.handler({
        task: 'test',
        quiet: false,
        _: ['plan'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();

      Object.defineProperty(process, 'argv', {
        value: originalArgv,
        writable: true,
        configurable: true
      });
    });
  });

  describe('Error Handling', () => {
    it('should convert non-Error to Error', async () => {
      workflowMock.saveModeState.mockRejectedValue('string error');
      const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

      await planCommand.handler({
        task: undefined,
        quiet: false,
        _: ['plan'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should display error message from Error object', async () => {
      workflowMock.saveModeState.mockRejectedValue(new Error('Save failed'));
      const { planCommand } = await import('../../../../src/cli/commands/shortcuts.js');

      await planCommand.handler({
        task: undefined,
        quiet: false,
        _: ['plan'],
        $0: 'ax'
      } as any);

      const errorCalls = mockConsoleError.mock.calls.map((c: unknown[]) => c[0]);
      expect(errorCalls.some((c: string) => c?.includes('Save failed'))).toBe(true);
    });
  });
});
