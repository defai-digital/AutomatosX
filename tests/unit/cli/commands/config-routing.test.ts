/**
 * Tests for config-routing CLI command
 * Full coverage for handler and all branches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted for stable mock instances
const routingConfiguratorInstance = vi.hoisted(() => ({
  detectCapabilities: vi.fn(),
  generateRecommendation: vi.fn(),
  generateReport: vi.fn(),
  applyRecommendation: vi.fn()
}));

const dynamicOptimizerInstance = vi.hoisted(() => ({
  initialize: vi.fn(),
  getStats: vi.fn(),
  getCostSummary: vi.fn(),
  getAdaptivePriorities: vi.fn(),
  getPerformanceSnapshot: vi.fn(),
  generateRecommendations: vi.fn()
}));

const fsMock = vi.hoisted(() => ({
  access: vi.fn()
}));

const configLoaderMock = vi.hoisted(() => ({
  loadConfigFile: vi.fn()
}));

const errorFormatterMock = vi.hoisted(() => ({
  printError: vi.fn()
}));

const dynamicOptimizerMock = vi.hoisted(() => ({
  getDynamicOptimizer: vi.fn(),
  resetDynamicOptimizer: vi.fn()
}));

// Mock chalk with all needed methods
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((s: string) => s),
    gray: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
    yellow: vi.fn((s: string) => s),
    red: vi.fn((s: string) => s),
    bold: Object.assign(vi.fn((s: string) => s), {
      cyan: vi.fn((s: string) => s),
      green: vi.fn((s: string) => s)
    })
  }
}));

vi.mock('fs/promises', () => fsMock);

vi.mock('fs', () => ({
  constants: { F_OK: 0 }
}));

vi.mock('path', () => ({
  resolve: vi.fn((...args) => args.join('/'))
}));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../../src/shared/errors/error-formatter.js', () => errorFormatterMock);

vi.mock('../../../../src/core/routing-configurator.js', () => ({
  RoutingConfigurator: vi.fn().mockImplementation(function() {
    return routingConfiguratorInstance;
  })
}));

vi.mock('../../../../src/core/config/loader.js', () => configLoaderMock);

vi.mock('../../../../src/core/router/dynamic-optimizer.js', () => dynamicOptimizerMock);

describe('Config Routing Command', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockProcessCwd: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessCwd = vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    // Clear call histories only
    routingConfiguratorInstance.detectCapabilities.mockClear();
    routingConfiguratorInstance.generateRecommendation.mockClear();
    routingConfiguratorInstance.generateReport.mockClear();
    routingConfiguratorInstance.applyRecommendation.mockClear();
    dynamicOptimizerInstance.initialize.mockClear();
    dynamicOptimizerInstance.getStats.mockClear();
    dynamicOptimizerInstance.getCostSummary.mockClear();
    dynamicOptimizerInstance.getAdaptivePriorities.mockClear();
    dynamicOptimizerInstance.getPerformanceSnapshot.mockClear();
    dynamicOptimizerInstance.generateRecommendations.mockClear();
    fsMock.access.mockClear();
    configLoaderMock.loadConfigFile.mockClear();
    errorFormatterMock.printError.mockClear();
    dynamicOptimizerMock.getDynamicOptimizer.mockClear();
    dynamicOptimizerMock.resetDynamicOptimizer.mockClear();

    // Re-setup constructor mocks
    const { RoutingConfigurator } = await import('../../../../src/core/routing-configurator.js');
    vi.mocked(RoutingConfigurator).mockImplementation(function() {
      return routingConfiguratorInstance as any;
    });

    // Setup default return values
    fsMock.access.mockResolvedValue(undefined);

    configLoaderMock.loadConfigFile.mockResolvedValue({
      providers: {
        'claude-code': { enabled: true, priority: 1, command: 'claude' },
        'gemini-cli': { enabled: true, priority: 2, command: 'gemini' }
      },
      router: {
        healthCheckInterval: 30000,
        providerCooldownMs: 60000,
        enableFreeTierPrioritization: true,
        routing: {
          autoConfigured: true,
          lastConfiguredAt: '2024-01-01',
          strategy: 'priority',
          agentAffinities: {
            backend: { primary: 'claude-code', fallback: ['gemini-cli', 'codex'] },
            frontend: { primary: 'gemini-cli', fallback: ['claude-code'] }
          },
          abilityRouting: {
            'code-generation': { preferredProviders: ['claude-code', 'codex'] }
          }
        }
      }
    });

    routingConfiguratorInstance.detectCapabilities.mockResolvedValue(undefined);
    routingConfiguratorInstance.generateRecommendation.mockReturnValue({
      providers: { 'claude-code': { enabled: true, priority: 1 } },
      rationale: ['Claude Code is available and recommended']
    });
    routingConfiguratorInstance.generateReport.mockReturnValue('Provider: claude-code\nPriority: 1');
    routingConfiguratorInstance.applyRecommendation.mockResolvedValue({
      applied: true,
      changes: ['Updated claude-code priority', 'Added gemini-cli fallback']
    });

    dynamicOptimizerMock.getDynamicOptimizer.mockReturnValue(dynamicOptimizerInstance);
    dynamicOptimizerMock.resetDynamicOptimizer.mockImplementation(() => {});
    dynamicOptimizerInstance.initialize.mockResolvedValue(undefined);
    dynamicOptimizerInstance.getStats.mockReturnValue({
      isInitialized: true,
      providersTracked: 2,
      lastOptimizationAt: '2024-01-01T12:00:00Z'
    });
    dynamicOptimizerInstance.getCostSummary.mockReturnValue({
      totalCostUsd: 0.0523,
      topSpenders: [
        { provider: 'claude-code', costUsd: 0.0345 },
        { provider: 'gemini-cli', costUsd: 0.0178 }
      ]
    });
    dynamicOptimizerInstance.getAdaptivePriorities.mockReturnValue({
      'claude-code': 0.92,
      'gemini-cli': 0.75
    });
    dynamicOptimizerInstance.getPerformanceSnapshot.mockResolvedValue({
      latency: { avg: 450, p95: 780 },
      successRate: 0.97,
      qualityScore: 0.91,
      lastUpdatedAt: '2024-01-01T11:30:00Z'
    });
    dynamicOptimizerInstance.generateRecommendations.mockResolvedValue([
      { provider: 'gemini-cli', type: 'priority', impact: 'medium', reason: 'Lower latency observed', recommendedValue: 'increase' }
    ]);
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessCwd.mockRestore();
    vi.resetModules();
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');
      expect(routingSubcommand.command).toBe('routing');
    });

    it('should have description', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');
      expect(routingSubcommand.describe).toContain('provider routing');
    });

    it('should have builder function', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');
      expect(typeof routingSubcommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');
      expect(typeof routingSubcommand.handler).toBe('function');
    });

    it('should configure all options in builder', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      const mockYargs: any = {
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis()
      };

      (routingSubcommand.builder as Function)(mockYargs);

      expect(mockYargs.option).toHaveBeenCalledWith('show', expect.objectContaining({
        alias: 's',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('reset', expect.objectContaining({
        alias: 'r',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('dry-run', expect.objectContaining({
        alias: 'd',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('json', expect.objectContaining({
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('verbose', expect.objectContaining({
        alias: 'v',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('agent', expect.objectContaining({
        alias: 'a',
        type: 'string'
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('ability', expect.objectContaining({
        type: 'string'
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('optimizer', expect.objectContaining({
        alias: 'o',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.example).toHaveBeenCalledTimes(7);
    });
  });

  describe('Handler - Config Path Resolution', () => {
    it('should exit with error when config file not found', async () => {
      fsMock.access.mockRejectedValue(new Error('ENOENT'));

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should find ax.config.json in current directory', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: true,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(fsMock.access).toHaveBeenCalled();
      expect(configLoaderMock.loadConfigFile).toHaveBeenCalled();
    });

    it('should fall back to .automatosx/config.json', async () => {
      // First call fails, second succeeds
      fsMock.access
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(undefined);

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: true,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(fsMock.access).toHaveBeenCalledTimes(2);
    });
  });

  describe('Handler - Show Routing Config', () => {
    it('should display current routing configuration', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: true,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(configLoaderMock.loadConfigFile).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display routing config in JSON format', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: true,
        reset: false,
        dryRun: false,
        json: true,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display verbose routing config with agent affinities', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: true,
        reset: false,
        dryRun: false,
        json: false,
        verbose: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle config without router settings', async () => {
      configLoaderMock.loadConfigFile.mockResolvedValue({
        providers: {
          'claude-code': { enabled: true, priority: 1, command: 'claude' }
        }
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: true,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle config with partial router settings', async () => {
      configLoaderMock.loadConfigFile.mockResolvedValue({
        providers: {
          'claude-code': { enabled: true, priority: 1, command: 'claude' }
        },
        router: {
          healthCheckInterval: 30000
        }
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: true,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Agent Affinity', () => {
    it('should display affinity for known agent', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        agent: 'backend',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should display agent affinity in JSON format', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: true,
        verbose: false,
        agent: 'backend',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle unknown agent with similar suggestions', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        agent: 'back',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle unknown agent with no similar suggestions', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        agent: 'xyz-unknown',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle config with no agent affinities', async () => {
      configLoaderMock.loadConfigFile.mockResolvedValue({
        providers: { 'claude-code': { enabled: true, priority: 1 } },
        router: {}
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        agent: 'backend',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show agent with no primary provider configured', async () => {
      configLoaderMock.loadConfigFile.mockResolvedValue({
        providers: { 'claude-code': { enabled: true, priority: 1 } },
        router: {
          routing: {
            agentAffinities: {
              backend: { primary: null, fallback: ['gemini-cli'] }
            }
          }
        }
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        agent: 'backend',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show agent with empty fallback list', async () => {
      configLoaderMock.loadConfigFile.mockResolvedValue({
        providers: { 'claude-code': { enabled: true, priority: 1 } },
        router: {
          routing: {
            agentAffinities: {
              backend: { primary: 'claude-code', fallback: [] }
            }
          }
        }
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        agent: 'backend',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should truncate long list of known agents', async () => {
      const manyAgents: Record<string, any> = {};
      for (let i = 0; i < 15; i++) {
        manyAgents[`agent-${i}`] = { primary: 'claude-code', fallback: [] };
      }

      configLoaderMock.loadConfigFile.mockResolvedValue({
        providers: { 'claude-code': { enabled: true, priority: 1 } },
        router: {
          routing: {
            agentAffinities: manyAgents
          }
        }
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        agent: 'unknown',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Ability Routing', () => {
    it('should display routing for known ability type', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        ability: 'code-generation',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display ability routing in JSON format', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: true,
        verbose: false,
        ability: 'code-generation',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle unknown ability type with similar suggestions', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        ability: 'code',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle completely unknown ability type', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        ability: 'xyz-unknown',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should use default routing for known ability without config', async () => {
      configLoaderMock.loadConfigFile.mockResolvedValue({
        providers: { 'claude-code': { enabled: true, priority: 1 } },
        router: {}
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        ability: 'code-review',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show configured routing source', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        ability: 'code-generation',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle ability with no preferred providers', async () => {
      configLoaderMock.loadConfigFile.mockResolvedValue({
        providers: { 'claude-code': { enabled: true, priority: 1 } },
        router: {
          routing: {
            abilityRouting: {
              'custom-ability': { preferredProviders: [] }
            }
          }
        }
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        ability: 'custom-ability',
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Optimizer Stats', () => {
    it('should display optimizer stats', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        optimizer: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(dynamicOptimizerInstance.initialize).toHaveBeenCalled();
      expect(dynamicOptimizerInstance.getStats).toHaveBeenCalled();
      expect(dynamicOptimizerMock.resetDynamicOptimizer).toHaveBeenCalled();
    });

    it('should display optimizer stats in JSON format', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: true,
        verbose: false,
        optimizer: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      expect(dynamicOptimizerMock.resetDynamicOptimizer).toHaveBeenCalled();
    });

    it('should display verbose optimizer stats with performance snapshots', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: true,
        optimizer: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(dynamicOptimizerInstance.getPerformanceSnapshot).toHaveBeenCalled();
    });

    it('should display recommendations when available', async () => {
      dynamicOptimizerInstance.generateRecommendations.mockResolvedValue([
        { provider: 'gemini-cli', type: 'priority', impact: 'high', reason: 'Low success rate', recommendedValue: 'decrease' },
        { provider: 'claude-code', type: 'timeout', impact: 'medium', reason: 'High latency', recommendedValue: '60s' },
        { provider: 'codex', type: 'enable', impact: 'low', reason: 'Available provider', recommendedValue: 'true' }
      ]);

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        optimizer: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(dynamicOptimizerInstance.generateRecommendations).toHaveBeenCalled();
    });

    it('should handle optimizer with no providers tracked', async () => {
      dynamicOptimizerInstance.getStats.mockReturnValue({
        isInitialized: false,
        providersTracked: 0,
        lastOptimizationAt: null
      });
      dynamicOptimizerInstance.getAdaptivePriorities.mockReturnValue({});

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: true,
        optimizer: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display cost summary with empty top spenders', async () => {
      dynamicOptimizerInstance.getCostSummary.mockReturnValue({
        totalCostUsd: 0,
        topSpenders: []
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        optimizer: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle null performance snapshot', async () => {
      dynamicOptimizerInstance.getPerformanceSnapshot.mockResolvedValue(null);

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: true,
        optimizer: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Auto-Configure', () => {
    it('should auto-configure routing', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(routingConfiguratorInstance.detectCapabilities).toHaveBeenCalled();
      expect(routingConfiguratorInstance.generateRecommendation).toHaveBeenCalled();
      expect(routingConfiguratorInstance.applyRecommendation).toHaveBeenCalled();
    });

    it('should display recommendation in JSON format', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: true,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle no providers detected', async () => {
      routingConfiguratorInstance.generateRecommendation.mockReturnValue({
        providers: {},
        rationale: ['No providers were detected', 'Install Claude Code or Gemini CLI']
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should show verbose output with applied changes', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle configuration preserved (not applied)', async () => {
      routingConfiguratorInstance.applyRecommendation.mockResolvedValue({
        applied: false,
        changes: []
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Dry Run Mode', () => {
    it('should show changes without applying in dry-run mode', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: true,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(routingConfiguratorInstance.applyRecommendation).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ dryRun: true })
      );
    });

    it('should show no changes needed in dry-run mode', async () => {
      routingConfiguratorInstance.applyRecommendation.mockResolvedValue({
        applied: false,
        changes: []
      });

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: true,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Reset Mode', () => {
    it('should not preserve customizations in reset mode', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: true,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(routingConfiguratorInstance.applyRecommendation).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ preserveCustomizations: false })
      );
    });

    it('should use reset mode with dry-run', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: true,
        dryRun: true,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(routingConfiguratorInstance.applyRecommendation).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ dryRun: true, preserveCustomizations: false })
      );
    });
  });

  describe('Handler - Error Handling', () => {
    it('should handle error during auto-configure', async () => {
      routingConfiguratorInstance.detectCapabilities.mockRejectedValue(
        new Error('Detection failed')
      );

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(errorFormatterMock.printError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle error during show routing config', async () => {
      configLoaderMock.loadConfigFile.mockRejectedValue(new Error('Load failed'));

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: true,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(errorFormatterMock.printError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle error with verbose option', async () => {
      routingConfiguratorInstance.detectCapabilities.mockRejectedValue(
        new Error('Verbose error')
      );

      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      expect(errorFormatterMock.printError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ verbose: true })
      );
    });
  });

  describe('Option Priority', () => {
    it('should prioritize --show over other options', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: true,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        agent: 'backend',
        ability: 'code-generation',
        optimizer: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      // Show should be handled, not agent/ability/optimizer
      expect(configLoaderMock.loadConfigFile).toHaveBeenCalled();
      expect(dynamicOptimizerInstance.initialize).not.toHaveBeenCalled();
    });

    it('should prioritize --agent over --ability and --optimizer', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        agent: 'backend',
        ability: 'code-generation',
        optimizer: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      // Agent should be handled
      expect(configLoaderMock.loadConfigFile).toHaveBeenCalled();
      expect(dynamicOptimizerInstance.initialize).not.toHaveBeenCalled();
    });

    it('should prioritize --ability over --optimizer', async () => {
      const { routingSubcommand } = await import('../../../../src/cli/commands/config-routing.js');

      await routingSubcommand.handler({
        show: false,
        reset: false,
        dryRun: false,
        json: false,
        verbose: false,
        ability: 'code-generation',
        optimizer: true,
        _: ['config', 'routing'],
        $0: 'ax'
      } as any);

      // Ability should be handled
      expect(configLoaderMock.loadConfigFile).toHaveBeenCalled();
      expect(dynamicOptimizerInstance.initialize).not.toHaveBeenCalled();
    });
  });
});
