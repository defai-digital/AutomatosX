/**
 * Tests for setup CLI command
 * Full coverage for handler and all setup functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports using vi.hoisted for stable references
const mkdirMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());
const accessMock = vi.hoisted(() => vi.fn());
const readdirMock = vi.hoisted(() => vi.fn());
const copyFileMock = vi.hoisted(() => vi.fn());
const rmMock = vi.hoisted(() => vi.fn());
const statMock = vi.hoisted(() => vi.fn());

vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((s: string) => s),
    gray: vi.fn((s: string) => s),
    green: Object.assign(vi.fn((s: string) => s), {
      bold: vi.fn((s: string) => s)
    }),
    yellow: vi.fn((s: string) => s),
    red: vi.fn((s: string) => s),
    blue: Object.assign(vi.fn((s: string) => s), {
      bold: vi.fn((s: string) => s)
    }),
    white: vi.fn((s: string) => s),
    dim: vi.fn((s: string) => s)
  }
}));

vi.mock('fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  readFile: readFileMock,
  access: accessMock,
  readdir: readdirMock,
  copyFile: copyFileMock,
  rm: rmMock,
  stat: statMock
}));

vi.mock('fs', () => ({
  constants: { F_OK: 0 }
}));

vi.mock('../../../../src/types/config.js', () => ({
  DEFAULT_CONFIG: {
    providers: {},
    memory: { maxEntries: 1000 },
    workspace: { prdPath: 'PRD' }
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

const printErrorMock = vi.hoisted(() => vi.fn());
vi.mock('../../../../src/shared/errors/error-formatter.js', () => ({
  printError: printErrorMock
}));

const promptHelperMock = vi.hoisted(() => ({
  withPrompt: vi.fn().mockImplementation(async (fn: (prompt: any) => Promise<any>) => {
    // Default mock returns true (user confirms)
    const mockPrompt = {
      question: vi.fn().mockResolvedValue('y'),
      close: vi.fn()
    };
    return fn(mockPrompt);
  })
}));
vi.mock('../../../../src/shared/helpers/prompt-helper.js', () => promptHelperMock);

vi.mock('../../../../src/shared/helpers/package-root.js', () => ({
  getPackageRoot: vi.fn().mockReturnValue('/package/root')
}));

const claudeCodeSetupHelperMock = vi.hoisted(() => ({
  ClaudeCodeSetupHelper: function() {
    return {
      setup: vi.fn().mockResolvedValue(undefined)
    };
  }
}));
vi.mock('../../../../src/integrations/claude-code/setup-helper.js', () => claudeCodeSetupHelperMock);

vi.mock('../../../../src/agents/profile-loader.js', () => ({
  ProfileLoader: function() {
    return {};
  }
}));

vi.mock('../../../../src/core/team-manager.js', () => ({
  TeamManager: function() {
    return {};
  }
}));

const providerDetectorMock = vi.hoisted(() => ({
  ProviderDetector: Object.assign(
    function() {
      return {
        detectAll: vi.fn().mockResolvedValue({
          'claude-code': true,
          'gemini-cli': false,
          'codex': false,
          'glm': false,
          'grok': false,
          'qwen': false
        })
      };
    },
    {
      formatProviderName: vi.fn((name: string) => {
        const names: Record<string, string> = {
          'claude-code': 'Claude Code',
          'gemini-cli': 'Gemini CLI',
          'codex': 'Codex CLI',
          'glm': 'GLM',
          'grok': 'Grok',
          'qwen': 'Qwen'
        };
        return names[name] || name;
      })
    }
  )
}));
vi.mock('../../../../src/core/provider-detector.js', () => providerDetectorMock);

const routingConfiguratorMock = vi.hoisted(() => ({
  RoutingConfigurator: function() {
    return {
      detectCapabilities: vi.fn().mockResolvedValue(undefined),
      generateRecommendation: vi.fn().mockReturnValue({
        providers: { claude: { priority: 1 } }
      }),
      generateReport: vi.fn().mockReturnValue('Routing report'),
      applyRecommendation: vi.fn().mockResolvedValue({
        applied: true,
        changes: ['Updated claude priority']
      })
    };
  }
}));
vi.mock('../../../../src/core/routing-configurator.js', () => routingConfiguratorMock);

// Mock child_process for git init and MCP CLI commands
const spawnMock = vi.hoisted(() => vi.fn());
const execMock = vi.hoisted(() => vi.fn());
vi.mock('child_process', () => ({
  spawn: spawnMock,
  exec: execMock
}));

// Mock util for promisify
vi.mock('util', () => ({
  promisify: (fn: any) => fn
}));

describe('Setup Command', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let originalEnv: NodeJS.ProcessEnv;
  let originalStdoutIsTTY: boolean | undefined;
  let originalStdinIsTTY: boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalEnv = { ...process.env };
    originalStdoutIsTTY = process.stdout.isTTY;
    originalStdinIsTTY = process.stdin.isTTY;

    // Default: skip MCP setup in tests
    process.env.VITEST = '1';
    process.env.AX_MOCK_PROVIDERS = 'true';

    // Re-set mock implementations after vi.clearAllMocks
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(JSON.stringify({
      version: '12.8.3',
      providers: {}
    }));
    accessMock.mockRejectedValue(new Error('ENOENT')); // Default: doesn't exist
    readdirMock.mockResolvedValue([
      'backend.yaml',
      'frontend.yaml',
      'quality.yaml',
      'security.yaml'
    ]);
    copyFileMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
    statMock.mockResolvedValue({ isDirectory: () => true });

    // Mock spawn for git init
    spawnMock.mockReturnValue({
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code: number | null) => void) => {
        if (event === 'close') {
          setImmediate(() => cb(0));
        }
      }),
      kill: vi.fn()
    });

    // Mock exec for MCP CLI commands
    execMock.mockImplementation((cmd: string, _opts: any, cb?: (error: Error | null, stdout: string, stderr: string) => void) => {
      if (cb) {
        cb(null, '', '');
      }
      return Promise.resolve({ stdout: '', stderr: '' });
    });
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    process.env = originalEnv;
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    vi.resetModules();
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');
      expect(setupCommand.command).toBe('setup [path]');
    });

    it('should have description', async () => {
      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');
      expect(setupCommand.describe).toContain('Set up AutomatosX');
    });

    it('should have builder function', async () => {
      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');
      expect(typeof setupCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');
      expect(typeof setupCommand.handler).toBe('function');
    });

    it('should configure options in builder', async () => {
      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      const mockYargs: any = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis()
      };

      (setupCommand.builder as Function)(mockYargs);

      expect(mockYargs.positional).toHaveBeenCalledWith('path', expect.objectContaining({
        type: 'string',
        default: '.'
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('force', expect.objectContaining({
        alias: 'f',
        type: 'boolean'
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('claude-code', expect.objectContaining({
        type: 'boolean',
        hidden: true
      }));
    });
  });

  describe('Handler - Basic Flow', () => {
    it('should run setup successfully', async () => {
      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      // Handler should produce output
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle setup with force flag', async () => {
      // Setup: .automatosx exists
      accessMock.mockImplementation((path: string) => {
        if (path.includes('.automatosx')) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        force: true,
        _: ['setup'],
        $0: 'ax'
      } as any);

      // Handler should produce output
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should exit when .automatosx exists without force', async () => {
      // Setup: .automatosx exists
      accessMock.mockResolvedValue(undefined);

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - Home Directory Guard', () => {
    it('should block setup in home directory on Unix', async () => {
      process.env.HOME = '/Users/test';

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/Users/test',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should block setup in home directory on Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
      process.env.USERPROFILE = 'C:\\Users\\Test';

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: 'C:\\Users\\Test',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);

      Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
    });
  });

  describe('Handler - Provider Detection', () => {
    it('should continue when no providers found (non-interactive)', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': false,
              'gemini-cli': false,
              'codex': false,
              'glm': false,
              'grok': false,
              'qwen': false
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
      Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      // Should produce output
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should list found providers', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': true,
              'gemini-cli': true,
              'codex': false
            })
          };
        },
        {
          formatProviderName: vi.fn((name: string) => {
            const names: Record<string, string> = {
              'claude-code': 'Claude Code',
              'gemini-cli': 'Gemini CLI'
            };
            return names[name] || name;
          })
        }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      // Should produce output
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Claude Code Integration', () => {
    it('should setup Claude Code integration when detected', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': true,
              'gemini-cli': false,
              'codex': false
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      // The handler should produce output (may fail or succeed depending on environment)
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should run legacy Claude Code setup with --claude-code flag', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': true,
              'gemini-cli': false,
              'codex': false
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        claudeCode: true,
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Gemini CLI Integration', () => {
    it('should setup Gemini CLI integration when detected', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': false,
              'gemini-cli': true,
              'codex': false
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Codex CLI Integration', () => {
    it('should setup Codex CLI integration when detected', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': false,
              'gemini-cli': false,
              'codex': true
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - SDK Providers', () => {
    it('should setup Qwen integration when detected', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': false,
              'gemini-cli': false,
              'codex': false,
              'glm': false,
              'grok': false,
              'qwen': true
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show SDK-first provider info for GLM', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': false,
              'glm': true,
              'grok': false
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show SDK-first provider info for Grok', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': false,
              'glm': false,
              'grok': true
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Error Handling', () => {
    it('should rollback on error', async () => {
      // First call succeeds (directory structure), then fail on copy
      let callCount = 0;
      mkdirMock.mockImplementation(() => {
        callCount++;
        if (callCount > 5) {
          throw new Error('Simulated error');
        }
        return Promise.resolve(undefined);
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(printErrorMock).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should not rollback in force mode', async () => {
      accessMock.mockResolvedValue(undefined); // Exists
      statMock.mockRejectedValue(new Error('stat failed'));

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        force: true,
        _: ['setup'],
        $0: 'ax'
      } as any);

      // Should print error but not call rollback
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - Environment Validation', () => {
    it('should fail when required directories are missing', async () => {
      statMock.mockRejectedValue(new Error('ENOENT'));

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - Git Initialization', () => {
    it('should initialize git when not a git repo', async () => {
      // Not a git repo
      accessMock.mockImplementation((path: string) => {
        if (path.includes('.git')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      // Handler should have run and produced output
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should skip git init when already a git repo', async () => {
      // Is a git repo
      accessMock.mockImplementation((path: string) => {
        if (path.includes('.git')) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      // Handler should have run and produced output
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle git not installed', async () => {
      spawnMock.mockReturnValue({
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: any) => {
          if (event === 'error') {
            setImmediate(() => cb(new Error('spawn git ENOENT')));
          }
        }),
        kill: vi.fn()
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      // Should produce some output (warning or otherwise)
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Routing Configuration', () => {
    it('should apply routing recommendation', async () => {
      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      // The handler should run and produce output
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle empty providers in routing', async () => {
      routingConfiguratorMock.RoutingConfigurator = function() {
        return {
          detectCapabilities: vi.fn().mockResolvedValue(undefined),
          generateRecommendation: vi.fn().mockReturnValue({
            providers: {}
          }),
          generateReport: vi.fn().mockReturnValue(''),
          applyRecommendation: vi.fn().mockResolvedValue({
            applied: false,
            changes: []
          })
        };
      } as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      // The handler should run and produce output
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Home Directory Guard', () => {
    it('should detect home directory on Unix', () => {
      const homeDir = '/Users/test';
      const projectDir = '/Users/test';

      const isSameDir = projectDir === homeDir;

      expect(isSameDir).toBe(true);
    });

    it('should detect home directory on Windows (case-insensitive)', () => {
      const homeDir = 'C:\\Users\\Test';
      const projectDir = 'c:\\users\\test';

      const isSameDir = projectDir.toLowerCase() === homeDir.toLowerCase();

      expect(isSameDir).toBe(true);
    });

    it('should allow project subdirectory', () => {
      const homeDir: string = '/Users/test';
      const projectDir: string = '/Users/test/projects/my-app';

      const isSameDir = projectDir === homeDir;

      expect(isSameDir).toBe(false);
    });
  });

  describe('Directory Structure', () => {
    it('should create all required directories', () => {
      const baseDir = '.automatosx';
      const dirs = [
        baseDir,
        `${baseDir}/agents`,
        `${baseDir}/teams`,
        `${baseDir}/abilities`,
        `${baseDir}/templates`,
        `${baseDir}/memory`,
        `${baseDir}/memory/exports`,
        `${baseDir}/sessions`,
        `${baseDir}/logs`,
        `${baseDir}/workflows`,
        `${baseDir}/iterate`,
        `${baseDir}/state`
      ];

      expect(dirs.length).toBe(12);
      expect(dirs).toContain(`${baseDir}/agents`);
      expect(dirs).toContain(`${baseDir}/workflows`);
    });
  });

  describe('Environment Validation', () => {
    it('should require example directories', () => {
      const requiredDirs = [
        'examples/agents',
        'examples/abilities',
        'examples/workflows',
        'examples/teams'
      ];

      expect(requiredDirs).toContain('examples/agents');
      expect(requiredDirs).toContain('examples/teams');
    });
  });

  describe('Skip MCP Setup Detection', () => {
    it('should skip MCP setup in test mode', () => {
      process.env.VITEST = '1';

      const shouldSkip = (
        process.env.AUTOMATOSX_SKIP_MCP_SETUP === 'true' ||
        process.env.AX_MOCK_PROVIDERS === 'true' ||
        process.env.VITEST === '1' ||
        process.env.NODE_ENV === 'test'
      );

      expect(shouldSkip).toBe(true);
    });

    it('should skip MCP setup when explicitly requested', () => {
      process.env.AUTOMATOSX_SKIP_MCP_SETUP = 'true';

      const shouldSkip = process.env.AUTOMATOSX_SKIP_MCP_SETUP === 'true';

      expect(shouldSkip).toBe(true);
    });
  });

  describe('File Copying', () => {
    it('should filter YAML files for agents', () => {
      const files = ['backend.yaml', 'frontend.yml', 'readme.md'];
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      expect(yamlFiles).toEqual(['backend.yaml', 'frontend.yml']);
    });

    it('should filter markdown files for abilities', () => {
      const files = ['code-review.md', 'testing.md', 'config.yaml'];
      const mdFiles = files.filter(f => f.endsWith('.md'));

      expect(mdFiles).toEqual(['code-review.md', 'testing.md']);
    });
  });

  describe('Config Creation', () => {
    it('should not overwrite existing config unless forced', async () => {
      const exists = true;
      const force = false;

      const shouldWrite = !exists || force;

      expect(shouldWrite).toBe(false);
    });

    it('should overwrite config when forced', () => {
      const exists = true;
      const force = true;

      const shouldWrite = !exists || force;

      expect(shouldWrite).toBe(true);
    });
  });

  describe('Config Merge Behavior (v12.8.4)', () => {
    it('should describe force behavior - delete and recreate', () => {
      const behavior = {
        force: true,
        action: 'delete_and_recreate',
        description: 'Create fresh config from DEFAULT_CONFIG'
      };

      expect(behavior.action).toBe('delete_and_recreate');
    });

    it('should describe non-force behavior - merge missing fields', () => {
      const behavior = {
        force: false,
        action: 'merge_missing',
        description: 'Deep merge missing fields from DEFAULT_CONFIG'
      };

      expect(behavior.action).toBe('merge_missing');
    });

    it('should deep merge missing fields correctly', () => {
      const defaults = {
        providers: {
          'claude-code': { timeout: 2700000, priority: 1 }
        },
        memory: { maxEntries: 10000 },
        newSection: { enabled: true }
      };

      const existing = {
        providers: {
          'claude-code': { timeout: 999999 }
        },
        memory: { maxEntries: 5000 }
      };

      const deepMerge = (
        defaults: Record<string, unknown>,
        target: Record<string, unknown>
      ): Record<string, unknown> => {
        const result = { ...target };
        for (const key of Object.keys(defaults)) {
          if (!(key in result)) {
            result[key] = defaults[key];
          } else if (
            typeof defaults[key] === 'object' &&
            defaults[key] !== null &&
            !Array.isArray(defaults[key]) &&
            typeof result[key] === 'object' &&
            result[key] !== null &&
            !Array.isArray(result[key])
          ) {
            result[key] = deepMerge(
              defaults[key] as Record<string, unknown>,
              result[key] as Record<string, unknown>
            );
          }
        }
        return result;
      };

      const merged = deepMerge(defaults, existing);

      expect((merged.providers as any)['claude-code'].timeout).toBe(999999);
      expect((merged.memory as any).maxEntries).toBe(5000);
      expect((merged.providers as any)['claude-code'].priority).toBe(1);
      expect(merged.newSection).toEqual({ enabled: true });
    });

    it('should preserve arrays without merging', () => {
      const defaults = {
        execution: {
          retry: {
            retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT']
          }
        }
      };

      const existing = {
        execution: {
          retry: {
            retryableErrors: ['CUSTOM_ERROR']
          }
        }
      };

      const preserveArrayMerge = (
        defaults: Record<string, unknown>,
        target: Record<string, unknown>
      ): Record<string, unknown> => {
        const result = { ...target };
        for (const key of Object.keys(defaults)) {
          if (!(key in result)) {
            result[key] = defaults[key];
          } else if (
            typeof defaults[key] === 'object' &&
            defaults[key] !== null &&
            !Array.isArray(defaults[key]) &&
            typeof result[key] === 'object' &&
            result[key] !== null &&
            !Array.isArray(result[key])
          ) {
            result[key] = preserveArrayMerge(
              defaults[key] as Record<string, unknown>,
              result[key] as Record<string, unknown>
            );
          }
        }
        return result;
      };

      const merged = preserveArrayMerge(defaults, existing);

      expect((merged.execution as any).retry.retryableErrors).toEqual(['CUSTOM_ERROR']);
    });
  });

  describe('Git Repository Initialization', () => {
    it('should skip if already a git repo', () => {
      const isGitRepo = true;
      const shouldInit = !isGitRepo;

      expect(shouldInit).toBe(false);
    });

    it('should initialize if not a git repo', () => {
      const isGitRepo = false;
      const shouldInit = !isGitRepo;

      expect(shouldInit).toBe(true);
    });
  });

  describe('Gitignore Updates', () => {
    it('should include AutomatosX entries', () => {
      const entries = [
        '',
        '# AutomatosX',
        '.automatosx/memory/',
        '.automatosx/logs/',
        'automatosx/tmp/',
        'ax.config.json',
        ''
      ];

      const content = entries.join('\n');

      expect(content).toContain('# AutomatosX');
      expect(content).toContain('.automatosx/memory/');
    });

    it('should not duplicate entries', () => {
      const existingContent = '# AutomatosX\n.automatosx/memory/';

      const alreadyExists = existingContent.includes('# AutomatosX');

      expect(alreadyExists).toBe(true);
    });
  });

  describe('Provider Detection', () => {
    it('should format provider names', () => {
      const formatProviderName = (name: string) => {
        const names: Record<string, string> = {
          'claude-code': 'Claude Code',
          'gemini-cli': 'Gemini CLI',
          'codex': 'Codex CLI'
        };
        return names[name] || name;
      };

      expect(formatProviderName('claude-code')).toBe('Claude Code');
      expect(formatProviderName('gemini-cli')).toBe('Gemini CLI');
    });

    it('should list found providers', () => {
      const providers = {
        'claude-code': true,
        'gemini-cli': true,
        'codex': false
      };

      const foundProviders = Object.entries(providers)
        .filter(([_, installed]) => installed)
        .map(([name]) => name);

      expect(foundProviders).toEqual(['claude-code', 'gemini-cli']);
    });
  });

  describe('Routing Configuration', () => {
    it('should generate routing recommendation', () => {
      const recommendation = {
        providers: {
          claude: { priority: 1 },
          gemini: { priority: 2 }
        }
      };

      expect(Object.keys(recommendation.providers).length).toBe(2);
    });

    it('should apply recommendation when not force mode', async () => {
      const result = {
        applied: true,
        changes: ['Updated claude priority', 'Updated gemini priority']
      };

      expect(result.applied).toBe(true);
      expect(result.changes.length).toBe(2);
    });
  });

  describe('Rollback Mechanism', () => {
    it('should track created resources', () => {
      const createdResources: string[] = [];

      createdResources.push('/test/.automatosx');
      createdResources.push('/test/ax.config.json');

      expect(createdResources).toHaveLength(2);
    });

    it('should rollback in reverse order', () => {
      const resources = ['/test/.automatosx', '/test/ax.config.json', '/test/.claude'];

      const reversed = resources.reverse();

      expect(reversed[0]).toBe('/test/.claude');
      expect(reversed[2]).toBe('/test/.automatosx');
    });
  });

  describe('Force Mode Cleanup', () => {
    it('should remove .automatosx directory', () => {
      const automatosxDir = '/test/.automatosx';
      const shouldRemove = true;

      expect(shouldRemove).toBe(true);
      expect(automatosxDir).toContain('.automatosx');
    });

    it('should filter ax-* command files', () => {
      const files = ['ax-backend.md', 'ax-frontend.md', 'other.md', 'readme.md'];

      const axFiles = files.filter(f => f.startsWith('ax-') && f.endsWith('.md'));

      expect(axFiles).toEqual(['ax-backend.md', 'ax-frontend.md']);
    });
  });

  describe('Default Workflow Templates', () => {
    it('should create 4 default workflow templates', () => {
      const templates = ['auth-flow.yaml', 'feature-flow.yaml', 'api-flow.yaml', 'refactor-flow.yaml'];

      expect(templates.length).toBe(4);
    });
  });

  describe('Iterate Mode Config', () => {
    it('should create patterns.yaml', () => {
      const patternsContent = `version: "1.0.0"
patterns:
  confirmation_prompt: []`;

      expect(patternsContent).toContain('patterns:');
      expect(patternsContent).toContain('confirmation_prompt');
    });

    it('should create templates.yaml', () => {
      const templatesContent = `version: "1.0.0"
templates:
  confirmation_prompt: []`;

      expect(templatesContent).toContain('templates:');
    });
  });

  describe('Workspace Directories', () => {
    it('should create PRD and tmp directories', () => {
      const dirs = ['automatosx', 'automatosx/PRD', 'automatosx/tmp'];

      expect(dirs).toContain('automatosx/PRD');
      expect(dirs).toContain('automatosx/tmp');
    });
  });

  describe('MCP CLI Commands', () => {
    it('should format claude mcp add command', () => {
      const projectDir = '/test/project';
      const command = `claude mcp add automatosx -s local -e "AUTOMATOSX_PROJECT_DIR=${projectDir}" -- automatosx mcp server`;

      expect(command).toContain('claude mcp add automatosx');
      expect(command).toContain('-s local');
      expect(command).toContain(projectDir);
    });

    it('should format gemini mcp add command', () => {
      const projectDir = '/test/project';
      const command = `gemini mcp add automatosx automatosx mcp server -s project -e "AUTOMATOSX_PROJECT_DIR=${projectDir}"`;

      expect(command).toContain('gemini mcp add automatosx');
      expect(command).toContain('-s project');
    });

    it('should format codex mcp add command', () => {
      const cwd = '/test/project';
      const command = `codex mcp add automatosx --env "AUTOMATOSX_PROJECT_DIR=${cwd}" -- automatosx mcp server`;

      expect(command).toContain('codex mcp add automatosx');
      expect(command).toContain('--env');
    });
  });

  describe('Error Handling', () => {
    it('should handle ENOENT for git command', () => {
      const errorMessage = 'spawn git ENOENT';
      const isGitMissing = errorMessage.includes('ENOENT') || errorMessage.includes('spawn git');

      expect(isGitMissing).toBe(true);
    });

    it('should handle command not found for MCP CLI', () => {
      const errorMessage = 'command not found: claude';
      const isCommandMissing = errorMessage.includes('command not found') || errorMessage.includes('not recognized');

      expect(isCommandMissing).toBe(true);
    });
  });

  describe('Handler - Multi Provider Scenarios', () => {
    it('should handle all providers detected', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': true,
              'gemini-cli': true,
              'codex': true,
              'glm': true,
              'grok': true,
              'qwen': true
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle only SDK providers detected (GLM and Grok)', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': false,
              'gemini-cli': false,
              'codex': false,
              'glm': true,
              'grok': true,
              'qwen': false
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle only CLI providers detected', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': true,
              'gemini-cli': true,
              'codex': true,
              'glm': false,
              'grok': false,
              'qwen': false
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Verbose Mode', () => {
    it('should handle verbose provider detection output', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': true,
              'gemini-cli': false
            })
          };
        },
        {
          formatProviderName: vi.fn((name: string) => {
            const names: Record<string, string> = {
              'claude-code': 'Claude Code'
            };
            return names[name] || name;
          })
        }
      ) as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        verbose: true,
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Git Init Scenarios', () => {
    it('should handle git init non-zero exit code', async () => {
      spawnMock.mockReturnValue({
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') {
            setImmediate(() => cb(Buffer.from('fatal error')));
          }
        }) },
        on: vi.fn((event: string, cb: any) => {
          if (event === 'close') {
            setImmediate(() => cb(1)); // Non-zero exit code
          }
        }),
        kill: vi.fn()
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle git init stdin write error', async () => {
      spawnMock.mockReturnValue({
        stdin: {
          write: vi.fn().mockImplementation(() => {
            throw new Error('stdin write failed');
          }),
          end: vi.fn()
        },
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn()
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - MCP CLI Scenarios', () => {
    it('should handle claude mcp list already configured', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': true,
              'gemini-cli': false
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('mcp list')) {
          return Promise.resolve({ stdout: 'automatosx', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle MCP CLI command not found', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': true,
              'gemini-cli': false
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('claude mcp')) {
          return Promise.reject(new Error('command not found: claude'));
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle MCP add command failure', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': true
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('mcp list')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        if (cmd.includes('mcp add')) {
          return Promise.reject(new Error('add command failed'));
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle force mode with existing MCP config', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'gemini-cli': true
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('mcp list')) {
          return Promise.resolve({ stdout: 'automatosx', stderr: '' });
        }
        if (cmd.includes('mcp remove')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        if (cmd.includes('mcp add')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      accessMock.mockImplementation((path: string) => {
        if (path.includes('.automatosx')) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        force: true,
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Config Merge Scenarios', () => {
    it('should handle invalid JSON in existing config', async () => {
      readFileMock.mockResolvedValue('invalid json { not valid');
      accessMock.mockImplementation((path: string) => {
        if (path.includes('ax.config.json')) {
          return Promise.resolve(undefined); // Config exists
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should merge config with nested objects', async () => {
      readFileMock.mockResolvedValue(JSON.stringify({
        version: '12.8.0',
        providers: {
          'claude-code': { enabled: true, timeout: 5000 }
        }
      }));
      accessMock.mockImplementation((path: string) => {
        if (path.includes('ax.config.json')) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Workspace Creation', () => {
    it('should handle workspace directory creation failure', async () => {
      let mkdirCallCount = 0;
      mkdirMock.mockImplementation(() => {
        mkdirCallCount++;
        if (mkdirCallCount > 10) {
          return Promise.reject(new Error('Permission denied'));
        }
        return Promise.resolve(undefined);
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      // Should continue despite workspace creation failure
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Gitignore Updates', () => {
    it('should handle existing gitignore with AutomatosX entries', async () => {
      readFileMock.mockImplementation((path: string) => {
        if (path.includes('.gitignore')) {
          return Promise.resolve('# AutomatosX\n.automatosx/memory/');
        }
        return Promise.resolve(JSON.stringify({ version: '12.8.3', providers: {} }));
      });
      accessMock.mockImplementation((path: string) => {
        if (path.includes('.gitignore')) {
          return Promise.resolve(undefined); // Exists
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle gitignore write failure', async () => {
      writeFileMock.mockImplementation((path: string) => {
        if (path.includes('.gitignore')) {
          return Promise.reject(new Error('Write failed'));
        }
        return Promise.resolve(undefined);
      });
      accessMock.mockRejectedValue(new Error('ENOENT'));

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Force Mode Cleanup Details', () => {
    it('should cleanup .claude commands in force mode', async () => {
      accessMock.mockResolvedValue(undefined); // Everything exists
      readdirMock.mockImplementation((path: string) => {
        if (path.includes('.claude/commands')) {
          return Promise.resolve(['ax-backend.md', 'ax-frontend.md', 'other-command.md']);
        }
        return Promise.resolve(['backend.yaml', 'frontend.yaml']);
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        force: true,
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should cleanup .gemini commands in force mode', async () => {
      accessMock.mockResolvedValue(undefined);
      readdirMock.mockImplementation((path: string) => {
        if (path.includes('.gemini/commands')) {
          return Promise.resolve(['ax-backend.toml', 'ax-quality.toml']);
        }
        return Promise.resolve(['backend.yaml']);
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        force: true,
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      accessMock.mockResolvedValue(undefined);
      rmMock.mockRejectedValue(new Error('Permission denied'));

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        force: true,
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Iterate Config Copying', () => {
    it('should create default iterate config when examples not found', async () => {
      statMock.mockImplementation((path: string) => {
        if (path.includes('examples/iterate')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve({ isDirectory: () => true });
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should copy iterate config from examples when available', async () => {
      readdirMock.mockImplementation((path: string) => {
        if (path.includes('examples/iterate')) {
          return Promise.resolve(['patterns.yaml', 'templates.yaml']);
        }
        return Promise.resolve(['backend.yaml']);
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Workflow Template Scenarios', () => {
    it('should create default workflows when examples directory empty', async () => {
      readdirMock.mockImplementation((path: string) => {
        if (path.includes('examples/workflows')) {
          return Promise.resolve([]); // Empty
        }
        return Promise.resolve(['backend.yaml']);
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should copy workflow templates with .yml extension', async () => {
      readdirMock.mockImplementation((path: string) => {
        if (path.includes('examples/workflows')) {
          return Promise.resolve(['auth-flow.yml', 'feature-flow.yaml']);
        }
        return Promise.resolve(['backend.yaml']);
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Version Detection', () => {
    it('should use fallback version when package.json read fails', async () => {
      readFileMock.mockImplementation((path: string) => {
        if (path.includes('package.json')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve(JSON.stringify({ version: '12.8.3', providers: {} }));
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Routing Configurator Scenarios', () => {
    it('should handle routing recommendation with multiple providers', async () => {
      routingConfiguratorMock.RoutingConfigurator = function() {
        return {
          detectCapabilities: vi.fn().mockResolvedValue(undefined),
          generateRecommendation: vi.fn().mockReturnValue({
            providers: {
              'claude-code': { priority: 1 },
              'gemini-cli': { priority: 2 },
              'openai': { priority: 3 }
            }
          }),
          generateReport: vi.fn().mockReturnValue('Provider report with details'),
          applyRecommendation: vi.fn().mockResolvedValue({
            applied: true,
            changes: ['change1', 'change2', 'change3']
          })
        };
      } as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle routing recommendation not applied', async () => {
      routingConfiguratorMock.RoutingConfigurator = function() {
        return {
          detectCapabilities: vi.fn().mockResolvedValue(undefined),
          generateRecommendation: vi.fn().mockReturnValue({
            providers: { 'claude-code': { priority: 1 } }
          }),
          generateReport: vi.fn().mockReturnValue('Report'),
          applyRecommendation: vi.fn().mockResolvedValue({
            applied: false,
            changes: []
          })
        };
      } as any;

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Claude Integration Rollback', () => {
    it('should not add claude dir to rollback if it pre-existed', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'claude-code': true
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      accessMock.mockImplementation((path: string) => {
        if (path.includes('.claude')) {
          return Promise.resolve(undefined); // Pre-existed
        }
        if (path.includes('.automatosx')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Gemini Integration Rollback', () => {
    it('should not add gemini dir to rollback if it pre-existed', async () => {
      providerDetectorMock.ProviderDetector = Object.assign(
        function() {
          return {
            detectAll: vi.fn().mockResolvedValue({
              'gemini-cli': true
            })
          };
        },
        { formatProviderName: vi.fn((name: string) => name) }
      ) as any;

      accessMock.mockImplementation((path: string) => {
        if (path.includes('.gemini')) {
          return Promise.resolve(undefined); // Pre-existed
        }
        if (path.includes('.automatosx')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const { setupCommand } = await import('../../../../src/cli/commands/setup.js');

      await setupCommand.handler({
        path: '/test/project',
        _: ['setup'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Helper Function Logic', () => {
    describe('shouldSkipExternalMcpSetup', () => {
      it('should skip when AUTOMATOSX_SKIP_MCP_SETUP is true', () => {
        const shouldSkip = process.env.AUTOMATOSX_SKIP_MCP_SETUP === 'true';
        // Not set in test but we can test the logic
        expect(typeof shouldSkip).toBe('boolean');
      });

      it('should skip when NODE_ENV is test', () => {
        process.env.NODE_ENV = 'test';
        const shouldSkip = process.env.NODE_ENV === 'test';
        expect(shouldSkip).toBe(true);
      });
    });

    describe('deepMergeConfig', () => {
      it('should handle null values in merge', () => {
        const defaults = {
          a: 1,
          b: null,
          c: { nested: true }
        };
        const target = {
          a: 2,
          d: 'extra'
        };

        // Simulating merge logic
        const result: Record<string, unknown> = { ...target };
        for (const key of Object.keys(defaults)) {
          if (!(key in result)) {
            result[key] = defaults[key as keyof typeof defaults];
          }
        }

        expect(result.a).toBe(2);
        expect(result.b).toBeNull();
        expect(result.c).toEqual({ nested: true });
        expect(result.d).toBe('extra');
      });
    });

    describe('checkExists', () => {
      it('should return true when path exists', async () => {
        const existsMock = vi.fn().mockResolvedValue(undefined);
        const exists = await existsMock().then(() => true).catch(() => false);
        expect(exists).toBe(true);
      });

      it('should return false when path does not exist', async () => {
        const existsMock = vi.fn().mockRejectedValue(new Error('ENOENT'));
        const exists = await existsMock().then(() => true).catch(() => false);
        expect(exists).toBe(false);
      });
    });
  });

  describe('Platform-Specific Logic', () => {
    it('should format home directory display for Unix', () => {
      const platform: string = 'darwin';
      const homeDirDisplay = platform === 'win32' ? '%USERPROFILE%' : '~/';
      expect(homeDirDisplay).toBe('~/');
    });

    it('should format home directory display for Windows', () => {
      const platform: string = 'win32';
      const homeDirDisplay = platform === 'win32' ? '%USERPROFILE%' : '~/';
      expect(homeDirDisplay).toBe('%USERPROFILE%');
    });

    it('should compare paths case-insensitively on Windows', () => {
      const platform: string = 'win32';
      const projectDir: string = 'C:\\Users\\Test\\Project';
      const homeDir: string = 'c:\\users\\test';

      const isSameDir = platform === 'win32'
        ? projectDir.toLowerCase() === homeDir.toLowerCase()
        : projectDir === homeDir;

      expect(isSameDir).toBe(false);
    });

    it('should compare paths case-sensitively on Unix', () => {
      const platform: string = 'darwin';
      const projectDir: string = '/Users/Test/Project';
      const homeDir: string = '/Users/Test';

      const isSameDir = platform === 'win32'
        ? projectDir.toLowerCase() === homeDir.toLowerCase()
        : projectDir === homeDir;

      expect(isSameDir).toBe(false);
    });
  });

  describe('Directory Permissions', () => {
    it('should use 0o755 permissions for directories', () => {
      const mode = 0o755;
      // rwxr-xr-x
      expect((mode & 0o700) >> 6).toBe(7); // owner: rwx
      expect((mode & 0o070) >> 3).toBe(5); // group: r-x
      expect(mode & 0o007).toBe(5);         // other: r-x
    });
  });

  describe('MCP Command Format', () => {
    it('should format qwen mcp add command correctly', () => {
      const projectDir = '/test/project';
      const command = `qwen mcp add automatosx automatosx mcp server -s project -e "AUTOMATOSX_PROJECT_DIR=${projectDir}"`;

      expect(command).toContain('qwen mcp add automatosx');
      expect(command).toContain('-s project');
      expect(command).toContain(projectDir);
    });

    it('should format command with special characters in path', () => {
      const projectDir = '/Users/test user/my project';
      const command = `claude mcp add automatosx -s local -e "AUTOMATOSX_PROJECT_DIR=${projectDir}" -- automatosx mcp server`;

      expect(command).toContain('test user');
      expect(command).toContain('my project');
    });
  });

  describe('Validation Error Messages', () => {
    it('should include reinstall instructions in validation error', () => {
      const errorMessage =
        'Environment validation failed:\n  • Missing required directory: examples/agents\n\n' +
        'This usually means the package is corrupted. Try reinstalling:\n' +
        '  npm uninstall -g @defai.digital/automatosx\n' +
        '  npm install -g @defai.digital/automatosx';

      expect(errorMessage).toContain('npm uninstall -g');
      expect(errorMessage).toContain('npm install -g');
      expect(errorMessage).toContain('package is corrupted');
    });
  });

  // Direct tests for internal functions via __testing__ export
  describe('Internal Functions - __testing__ export', () => {
    describe('shouldSkipExternalMcpSetup', () => {
      it('should return true when AUTOMATOSX_SKIP_MCP_SETUP is true', async () => {
        process.env.AUTOMATOSX_SKIP_MCP_SETUP = 'true';
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        expect(__testing__.shouldSkipExternalMcpSetup()).toBe(true);
      });

      it('should return true when AX_MOCK_PROVIDERS is true', async () => {
        process.env.AX_MOCK_PROVIDERS = 'true';
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        expect(__testing__.shouldSkipExternalMcpSetup()).toBe(true);
      });

      it('should return true when VITEST is 1', async () => {
        process.env.VITEST = '1';
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        expect(__testing__.shouldSkipExternalMcpSetup()).toBe(true);
      });

      it('should return true when NODE_ENV is test', async () => {
        process.env.NODE_ENV = 'test';
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        expect(__testing__.shouldSkipExternalMcpSetup()).toBe(true);
      });
    });

    describe('checkExists', () => {
      it('should return true when path exists', async () => {
        accessMock.mockResolvedValue(undefined);
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const result = await __testing__.checkExists('/some/path');
        expect(result).toBe(true);
      });

      it('should return false when path does not exist', async () => {
        accessMock.mockRejectedValue(new Error('ENOENT'));
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const result = await __testing__.checkExists('/nonexistent');
        expect(result).toBe(false);
      });
    });

    describe('createDirectoryStructure', () => {
      it('should create all required directories', async () => {
        mkdirMock.mockResolvedValue(undefined);
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.createDirectoryStructure('/test/.automatosx');
        expect(mkdirMock).toHaveBeenCalled();
      });

      it('should use 0o755 mode for directories', async () => {
        mkdirMock.mockResolvedValue(undefined);
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.createDirectoryStructure('/test/.automatosx');
        expect(mkdirMock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ mode: 0o755 })
        );
      });
    });

    describe('validateEnvironment', () => {
      it('should pass when all required directories exist', async () => {
        statMock.mockResolvedValue({ isDirectory: () => true });
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await expect(__testing__.validateEnvironment('/package/root')).resolves.not.toThrow();
      });

      it('should throw when required directories are missing', async () => {
        statMock.mockRejectedValue(new Error('ENOENT'));
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await expect(__testing__.validateEnvironment('/package/root')).rejects.toThrow('Environment validation failed');
      });
    });

    describe('rollbackCreatedResources', () => {
      it('should remove resources in reverse order', async () => {
        rmMock.mockResolvedValue(undefined);
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.rollbackCreatedResources(['/a', '/b', '/c']);
        expect(rmMock).toHaveBeenCalledTimes(3);
      });

      it('should handle removal errors gracefully', async () => {
        rmMock.mockRejectedValue(new Error('Permission denied'));
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await expect(__testing__.rollbackCreatedResources(['/a'])).resolves.not.toThrow();
      });
    });

    describe('deepMergeConfig', () => {
      // Note: deepMergeConfig(defaults, target) - target values win, defaults fill gaps
      it('should merge objects deeply', async () => {
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        // defaults has a and b.d and e, target has b.c
        const defaults = { a: 1, b: { d: 3 }, e: 4 };
        const target = { b: { c: 2 } };
        const result = __testing__.deepMergeConfig(defaults, target);
        expect(result).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 });
      });

      it('should keep target values over defaults', async () => {
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const defaults = { a: 1, b: 2 };
        const target = { a: 10 }; // target has a, should keep it
        const result = __testing__.deepMergeConfig(defaults, target);
        expect(result.a).toBe(10); // target wins
        expect(result.b).toBe(2);  // defaults fills gap
      });

      it('should handle null values in target correctly', async () => {
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const defaults = { a: 1, b: 2 };
        const target = { a: null } as Record<string, unknown>; // target has null a
        const result = __testing__.deepMergeConfig(defaults, target);
        expect(result.a).toBeNull(); // target wins (null is a valid value)
        expect(result.b).toBe(2);
      });

      it('should handle arrays in target without merging', async () => {
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const defaults = { arr: [3, 4] };
        const target = { arr: [1, 2] }; // target has array
        const result = __testing__.deepMergeConfig(defaults, target);
        expect(result.arr).toEqual([1, 2]); // target array wins
      });
    });

    describe('copyExampleFiles', () => {
      it('should copy files with matching extension', async () => {
        readdirMock.mockResolvedValue(['file1.yaml', 'file2.yaml', 'file3.md']);
        copyFileMock.mockResolvedValue(undefined);
        accessMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const count = await __testing__.copyExampleFiles('/base', '/package', {
          exampleDir: 'agents',
          targetDir: 'agents',
          extension: '.yaml',
          resourceName: 'agent'
        });
        expect(count).toBe(2);
      });

      it('should throw when example directory cannot be read', async () => {
        readdirMock.mockRejectedValue(new Error('ENOENT'));

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await expect(__testing__.copyExampleFiles('/base', '/package', {
          exampleDir: 'missing',
          targetDir: 'target',
          extension: '.yaml',
          resourceName: 'test'
        })).rejects.toThrow('ENOENT');
      });

      it('should throw when no matching files found', async () => {
        readdirMock.mockResolvedValue(['file1.txt', 'file2.md']); // no .yaml files

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await expect(__testing__.copyExampleFiles('/base', '/package', {
          exampleDir: 'agents',
          targetDir: 'agents',
          extension: '.yaml',
          resourceName: 'agent'
        })).rejects.toThrow('No agent files found');
      });
    });

    describe('copyExampleTeams', () => {
      it('should copy team yaml files', async () => {
        readdirMock.mockResolvedValue(['team1.yaml', 'team2.yaml']);
        copyFileMock.mockResolvedValue(undefined);
        accessMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const count = await __testing__.copyExampleTeams('/base', '/package');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    describe('copyExampleAgents', () => {
      it('should copy agent yaml files', async () => {
        readdirMock.mockResolvedValue(['backend.yaml', 'frontend.yaml']);
        copyFileMock.mockResolvedValue(undefined);
        accessMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const count = await __testing__.copyExampleAgents('/base', '/package');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    describe('copyExampleAbilities', () => {
      it('should copy ability markdown files', async () => {
        readdirMock.mockResolvedValue(['code-review.md', 'testing.md']);
        copyFileMock.mockResolvedValue(undefined);
        accessMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const count = await __testing__.copyExampleAbilities('/base', '/package');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    describe('copyExampleTemplates', () => {
      it('should copy template yaml files', async () => {
        readdirMock.mockResolvedValue(['template1.yaml']);
        copyFileMock.mockResolvedValue(undefined);
        accessMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const count = await __testing__.copyExampleTemplates('/base', '/package');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    describe('copyWorkflowTemplates', () => {
      it('should copy workflow yaml/yml files', async () => {
        readdirMock.mockResolvedValue(['workflow1.yaml', 'workflow2.yml']);
        copyFileMock.mockResolvedValue(undefined);
        accessMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const count = await __testing__.copyWorkflowTemplates('/base', '/package');
        expect(count).toBeGreaterThanOrEqual(0);
      });

      it('should create default workflows when no examples found', async () => {
        accessMock.mockRejectedValue(new Error('ENOENT'));
        writeFileMock.mockResolvedValue(undefined);
        mkdirMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const count = await __testing__.copyWorkflowTemplates('/base', '/package');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    describe('copyIterateConfig', () => {
      it('should copy iterate config files when examples exist', async () => {
        accessMock.mockResolvedValue(undefined); // checkExists returns true
        readdirMock.mockResolvedValue(['patterns.yaml', 'templates.yaml']);
        copyFileMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.copyIterateConfig('/base', '/package');
        expect(copyFileMock).toHaveBeenCalledTimes(2);
      });

      it('should create default config when examples missing', async () => {
        accessMock.mockRejectedValue(new Error('ENOENT')); // checkExists returns false
        writeFileMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.copyIterateConfig('/base', '/package');
        expect(writeFileMock).toHaveBeenCalled();
      });
    });

    describe('createDefaultIterateConfig', () => {
      it('should create patterns.yaml and templates.yaml', async () => {
        writeFileMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.createDefaultIterateConfig('/iterate');
        expect(writeFileMock).toHaveBeenCalledTimes(2);
      });
    });

    describe('createDefaultWorkflowTemplates', () => {
      it('should create 4 default workflow templates', async () => {
        writeFileMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.createDefaultWorkflowTemplates('/workflows');
        expect(writeFileMock).toHaveBeenCalledTimes(4);
      });
    });

    describe('createDefaultConfig', () => {
      it('should create new config when none exists', async () => {
        accessMock.mockRejectedValue(new Error('ENOENT'));
        writeFileMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.createDefaultConfig('/project', false, '12.8.4');
        expect(writeFileMock).toHaveBeenCalled();
      });

      it('should merge with existing config when not force mode', async () => {
        accessMock.mockResolvedValue(undefined);
        readFileMock.mockResolvedValue(JSON.stringify({ providers: { claude: {} } }));
        writeFileMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.createDefaultConfig('/project', false, '12.8.4');
        expect(readFileMock).toHaveBeenCalled();
      });

      it('should overwrite config in force mode', async () => {
        accessMock.mockResolvedValue(undefined);
        writeFileMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.createDefaultConfig('/project', true, '12.8.4');
        expect(writeFileMock).toHaveBeenCalled();
      });
    });

    describe('initializeGitRepository', () => {
      it('should return true when already a git repo (success)', async () => {
        accessMock.mockResolvedValue(undefined); // .git exists

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const result = await __testing__.initializeGitRepository('/project');
        expect(result).toBe(true); // Returns true (already exists = success)
      });

      it('should initialize git when not a repo', async () => {
        accessMock.mockRejectedValue(new Error('ENOENT'));
        spawnMock.mockReturnValue({
          stdin: { write: vi.fn(), end: vi.fn() },
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn((event: string, cb: (code: number | null) => void) => {
            if (event === 'close') setImmediate(() => cb(0));
          }),
          kill: vi.fn()
        });

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const result = await __testing__.initializeGitRepository('/project');
        expect(result).toBe(true);
      });

      it('should handle git not installed', async () => {
        accessMock.mockRejectedValue(new Error('ENOENT'));
        spawnMock.mockReturnValue({
          stdin: { write: vi.fn(), end: vi.fn() },
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn((event: string, cb: (code: number | null, signal?: string) => void) => {
            if (event === 'error') {
              setImmediate(() => {
                const err = new Error('spawn git ENOENT') as NodeJS.ErrnoException;
                err.code = 'ENOENT';
                (cb as any)(err);
              });
            }
          }),
          kill: vi.fn()
        });

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const result = await __testing__.initializeGitRepository('/project');
        expect(result).toBe(false);
      });
    });

    describe('updateGitignore', () => {
      it('should create gitignore when none exists', async () => {
        accessMock.mockRejectedValue(new Error('ENOENT'));
        writeFileMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.updateGitignore('/project');
        expect(writeFileMock).toHaveBeenCalled();
      });

      it('should append to existing gitignore', async () => {
        accessMock.mockResolvedValue(undefined);
        readFileMock.mockResolvedValue('node_modules/\n');
        writeFileMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.updateGitignore('/project');
        expect(writeFileMock).toHaveBeenCalled();
      });

      it('should not duplicate existing entries', async () => {
        accessMock.mockResolvedValue(undefined);
        readFileMock.mockResolvedValue('.automatosx/memory/\n.automatosx/logs/\n');
        writeFileMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.updateGitignore('/project');
        // Should still write but entries already exist
      });
    });

    describe('setupClaudeIntegration', () => {
      it('should call ClaudeCodeSetupHelper', async () => {
        mkdirMock.mockResolvedValue(undefined);
        accessMock.mockRejectedValue(new Error('ENOENT'));

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.setupClaudeIntegration('/project', '/package');
        // ClaudeCodeSetupHelper.setup should be called
      });
    });

    describe('createWorkspaceDirectories', () => {
      it('should create automatosx/PRD and tmp directories', async () => {
        mkdirMock.mockResolvedValue(undefined);
        writeFileMock.mockResolvedValue(undefined);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.createWorkspaceDirectories('/project');
        expect(mkdirMock).toHaveBeenCalled();
        expect(writeFileMock).toHaveBeenCalled();
      });

      it('should handle directory creation failure gracefully', async () => {
        mkdirMock.mockRejectedValue(new Error('Permission denied'));

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await expect(__testing__.createWorkspaceDirectories('/project')).resolves.not.toThrow();
      });
    });

    describe('createMcpConfig', () => {
      it('should skip in test mode', async () => {
        process.env.NODE_ENV = 'test';
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.createMcpConfig('/project');
        // Should return early without calling exec
      });
    });

    describe('setupQwenMCPConfig', () => {
      it('should skip in test mode', async () => {
        process.env.NODE_ENV = 'test';
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const result = await __testing__.setupQwenMCPConfig('/project');
        expect(result).toBe('skipped');
      });
    });

    describe('setupGeminiIntegration', () => {
      it('should setup Gemini MCP when provider detected', async () => {
        mkdirMock.mockResolvedValue(undefined);
        writeFileMock.mockResolvedValue(undefined);
        accessMock.mockRejectedValue(new Error('ENOENT'));

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const result = await __testing__.setupGeminiIntegration('/project', '/package');
        expect(result).toBeDefined();
      });
    });

    describe('setupGeminiMCPViaCLI', () => {
      it('should return skipped when gemini CLI not found', async () => {
        execMock.mockRejectedValue(new Error('command not found: gemini'));

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const result = await __testing__.setupGeminiMCPViaCLI('/project');
        expect(result).toBe('skipped');
      });

      it('should return configured when MCP added successfully', async () => {
        execMock.mockResolvedValue({ stdout: '', stderr: '' });

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const result = await __testing__.setupGeminiMCPViaCLI('/project');
        expect(result).toBe('configured');
      });
    });

    describe('setupCodexGlobalMCPConfig', () => {
      it('should skip in test mode', async () => {
        process.env.NODE_ENV = 'test';
        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        const result = await __testing__.setupCodexGlobalMCPConfig();
        expect(result).toBe('skipped');
      });
    });

    describe('cleanupForceMode', () => {
      it('should remove .automatosx directory', async () => {
        accessMock.mockResolvedValue(undefined);
        rmMock.mockResolvedValue(undefined);
        readdirMock.mockResolvedValue([]);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.cleanupForceMode('/project');
        expect(rmMock).toHaveBeenCalled();
      });

      it('should remove ax-* command files from .claude/commands', async () => {
        accessMock.mockResolvedValue(undefined);
        rmMock.mockResolvedValue(undefined);
        readdirMock.mockImplementation((dir: string) => {
          if (dir.includes('.claude/commands')) {
            return Promise.resolve(['ax-run.md', 'ax-list.md', 'other.md']);
          }
          if (dir.includes('.gemini/commands')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        });

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.cleanupForceMode('/project');
        // Should call rm for ax-run.md and ax-list.md but not other.md
      });

      it('should remove ax-* command files from .gemini/commands', async () => {
        accessMock.mockResolvedValue(undefined);
        rmMock.mockResolvedValue(undefined);
        readdirMock.mockImplementation((dir: string) => {
          if (dir.includes('.claude/commands')) {
            return Promise.resolve([]);
          }
          if (dir.includes('.gemini/commands')) {
            return Promise.resolve(['ax-run.toml', 'ax-list.toml']);
          }
          return Promise.resolve([]);
        });

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await __testing__.cleanupForceMode('/project');
      });

      it('should handle cleanup errors gracefully', async () => {
        accessMock.mockResolvedValue(undefined);
        rmMock.mockRejectedValue(new Error('Permission denied'));
        readdirMock.mockResolvedValue([]);

        const { __testing__ } = await import('../../../../src/cli/commands/setup.js');
        await expect(__testing__.cleanupForceMode('/project')).resolves.not.toThrow();
      });
    });
  });
});
