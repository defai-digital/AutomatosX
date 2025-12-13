/**
 * Tests for resume CLI command
 * Full coverage for handler and all branches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted for ALL mock instances to ensure they survive vi.clearAllMocks()
const checkpointManagerInstance = vi.hoisted(() => ({
  loadCheckpoint: vi.fn()
}));

const lazyMemoryManagerInstance = vi.hoisted(() => ({
  close: vi.fn()
}));

const routerInstance = vi.hoisted(() => ({
  destroy: vi.fn()
}));

const sessionManagerInstance = vi.hoisted(() => ({
  initialize: vi.fn()
}));

const controllerInstance = vi.hoisted(() => ({
  resume: vi.fn()
}));

// Use vi.hoisted for stable mocks
const pathResolverMock = vi.hoisted(() => ({
  PathResolver: class {
    getAgentsDirectory() { return '/test/.automatosx/agents'; }
  },
  detectProjectRoot: vi.fn()
}));

const configLoaderMock = vi.hoisted(() => ({
  loadConfig: vi.fn()
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
    blue: {
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

vi.mock('../../../../src/shared/validation/path-resolver.js', () => pathResolverMock);
vi.mock('../../../../src/core/config/loader.js', () => configLoaderMock);

vi.mock('../../../../src/core/session/checkpoint.js', () => ({
  CheckpointManager: vi.fn().mockImplementation(function() {
    return checkpointManagerInstance;
  })
}));

vi.mock('../../../../src/core/team-manager.js', () => ({
  TeamManager: class {}
}));

vi.mock('../../../../src/agents/profile-loader.js', () => ({
  ProfileLoader: class {}
}));

vi.mock('../../../../src/agents/abilities-manager.js', () => ({
  AbilitiesManager: class {}
}));

vi.mock('../../../../src/agents/context-manager.js', () => ({
  ContextManager: class {}
}));

vi.mock('../../../../src/agents/executor.js', () => ({
  AgentExecutor: class {}
}));

vi.mock('../../../../src/core/memory/lazy-manager.js', () => ({
  LazyMemoryManager: vi.fn().mockImplementation(function() {
    return lazyMemoryManagerInstance;
  })
}));

vi.mock('../../../../src/core/router/router.js', () => ({
  Router: vi.fn().mockImplementation(function() {
    return routerInstance;
  })
}));

vi.mock('../../../../src/core/session/manager.js', () => ({
  SessionManager: vi.fn().mockImplementation(function() {
    return sessionManagerInstance;
  })
}));

vi.mock('../../../../src/core/workspace-manager.js', () => ({
  WorkspaceManager: class {}
}));

vi.mock('../../../../src/core/stage-execution-controller.js', () => ({
  StageExecutionController: vi.fn().mockImplementation(function() {
    return controllerInstance;
  })
}));

vi.mock('../../../../src/providers/claude-provider.js', () => ({
  ClaudeProvider: vi.fn().mockImplementation(function() {
    return { name: 'claude-code' };
  })
}));

vi.mock('../../../../src/providers/gemini-provider.js', () => ({
  GeminiProvider: vi.fn().mockImplementation(function() {
    return { name: 'gemini-cli' };
  })
}));

vi.mock('../../../../src/providers/openai-provider-factory.js', () => ({
  createOpenAIProviderSync: vi.fn().mockReturnValue({ name: 'openai' })
}));

vi.mock('../../../../src/providers/glm-provider.js', () => ({
  GLMProvider: vi.fn().mockImplementation(function() {
    return { name: 'glm' };
  })
}));

vi.mock('../../../../src/providers/grok-provider.js', () => ({
  GrokProvider: vi.fn().mockImplementation(function() {
    return { name: 'grok' };
  })
}));

describe('Resume Command', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  const defaultCheckpoint = {
    runId: 'test-run-12345678',
    agent: 'backend',
    task: 'test task',
    lastCompletedStageIndex: 1,
    stages: [{ name: 'stage1' }, { name: 'stage2' }, { name: 'stage3' }],
    createdAt: Date.now(),
    mode: { interactive: false, streaming: true, autoConfirm: false }
  };

  const defaultConfig = {
    providers: {},
    execution: { stages: {} },
    router: {}
  };

  beforeEach(async () => {
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Clear call histories only (don't reset implementations)
    pathResolverMock.detectProjectRoot.mockClear();
    configLoaderMock.loadConfig.mockClear();
    checkpointManagerInstance.loadCheckpoint.mockClear();
    controllerInstance.resume.mockClear();
    sessionManagerInstance.initialize.mockClear();
    lazyMemoryManagerInstance.close.mockClear();
    routerInstance.destroy.mockClear();

    // Re-setup constructor mock implementations (may have been cleared by mockResolvedValueOnce consumption)
    const { CheckpointManager } = await import('../../../../src/core/session/checkpoint.js');
    const { LazyMemoryManager } = await import('../../../../src/core/memory/lazy-manager.js');
    const { Router } = await import('../../../../src/core/router/router.js');
    const { SessionManager } = await import('../../../../src/core/session/manager.js');
    const { StageExecutionController } = await import('../../../../src/core/stage-execution-controller.js');
    const { ClaudeProvider } = await import('../../../../src/providers/claude-provider.js');
    const { GeminiProvider } = await import('../../../../src/providers/gemini-provider.js');
    const { GLMProvider } = await import('../../../../src/providers/glm-provider.js');
    const { GrokProvider } = await import('../../../../src/providers/grok-provider.js');

    vi.mocked(CheckpointManager).mockImplementation(function() {
      return checkpointManagerInstance as any;
    });
    vi.mocked(LazyMemoryManager).mockImplementation(function() {
      return lazyMemoryManagerInstance as any;
    });
    vi.mocked(Router).mockImplementation(function() {
      return routerInstance as any;
    });
    vi.mocked(SessionManager).mockImplementation(function() {
      return sessionManagerInstance as any;
    });
    vi.mocked(StageExecutionController).mockImplementation(function() {
      return controllerInstance as any;
    });
    vi.mocked(ClaudeProvider).mockImplementation(function() {
      return { name: 'claude-code' } as any;
    });
    vi.mocked(GeminiProvider).mockImplementation(function() {
      return { name: 'gemini-cli' } as any;
    });
    vi.mocked(GLMProvider).mockImplementation(function() {
      return { name: 'glm' } as any;
    });
    vi.mocked(GrokProvider).mockImplementation(function() {
      return { name: 'grok' } as any;
    });

    // Setup default mocks on the shared instances
    pathResolverMock.detectProjectRoot.mockResolvedValue('/test/project');
    configLoaderMock.loadConfig.mockResolvedValue(defaultConfig);
    checkpointManagerInstance.loadCheckpoint.mockResolvedValue(defaultCheckpoint);
    controllerInstance.resume.mockResolvedValue({ success: true });
    sessionManagerInstance.initialize.mockResolvedValue(undefined);
    lazyMemoryManagerInstance.close.mockResolvedValue(undefined);
    routerInstance.destroy.mockReturnValue(undefined);
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    vi.resetModules();
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');
      expect(resumeCommand.command).toBe('resume <run-id>');
    });

    it('should have description', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');
      expect(resumeCommand.describe).toContain('Resume execution');
    });

    it('should have builder function', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');
      expect(typeof resumeCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');
      expect(typeof resumeCommand.handler).toBe('function');
    });

    it('should configure options in builder', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      const mockYargs: any = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis()
      };

      (resumeCommand.builder as Function)(mockYargs);

      expect(mockYargs.positional).toHaveBeenCalledWith('run-id', expect.objectContaining({
        type: 'string',
        demandOption: true
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('interactive', expect.objectContaining({
        alias: 'i',
        type: 'boolean'
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('streaming', expect.objectContaining({
        alias: 's',
        type: 'boolean'
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('verbose', expect.objectContaining({
        alias: 'v',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('auto-continue', expect.objectContaining({
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('hybrid', expect.objectContaining({
        type: 'boolean',
        default: false
      }));
    });
  });

  describe('Handler - Run ID Validation', () => {
    it('should validate run-id is required', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      // When process.exit is mocked, code continues, so we catch the error
      try {
        await resumeCommand.handler({
          'run-id': undefined,
          _: ['resume'],
          $0: 'ax'
        } as any);
      } catch {
        // Expected to throw after mocked exit
      }

      expect(mockProcessExit).toHaveBeenCalledWith(1);
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Run ID is required');
    });

    it('should validate run-id is a string', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      try {
        await resumeCommand.handler({
          'run-id': 123,
          _: ['resume'],
          $0: 'ax'
        } as any);
      } catch {
        // Expected to throw after mocked exit
      }

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - Successful Resume', () => {
    it('should resume successfully with valid run-id', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        verbose: false,
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(controllerInstance.resume).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should display checkpoint summary', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Checkpoint Found');
    });

    it('should truncate run-id for display', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678-full-uuid',
        _: ['resume'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('test-run');
    });

    it('should cleanup resources on success', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(lazyMemoryManagerInstance.close).toHaveBeenCalled();
      expect(routerInstance.destroy).toHaveBeenCalled();
    });
  });

  describe('Handler - Verbose Mode', () => {
    it('should show project info in verbose mode', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        verbose: true,
        _: ['resume'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Project');
    });

    it('should show memory initialization status in verbose mode', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        verbose: true,
        _: ['resume'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Memory system ready');
    });
  });

  describe('Handler - Memory Manager Initialization', () => {
    it('should handle memory manager initialization failure in verbose mode', async () => {
      const { LazyMemoryManager } = await import('../../../../src/core/memory/lazy-manager.js');
      vi.mocked(LazyMemoryManager).mockImplementationOnce(() => {
        throw new Error('Memory initialization failed');
      });

      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        verbose: true,
        _: ['resume'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Memory features disabled');
    });

    it('should continue without memory manager when initialization fails', async () => {
      const { LazyMemoryManager } = await import('../../../../src/core/memory/lazy-manager.js');
      vi.mocked(LazyMemoryManager).mockImplementationOnce(() => {
        throw new Error('Memory initialization failed');
      });

      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        verbose: false,
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(controllerInstance.resume).toHaveBeenCalled();
    });
  });

  describe('Handler - Execution Mode', () => {
    it('should enable hybrid mode', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        hybrid: true,
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(controllerInstance.resume).toHaveBeenCalledWith(
        'test-run-12345678',
        expect.objectContaining({
          interactive: true,
          streaming: true
        }),
        expect.any(Object)
      );
    });

    it('should use checkpoint mode when no flags provided', async () => {
      checkpointManagerInstance.loadCheckpoint.mockResolvedValueOnce({
        ...defaultCheckpoint,
        mode: { interactive: true, streaming: false, autoConfirm: true }
      });

      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(controllerInstance.resume).toHaveBeenCalledWith(
        'test-run-12345678',
        expect.objectContaining({
          interactive: true,
          streaming: false,
          autoConfirm: true
        }),
        expect.any(Object)
      );
    });

    it('should override with interactive flag', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        interactive: true,
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(controllerInstance.resume).toHaveBeenCalledWith(
        'test-run-12345678',
        expect.objectContaining({
          interactive: true
        }),
        expect.any(Object)
      );
    });

    it('should override with streaming flag', async () => {
      checkpointManagerInstance.loadCheckpoint.mockResolvedValueOnce({
        ...defaultCheckpoint,
        mode: { interactive: false, streaming: false }
      });

      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        streaming: true,
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(controllerInstance.resume).toHaveBeenCalledWith(
        'test-run-12345678',
        expect.objectContaining({
          streaming: true
        }),
        expect.any(Object)
      );
    });

    it('should enable auto-continue mode', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        autoContinue: true,
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(controllerInstance.resume).toHaveBeenCalledWith(
        'test-run-12345678',
        expect.objectContaining({
          autoConfirm: true
        }),
        expect.any(Object)
      );
    });

    it('should default streaming to true when not in checkpoint', async () => {
      checkpointManagerInstance.loadCheckpoint.mockResolvedValueOnce({
        ...defaultCheckpoint,
        mode: { interactive: false }
      });

      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(controllerInstance.resume).toHaveBeenCalledWith(
        'test-run-12345678',
        expect.objectContaining({
          streaming: true
        }),
        expect.any(Object)
      );
    });
  });

  describe('Handler - Provider Initialization', () => {
    it('should initialize claude-code provider when enabled', async () => {
      configLoaderMock.loadConfig.mockResolvedValueOnce({
        providers: {
          'claude-code': { enabled: true, priority: 1, timeout: 60000 }
        },
        execution: { stages: {} },
        router: {}
      });

      const { ClaudeProvider } = await import('../../../../src/providers/claude-provider.js');
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(ClaudeProvider).toHaveBeenCalled();
    });

    it('should initialize gemini-cli provider when enabled', async () => {
      configLoaderMock.loadConfig.mockResolvedValueOnce({
        providers: {
          'gemini-cli': { enabled: true, priority: 2, timeout: 60000 }
        },
        execution: { stages: {} },
        router: {}
      });

      const { GeminiProvider } = await import('../../../../src/providers/gemini-provider.js');
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(GeminiProvider).toHaveBeenCalled();
    });

    it('should initialize openai provider when enabled', async () => {
      configLoaderMock.loadConfig.mockResolvedValueOnce({
        providers: {
          'openai': { enabled: true, priority: 3, timeout: 60000 }
        },
        execution: { stages: {} },
        router: {}
      });

      const { createOpenAIProviderSync } = await import('../../../../src/providers/openai-provider-factory.js');
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(createOpenAIProviderSync).toHaveBeenCalled();
    });

    it('should initialize glm provider when enabled', async () => {
      configLoaderMock.loadConfig.mockResolvedValueOnce({
        providers: {
          'glm': { enabled: true, priority: 4, timeout: 60000 }
        },
        execution: { stages: {} },
        router: {}
      });

      const { GLMProvider } = await import('../../../../src/providers/glm-provider.js');
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(GLMProvider).toHaveBeenCalled();
    });

    it('should initialize grok provider when enabled', async () => {
      configLoaderMock.loadConfig.mockResolvedValueOnce({
        providers: {
          'grok': { enabled: true, priority: 5, timeout: 60000 }
        },
        execution: { stages: {} },
        router: {}
      });

      const { GrokProvider } = await import('../../../../src/providers/grok-provider.js');
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(GrokProvider).toHaveBeenCalled();
    });
  });

  describe('Handler - Health Check Interval', () => {
    it('should use minimum health check interval from providers', async () => {
      configLoaderMock.loadConfig.mockResolvedValueOnce({
        providers: {
          'claude-code': { enabled: true, priority: 1, healthCheck: { interval: 60000 } },
          'gemini-cli': { enabled: true, priority: 2, healthCheck: { interval: 30000 } }
        },
        execution: { stages: {} },
        router: {}
      });

      const { Router } = await import('../../../../src/core/router/router.js');
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(Router).toHaveBeenCalledWith(expect.objectContaining({
        healthCheckInterval: 30000
      }));
    });
  });

  describe('Handler - Execution Failure', () => {
    it('should exit with error when execution fails', async () => {
      controllerInstance.resume.mockResolvedValueOnce({ success: false });

      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should cleanup resources on execution failure', async () => {
      controllerInstance.resume.mockResolvedValueOnce({ success: false });

      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(lazyMemoryManagerInstance.close).toHaveBeenCalled();
      expect(routerInstance.destroy).toHaveBeenCalled();
    });
  });

  describe('Handler - Error Handling', () => {
    it('should handle detectProjectRoot error', async () => {
      pathResolverMock.detectProjectRoot.mockRejectedValueOnce(new Error('Not a project directory'));

      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle checkpoint not found error', async () => {
      checkpointManagerInstance.loadCheckpoint.mockRejectedValueOnce(new Error('Checkpoint not found'));

      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should log error with context', async () => {
      pathResolverMock.detectProjectRoot.mockRejectedValueOnce(new Error('Test error'));
      const { logger } = await import('../../../../src/shared/logging/logger.js');

      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(logger.error).toHaveBeenCalledWith(
        'Resume failed',
        expect.objectContaining({
          error: 'Test error',
          runId: 'test-run-12345678'
        })
      );
    });

    it('should cleanup resources on error', async () => {
      // Need to make error occur after resources are created
      controllerInstance.resume.mockRejectedValueOnce(new Error('Resume execution error'));

      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(lazyMemoryManagerInstance.close).toHaveBeenCalled();
      expect(routerInstance.destroy).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      controllerInstance.resume.mockRejectedValueOnce(new Error('Resume error'));
      lazyMemoryManagerInstance.close.mockRejectedValueOnce(new Error('Cleanup error'));

      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(logger.debug).toHaveBeenCalledWith(
        'Cleanup error ignored',
        expect.objectContaining({ error: 'Cleanup error' })
      );
    });
  });

  describe('Handler - Configuration', () => {
    it('should use custom checkpoint path from config', async () => {
      configLoaderMock.loadConfig.mockResolvedValueOnce({
        providers: {},
        execution: {
          stages: {
            checkpointPath: '/custom/checkpoints'
          }
        },
        router: {}
      });

      const { CheckpointManager } = await import('../../../../src/core/session/checkpoint.js');
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(CheckpointManager).toHaveBeenCalledWith(
        '/custom/checkpoints',
        expect.any(Number)
      );
    });

    it('should use default cleanup days', async () => {
      const { CheckpointManager } = await import('../../../../src/core/session/checkpoint.js');
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(CheckpointManager).toHaveBeenCalledWith(
        expect.any(String),
        7 // default cleanup days
      );
    });

    it('should use custom cleanup days from config', async () => {
      configLoaderMock.loadConfig.mockResolvedValueOnce({
        providers: {},
        execution: {
          stages: {
            cleanupAfterDays: 14
          }
        },
        router: {}
      });

      const { CheckpointManager } = await import('../../../../src/core/session/checkpoint.js');
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(CheckpointManager).toHaveBeenCalledWith(
        expect.any(String),
        14
      );
    });

    it('should pass verbose flag to controller', async () => {
      const { resumeCommand } = await import('../../../../src/cli/commands/resume.js');

      await resumeCommand.handler({
        'run-id': 'test-run-12345678',
        verbose: true,
        _: ['resume'],
        $0: 'ax'
      } as any);

      expect(controllerInstance.resume).toHaveBeenCalledWith(
        'test-run-12345678',
        expect.any(Object),
        expect.objectContaining({ verbose: true })
      );
    });
  });
});
