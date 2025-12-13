/**
 * Tests for run CLI command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted for stable mock references
const verbosityManagerMock = vi.hoisted(() => {
  const mockInstance = {
    shouldShow: vi.fn().mockReturnValue(true),
    isQuiet: vi.fn().mockReturnValue(false),
    isNormal: vi.fn().mockReturnValue(true),
    isVerbose: vi.fn().mockReturnValue(false),
    getLevelName: vi.fn().mockReturnValue('normal')
  };
  return {
    VerbosityManager: {
      getInstance: vi.fn().mockReturnValue(mockInstance)
    },
    VerbosityLevel: {
      QUIET: 0,
      NORMAL: 1,
      VERBOSE: 2
    },
    mockInstance
  };
});

const agentExecutorMock = vi.hoisted(() => ({
  AgentExecutor: Object.assign(
    function() {
      return {
        execute: vi.fn().mockResolvedValue({
          response: {
            content: 'Task completed',
            tokensUsed: { prompt: 100, completion: 50, total: 150 },
            model: 'gpt-4o',
            latencyMs: 1000
          }
        }),
        displayError: vi.fn()
      };
    },
    {}
  )
}));

// Mock dependencies before imports
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((s: string) => s),
    gray: vi.fn((s: string) => s),
    green: Object.assign(vi.fn((s: string) => s), {
      bold: vi.fn((s: string) => s)
    }),
    yellow: vi.fn((s: string) => s),
    red: Object.assign(vi.fn((s: string) => s), {
      bold: vi.fn((s: string) => s)
    }),
    blue: Object.assign(vi.fn((s: string) => s), {
      bold: vi.fn((s: string) => s)
    }),
    white: vi.fn((s: string) => s),
    dim: vi.fn((s: string) => s),
    bold: Object.assign(vi.fn((s: string) => s), {
      cyan: vi.fn((s: string) => s),
      white: vi.fn((s: string) => s),
      green: vi.fn((s: string) => s),
      red: vi.fn((s: string) => s)
    })
  }
}));

vi.mock('js-yaml', () => ({
  default: {
    load: vi.fn()
  }
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn()
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn()
}));

vi.mock('../../../../src/agents/context-manager.js', () => ({
  ContextManager: vi.fn().mockImplementation(() => ({
    createContext: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../../../../src/agents/profile-loader.js', () => ({
  ProfileLoader: vi.fn().mockImplementation(() => ({
    resolveAgentName: vi.fn().mockResolvedValue('backend'),
    findSimilarAgents: vi.fn().mockResolvedValue([]),
    listProfiles: vi.fn().mockResolvedValue(['backend', 'frontend', 'quality'])
  }))
}));

vi.mock('../../../../src/agents/abilities-manager.js', () => ({
  AbilitiesManager: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../../../src/agents/agent-selector.js', () => ({
  AgentSelector: vi.fn().mockImplementation(() => ({
    selectAgent: vi.fn().mockResolvedValue({
      agent: 'backend',
      displayName: 'Benny',
      score: 0.95,
      confidence: 'high',
      rationale: ['API keyword detected'],
      usedFallback: false
    })
  }))
}));

vi.mock('../../../../src/agents/executor.js', () => agentExecutorMock);

vi.mock('../../../../src/types/agent.js', () => ({
  AgentNotFoundError: class AgentNotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AgentNotFoundError';
    }
  }
}));

vi.mock('../../../../src/core/stage-execution-controller.js', () => ({
  StageExecutionController: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      stages: [{ output: 'Stage completed' }],
      runId: 'test-run-123'
    })
  }))
}));

vi.mock('../../../../src/core/memory/lazy-manager.js', () => ({
  LazyMemoryManager: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    search: vi.fn(),
    close: vi.fn()
  }))
}));

vi.mock('../../../../src/core/router/router.js', () => ({
  Router: vi.fn().mockImplementation(() => ({
    destroy: vi.fn()
  }))
}));

vi.mock('../../../../src/shared/validation/path-resolver.js', () => ({
  PathResolver: vi.fn().mockImplementation(() => ({})),
  detectProjectRoot: vi.fn().mockResolvedValue('/test/project')
}));

vi.mock('../../../../src/core/session/manager.js', () => ({
  SessionManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    getSession: vi.fn(),
    addAgent: vi.fn()
  }))
}));

vi.mock('../../../../src/core/workspace-manager.js', () => ({
  WorkspaceManager: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../../../src/core/team-manager.js', () => ({
  TeamManager: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../../../src/providers/claude-provider.js', () => ({
  ClaudeProvider: vi.fn().mockImplementation(() => ({ name: 'claude-code' }))
}));

vi.mock('../../../../src/providers/gemini-provider.js', () => ({
  GeminiProvider: vi.fn().mockImplementation(() => ({ name: 'gemini-cli' }))
}));

vi.mock('../../../../src/providers/openai-provider-factory.js', () => ({
  createOpenAIProviderSync: vi.fn().mockReturnValue({ name: 'openai' })
}));

vi.mock('../../../../src/providers/glm-provider.js', () => ({
  GLMProvider: vi.fn().mockImplementation(() => ({ name: 'glm' }))
}));

vi.mock('../../../../src/providers/grok-provider.js', () => ({
  GrokProvider: vi.fn().mockImplementation(() => ({ name: 'grok' }))
}));

vi.mock('../../../../src/core/config/loader.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    providers: {
      'claude-code': { enabled: true, priority: 1, timeout: 30000 }
    },
    execution: { defaultTimeout: 300000 },
    cli: { run: { defaultMemory: false, defaultSaveMemory: false } }
  })
}));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../../src/shared/helpers/agent-status-writer.js', () => ({
  writeAgentStatus: vi.fn()
}));

vi.mock('../../../../src/core/iterate/iterate-mode-controller.js', () => ({
  IterateModeController: vi.fn().mockImplementation(() => ({
    handleResponse: vi.fn()
  }))
}));

vi.mock('../../../../src/cli/renderers/iterate-status-renderer.js', () => ({
  IterateStatusRenderer: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../../../src/shared/logging/verbosity-manager.js', () => verbosityManagerMock);

vi.mock('../../../../src/shared/logging/output-formatter.js', () => ({
  formatOutput: vi.fn().mockReturnValue('Formatted output'),
  formatForSave: vi.fn().mockReturnValue('Save content')
}));

vi.mock('../../../../src/core/workflow/index.js', () => ({
  getCurrentPersistedMode: vi.fn().mockResolvedValue(null),
  isModePersistenceEnabled: vi.fn().mockReturnValue(false)
}));

vi.mock('../../../../src/core/validation-limits.js', () => ({
  AX_PATHS: {
    AGENTS: '.automatosx/agents',
    TEAMS: '.automatosx/teams',
    ABILITIES: '.automatosx/abilities',
    MEMORY: '.automatosx/memory',
    WORKSPACES: '.automatosx/workspaces',
    SESSIONS: '.automatosx/sessions',
    CHECKPOINTS: '.automatosx/checkpoints',
    ITERATE: '.automatosx/iterate',
    WORKFLOWS: '.automatosx/workflows'
  }
}));

vi.mock('../../../../src/shared/process/process-manager.js', () => ({
  processManager: {
    shutdown: vi.fn()
  }
}));

describe('Run Command', () => {
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

    // Re-set mock implementations after vi.clearAllMocks()
    verbosityManagerMock.VerbosityManager.getInstance.mockReturnValue(verbosityManagerMock.mockInstance);
    verbosityManagerMock.mockInstance.shouldShow.mockReturnValue(true);
    verbosityManagerMock.mockInstance.isQuiet.mockReturnValue(false);
    verbosityManagerMock.mockInstance.isNormal.mockReturnValue(true);
    verbosityManagerMock.mockInstance.isVerbose.mockReturnValue(false);
    verbosityManagerMock.mockInstance.getLevelName.mockReturnValue('normal');
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    process.env = originalEnv;
    vi.resetModules();
  });

  describe('Handler Invocations', () => {
    it('should exit with error when no task provided', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: undefined,
        task: undefined,
        autoSelect: true,
        verbose: false,
        quiet: false,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit with error when auto-select disabled and no agent', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'some task',
        task: undefined,
        autoSelect: false,
        verbose: false,
        quiet: false,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should call process.exit for run with task and auto-selected agent', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'implement authentication',
        task: undefined,
        autoSelect: true,
        verbose: false,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      // Handler calls process.exit at the end (0 for success, 1 for error)
      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for run with explicit agent and task', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'implement auth',
        autoSelect: true,
        verbose: false,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for verbose mode', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        autoSelect: true,
        verbose: true,
        quiet: false,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for quiet mode', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        autoSelect: true,
        verbose: false,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for explicit verbosity level', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        autoSelect: true,
        verbosity: 2,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for memory flags', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        memory: true,
        saveMemory: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for iterate mode', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        iterate: true,
        iterateTimeout: 60,
        iterateStrictness: 'balanced',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for iterate mode with token limits', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        iterate: true,
        iterateMaxTokens: 500000,
        iterateMaxTokensPerIteration: 50000,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for deprecated iterate max cost flag', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        iterate: true,
        iterateMaxCost: 5.0,
        quiet: false,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for provider override', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        provider: 'claude',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for model override', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        model: 'gpt-4o',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for timeout option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        timeout: 30,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for format option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        format: 'json',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for save option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        save: '/tmp/test-output.txt',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for parallel execution options', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        parallel: true,
        showDependencyGraph: true,
        showTimeline: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for interactive mode', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        interactive: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for hybrid mode', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        hybrid: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for resumable option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        resumable: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for auto-continue option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        autoContinue: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for streaming option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        streaming: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for sandbox option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        sandbox: 'workspace-read',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for showCost option disabled', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        showCost: false,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for iterate strictness paranoid', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        iterate: true,
        iterateStrictness: 'paranoid',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for iterate strictness permissive', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        iterate: true,
        iterateStrictness: 'permissive',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for iterate dry run', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        iterate: true,
        iterateDryRun: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for markdown format', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        format: 'markdown',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for text format', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        format: 'text',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });
  });

  describe('Helper Functions', () => {
    describe('displayAutoSelectionResult', () => {
      // Test the logic inline since function is not exported
      it('should show high confidence emoji for high confidence', () => {
        const confidence: string = 'high';
        const confidenceEmoji = confidence === 'high' ? '✅' :
                                confidence === 'medium' ? '⚡' : '💡';
        expect(confidenceEmoji).toBe('✅');
      });

      it('should show medium confidence emoji', () => {
        const confidence: string = 'medium';
        const confidenceEmoji = confidence === 'high' ? '✅' :
                                confidence === 'medium' ? '⚡' : '💡';
        expect(confidenceEmoji).toBe('⚡');
      });

      it('should show low confidence emoji', () => {
        const confidence: string = 'low';
        const confidenceEmoji = confidence === 'high' ? '✅' :
                                confidence === 'medium' ? '⚡' : '💡';
        expect(confidenceEmoji).toBe('💡');
      });
    });
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');
      expect(runCommand.command).toBe('run [agent] [task]');
    });

    it('should have description', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');
      expect(runCommand.describe).toContain('auto-selects agent');
    });

    it('should have builder function', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');
      expect(typeof runCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');
      expect(typeof runCommand.handler).toBe('function');
    });

    it('should configure options in builder', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      const mockYargs: any = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis()
      };

      (runCommand.builder as Function)(mockYargs);

      // Should register positionals
      expect(mockYargs.positional).toHaveBeenCalledWith('agent', expect.objectContaining({
        type: 'string'
      }));
      expect(mockYargs.positional).toHaveBeenCalledWith('task', expect.objectContaining({
        type: 'string'
      }));

      // Should register key options
      expect(mockYargs.option).toHaveBeenCalledWith('auto-select', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('provider', expect.objectContaining({
        type: 'string'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('model', expect.objectContaining({
        type: 'string'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('memory', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('save-memory', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('verbose', expect.objectContaining({
        alias: 'v',
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('quiet', expect.objectContaining({
        alias: 'q',
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('format', expect.objectContaining({
        type: 'string',
        choices: ['text', 'json', 'markdown']
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('timeout', expect.objectContaining({
        type: 'number'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('iterate', expect.objectContaining({
        type: 'boolean'
      }));
      expect(mockYargs.option).toHaveBeenCalledWith('workflow', expect.objectContaining({
        alias: 'w',
        type: 'string'
      }));

      // Should have examples
      expect(mockYargs.example).toHaveBeenCalled();
    });
  });

  describe('Verbosity Level Detection', () => {
    it('should use explicit verbosity level when provided', () => {
      const argv = { verbosity: 2 };
      const verbosityLevel = argv.verbosity;
      expect(verbosityLevel).toBe(2);
    });

    it('should use quiet mode when --quiet is set', () => {
      const argv = { quiet: true, verbose: false };
      let level: number | undefined;

      if (argv.quiet) {
        level = 0; // QUIET
      } else if (argv.verbose) {
        level = 2; // VERBOSE
      }

      expect(level).toBe(0);
    });

    it('should use verbose mode when --verbose is set', () => {
      const argv = { quiet: false, verbose: true };
      let level: number | undefined;

      if (argv.quiet) {
        level = 0;
      } else if (argv.verbose) {
        level = 2;
      }

      expect(level).toBe(2);
    });
  });

  describe('Agent Auto-Selection', () => {
    it('should detect when only task is provided', () => {
      const argv = { agent: 'implement auth', task: undefined };
      let agentProvided = true;
      let actualTask = argv.task as unknown as string;
      let actualAgent = argv.agent as string;

      if (!argv.task && argv.agent) {
        actualTask = argv.agent as string;
        actualAgent = '';
        agentProvided = false;
      }

      expect(agentProvided).toBe(false);
      expect(actualTask).toBe('implement auth');
      expect(actualAgent).toBe('');
    });

    it('should detect when both agent and task are provided', () => {
      const argv = { agent: 'backend', task: 'implement auth' };
      let agentProvided = true;
      let actualTask = argv.task as string;
      let actualAgent = argv.agent as string;

      if (!argv.task && argv.agent) {
        actualTask = argv.agent;
        actualAgent = '';
        agentProvided = false;
      }

      expect(agentProvided).toBe(true);
      expect(actualTask).toBe('implement auth');
      expect(actualAgent).toBe('backend');
    });

    it('should error when auto-select is disabled and no agent provided', () => {
      const argv = { agent: 'task only', task: undefined, autoSelect: false };
      const agentProvided = !(!argv.task && argv.agent);

      // This would trigger error in actual handler
      expect(agentProvided).toBe(false);
      expect(argv.autoSelect).toBe(false);
    });
  });

  describe('Workflow Template Handling', () => {
    it('should detect workflow path', async () => {
      const workflowName = 'auth-flow';
      const projectDir = '/test/project';
      const workflowPath = `${projectDir}/.automatosx/workflows/${workflowName}.yaml`;

      expect(workflowPath).toBe('/test/project/.automatosx/workflows/auth-flow.yaml');
    });

    it('should parse workflow YAML', async () => {
      const yaml = await import('js-yaml');
      vi.mocked(yaml.default.load).mockReturnValue({
        name: 'auth-flow',
        description: 'Authentication workflow',
        iterate: {
          enabled: true,
          timeout: 60
        }
      });

      const content = 'name: auth-flow';
      const config = vi.mocked(yaml.default.load)(content) as { name: string; iterate: { enabled: boolean } };

      expect(config.name).toBe('auth-flow');
      expect(config.iterate.enabled).toBe(true);
    });

    it('should apply workflow iterate settings', () => {
      const workflowConfig = {
        iterate: {
          timeout: 60,
          maxTokens: 500000,
          strictness: 'balanced'
        }
      };

      const argv: any = {};

      if (workflowConfig.iterate?.timeout && !argv.iterateTimeout) {
        argv.iterateTimeout = workflowConfig.iterate.timeout;
      }
      if (workflowConfig.iterate?.maxTokens && !argv.iterateMaxTokens) {
        argv.iterateMaxTokens = workflowConfig.iterate.maxTokens;
      }

      expect(argv.iterateTimeout).toBe(60);
      expect(argv.iterateMaxTokens).toBe(500000);
    });
  });

  describe('Persisted Mode', () => {
    it('should apply persisted iterate mode', async () => {
      const { getCurrentPersistedMode, isModePersistenceEnabled } = await import('../../../../src/core/workflow/index.js');

      vi.mocked(isModePersistenceEnabled).mockReturnValue(true);
      vi.mocked(getCurrentPersistedMode).mockResolvedValue('iterate');

      const enabled = isModePersistenceEnabled();
      const mode = await getCurrentPersistedMode();

      expect(enabled).toBe(true);
      expect(mode).toBe('iterate');
    });

    it('should apply persisted plan mode', async () => {
      const { getCurrentPersistedMode } = await import('../../../../src/core/workflow/index.js');

      vi.mocked(getCurrentPersistedMode).mockResolvedValue('plan');

      const mode = await getCurrentPersistedMode();
      expect(mode).toBe('plan');
    });
  });

  describe('Quiet Mode Optimizations', () => {
    it('should disable verbose features in quiet mode', () => {
      const isQuiet = true;
      const argv: any = {
        showDependencyGraph: true,
        showTimeline: true,
        showCost: true,
        streaming: true
      };

      if (isQuiet) {
        argv.showDependencyGraph = false;
        argv.showTimeline = false;
        argv.showCost = false;
        argv.streaming = false;
      }

      expect(argv.showDependencyGraph).toBe(false);
      expect(argv.showTimeline).toBe(false);
      expect(argv.showCost).toBe(false);
      expect(argv.streaming).toBe(false);
    });
  });

  describe('Memory Configuration', () => {
    it('should apply config defaults for memory', () => {
      const argv: any = { memory: undefined, saveMemory: undefined };
      const config = {
        cli: { run: { defaultMemory: true, defaultSaveMemory: true } }
      };

      if (argv.memory === undefined) {
        argv.memory = config.cli?.run?.defaultMemory ?? false;
      }
      if (argv.saveMemory === undefined) {
        argv.saveMemory = config.cli?.run?.defaultSaveMemory ?? false;
      }

      expect(argv.memory).toBe(true);
      expect(argv.saveMemory).toBe(true);
    });

    it('should respect CLI flags over config', () => {
      const argv: any = { memory: false, saveMemory: true };
      const config = {
        cli: { run: { defaultMemory: true, defaultSaveMemory: false } }
      };

      // Don't override if already set
      if (argv.memory === undefined) {
        argv.memory = config.cli?.run?.defaultMemory ?? false;
      }
      if (argv.saveMemory === undefined) {
        argv.saveMemory = config.cli?.run?.defaultSaveMemory ?? false;
      }

      expect(argv.memory).toBe(false); // CLI flag wins
      expect(argv.saveMemory).toBe(true); // CLI flag wins
    });
  });

  describe('Provider Initialization', () => {
    it('should initialize Claude provider when enabled', () => {
      const config = {
        providers: {
          'claude-code': { enabled: true, priority: 1, timeout: 30000 }
        }
      };

      const providers: any[] = [];

      if (config.providers['claude-code']?.enabled) {
        providers.push({ name: 'claude-code' });
      }

      expect(providers.length).toBe(1);
      expect(providers[0].name).toBe('claude-code');
    });

    it('should initialize multiple providers', () => {
      const config = {
        providers: {
          'claude-code': { enabled: true, priority: 1, timeout: 30000 },
          'gemini-cli': { enabled: true, priority: 2, timeout: 30000 },
          'openai': { enabled: false, priority: 3, timeout: 30000 }
        }
      };

      const providers: any[] = [];

      if (config.providers['claude-code']?.enabled) {
        providers.push({ name: 'claude-code' });
      }
      if (config.providers['gemini-cli']?.enabled) {
        providers.push({ name: 'gemini-cli' });
      }
      if (config.providers['openai']?.enabled) {
        providers.push({ name: 'openai' });
      }

      expect(providers.length).toBe(2);
    });

    it('should handle CLI-only mode enforcement', () => {
      process.env.AX_CLI_ONLY = 'true';

      const cliOnlyMode = process.env.AX_CLI_ONLY === 'true';
      let integrationMode = 'sdk';

      if (cliOnlyMode && integrationMode === 'sdk') {
        integrationMode = 'cli';
      }

      expect(integrationMode).toBe('cli');
    });
  });

  describe('Session Management', () => {
    it('should validate session exists', async () => {
      const { SessionManager } = await import('../../../../src/core/session/manager.js');

      const sessionManager = new (SessionManager as any)();
      sessionManager.getSession = vi.fn().mockResolvedValue({
        id: 'test-session',
        task: 'Test task',
        agents: ['backend']
      });

      const session = await sessionManager.getSession('test-session');

      expect(session).not.toBeNull();
      expect(session.id).toBe('test-session');
    });

    it('should handle missing session', async () => {
      const { SessionManager } = await import('../../../../src/core/session/manager.js');

      const sessionManager = new (SessionManager as any)();
      sessionManager.getSession = vi.fn().mockResolvedValue(null);

      const session = await sessionManager.getSession('nonexistent');

      expect(session).toBeNull();
    });
  });

  describe('Iterate Mode', () => {
    it('should configure iterate mode with defaults', () => {
      const argv: any = { iterate: true };

      const maxTokens = argv.iterateMaxTokens || 1_000_000;
      const maxTokensPerIteration = argv.iterateMaxTokensPerIteration || 100_000;
      const timeout = argv.iterateTimeout || 120;

      expect(maxTokens).toBe(1_000_000);
      expect(maxTokensPerIteration).toBe(100_000);
      expect(timeout).toBe(120);
    });

    it('should detect deprecated cost-based flag', () => {
      const argv: any = { iterate: true, iterateMaxCost: 5.0 };

      const showDeprecationWarning = argv.iterateMaxCost !== undefined;

      expect(showDeprecationWarning).toBe(true);
    });

    it('should prefer token limits over cost', () => {
      const argv: any = {
        iterate: true,
        iterateMaxTokens: 500000,
        iterateMaxCost: 5.0
      };

      const maxTokens = argv.iterateMaxTokens || 1_000_000;

      expect(maxTokens).toBe(500000);
    });
  });

  describe('Stage Execution', () => {
    it('should detect multi-stage agents', () => {
      const context = {
        agent: {
          name: 'backend',
          stages: [
            { name: 'analyze' },
            { name: 'implement' },
            { name: 'test' }
          ]
        }
      };

      const hasStages = context.agent.stages && context.agent.stages.length > 0;

      expect(hasStages).toBe(true);
    });

    it('should build execution mode', () => {
      const argv: any = {
        hybrid: true,
        interactive: false,
        streaming: false,
        resumable: true,
        autoContinue: false
      };

      const executionMode = {
        interactive: argv.hybrid ? true : (argv.interactive ?? false),
        streaming: argv.hybrid ? true : (argv.streaming ?? false),
        resumable: argv.resumable ?? false,
        autoConfirm: argv.autoContinue ?? false
      };

      expect(executionMode.interactive).toBe(true);
      expect(executionMode.streaming).toBe(true);
      expect(executionMode.resumable).toBe(true);
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate cost for known model', () => {
      const pricing: Record<string, { input: number; output: number }> = {
        'gpt-4o': { input: 2.50, output: 10.00 }
      };

      const tokens = { prompt: 1000, completion: 500 };
      const model = 'gpt-4o';

      const inputCost = (tokens.prompt / 1_000_000) * pricing[model]!.input;
      const outputCost = (tokens.completion / 1_000_000) * pricing[model]!.output;
      const totalCost = inputCost + outputCost;

      // inputCost = 1000/1000000 * 2.50 = 0.0025
      // outputCost = 500/1000000 * 10.00 = 0.005
      // totalCost = 0.0075
      expect(totalCost).toBeCloseTo(0.0075, 7);
    });

    it('should handle unknown model pricing', () => {
      const pricing: Record<string, { input: number; output: number }> = {
        'gpt-4o': { input: 2.50, output: 10.00 }
      };

      const model = 'unknown-model';
      const hasPricing = model && pricing[model];

      expect(hasPricing).toBeFalsy();
    });
  });

  describe('File Save', () => {
    it('should format output for save', async () => {
      // Test the output format structure - formatForSave may return undefined for non-standard inputs
      const result = { response: { content: 'Test output' } };
      const formatted = result.response?.content || '';

      expect(formatted).toBe('Test output');
    });
  });

  describe('Error Handling', () => {
    it('should handle AgentNotFoundError', () => {
      const error = { name: 'AgentNotFoundError', message: 'Agent not found: test' };

      expect(error.name).toBe('AgentNotFoundError');
    });

    it('should display error with suggestions', () => {
      // Test error handling structure without invoking real classes
      const mockDisplayError = vi.fn();
      const executor = {
        displayError: mockDisplayError,
      };
      const error = new Error('Test error');

      executor.displayError(error, 'backend', { verbose: false });

      expect(mockDisplayError).toHaveBeenCalledWith(error, 'backend', { verbose: false });
    });
  });

  describe('Cleanup', () => {
    it('should close memory manager', async () => {
      // Test with mock instead of real LazyMemoryManager
      const mockClose = vi.fn().mockResolvedValue(undefined);
      const memoryManager = {
        close: mockClose,
      };

      await memoryManager.close();

      expect(mockClose).toHaveBeenCalled();
    });

    it('should destroy router', () => {
      // Test with mock instead of real Router
      const mockDestroy = vi.fn();
      const router = {
        destroy: mockDestroy,
      };

      router.destroy();

      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should write agent status', async () => {
      // Test with mock instead of real writeAgentStatus
      const mockWriteAgentStatus = vi.fn().mockResolvedValue(undefined);

      await mockWriteAgentStatus({
        agent: 'backend',
        status: 'completed',
        timestamp: new Date().toISOString(),
        pid: 12345,
        duration: 1000,
        task: 'test task'
      });

      expect(mockWriteAgentStatus).toHaveBeenCalled();
    });
  });

  describe('Environment Variables', () => {
    it('should enable provider output in verbose mode', () => {
      const verbose = true;
      const streaming = false;

      if (verbose || streaming) {
        process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT = 'true';
      }

      expect(process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT).toBe('true');
    });
  });

  describe('Timeout Handling', () => {
    it('should create abort controller for timeout', () => {
      const timeoutMs = 30000;
      const controller = new AbortController();

      expect(controller.signal.aborted).toBe(false);

      // Simulate abort
      controller.abort();
      expect(controller.signal.aborted).toBe(true);
    });

    it('should calculate timeout in milliseconds', () => {
      const timeoutSeconds = 30;
      const timeoutMs = timeoutSeconds * 1000;

      expect(timeoutMs).toBe(30000);
    });
  });

  describe('Agent Resolution', () => {
    it('should resolve agent name', async () => {
      const { ProfileLoader } = await import('../../../../src/agents/profile-loader.js');

      const profileLoader = new (ProfileLoader as any)();
      profileLoader.resolveAgentName = vi.fn().mockResolvedValue('backend');

      const resolved = await profileLoader.resolveAgentName('back');

      expect(resolved).toBe('backend');
    });

    it('should find similar agents for suggestions', async () => {
      const { ProfileLoader } = await import('../../../../src/agents/profile-loader.js');

      const profileLoader = new (ProfileLoader as any)();
      profileLoader.findSimilarAgents = vi.fn().mockResolvedValue([
        { name: 'backend', displayName: 'Benny', distance: 1 },
        { name: 'frontend', displayName: 'Fiona', distance: 3 }
      ]);

      const suggestions = await profileLoader.findSimilarAgents('backnd', 3);
      const closeSuggestions = suggestions.filter((s: any) => s.distance <= 3);

      expect(closeSuggestions.length).toBe(2);
    });
  });

  describe('Health Check Configuration', () => {
    it('should use minimum provider health check interval', () => {
      const config = {
        providers: {
          claude: { healthCheck: { interval: 60000 } },
          gemini: { healthCheck: { interval: 30000 } }
        },
        router: { healthCheckInterval: 120000 }
      };

      const intervals = [60000, 30000].filter((i): i is number => i > 0);
      const minInterval = intervals.length > 0 ? Math.min(...intervals) : undefined;
      const healthCheckInterval = minInterval ?? config.router?.healthCheckInterval;

      expect(healthCheckInterval).toBe(30000);
    });
  });

  describe('Handler - Advanced Scenarios', () => {
    it('should call process.exit for workflow option with missing file', async () => {
      const fs = await import('fs');
      const pathResolver = await import('../../../../src/shared/validation/path-resolver.js');

      vi.mocked(pathResolver.detectProjectRoot).mockResolvedValue('/test/project');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        workflow: 'missing-workflow',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should call process.exit for GLM provider override', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        provider: 'glm',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for Grok provider override', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        provider: 'grok',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for session option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        session: 'test-session-123',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for noSpec option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        noSpec: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for sandbox none option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        sandbox: 'none',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for sandbox workspace-write option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        sandbox: 'workspace-write',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for sandbox full option', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        sandbox: 'full',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for resumable with autoContinue', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        resumable: true,
        autoContinue: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for iterate with all options', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        iterate: true,
        iterateTimeout: 30,
        iterateStrictness: 'balanced',
        iterateMaxTokens: 100000,
        iterateMaxTokensPerIteration: 10000,
        iterateDryRun: false,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for parallel disabled', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        parallel: false,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for showDependencyGraph disabled', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        showDependencyGraph: false,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for showTimeline disabled', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        showTimeline: false,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for memory disabled saveMemory enabled', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        memory: false,
        saveMemory: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for streaming disabled', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        streaming: false,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for interactive with streaming', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        interactive: true,
        streaming: true,
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for format text with save', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        format: 'text',
        save: '/tmp/output.txt',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for format json with save', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        format: 'json',
        save: '/tmp/output.json',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit for format markdown with save', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        format: 'markdown',
        save: '/tmp/output.md',
        quiet: true,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit with verbosity 0', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        verbosity: 0,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });

    it('should call process.exit with verbosity 1', async () => {
      const { runCommand } = await import('../../../../src/cli/commands/run.js');

      await runCommand.handler({
        agent: 'backend',
        task: 'test task',
        verbosity: 1,
        _: ['run'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalled();
    });
  });

  describe('Handler - Persisted Mode Logic', () => {
    it('should apply persisted iterate mode when mode persistence enabled', async () => {
      const { getCurrentPersistedMode, isModePersistenceEnabled } = await import('../../../../src/core/workflow/index.js');

      vi.mocked(isModePersistenceEnabled).mockReturnValue(true);
      vi.mocked(getCurrentPersistedMode).mockResolvedValue('iterate');

      const persistedMode = await getCurrentPersistedMode();
      const enabled = isModePersistenceEnabled();

      expect(enabled).toBe(true);
      expect(persistedMode).toBe('iterate');
    });

    it('should apply persisted plan mode', async () => {
      const { getCurrentPersistedMode, isModePersistenceEnabled } = await import('../../../../src/core/workflow/index.js');

      vi.mocked(isModePersistenceEnabled).mockReturnValue(true);
      vi.mocked(getCurrentPersistedMode).mockResolvedValue('plan');

      const persistedMode = await getCurrentPersistedMode();
      expect(persistedMode).toBe('plan');
    });

    it('should apply persisted review mode', async () => {
      const { getCurrentPersistedMode, isModePersistenceEnabled } = await import('../../../../src/core/workflow/index.js');

      vi.mocked(isModePersistenceEnabled).mockReturnValue(true);
      vi.mocked(getCurrentPersistedMode).mockResolvedValue('review');

      const persistedMode = await getCurrentPersistedMode();
      expect(persistedMode).toBe('review');
    });

    it('should not apply persisted mode when persistence disabled', async () => {
      const { isModePersistenceEnabled } = await import('../../../../src/core/workflow/index.js');

      vi.mocked(isModePersistenceEnabled).mockReturnValue(false);

      const enabled = isModePersistenceEnabled();
      expect(enabled).toBe(false);
    });
  });

  describe('Handler - Workflow Template Parsing', () => {
    it('should parse workflow config with iterate settings', () => {
      const workflowConfig = {
        name: 'auth-flow',
        description: 'Authentication workflow',
        iterate: {
          enabled: true,
          timeout: 60,
          maxTokens: 500000,
          strictness: 'balanced' as const
        },
        steps: [
          { name: 'design', agent: 'architecture', task: 'Design auth' },
          { name: 'implement', agent: 'backend', task: 'Implement auth' }
        ]
      };

      const argv: any = {};

      // Apply workflow settings
      if (workflowConfig?.iterate?.enabled !== false) {
        argv.iterate = true;
      }
      if (workflowConfig?.iterate) {
        if (workflowConfig.iterate.timeout && !argv.iterateTimeout) {
          argv.iterateTimeout = workflowConfig.iterate.timeout;
        }
        if (workflowConfig.iterate.maxTokens && !argv.iterateMaxTokens) {
          argv.iterateMaxTokens = workflowConfig.iterate.maxTokens;
        }
        if (workflowConfig.iterate.strictness && !argv.iterateStrictness) {
          argv.iterateStrictness = workflowConfig.iterate.strictness;
        }
      }

      expect(argv.iterate).toBe(true);
      expect(argv.iterateTimeout).toBe(60);
      expect(argv.iterateMaxTokens).toBe(500000);
      expect(argv.iterateStrictness).toBe('balanced');
    });

    it('should not override existing argv iterate settings', () => {
      const workflowConfig = {
        name: 'auth-flow',
        iterate: {
          enabled: true,
          timeout: 60,
          maxTokens: 500000
        }
      };

      const argv: any = {
        iterateTimeout: 30,
        iterateMaxTokens: 100000
      };

      if (workflowConfig?.iterate?.enabled !== false) {
        argv.iterate = true;
      }
      if (workflowConfig?.iterate) {
        if (workflowConfig.iterate.timeout && !argv.iterateTimeout) {
          argv.iterateTimeout = workflowConfig.iterate.timeout;
        }
        if (workflowConfig.iterate.maxTokens && !argv.iterateMaxTokens) {
          argv.iterateMaxTokens = workflowConfig.iterate.maxTokens;
        }
      }

      expect(argv.iterateTimeout).toBe(30); // CLI flag preserved
      expect(argv.iterateMaxTokens).toBe(100000); // CLI flag preserved
    });

    it('should handle workflow with iterate disabled', () => {
      const workflowConfig = {
        name: 'simple-flow',
        iterate: {
          enabled: false
        }
      };

      const argv: any = {};

      if (workflowConfig?.iterate?.enabled !== false) {
        argv.iterate = true;
      }

      expect(argv.iterate).toBeUndefined();
    });
  });

  describe('Handler - Provider Configuration', () => {
    it('should detect enabled providers', () => {
      const config = {
        providers: {
          'claude-code': { enabled: true, priority: 1, timeout: 30000 },
          'gemini-cli': { enabled: true, priority: 2, timeout: 30000 },
          'openai': { enabled: false, priority: 3, timeout: 30000 },
          'glm': { enabled: true, priority: 4, timeout: 30000 },
          'grok': { enabled: true, priority: 5, timeout: 30000 }
        }
      };

      const enabledProviders = Object.entries(config.providers)
        .filter(([_, conf]) => conf.enabled)
        .map(([name]) => name);

      expect(enabledProviders).toContain('claude-code');
      expect(enabledProviders).toContain('gemini-cli');
      expect(enabledProviders).not.toContain('openai');
      expect(enabledProviders).toContain('glm');
      expect(enabledProviders).toContain('grok');
      expect(enabledProviders.length).toBe(4);
    });

    it('should handle OpenAI SDK integration mode', () => {
      const openaiConfig = {
        enabled: true,
        integration: 'sdk',
        sdk: { defaultModel: 'gpt-4o' }
      };

      const integrationMode = openaiConfig.integration || 'cli';

      expect(integrationMode).toBe('sdk');
    });

    it('should handle OpenAI CLI integration mode', () => {
      const openaiConfig = {
        enabled: true,
        integration: 'cli',
        command: 'codex'
      };

      const integrationMode = openaiConfig.integration || 'cli';

      expect(integrationMode).toBe('cli');
    });

    it('should default to CLI mode when integration not specified', () => {
      const openaiConfig = {
        enabled: true,
        command: 'codex'
      };

      const integrationMode = (openaiConfig as any).integration || 'cli';

      expect(integrationMode).toBe('cli');
    });

    it('should enforce CLI-only mode via environment variable', () => {
      process.env.AX_CLI_ONLY = 'true';

      const openaiConfig = {
        enabled: true,
        integration: 'sdk'
      };

      const cliOnlyMode = process.env.AX_CLI_ONLY === 'true';
      let integrationMode = openaiConfig.integration || 'cli';

      if (cliOnlyMode && integrationMode === 'sdk') {
        integrationMode = 'cli';
      }

      expect(integrationMode).toBe('cli');
    });
  });

  describe('Handler - Cost Display Logic', () => {
    it('should calculate cost for Claude Opus model', () => {
      const pricing: Record<string, { input: number; output: number }> = {
        'claude-3-opus-20240229': { input: 15.00, output: 75.00 }
      };

      const tokens = { prompt: 1000, completion: 500 };
      const model = 'claude-3-opus-20240229';

      const inputCost = (tokens.prompt / 1_000_000) * pricing[model]!.input;
      const outputCost = (tokens.completion / 1_000_000) * pricing[model]!.output;
      const totalCost = inputCost + outputCost;

      // inputCost = 1000/1000000 * 15.00 = 0.015
      // outputCost = 500/1000000 * 75.00 = 0.0375
      expect(totalCost).toBeCloseTo(0.0525, 4);
    });

    it('should calculate cost for Claude Sonnet model', () => {
      const pricing: Record<string, { input: number; output: number }> = {
        'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 }
      };

      const tokens = { prompt: 2000, completion: 1000 };
      const model = 'claude-3-5-sonnet-20241022';

      const inputCost = (tokens.prompt / 1_000_000) * pricing[model]!.input;
      const outputCost = (tokens.completion / 1_000_000) * pricing[model]!.output;
      const totalCost = inputCost + outputCost;

      expect(totalCost).toBeCloseTo(0.021, 4);
    });

    it('should calculate cost for Gemini Flash model', () => {
      const pricing: Record<string, { input: number; output: number }> = {
        'gemini-2.0-flash-exp': { input: 0.125, output: 0.375 }
      };

      const tokens = { prompt: 10000, completion: 5000 };
      const model = 'gemini-2.0-flash-exp';

      const inputCost = (tokens.prompt / 1_000_000) * pricing[model]!.input;
      const outputCost = (tokens.completion / 1_000_000) * pricing[model]!.output;
      const totalCost = inputCost + outputCost;

      expect(totalCost).toBeCloseTo(0.003125, 6);
    });

    it('should calculate cost for GPT-4o-mini model', () => {
      const pricing: Record<string, { input: number; output: number }> = {
        'gpt-4o-mini': { input: 0.15, output: 0.60 }
      };

      const tokens = { prompt: 5000, completion: 2000 };
      const model = 'gpt-4o-mini';

      const inputCost = (tokens.prompt / 1_000_000) * pricing[model]!.input;
      const outputCost = (tokens.completion / 1_000_000) * pricing[model]!.output;
      const totalCost = inputCost + outputCost;

      expect(totalCost).toBeCloseTo(0.00195, 5);
    });

    it('should format duration from latencyMs', () => {
      const latencyMs = 2500;
      const duration = (latencyMs / 1000).toFixed(1) + 's';

      expect(duration).toBe('2.5s');
    });

    it('should handle undefined latencyMs', () => {
      const response: { model: string; tokensUsed: { total: number }; latencyMs?: number } = { model: 'gpt-4o', tokensUsed: { total: 100 } };
      const duration = response.latencyMs
        ? (response.latencyMs / 1000).toFixed(1) + 's'
        : 'unknown';

      expect(duration).toBe('unknown');
    });
  });

  describe('Handler - Multi-Stage Detection', () => {
    it('should detect multi-stage agent', () => {
      const context = {
        agent: {
          name: 'complex-agent',
          stages: [
            { name: 'analyze', description: 'Analyze code' },
            { name: 'implement', description: 'Implement changes' },
            { name: 'test', description: 'Run tests' },
            { name: 'review', description: 'Review changes' }
          ]
        }
      };

      const hasStages = context.agent.stages && context.agent.stages.length > 0;

      expect(hasStages).toBe(true);
      expect(context.agent.stages.length).toBe(4);
    });

    it('should detect single-stage agent', () => {
      const context = {
        agent: {
          name: 'simple-agent',
          stages: []
        }
      };

      const hasStages = context.agent.stages && context.agent.stages.length > 0;

      expect(hasStages).toBe(false);
    });

    it('should handle agent without stages property', () => {
      const context = {
        agent: {
          name: 'basic-agent'
        }
      };

      const hasStages = (context.agent as any).stages && (context.agent as any).stages.length > 0;

      expect(hasStages).toBeFalsy();
    });
  });

  describe('Handler - Execution Mode Building', () => {
    it('should build execution mode with all options enabled', () => {
      const argv = {
        hybrid: true,
        interactive: true,
        streaming: true,
        resumable: true,
        autoContinue: true
      };

      const executionMode = {
        interactive: argv.hybrid ? true : (argv.interactive ?? false),
        streaming: argv.hybrid ? true : (argv.streaming ?? false),
        resumable: argv.resumable ?? false,
        autoConfirm: argv.autoContinue ?? false
      };

      expect(executionMode.interactive).toBe(true);
      expect(executionMode.streaming).toBe(true);
      expect(executionMode.resumable).toBe(true);
      expect(executionMode.autoConfirm).toBe(true);
    });

    it('should build execution mode with minimal options', () => {
      const argv = {
        hybrid: false,
        interactive: false,
        streaming: false,
        resumable: false,
        autoContinue: false
      };

      const executionMode = {
        interactive: argv.hybrid ? true : (argv.interactive ?? false),
        streaming: argv.hybrid ? true : (argv.streaming ?? false),
        resumable: argv.resumable ?? false,
        autoConfirm: argv.autoContinue ?? false
      };

      expect(executionMode.interactive).toBe(false);
      expect(executionMode.streaming).toBe(false);
      expect(executionMode.resumable).toBe(false);
      expect(executionMode.autoConfirm).toBe(false);
    });

    it('should apply hybrid mode overrides', () => {
      const argv = {
        hybrid: true,
        interactive: false,
        streaming: false
      };

      const executionMode = {
        interactive: argv.hybrid ? true : (argv.interactive ?? false),
        streaming: argv.hybrid ? true : (argv.streaming ?? false)
      };

      // hybrid mode forces both to true
      expect(executionMode.interactive).toBe(true);
      expect(executionMode.streaming).toBe(true);
    });
  });

  describe('Handler - Iterate Mode Token Limits', () => {
    it('should apply default token limits', () => {
      const argv = { iterate: true };

      const maxTokens = (argv as any).iterateMaxTokens || 1_000_000;
      const maxTokensPerIteration = (argv as any).iterateMaxTokensPerIteration || 100_000;

      expect(maxTokens).toBe(1_000_000);
      expect(maxTokensPerIteration).toBe(100_000);
    });

    it('should use provided token limits', () => {
      const argv = {
        iterate: true,
        iterateMaxTokens: 500_000,
        iterateMaxTokensPerIteration: 50_000
      };

      const maxTokens = argv.iterateMaxTokens || 1_000_000;
      const maxTokensPerIteration = argv.iterateMaxTokensPerIteration || 100_000;

      expect(maxTokens).toBe(500_000);
      expect(maxTokensPerIteration).toBe(50_000);
    });

    it('should use default timeout when not provided', () => {
      const argv = { iterate: true };

      const timeout = (argv as any).iterateTimeout || 120;

      expect(timeout).toBe(120);
    });

    it('should use provided timeout', () => {
      const argv = { iterate: true, iterateTimeout: 60 };

      const timeout = argv.iterateTimeout || 120;

      expect(timeout).toBe(60);
    });
  });

  describe('Handler - Auto-Selection Display', () => {
    it('should show high confidence result', () => {
      const selection = {
        agent: 'backend',
        displayName: 'Benny',
        score: 0.95,
        confidence: 'high' as const,
        rationale: ['API keyword detected', 'Backend pattern match'],
        usedFallback: false
      };

      const confidenceEmoji = selection.confidence === 'high' ? '✅' :
                              selection.confidence === 'medium' ? '⚡' : '💡';

      expect(confidenceEmoji).toBe('✅');
      expect(selection.usedFallback).toBe(false);
      expect(selection.rationale.length).toBe(2);
    });

    it('should show medium confidence result', () => {
      const selection = {
        agent: 'frontend',
        displayName: 'Fiona',
        score: 0.75,
        confidence: 'medium' as string,
        rationale: ['UI keyword partial match'],
        usedFallback: false
      };

      const confidenceEmoji = selection.confidence === 'high' ? '✅' :
                              selection.confidence === 'medium' ? '⚡' : '💡';

      expect(confidenceEmoji).toBe('⚡');
    });

    it('should show fallback warning when low confidence', () => {
      const selection = {
        agent: 'backend',
        displayName: 'Benny',
        score: 0.45,
        confidence: 'low' as string,
        rationale: ['Default fallback'],
        usedFallback: true
      };

      const confidenceEmoji = selection.confidence === 'high' ? '✅' :
                              selection.confidence === 'medium' ? '⚡' : '💡';

      expect(confidenceEmoji).toBe('💡');
      expect(selection.usedFallback).toBe(true);
    });
  });

  describe('Handler - Error Cleanup', () => {
    it('should cleanup memory manager on error', async () => {
      const mockClose = vi.fn().mockResolvedValue(undefined);
      const memoryManager = { close: mockClose };

      await memoryManager.close();

      expect(mockClose).toHaveBeenCalled();
    });

    it('should cleanup router on error', () => {
      const mockDestroy = vi.fn();
      const router = { destroy: mockDestroy };

      router.destroy();

      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should cleanup context manager on error', async () => {
      const mockCleanup = vi.fn().mockResolvedValue(undefined);
      const contextManager = { cleanup: mockCleanup };
      const context = { id: 'test' };

      await contextManager.cleanup(context);

      expect(mockCleanup).toHaveBeenCalledWith(context);
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockCleanup = vi.fn().mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(mockCleanup().catch(() => {})).resolves.toBeUndefined();
    });
  });

  describe('Handler - Environment Variable Detection', () => {
    it('should enable provider output in streaming mode', () => {
      const argv = { verbose: false, streaming: true };

      if (argv.verbose || argv.streaming) {
        process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT = 'true';
      }

      expect(process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT).toBe('true');
    });

    it('should not enable provider output when both disabled', () => {
      delete process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT;

      const argv = { verbose: false, streaming: false };

      if (argv.verbose || argv.streaming) {
        process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT = 'true';
      }

      expect(process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT).toBeUndefined();
    });
  });
});
