/**
 * Tests for codex CLI command
 * Full coverage for handler and all branches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock dependencies before imports
vi.mock('chalk', () => ({
  default: {
    cyan: {
      bold: vi.fn((s: string) => s)
    },
    gray: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
    yellow: vi.fn((s: string) => s),
    red: vi.fn((s: string) => s)
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
const agentsMdGeneratorMock = vi.hoisted(() => ({
  generateAgentsMd: vi.fn(),
  validateAgentsMd: vi.fn()
}));

const fsMock = vi.hoisted(() => ({
  readFile: vi.fn()
}));

vi.mock('../../../../src/integrations/openai-codex/agents-md-generator.js', () => agentsMdGeneratorMock);
vi.mock('fs/promises', () => fsMock);

describe('Codex Command', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    agentsMdGeneratorMock.generateAgentsMd.mockResolvedValue('/path/to/AGENTS.md');
    agentsMdGeneratorMock.validateAgentsMd.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: []
    });
    fsMock.readFile.mockResolvedValue('# AGENTS.md\nTest content');

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

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');
      expect(codexCommand.command).toBe('codex <command>');
    });

    it('should have description', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');
      expect(codexCommand.describe).toContain('Codex CLI integration');
    });

    it('should have builder function', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');
      expect(typeof codexCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');
      expect(typeof codexCommand.handler).toBe('function');
    });

    it('should configure builder with agents-md command', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      const mockYargs: any = {
        command: vi.fn().mockReturnThis(),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      expect(mockYargs.command).toHaveBeenCalled();
      expect(mockYargs.demandCommand).toHaveBeenCalledWith(1, 'Please specify a subcommand');
      expect(mockYargs.example).toHaveBeenCalled();
      expect(mockYargs.help).toHaveBeenCalled();
    });

    it('should have empty handler for parent command', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      // Handler should not throw and should be a no-op
      expect(() => codexCommand.handler({} as any)).not.toThrow();
    });
  });

  describe('agents-md generate', () => {
    it('should generate AGENTS.md successfully', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      // Access the subcommand through builder
      let generateHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            // Extract agents-md subcommands
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'generate') {
                  generateHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      expect(generateHandler).toBeDefined();
      await generateHandler!({ output: '/test/dir', force: false });

      expect(agentsMdGeneratorMock.generateAgentsMd).toHaveBeenCalledWith({
        projectRoot: '/test/dir',
        force: false
      });
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should use cwd when output not specified', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let generateHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'generate') {
                  generateHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      await generateHandler!({ output: undefined, force: true });

      expect(agentsMdGeneratorMock.generateAgentsMd).toHaveBeenCalledWith({
        projectRoot: process.cwd(),
        force: true
      });
    });

    it('should handle generation error', async () => {
      agentsMdGeneratorMock.generateAgentsMd.mockRejectedValue(new Error('Generation failed'));

      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let generateHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'generate') {
                  generateHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      await generateHandler!({ output: '/test', force: false });

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should configure generate builder options', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let generateBuilder: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'generate') {
                  generateBuilder = subCmdConfig.builder;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      const builderYargs: any = {
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis()
      };

      generateBuilder!(builderYargs);

      expect(builderYargs.option).toHaveBeenCalledWith('force', expect.objectContaining({
        alias: 'f',
        type: 'boolean',
        default: false
      }));
      expect(builderYargs.option).toHaveBeenCalledWith('output', expect.objectContaining({
        alias: 'o',
        type: 'string'
      }));
      expect(builderYargs.example).toHaveBeenCalled();
    });
  });

  describe('agents-md validate', () => {
    it('should validate AGENTS.md successfully', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let validateHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'validate') {
                  validateHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      await validateHandler!({ file: '/test/AGENTS.md' });

      expect(agentsMdGeneratorMock.validateAgentsMd).toHaveBeenCalledWith('/test/AGENTS.md');
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should use default file path when not specified', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let validateHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'validate') {
                  validateHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      await validateHandler!({ file: undefined });

      expect(agentsMdGeneratorMock.validateAgentsMd).toHaveBeenCalledWith(
        join(process.cwd(), 'AGENTS.md')
      );
    });

    it('should handle invalid AGENTS.md with errors', async () => {
      agentsMdGeneratorMock.validateAgentsMd.mockResolvedValue({
        valid: false,
        errors: ['Missing required section', 'Invalid syntax'],
        warnings: []
      });

      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let validateHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'validate') {
                  validateHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      await validateHandler!({ file: '/test/AGENTS.md' });

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should display warnings', async () => {
      agentsMdGeneratorMock.validateAgentsMd.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ['Consider adding more detail', 'Optional section missing']
      });

      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let validateHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'validate') {
                  validateHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      await validateHandler!({ file: '/test/AGENTS.md' });

      // Should display warnings but not exit with error
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should handle validation error', async () => {
      agentsMdGeneratorMock.validateAgentsMd.mockRejectedValue(new Error('File not found'));

      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let validateHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'validate') {
                  validateHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      await validateHandler!({ file: '/test/AGENTS.md' });

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should configure validate builder options', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let validateBuilder: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'validate') {
                  validateBuilder = subCmdConfig.builder;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      const builderYargs: any = {
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis()
      };

      validateBuilder!(builderYargs);

      expect(builderYargs.option).toHaveBeenCalledWith('file', expect.objectContaining({
        alias: 'f',
        type: 'string'
      }));
      expect(builderYargs.example).toHaveBeenCalled();
    });
  });

  describe('agents-md show', () => {
    it('should show AGENTS.md content', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let showHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'show') {
                  showHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      await showHandler!({ file: '/test/AGENTS.md' });

      expect(fsMock.readFile).toHaveBeenCalledWith('/test/AGENTS.md', 'utf-8');
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should use default file path when not specified', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let showHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'show') {
                  showHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      await showHandler!({ file: undefined });

      expect(fsMock.readFile).toHaveBeenCalledWith(
        join(process.cwd(), 'AGENTS.md'),
        'utf-8'
      );
    });

    it('should handle read error', async () => {
      fsMock.readFile.mockRejectedValue(new Error('File not found'));

      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let showHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'show') {
                  showHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      await showHandler!({ file: '/test/AGENTS.md' });

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should configure show builder options', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let showBuilder: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'show') {
                  showBuilder = subCmdConfig.builder;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      const builderYargs: any = {
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis()
      };

      showBuilder!(builderYargs);

      expect(builderYargs.option).toHaveBeenCalledWith('file', expect.objectContaining({
        alias: 'f',
        type: 'string'
      }));
      expect(builderYargs.example).toHaveBeenCalled();
    });
  });

  describe('agents-md parent command', () => {
    it('should configure agents-md builder', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let agentsMdBuilder: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            agentsMdBuilder = cmdConfig.builder;
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      expect(agentsMdBuilder).toBeDefined();

      const agentsMdYargs: any = {
        command: vi.fn().mockReturnThis(),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      agentsMdBuilder!(agentsMdYargs);

      expect(agentsMdYargs.command).toHaveBeenCalledTimes(3); // generate, validate, show
      expect(agentsMdYargs.demandCommand).toHaveBeenCalledWith(1, 'Please specify a subcommand');
      expect(agentsMdYargs.help).toHaveBeenCalled();
    });

    it('should have empty handler for agents-md parent', async () => {
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let agentsMdHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            agentsMdHandler = cmdConfig.handler;
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);

      expect(agentsMdHandler).toBeDefined();
      expect(() => agentsMdHandler!()).not.toThrow();
    });
  });

  describe('Logger Integration', () => {
    it('should log errors on generation failure', async () => {
      agentsMdGeneratorMock.generateAgentsMd.mockRejectedValue(new Error('Test error'));
      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let generateHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'generate') {
                  generateHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);
      await generateHandler!({ output: '/test', force: false });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to generate AGENTS.md',
        expect.any(Object)
      );
    });

    it('should log errors on validation failure', async () => {
      agentsMdGeneratorMock.validateAgentsMd.mockRejectedValue(new Error('Validation error'));
      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let validateHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'validate') {
                  validateHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);
      await validateHandler!({ file: '/test/AGENTS.md' });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to validate AGENTS.md',
        expect.any(Object)
      );
    });

    it('should log errors on read failure', async () => {
      fsMock.readFile.mockRejectedValue(new Error('Read error'));
      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const { codexCommand } = await import('../../../../src/cli/commands/codex.js');

      let showHandler: Function | undefined;
      const mockYargs: any = {
        command: vi.fn((cmdConfig: any) => {
          if (cmdConfig.command === 'agents-md <command>') {
            const agentsMdYargs: any = {
              command: vi.fn((subCmdConfig: any) => {
                if (subCmdConfig.command === 'show') {
                  showHandler = subCmdConfig.handler;
                }
                return agentsMdYargs;
              }),
              demandCommand: vi.fn().mockReturnThis(),
              example: vi.fn().mockReturnThis(),
              help: vi.fn().mockReturnThis()
            };
            cmdConfig.builder(agentsMdYargs);
          }
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
        help: vi.fn().mockReturnThis()
      };

      (codexCommand.builder as Function)(mockYargs);
      await showHandler!({ file: '/test/AGENTS.md' });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to read AGENTS.md',
        expect.any(Object)
      );
    });
  });
});
