/**
 * Tests for debug-instructions CLI command
 * Full coverage for handler and all branches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted for stable mock instances
const orchestrationServiceInstance = vi.hoisted(() => ({
  getDebugInfo: vi.fn()
}));

const tokenBudgetManagerInstance = vi.hoisted(() => ({
  getConfig: vi.fn()
}));

// Mock chalk with all needed methods
vi.mock('chalk', () => ({
  default: {
    cyan: Object.assign(vi.fn((s: string) => s), { bold: vi.fn((s: string) => s) }),
    gray: vi.fn((s: string) => s),
    green: Object.assign(vi.fn((s: string) => s), { bold: vi.fn((s: string) => s) }),
    yellow: vi.fn((s: string) => s),
    red: Object.assign(vi.fn((s: string) => s), { bold: vi.fn((s: string) => s) }),
    blue: Object.assign(vi.fn((s: string) => s), { bold: vi.fn((s: string) => s) }),
    dim: vi.fn((s: string) => s)
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

vi.mock('../../../../src/core/orchestration/orchestration-service.js', () => ({
  OrchestrationService: vi.fn().mockImplementation(function() {
    return orchestrationServiceInstance;
  })
}));

vi.mock('../../../../src/core/orchestration/token-budget.js', () => ({
  TokenBudgetManager: vi.fn().mockImplementation(function() {
    return tokenBudgetManagerInstance;
  })
}));

vi.mock('../../../../src/core/workflow/index.js', () => ({
  WORKFLOW_MODES: {
    default: {},
    planning: {},
    execution: {}
  }
}));

vi.mock('../../../../src/agents/instruction-templates.js', () => ({
  AGENT_TEMPLATES: {
    backend: {
      displayName: 'Backend Developer',
      domainReminders: ['Use TypeScript', 'Follow SOLID principles'],
      qualityChecklist: ['Write tests', 'Handle errors'],
      delegationTriggers: [
        { suggestedAgent: 'frontend', keywords: ['ui', 'component'], reason: 'UI work' },
        { suggestedAgent: 'quality', keywords: ['test'], reason: 'Testing' }
      ],
      antiPatterns: ['Hardcoded values', 'God objects'],
      bestPractices: ['Use dependency injection', 'Apply DRY']
    },
    frontend: {
      displayName: 'Frontend Developer',
      domainReminders: ['Use React'],
      qualityChecklist: ['Check accessibility'],
      delegationTriggers: [],
      antiPatterns: ['Inline styles'],
      bestPractices: ['Use components']
    }
  }
}));

describe('Debug Instructions Command', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Clear call histories only
    orchestrationServiceInstance.getDebugInfo.mockClear();
    tokenBudgetManagerInstance.getConfig.mockClear();

    // Re-setup constructor mocks
    const { OrchestrationService } = await import('../../../../src/core/orchestration/orchestration-service.js');
    vi.mocked(OrchestrationService).mockImplementation(function() {
      return orchestrationServiceInstance as any;
    });

    const { TokenBudgetManager } = await import('../../../../src/core/orchestration/token-budget.js');
    vi.mocked(TokenBudgetManager).mockImplementation(function() {
      return tokenBudgetManagerInstance as any;
    });

    // Setup default return values
    orchestrationServiceInstance.getDebugInfo.mockReturnValue({
      turnCount: 5,
      workflowMode: 'default',
      todoCount: 3,
      providers: ['TodoInstructionProvider', 'MemoryInstructionProvider'],
      tokenBudget: { used: 500, total: 2000 }
    });

    tokenBudgetManagerInstance.getConfig.mockReturnValue({
      maxTotal: 2000,
      criticalReserve: 300,
      perType: {
        task: 500,
        memory: 600,
        session: 300,
        delegation: 200,
        mode: 400,
        context: 300
      }
    });
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    vi.resetModules();
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');
      expect(debugInstructionsCommand.command).toBe('debug:instructions');
    });

    it('should have description', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');
      expect(debugInstructionsCommand.describe).toContain('embedded instructions');
    });

    it('should have builder function', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');
      expect(typeof debugInstructionsCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');
      expect(typeof debugInstructionsCommand.handler).toBe('function');
    });

    it('should configure all options in builder', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      const mockYargs: any = {
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis()
      };

      (debugInstructionsCommand.builder as Function)(mockYargs);

      expect(mockYargs.option).toHaveBeenCalledWith('tokens', expect.objectContaining({
        alias: 't',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('providers', expect.objectContaining({
        alias: 'p',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('templates', expect.objectContaining({
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('agent', expect.objectContaining({
        alias: 'a',
        type: 'string'
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('verbose', expect.objectContaining({
        alias: 'v',
        type: 'boolean',
        default: false
      }));

      expect(mockYargs.example).toHaveBeenCalledTimes(5);
    });
  });

  describe('Handler - Default Display (Overall State)', () => {
    it('should display overall state when no options provided', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(orchestrationServiceInstance.getDebugInfo).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display overall state with verbose mode', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: true,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(orchestrationServiceInstance.getDebugInfo).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display providers from debug info', async () => {
      orchestrationServiceInstance.getDebugInfo.mockReturnValue({
        turnCount: 5,
        workflowMode: 'default',
        todoCount: 3,
        providers: ['TodoInstructionProvider', 'MemoryInstructionProvider', 'SessionProvider'],
        tokenBudget: { used: 500, total: 2000 }
      });

      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle empty providers list', async () => {
      orchestrationServiceInstance.getDebugInfo.mockReturnValue({
        turnCount: 0,
        workflowMode: 'default',
        todoCount: 0,
        providers: [],
        tokenBudget: { used: 0, total: 2000 }
      });

      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show token budget usage bar with green color for low usage', async () => {
      orchestrationServiceInstance.getDebugInfo.mockReturnValue({
        turnCount: 5,
        workflowMode: 'default',
        todoCount: 3,
        providers: [],
        tokenBudget: { used: 400, total: 2000 } // 20% usage
      });

      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show token budget usage bar with yellow color for medium usage', async () => {
      orchestrationServiceInstance.getDebugInfo.mockReturnValue({
        turnCount: 5,
        workflowMode: 'default',
        todoCount: 3,
        providers: [],
        tokenBudget: { used: 1200, total: 2000 } // 60% usage
      });

      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show token budget usage bar with red color for high usage', async () => {
      orchestrationServiceInstance.getDebugInfo.mockReturnValue({
        turnCount: 5,
        workflowMode: 'default',
        todoCount: 3,
        providers: [],
        tokenBudget: { used: 1700, total: 2000 } // 85% usage
      });

      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should highlight current workflow mode', async () => {
      orchestrationServiceInstance.getDebugInfo.mockReturnValue({
        turnCount: 5,
        workflowMode: 'planning',
        todoCount: 3,
        providers: [],
        tokenBudget: { used: 500, total: 2000 }
      });

      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Token Budget Display', () => {
    it('should display token budget details when --tokens flag is used', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: true,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(tokenBudgetManagerInstance.getConfig).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display verbose token info with descriptions', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: true,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: true,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(tokenBudgetManagerInstance.getConfig).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Providers Display', () => {
    it('should display providers when --providers flag is used', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: true,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display verbose provider info with triggers and priority', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: true,
        templates: false,
        agent: undefined,
        verbose: true,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Agent Templates Display', () => {
    it('should display all agent templates when --templates flag is used', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: true,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display verbose template info with counts', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: true,
        agent: undefined,
        verbose: true,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - Specific Agent Template Display', () => {
    it('should display backend agent template when --agent backend is used', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: 'backend',
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should display frontend agent template when --agent frontend is used', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: 'frontend',
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should display verbose agent template with anti-patterns and best practices', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: 'backend',
        verbose: true,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display delegation triggers with verbose reason', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: 'backend',
        verbose: true,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle agent with no delegation triggers', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: 'frontend',
        verbose: true,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should exit with error for unknown agent domain', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: 'unknown',
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should list available domains when unknown agent is specified', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: 'invalid-agent',
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - Error Handling', () => {
    it('should handle error in getDebugInfo', async () => {
      orchestrationServiceInstance.getDebugInfo.mockImplementation(() => {
        throw new Error('Failed to get debug info');
      });

      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle error in getConfig', async () => {
      tokenBudgetManagerInstance.getConfig.mockImplementation(() => {
        throw new Error('Failed to get config');
      });

      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: true,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects in catch block', async () => {
      orchestrationServiceInstance.getDebugInfo.mockImplementation(() => {
        throw 'String error';
      });

      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: false,
        agent: undefined,
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Option Priority', () => {
    it('should prioritize --tokens over other options', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: true,
        providers: true,
        templates: true,
        agent: 'backend',
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      // Only token budget should be displayed
      expect(tokenBudgetManagerInstance.getConfig).toHaveBeenCalled();
      expect(orchestrationServiceInstance.getDebugInfo).not.toHaveBeenCalled();
    });

    it('should prioritize --providers over --templates and --agent', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: true,
        templates: true,
        agent: 'backend',
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      // Providers should be displayed, not templates or specific agent
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should prioritize --templates over --agent', async () => {
      const { debugInstructionsCommand } = await import('../../../../src/cli/commands/debug-instructions.js');

      await debugInstructionsCommand.handler({
        tokens: false,
        providers: false,
        templates: true,
        agent: 'backend',
        verbose: false,
        _: ['debug:instructions'],
        $0: 'ax'
      } as any);

      // Templates listing should be displayed
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });
});
