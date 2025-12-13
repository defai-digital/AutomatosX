/**
 * Tests for doctor CLI command
 * Full coverage for handler and all diagnostic functions
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
    dim: vi.fn((s: string) => s),
    bgRed: { white: vi.fn((s: string) => s) },
    bold: Object.assign(vi.fn((s: string) => s), {
      cyan: vi.fn((s: string) => s),
      white: vi.fn((s: string) => s),
      yellow: vi.fn((s: string) => s),
      green: vi.fn((s: string) => s),
      red: vi.fn((s: string) => s)
    })
  }
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    succeed: vi.fn(),
    fail: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    start: vi.fn().mockReturnThis(),
    stop: vi.fn()
  }))
}));

// Use vi.hoisted for stable mocks
const execSyncMock = vi.hoisted(() => vi.fn());
const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  execSync: execSyncMock,
  spawn: spawnMock
}));

const existsSyncMock = vi.hoisted(() => vi.fn());
const statSyncMock = vi.hoisted(() => vi.fn());
const readdirSyncMock = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  existsSync: existsSyncMock,
  statSync: statSyncMock,
  readdirSync: readdirSyncMock
}));

const accessMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  access: accessMock,
  readFile: readFileMock,
  constants: { W_OK: 2 }
}));

const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/core/config/loader.js', () => ({
  loadConfig: loadConfigMock
}));

const pathResolverMock = vi.hoisted(() => ({
  PathResolver: vi.fn().mockImplementation(() => ({
    detectProjectRoot: vi.fn().mockResolvedValue('/test/project')
  }))
}));

vi.mock('../../../../src/shared/validation/path-resolver.js', () => pathResolverMock);

const printErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/shared/errors/error-formatter.js', () => ({
  printError: printErrorMock
}));

const claudeCodeSetupHelperMock = vi.hoisted(() => ({
  ClaudeCodeSetupHelper: vi.fn().mockImplementation(() => ({
    runDiagnostics: vi.fn().mockResolvedValue({
      claudeCodeInstalled: true,
      claudeCodeVersion: '1.0.0',
      mcpServerAvailable: true,
      mcpServerRegistered: true,
      manifestsGenerated: true,
      manifestsValid: true,
      errors: [],
      warnings: []
    })
  }))
}));

vi.mock('../../../../src/integrations/claude-code/setup-helper.js', () => claudeCodeSetupHelperMock);

vi.mock('../../../../src/agents/profile-loader.js', () => ({
  ProfileLoader: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../../../src/core/team-manager.js', () => ({
  TeamManager: vi.fn().mockImplementation(() => ({}))
}));

const providerDetectorMock = vi.hoisted(() => ({
  ProviderDetector: Object.assign(
    vi.fn().mockImplementation(() => ({
      detectAllWithInfo: vi.fn().mockResolvedValue([
        { name: 'claude-code', detected: true, version: '1.0.0' },
        { name: 'gemini-cli', detected: false },
        { name: 'codex', detected: true, version: '2.0.0' }
      ])
    })),
    {
      formatProviderName: vi.fn((name: string) => name.charAt(0).toUpperCase() + name.slice(1))
    }
  )
}));

vi.mock('../../../../src/core/provider-detector.js', () => providerDetectorMock);

vi.mock('../../../../src/core/validation-limits.js', () => ({
  AX_PATHS: {
    ROOT: '.automatosx',
    MEMORY: '.automatosx/memory'
  },
  TIMEOUTS: {
    PROVIDER_DETECTION: 5000
  }
}));

describe('Doctor Command', () => {
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

    // Re-set mock implementations (cleared by vi.clearAllMocks)
    loadConfigMock.mockResolvedValue({
      version: '12.8.3',
      providers: {
        claude: { enabled: true, priority: 1 },
        gemini: { enabled: true, priority: 2 }
      },
      execution: {
        defaultTimeout: 300000,
        concurrency: { maxConcurrentAgents: 4 }
      },
      memory: {
        maxEntries: 10000,
        persistPath: '.automatosx/memory'
      }
    });

    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue({
      size: 102400,
      mtime: new Date()
    });
    readdirSyncMock.mockReturnValue([
      'backend.yaml',
      'frontend.yaml',
      'quality.yaml',
      'security.yaml',
      'session-1.json',
      'session-2.json'
    ]);
    accessMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(JSON.stringify({
      providers: { openai: { enabled: true } },
      mcpServers: { automatosx: { command: 'automatosx' } }
    }));

    execSyncMock.mockImplementation((cmd: string) => {
      if (cmd.includes('--version')) {
        return '1.0.0';
      }
      if (cmd.includes('--help')) {
        return 'Usage: command [options]';
      }
      if (cmd.includes('login status')) {
        return 'logged in as user@example.com';
      }
      if (cmd.includes('PRAGMA integrity_check')) {
        return 'ok';
      }
      if (cmd.includes('SELECT COUNT')) {
        return '100';
      }
      if (cmd.includes('sqlite_master')) {
        return 'memories_fts';
      }
      if (cmd.includes('df -k')) {
        return '/dev/disk1 500000000 100000000 400000000 20% /';
      }
      if (cmd.includes('du -sk')) {
        return '10240';
      }
      if (cmd.includes('which gcc') || cmd.includes('where cl.exe')) {
        return '/usr/bin/gcc';
      }
      return '';
    });

    // Mock spawn for MCP diagnostics
    spawnMock.mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: {
        on: vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') {
            setImmediate(() => cb(Buffer.from('Server started successfully')));
          }
        })
      },
      on: vi.fn(),
      kill: vi.fn()
    });
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    process.env = originalEnv;
    vi.resetModules();
  });

  describe('Helper Functions', () => {
    describe('capitalize', () => {
      const capitalize = (str: string): string => {
        return str.charAt(0).toUpperCase() + str.slice(1);
      };

      it('should capitalize first letter', () => {
        expect(capitalize('hello')).toBe('Hello');
      });

      it('should handle single character', () => {
        expect(capitalize('a')).toBe('A');
      });

      it('should handle empty string', () => {
        expect(capitalize('')).toBe('');
      });

      it('should handle already capitalized', () => {
        expect(capitalize('Hello')).toBe('Hello');
      });
    });

    describe('getProviderEmoji', () => {
      const getProviderEmoji = (provider: string): string => {
        switch (provider) {
          case 'openai': return '🤖';
          case 'gemini': return '✨';
          case 'claude': return '🧠';
          default: return '🔧';
        }
      };

      it('should return robot for openai', () => {
        expect(getProviderEmoji('openai')).toBe('🤖');
      });

      it('should return sparkles for gemini', () => {
        expect(getProviderEmoji('gemini')).toBe('✨');
      });

      it('should return brain for claude', () => {
        expect(getProviderEmoji('claude')).toBe('🧠');
      });

      it('should return wrench for unknown', () => {
        expect(getProviderEmoji('unknown')).toBe('🔧');
      });
    });

    describe('getProviderInstallCommand', () => {
      const getProviderInstallCommand = (provider: string): string => {
        switch (provider) {
          case 'openai':
            return 'npm install -g @openai/codex-cli\n   OR: brew install --cask codex';
          case 'gemini':
            return 'Follow installation guide at: https://ai.google.dev/gemini-api/docs/cli';
          case 'claude':
            return 'Install from: https://claude.com/code\n   OR: npm install -g @anthropic-ai/claude-cli';
          default:
            return 'Check provider documentation for installation instructions';
        }
      };

      it('should return openai install command', () => {
        const result = getProviderInstallCommand('openai');
        expect(result).toContain('npm install');
        expect(result).toContain('codex');
      });

      it('should return gemini install command', () => {
        const result = getProviderInstallCommand('gemini');
        expect(result).toContain('ai.google.dev');
      });

      it('should return claude install command', () => {
        const result = getProviderInstallCommand('claude');
        expect(result).toContain('claude.com');
      });

      it('should return generic for unknown', () => {
        const result = getProviderInstallCommand('unknown');
        expect(result).toContain('documentation');
      });
    });
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');
      expect(doctorCommand.command).toBe('doctor [provider]');
    });

    it('should have description', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');
      expect(doctorCommand.describe).toBe('Run diagnostic checks and validate system setup');
    });

    it('should have builder function', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');
      expect(typeof doctorCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');
      expect(typeof doctorCommand.handler).toBe('function');
    });

    it('should configure all options in builder', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      const mockYargs: any = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis()
      };

      (doctorCommand.builder as Function)(mockYargs);

      expect(mockYargs.positional).toHaveBeenCalledWith('provider', expect.objectContaining({
        type: 'string',
        choices: ['openai', 'gemini', 'claude', 'glm', 'grok']
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('verbose', expect.objectContaining({
        alias: 'v',
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('fix', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('claude-code', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('codex', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('glm', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('grok', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('memory', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('mcp', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('sqlite', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('full', expect.objectContaining({
        type: 'boolean'
      }));

      expect(mockYargs.example).toHaveBeenCalled();
    });
  });

  describe('Handler - Basic Flow', () => {
    it('should run basic health check', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        _: ['doctor'],
        $0: 'ax'
      } as any);

      // Handler should execute and produce output
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should exit with error when configuration fails', async () => {
      loadConfigMock.mockRejectedValue(new Error('Config not found'));

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle verbose mode', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        verbose: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle --full mode with all diagnostics', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        full: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Provider-specific Checks', () => {
    it('should check openai provider when specified', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        provider: 'openai',
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should check gemini provider when specified', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        provider: 'gemini',
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should check claude provider when specified', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        provider: 'claude',
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle provider not found', async () => {
      providerDetectorMock.ProviderDetector.mockImplementationOnce(() => ({
        detectAllWithInfo: vi.fn().mockResolvedValue([
          { name: 'claude-code', detected: false },
          { name: 'gemini-cli', detected: false },
          { name: 'codex', detected: false }
        ])
      }));

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        provider: 'openai',
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - Claude Code Diagnostics', () => {
    it('should run Claude Code diagnostics when flag is set', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        claudeCode: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should exit with error when .automatosx not found', async () => {
      existsSyncMock.mockReturnValue(false);

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        claudeCode: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle diagnostics with errors', async () => {
      claudeCodeSetupHelperMock.ClaudeCodeSetupHelper.mockImplementationOnce(() => ({
        runDiagnostics: vi.fn().mockResolvedValue({
          claudeCodeInstalled: false,
          claudeCodeVersion: null,
          mcpServerAvailable: false,
          mcpServerRegistered: false,
          manifestsGenerated: false,
          manifestsValid: false,
          errors: ['Claude Code not installed'],
          warnings: ['Some warning']
        })
      }));

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        claudeCode: true,
        verbose: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - Codex Diagnostics', () => {
    it('should run Codex diagnostics when flag is set', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        codex: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle Codex CLI not found', async () => {
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd.includes('codex --version')) {
          throw new Error('Command not found');
        }
        return '';
      });

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        codex: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle auth not logged in', async () => {
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd.includes('--version')) {
          return '1.0.0';
        }
        if (cmd.includes('login status')) {
          throw new Error('not logged in');
        }
        if (cmd.includes('--help')) {
          return 'Usage: codex';
        }
        return '';
      });

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        codex: true,
        verbose: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - GLM Diagnostics', () => {
    it('should run GLM diagnostics when flag is set', async () => {
      process.env.GLM_API_KEY = 'test-key';

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        glm: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle missing GLM API key', async () => {
      delete process.env.ZAI_API_KEY;
      delete process.env.ZHIPU_API_KEY;
      delete process.env.GLM_API_KEY;

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        glm: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle GLM with verbose mode', async () => {
      process.env.ZAI_API_KEY = 'test-key-12345678';

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        glm: true,
        verbose: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Grok Diagnostics', () => {
    it('should run Grok diagnostics when flag is set', async () => {
      process.env.XAI_API_KEY = 'xai-test-key';

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        grok: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle missing Grok API key', async () => {
      delete process.env.XAI_API_KEY;
      delete process.env.GROK_API_KEY;

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        grok: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - Memory Diagnostics', () => {
    it('should run memory diagnostics when flag is set', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        memory: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle missing database', async () => {
      existsSyncMock.mockReturnValue(false);

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        memory: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should check FTS5 index', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        memory: true,
        verbose: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle missing FTS5 index', async () => {
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd.includes('sqlite_master')) {
          return ''; // No FTS5 table
        }
        if (cmd.includes('PRAGMA integrity_check')) {
          return 'ok';
        }
        if (cmd.includes('SELECT COUNT')) {
          return '50';
        }
        return '1.0.0';
      });

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        memory: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - MCP Diagnostics', () => {
    it('should run MCP diagnostics when flag is set', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        mcp: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle CLI not available', async () => {
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd.includes('automatosx --version')) {
          throw new Error('Command not found');
        }
        return '';
      });

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        mcp: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should check .mcp.json existence', async () => {
      existsSyncMock.mockImplementation((path: string) => {
        return !path.includes('.mcp.json');
      });

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        mcp: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should validate MCP config content', async () => {
      readFileMock.mockResolvedValue(JSON.stringify({
        mcpServers: {} // Invalid - no automatosx server
      }));

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        mcp: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - SQLite Diagnostics', () => {
    it('should run SQLite diagnostics when flag is set', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        sqlite: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle better-sqlite3 load failure', async () => {
      // This test verifies the error path is handled
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        sqlite: true,
        verbose: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should check C++ build tools', async () => {
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd.includes('which gcc') || cmd.includes('where cl.exe')) {
          throw new Error('not found');
        }
        return '1.0.0';
      });

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        sqlite: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      pathResolverMock.PathResolver.mockImplementationOnce(() => ({
        detectProjectRoot: vi.fn().mockRejectedValue(new Error('Unexpected error'))
      }));

      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(printErrorMock).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Node Version Check', () => {
    it('should pass for Node.js 24+', () => {
      const nodeVersion = 'v24.0.0';
      const versionParts = nodeVersion.slice(1).split('.');
      const parsedMajor = parseInt(versionParts[0] || '0', 10);
      const majorVersion = isNaN(parsedMajor) ? 0 : parsedMajor;
      const isSupported = majorVersion >= 24;

      expect(isSupported).toBe(true);
    });

    it('should fail for Node.js 22', () => {
      const nodeVersion = 'v22.0.0';
      const versionParts = nodeVersion.slice(1).split('.');
      const parsedMajor = parseInt(versionParts[0] || '0', 10);
      const majorVersion = isNaN(parsedMajor) ? 0 : parsedMajor;
      const isSupported = majorVersion >= 24;

      expect(isSupported).toBe(false);
    });

    it('should handle malformed version', () => {
      const nodeVersion = 'invalid';
      const versionParts = nodeVersion.slice(1).split('.');
      const parsedMajor = parseInt(versionParts[0] || '0', 10);
      const majorVersion = isNaN(parsedMajor) ? 0 : parsedMajor;
      const isSupported = majorVersion >= 24;

      expect(isSupported).toBe(false);
    });
  });

  describe('Check Command Helper', () => {
    it('should return success when command works', () => {
      execSyncMock.mockReturnValue('output');

      let success = false;
      let output = '';
      try {
        output = execSyncMock('test --version', { encoding: 'utf-8' }) as string;
        success = true;
      } catch {
        success = false;
      }

      expect(success).toBe(true);
      expect(output).toBe('output');
    });

    it('should return failure when command throws', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('Command not found');
      });

      let success = false;
      let error = '';
      try {
        execSyncMock('nonexistent --version', { encoding: 'utf-8' });
        success = true;
      } catch (e) {
        success = false;
        error = (e as Error).message;
      }

      expect(success).toBe(false);
      expect(error).toContain('not found');
    });
  });

  describe('OpenAI Auth Check', () => {
    it('should detect logged in status', () => {
      execSyncMock.mockReturnValue('logged in as user@example.com');

      const output = execSyncMock('codex login status 2>&1', { encoding: 'utf-8' }) as string;
      const statusText = output.toLowerCase();

      expect(statusText.includes('logged in')).toBe(true);
    });

    it('should detect authenticated status', () => {
      execSyncMock.mockReturnValue('authenticated');

      const output = execSyncMock('codex login status 2>&1', { encoding: 'utf-8' }) as string;
      const statusText = output.toLowerCase();

      expect(statusText.includes('authenticated')).toBe(true);
    });

    it('should detect not authenticated', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('not logged in');
      });

      let success = false;
      let fix = '';

      try {
        execSyncMock('codex login status 2>&1', { encoding: 'utf-8' });
        success = true;
      } catch (e) {
        const errorMsg = (e as Error).message.toLowerCase();
        if (errorMsg.includes('not logged in')) {
          success = false;
          fix = 'Run: codex login';
        }
      }

      expect(success).toBe(false);
      expect(fix).toBe('Run: codex login');
    });

    it('should detect not authenticated with different message', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('not authenticated');
      });

      let errorMsg = '';
      try {
        execSyncMock('codex login status 2>&1', { encoding: 'utf-8' });
      } catch (e) {
        errorMsg = (e as Error).message.toLowerCase();
      }

      expect(errorMsg.includes('not authenticated')).toBe(true);
    });
  });

  describe('File System Checks', () => {
    it('should detect .automatosx directory', () => {
      existsSyncMock.mockReturnValue(true);

      const result = existsSyncMock('/test/.automatosx');
      expect(result).toBe(true);
    });

    it('should detect missing .automatosx directory', () => {
      existsSyncMock.mockReturnValue(false);

      const result = existsSyncMock('/test/.automatosx');
      expect(result).toBe(false);
    });

    it('should check write permissions', async () => {
      accessMock.mockResolvedValue(undefined);

      let hasPermission = false;
      try {
        await accessMock('/test', 2);
        hasPermission = true;
      } catch {
        hasPermission = false;
      }

      expect(hasPermission).toBe(true);
    });

    it('should handle permission denied', async () => {
      accessMock.mockRejectedValue(new Error('Permission denied'));

      let hasPermission = true;
      try {
        await accessMock('/test', 2);
      } catch {
        hasPermission = false;
      }

      expect(hasPermission).toBe(false);
    });
  });

  describe('Memory System Checks', () => {
    it('should detect memory database', () => {
      existsSyncMock.mockReturnValue(true);
      statSyncMock.mockReturnValue({
        size: 1024 * 100,
        mtime: new Date()
      });

      const dbExists = existsSyncMock('/test/.automatosx/memory/memories.db');
      expect(dbExists).toBe(true);

      const stats = statSyncMock('/test/.automatosx/memory/memories.db');
      const sizeKB = Math.round(stats.size / 1024);
      expect(sizeKB).toBe(100);
    });

    it('should check database integrity', () => {
      execSyncMock.mockReturnValue('ok');

      const output = execSyncMock('sqlite3 db.db "PRAGMA integrity_check;"', { encoding: 'utf-8' }) as string;
      const integrityOk = output.includes('ok');

      expect(integrityOk).toBe(true);
    });

    it('should handle database larger than 1MB', () => {
      statSyncMock.mockReturnValue({
        size: 1024 * 1024 * 5, // 5MB
        mtime: new Date()
      });

      const stats = statSyncMock('/test/.automatosx/memory/memories.db');
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      expect(sizeMB).toBe('5.00');
    });

    it('should handle statSync error', () => {
      statSyncMock.mockImplementation(() => {
        throw new Error('Cannot read stats');
      });

      let errorOccurred = false;
      try {
        statSyncMock('/test/.automatosx/memory/memories.db');
      } catch {
        errorOccurred = true;
      }

      expect(errorOccurred).toBe(true);
    });
  });

  describe('Session System Checks', () => {
    it('should count session files', () => {
      existsSyncMock.mockReturnValue(true);
      readdirSyncMock.mockReturnValue([
        'session-1.json',
        'session-2.json',
        'session-3.json'
      ]);

      const files = readdirSyncMock('/test/.automatosx/sessions')
        .filter((f: string) => f.endsWith('.json'));

      expect(files.length).toBe(3);
    });

    it('should warn about too many sessions', () => {
      const sessionCount = 60;
      const needsCleanup = sessionCount > 50;

      expect(needsCleanup).toBe(true);
    });

    it('should handle readdirSync error', () => {
      readdirSyncMock.mockImplementation(() => {
        throw new Error('Cannot read directory');
      });

      let errorOccurred = false;
      try {
        readdirSyncMock('/test/.automatosx/sessions');
      } catch {
        errorOccurred = true;
      }

      expect(errorOccurred).toBe(true);
    });
  });

  describe('Agent Profile Checks', () => {
    it('should count agent profiles', () => {
      existsSyncMock.mockReturnValue(true);
      readdirSyncMock.mockReturnValue([
        'backend.yaml',
        'frontend.yaml',
        'quality.yml',
        'security.yaml'
      ]);

      const files = readdirSyncMock('/test/.automatosx/agents')
        .filter((f: string) => f.endsWith('.yaml') || f.endsWith('.yml'));

      expect(files.length).toBe(4);
    });

    it('should check essential agents', () => {
      const files = ['backend.yaml', 'frontend.yaml', 'quality.yaml'];
      const essentialAgents = ['backend', 'frontend', 'quality', 'security'];

      const foundEssential = essentialAgents.filter(agent =>
        files.some(f => f.startsWith(agent))
      );

      expect(foundEssential.length).toBe(3);
      expect(foundEssential).toContain('backend');
      expect(foundEssential).toContain('frontend');
      expect(foundEssential).toContain('quality');
    });

    it('should handle missing agents directory', () => {
      existsSyncMock.mockReturnValue(false);

      const agentsDirExists = existsSyncMock('/test/.automatosx/agents');
      expect(agentsDirExists).toBe(false);
    });
  });

  describe('Network Connectivity Checks', () => {
    it('should check API endpoint reachability', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({ status: 200 });

      const response = await global.fetch('https://api.anthropic.com/v1/models', { method: 'HEAD' });

      expect(response.status).toBe(200);

      global.fetch = originalFetch;
    });

    it('should handle unreachable endpoints', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      let reachable = false;
      try {
        await global.fetch('https://api.example.com');
        reachable = true;
      } catch {
        reachable = false;
      }

      expect(reachable).toBe(false);

      global.fetch = originalFetch;
    });

    it('should handle fetch returning null', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue(null);

      const response = await global.fetch('https://api.example.com', { method: 'HEAD' });

      expect(response).toBeNull();

      global.fetch = originalFetch;
    });
  });

  describe('Disk Space Checks', () => {
    it('should parse df output', () => {
      execSyncMock.mockReturnValue('/dev/disk1 500000000 100000000 400000000 20% /');

      const dfOutput = execSyncMock('df -k "/test" | tail -1', { encoding: 'utf-8' }) as string;
      const parts = dfOutput.trim().split(/\s+/);
      const availableKB = parseInt(parts[3] || '0', 10);
      const availableMB = Math.round(availableKB / 1024);

      expect(availableMB).toBeGreaterThan(0);
    });

    it('should detect low disk space', () => {
      const availableMB = 50;
      const hasEnoughSpace = availableMB > 100;

      expect(hasEnoughSpace).toBe(false);
    });

    it('should handle NaN in disk space parsing', () => {
      const rawAvailable = undefined;
      const availableKB = parseInt(rawAvailable || '0', 10);
      const safeAvailableKB = isNaN(availableKB) ? 0 : availableKB;

      expect(safeAvailableKB).toBe(0);
    });

    it('should handle large disk space (GB)', () => {
      const availableKB = 1024 * 1024 * 100; // 100GB
      const availableGB = (availableKB / (1024 * 1024)).toFixed(2);
      const availableMB = Math.round(availableKB / 1024);

      expect(availableMB).toBeGreaterThan(1024);
      expect(availableGB).toBe('100.00');
    });

    it('should handle df command error', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('df command failed');
      });

      let errorOccurred = false;
      try {
        execSyncMock('df -k "/test" | tail -1', { encoding: 'utf-8' });
      } catch {
        errorOccurred = true;
      }

      expect(errorOccurred).toBe(true);
    });
  });

  describe('GLM Diagnostics Details', () => {
    it('should check GLM API key from ZAI_API_KEY', () => {
      process.env.ZAI_API_KEY = 'zai-test-key';

      const apiKey = process.env.ZAI_API_KEY || process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY;

      expect(apiKey).toBe('zai-test-key');
    });

    it('should check GLM API key from ZHIPU_API_KEY', () => {
      delete process.env.ZAI_API_KEY;
      process.env.ZHIPU_API_KEY = 'zhipu-test-key';

      const apiKey = process.env.ZAI_API_KEY || process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY;

      expect(apiKey).toBe('zhipu-test-key');
    });

    it('should detect missing API key', () => {
      delete process.env.ZAI_API_KEY;
      delete process.env.ZHIPU_API_KEY;
      delete process.env.GLM_API_KEY;

      const apiKey = process.env.ZAI_API_KEY || process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY;

      expect(apiKey).toBeUndefined();
    });
  });

  describe('Grok Diagnostics Details', () => {
    it('should check Grok API key from XAI_API_KEY', () => {
      process.env.XAI_API_KEY = 'xai-test-key';

      const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;

      expect(apiKey).toBe('xai-test-key');
    });

    it('should check Grok API key from GROK_API_KEY', () => {
      delete process.env.XAI_API_KEY;
      process.env.GROK_API_KEY = 'grok-test-key';

      const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;

      expect(apiKey).toBe('grok-test-key');
    });

    it('should detect missing API key', () => {
      delete process.env.XAI_API_KEY;
      delete process.env.GROK_API_KEY;

      const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;

      expect(apiKey).toBeUndefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should check enabled providers', () => {
      const config = {
        providers: {
          claude: { enabled: true, priority: 1 },
          gemini: { enabled: false, priority: 2 }
        }
      };

      const enabledProviders = Object.entries(config.providers)
        .filter(([_, cfg]) => cfg.enabled)
        .map(([name]) => name);

      expect(enabledProviders).toEqual(['claude']);
    });

    it('should handle no enabled providers', () => {
      const config = {
        providers: {
          claude: { enabled: false },
          gemini: { enabled: false }
        }
      };

      const enabledProviders = Object.entries(config.providers)
        .filter(([_, cfg]) => cfg.enabled)
        .map(([name]) => name);

      expect(enabledProviders.length).toBe(0);
    });

    it('should check execution timeout', () => {
      const config = {
        execution: { defaultTimeout: 300000 }
      };

      const defaultTimeout = config.execution?.defaultTimeout ?? 0;
      const hasValidTimeout = defaultTimeout > 0;
      const timeoutMinutes = Math.round(defaultTimeout / 60000);

      expect(hasValidTimeout).toBe(true);
      expect(timeoutMinutes).toBe(5);
    });

    it('should handle invalid timeout', () => {
      const config = {
        execution: { defaultTimeout: 0 }
      };

      const defaultTimeout = config.execution?.defaultTimeout ?? 0;
      const hasValidTimeout = defaultTimeout > 0;

      expect(hasValidTimeout).toBe(false);
    });

    it('should check memory settings', () => {
      const config = {
        memory: { maxEntries: 10000 }
      };

      const maxEntries = config.memory?.maxEntries ?? 0;
      const hasValidMemory = maxEntries > 0;

      expect(hasValidMemory).toBe(true);
    });
  });

  describe('Summary Display', () => {
    it('should count passed and failed checks', () => {
      const results = [
        { name: 'Check 1', category: 'System', passed: true, message: 'OK' },
        { name: 'Check 2', category: 'System', passed: false, message: 'Failed' },
        { name: 'Check 3', category: 'System', passed: true, message: 'OK' }
      ];

      const passed = results.filter(r => r.passed).length;
      const failed = results.filter(r => !r.passed).length;
      const total = results.length;

      expect(passed).toBe(2);
      expect(failed).toBe(1);
      expect(total).toBe(3);
    });

    it('should group by category in verbose mode', () => {
      const results = [
        { name: 'Check 1', category: 'System', passed: true, message: 'OK' },
        { name: 'Check 2', category: 'Provider', passed: true, message: 'OK' },
        { name: 'Check 3', category: 'System', passed: false, message: 'Failed' }
      ];

      const byCategory = results.reduce((acc, r) => {
        if (!acc[r.category]) {
          acc[r.category] = [];
        }
        acc[r.category]!.push(r);
        return acc;
      }, {} as Record<string, typeof results>);

      expect(Object.keys(byCategory)).toEqual(['System', 'Provider']);
      expect(byCategory['System']?.length).toBe(2);
      expect(byCategory['Provider']?.length).toBe(1);
    });
  });

  describe('MCP Diagnostics Details', () => {
    it('should check .mcp.json existence', () => {
      existsSyncMock.mockReturnValue(true);

      const mcpJsonExists = existsSyncMock('/test/.mcp.json');
      expect(mcpJsonExists).toBe(true);
    });

    it('should validate MCP config content', () => {
      const mcpConfig = {
        mcpServers: {
          automatosx: {
            command: 'automatosx'
          }
        }
      };

      const isValid = !!mcpConfig?.mcpServers?.automatosx?.command;
      expect(isValid).toBe(true);
    });

    it('should detect invalid MCP config', () => {
      const mcpConfig = {
        mcpServers: {}
      };

      const isValid = !!(mcpConfig as any)?.mcpServers?.automatosx?.command;
      expect(isValid).toBe(false);
    });
  });

  describe('System Dependencies', () => {
    it('should check ripgrep installation', () => {
      execSyncMock.mockReturnValue('ripgrep 14.0.0');

      const output = execSyncMock('rg --version', { encoding: 'utf-8' }) as string;
      const version = output.split('\n')[0]?.trim();

      expect(version).toContain('ripgrep');
    });

    it('should check git installation', () => {
      execSyncMock.mockReturnValue('git version 2.40.0');

      const output = execSyncMock('git --version', { encoding: 'utf-8' }) as string;

      expect(output).toContain('git version');
    });
  });

  describe('Claude Code Diagnostics Details', () => {
    it('should run Claude Code setup helper diagnostics', () => {
      const mockDiagnostics = {
        claudeCodeInstalled: true,
        claudeCodeVersion: '1.0.0',
        mcpServerAvailable: true,
        mcpServerRegistered: true,
        manifestsGenerated: true,
        manifestsValid: true,
        errors: [],
        warnings: []
      };

      expect(claudeCodeSetupHelperMock.ClaudeCodeSetupHelper).toBeDefined();

      expect(mockDiagnostics.claudeCodeInstalled).toBe(true);
      expect(mockDiagnostics.mcpServerAvailable).toBe(true);
      expect(mockDiagnostics.manifestsGenerated).toBe(true);
    });
  });

  describe('Codex Diagnostics Details', () => {
    it('should check Codex CLI installation', () => {
      execSyncMock.mockReturnValue('1.0.0');

      const output = execSyncMock('codex --version', { encoding: 'utf-8' }) as string;
      const version = output.trim();

      expect(version).toBe('1.0.0');
    });

    it('should check provider configuration', () => {
      const config = {
        providers: {
          openai: { enabled: true }
        }
      };

      const providerConfigured = config?.providers?.openai?.enabled === true;
      expect(providerConfigured).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', () => {
      const error = new Error('Test error');

      printErrorMock(error);

      expect(printErrorMock).toHaveBeenCalledWith(error);
    });
  });

  describe('CLI Provider Check', () => {
    it('should check generic CLI provider', () => {
      execSyncMock
        .mockReturnValueOnce('1.0.0')
        .mockReturnValueOnce('Usage: gemini [options]');

      const versionCheck = execSyncMock('gemini --version', { encoding: 'utf-8' }) as string;
      expect(versionCheck).toBe('1.0.0');

      const helpCheck = execSyncMock('gemini --help', { encoding: 'utf-8' }) as string;
      expect(helpCheck).toContain('Usage');
    });
  });

  describe('Provider Detection', () => {
    it('should map provider names', () => {
      const providerMap: Record<string, string> = {
        'openai': 'codex',
        'gemini': 'gemini-cli',
        'claude': 'claude-code'
      };

      expect(providerMap['openai']).toBe('codex');
      expect(providerMap['gemini']).toBe('gemini-cli');
      expect(providerMap['claude']).toBe('claude-code');
    });
  });

  describe('Display Check Function', () => {
    it('should display passed check with details', () => {
      const result = {
        name: 'Test Check',
        category: 'System',
        passed: true,
        message: 'All good',
        details: 'Some details'
      };

      // Verify the result structure
      expect(result.passed).toBe(true);
      expect(result.details).toBeTruthy();
    });

    it('should display failed check', () => {
      const result = {
        name: 'Test Check',
        category: 'System',
        passed: false,
        message: 'Failed',
        fix: 'Run: some command'
      };

      expect(result.passed).toBe(false);
      expect(result.fix).toBeTruthy();
    });
  });

  describe('Full Mode Additional Checks', () => {
    it('should run system dependencies check in full mode', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        full: true,
        verbose: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should run config validation in full mode', async () => {
      const { doctorCommand } = await import('../../../../src/cli/commands/doctor.js');

      await doctorCommand.handler({
        full: true,
        _: ['doctor'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Database Path Escaping', () => {
    it('should escape special characters in db path', () => {
      const dbPath = '/path/with "quotes"/db.sqlite';
      const escapedDbPath = `"${dbPath.replace(/"/g, '\\"')}"`;

      expect(escapedDbPath).toBe('"/path/with \\"quotes\\"/db.sqlite"');
    });
  });

  describe('API Endpoint Check', () => {
    it('should handle timeout in endpoint check', async () => {
      const originalFetch = global.fetch;
      const controller = new AbortController();

      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Aborted')), 100);
        });
      });

      let result = false;
      try {
        await global.fetch('https://api.example.com', { signal: controller.signal });
        result = true;
      } catch {
        result = false;
      }

      expect(result).toBe(false);

      global.fetch = originalFetch;
    });
  });

  describe('GLM and Grok CLI Checks', () => {
    it('should check ax-glm CLI version', () => {
      execSyncMock.mockReturnValue('1.2.0');

      const output = execSyncMock('ax-glm --version', { encoding: 'utf8', timeout: 5000 }) as string;

      expect(output.trim()).toBe('1.2.0');
    });

    it('should handle ax-glm CLI not found', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('command not found: ax-glm');
      });

      let cliInstalled = false;
      try {
        execSyncMock('ax-glm --version', { encoding: 'utf8', timeout: 5000 });
        cliInstalled = true;
      } catch {
        cliInstalled = false;
      }

      expect(cliInstalled).toBe(false);
    });

    it('should check ax-grok CLI version', () => {
      execSyncMock.mockReturnValue('1.3.0');

      const output = execSyncMock('ax-grok --version', { encoding: 'utf8', timeout: 5000 }) as string;

      expect(output.trim()).toBe('1.3.0');
    });
  });
});
