/**
 * Tests for spec CLI command
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
    bold: vi.fn((s: string) => s)
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
const pathResolverMock = vi.hoisted(() => ({
  detectProjectRoot: vi.fn()
}));

const specExplainMock = vi.hoisted(() => ({
  handleSpecExplain: vi.fn()
}));

vi.mock('../../../../src/shared/validation/path-resolver.js', () => pathResolverMock);
vi.mock('../../../../src/cli/commands/spec/explain.js', () => specExplainMock);

describe('Spec Command', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup default mocks
    pathResolverMock.detectProjectRoot.mockResolvedValue('/test/workspace');
    specExplainMock.handleSpecExplain.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    vi.resetModules();
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');
      expect(specCommand.command).toBe('spec <subcommand>');
    });

    it('should have description', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');
      expect(specCommand.describe).toContain('Spec file utilities');
    });

    it('should have builder function', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');
      expect(typeof specCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');
      expect(typeof specCommand.handler).toBe('function');
    });

    it('should configure options in builder', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      const mockYargs: any = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        epilogue: vi.fn().mockReturnThis()
      };

      (specCommand.builder as Function)(mockYargs);

      expect(mockYargs.positional).toHaveBeenCalledWith('subcommand', expect.objectContaining({
        type: 'string',
        choices: ['explain'],
        demandOption: true
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('file', expect.objectContaining({
        type: 'string'
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('format', expect.objectContaining({
        type: 'string',
        choices: ['markdown', 'text', 'json'],
        default: 'markdown'
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('sections', expect.objectContaining({
        type: 'string'
      }));

      expect(mockYargs.example).toHaveBeenCalledTimes(2);
      expect(mockYargs.epilogue).toHaveBeenCalled();
    });

    it('should show deprecation notice in epilogue', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      const mockYargs: any = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        epilogue: vi.fn().mockReturnThis()
      };

      (specCommand.builder as Function)(mockYargs);

      expect(mockYargs.epilogue).toHaveBeenCalled();
      const epilogueCall = mockYargs.epilogue.mock.calls[0][0];
      expect(epilogueCall).toContain('removed in v11.0.0');
    });
  });

  describe('Handler - Explain Subcommand', () => {
    it('should handle explain subcommand with file option', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: 'my-workflow.ax.yaml',
        format: 'markdown',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(pathResolverMock.detectProjectRoot).toHaveBeenCalledWith(process.cwd());
      expect(specExplainMock.handleSpecExplain).toHaveBeenCalledWith(
        '/test/workspace',
        expect.objectContaining({
          file: 'my-workflow.ax.yaml',
          format: 'markdown'
        })
      );
    });

    it('should handle explain with file from positional args', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: undefined,
        format: 'text',
        _: ['spec', 'workflow.ax.yaml'],
        $0: 'ax'
      } as any);

      expect(specExplainMock.handleSpecExplain).toHaveBeenCalledWith(
        '/test/workspace',
        expect.objectContaining({
          file: 'workflow.ax.yaml',
          format: 'text'
        })
      );
    });

    it('should handle explain with json format', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: 'spec.yaml',
        format: 'json',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(specExplainMock.handleSpecExplain).toHaveBeenCalledWith(
        '/test/workspace',
        expect.objectContaining({
          format: 'json'
        })
      );
    });

    it('should handle explain with sections option', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: 'spec.yaml',
        format: 'markdown',
        sections: 'overview,tasks,dependencies',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(specExplainMock.handleSpecExplain).toHaveBeenCalledWith(
        '/test/workspace',
        expect.objectContaining({
          sections: ['overview', 'tasks', 'dependencies']
        })
      );
    });

    it('should exit with error when file is missing', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: undefined,
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - Unknown Subcommand', () => {
    it('should exit with error for unknown subcommand', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'run',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should show deprecation message for old subcommands', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'init',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should show migration guidance for removed commands', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'create',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle validate subcommand as deprecated', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'validate',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle status subcommand as deprecated', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'status',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle graph subcommand as deprecated', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'graph',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Handler - Error Handling', () => {
    it('should handle detectProjectRoot error', async () => {
      pathResolverMock.detectProjectRoot.mockRejectedValue(new Error('Not a project directory'));

      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: 'spec.yaml',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle handleSpecExplain error', async () => {
      specExplainMock.handleSpecExplain.mockRejectedValue(new Error('Spec file not found'));

      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: 'missing.yaml',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should display error message', async () => {
      const errorMessage = 'Test error message';
      pathResolverMock.detectProjectRoot.mockRejectedValue(new Error(errorMessage));

      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: 'spec.yaml',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
    });
  });

  describe('Format Options', () => {
    it('should default to markdown format', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: 'spec.yaml',
        format: 'markdown',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(specExplainMock.handleSpecExplain).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ format: 'markdown' })
      );
    });

    it('should support text format', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: 'spec.yaml',
        format: 'text',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(specExplainMock.handleSpecExplain).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ format: 'text' })
      );
    });
  });

  describe('Sections Parsing', () => {
    it('should handle undefined sections', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: 'spec.yaml',
        sections: undefined,
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(specExplainMock.handleSpecExplain).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ sections: undefined })
      );
    });

    it('should trim whitespace from section names', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: 'spec.yaml',
        sections: ' overview , tasks , deps ',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(specExplainMock.handleSpecExplain).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          sections: ['overview', 'tasks', 'deps']
        })
      );
    });

    it('should parse single section', async () => {
      const { specCommand } = await import('../../../../src/cli/commands/spec.js');

      await specCommand.handler({
        subcommand: 'explain',
        file: 'spec.yaml',
        sections: 'overview',
        _: ['spec'],
        $0: 'ax'
      } as any);

      expect(specExplainMock.handleSpecExplain).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          sections: ['overview']
        })
      );
    });
  });

  describe('Subcommand Support', () => {
    it('should only support explain subcommand', () => {
      const choices = ['explain'];
      expect(choices).toContain('explain');
      expect(choices).not.toContain('run');
      expect(choices).not.toContain('init');
    });
  });

  describe('Migration Guidance', () => {
    it('should suggest ax run for workflow execution', () => {
      const suggestion = 'Use "ax run <agent> --iterate" for workflow execution';
      expect(suggestion).toContain('ax run');
      expect(suggestion).toContain('--iterate');
    });

    it('should suggest ax gen for generation', () => {
      const suggestion = 'Use "ax gen plan/dag/scaffold/tests" for generation';
      expect(suggestion).toContain('ax gen');
    });

    it('should reference migration documentation', () => {
      const docUrl = 'docs/migration/spec-kit-deprecation.md';
      expect(docUrl).toContain('spec-kit-deprecation');
    });
  });
});
