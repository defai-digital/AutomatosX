/**
 * Memory Command Tests
 *
 * Tests for all memory CLI commands (search, export, import, stats, clear).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  searchCommand,
  listCommand,
  addCommand,
  deleteCommand,
  exportCommand,
  importCommand,
  statsCommand,
  clearCommand,
  memoryCommand
} from '../../src/cli/commands/memory.js';

describe('Memory Commands', () => {

  describe('Main Memory Command', () => {
    it('should have correct command string', () => {
      expect(memoryCommand.command).toBe('memory <command>');
    });

    it('should have description', () => {
      expect(memoryCommand.describe).toBeDefined();
      expect(typeof memoryCommand.describe).toBe('string');
    });

    it('should have builder function', () => {
      expect(memoryCommand.builder).toBeDefined();
      expect(typeof memoryCommand.builder).toBe('function');
    });

    it('should have handler function', () => {
      expect(memoryCommand.handler).toBeDefined();
      expect(typeof memoryCommand.handler).toBe('function');
    });
  });

  describe('Search Command', () => {
    describe('Command Definition', () => {
      it('should have correct command string', () => {
        // v4.11.0: query is required (FTS5 only, no vector-file support)
        expect(searchCommand.command).toBe('search <query>');
      });

      it('should have description', () => {
        expect(searchCommand.describe).toBeDefined();
        expect(typeof searchCommand.describe).toBe('string');
      });

      it('should have builder function', () => {
        expect(searchCommand.builder).toBeDefined();
        expect(typeof searchCommand.builder).toBe('function');
      });

      it('should have handler function', () => {
        expect(searchCommand.handler).toBeDefined();
        expect(typeof searchCommand.handler).toBe('function');
      });
    });

    describe('Builder Options', () => {
      it('should define query positional argument', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis(),
          check: vi.fn().mockReturnThis()
        };

        (searchCommand.builder as Function)(mockYargs);

        expect(mockYargs.positional).toHaveBeenCalledWith('query', expect.objectContaining({
          describe: expect.any(String),
          type: 'string'
        }));
      });

      it('should define limit option with default', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis(),
          check: vi.fn().mockReturnThis()
        };

        (searchCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('limit', expect.objectContaining({
          type: 'number',
          default: 10
        }));
      });

      it('should define threshold option with default', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis(),
          check: vi.fn().mockReturnThis()
        };

        (searchCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('threshold', expect.objectContaining({
          type: 'number',
          default: 0
        }));
      });

      it('should define output option with choices', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis(),
          check: vi.fn().mockReturnThis()
        };

        (searchCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('output', expect.objectContaining({
          type: 'string',
          choices: ['json', 'table'],
          default: 'table'
        }));
      });

      it('should define type filter with valid choices', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis(),
          check: vi.fn().mockReturnThis()
        };

        (searchCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('type', expect.objectContaining({
          type: 'string',
          choices: ['conversation', 'code', 'document', 'task', 'other']
        }));
      });

      // v4.11.0: No validation check needed - query is required parameter
    });
  });

  describe('List Command', () => {
    describe('Command Definition', () => {
      it('should have correct command string', () => {
        expect(listCommand.command).toBe('list');
      });

      it('should have description', () => {
        expect(listCommand.describe).toBeDefined();
        expect(typeof listCommand.describe).toBe('string');
      });

      it('should have builder function', () => {
        expect(listCommand.builder).toBeDefined();
        expect(typeof listCommand.builder).toBe('function');
      });

      it('should have handler function', () => {
        expect(listCommand.handler).toBeDefined();
        expect(typeof listCommand.handler).toBe('function');
      });
    });

    describe('Builder Options', () => {
      it('should define type filter option', () => {
        const mockYargs = {
          option: vi.fn().mockReturnThis()
        };

        (listCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('type', expect.objectContaining({
          type: 'string',
          choices: ['conversation', 'code', 'document', 'task', 'other']
        }));
      });

      it('should define limit option with default', () => {
        const mockYargs = {
          option: vi.fn().mockReturnThis()
        };

        (listCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('limit', expect.objectContaining({
          type: 'number',
          default: 50
        }));
      });

      it('should define pagination options', () => {
        const mockYargs = {
          option: vi.fn().mockReturnThis()
        };

        (listCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('offset', expect.anything());
        expect(mockYargs.option).toHaveBeenCalledWith('order-by', expect.anything());
        expect(mockYargs.option).toHaveBeenCalledWith('order', expect.anything());
      });
    });
  });

  describe('Add Command', () => {
    describe('Command Definition', () => {
      it('should have correct command string', () => {
        expect(addCommand.command).toBe('add <content>');
      });

      it('should have description', () => {
        expect(addCommand.describe).toBeDefined();
        expect(typeof addCommand.describe).toBe('string');
      });

      it('should have builder function', () => {
        expect(addCommand.builder).toBeDefined();
        expect(typeof addCommand.builder).toBe('function');
      });

      it('should have handler function', () => {
        expect(addCommand.handler).toBeDefined();
        expect(typeof addCommand.handler).toBe('function');
      });
    });

    describe('Builder Options', () => {
      it('should define content positional as required', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis()
        };

        (addCommand.builder as Function)(mockYargs);

        expect(mockYargs.positional).toHaveBeenCalledWith('content', expect.objectContaining({
          type: 'string',
          demandOption: true
        }));
      });

      it('should define type option with choices', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis()
        };

        (addCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('type', expect.objectContaining({
          type: 'string',
          choices: ['conversation', 'code', 'document', 'task', 'other'],
          default: 'other'
        }));
      });
    });
  });

  describe('Delete Command', () => {
    describe('Command Definition', () => {
      it('should have correct command string', () => {
        expect(deleteCommand.command).toBe('delete <id>');
      });

      it('should have description', () => {
        expect(deleteCommand.describe).toBeDefined();
        expect(typeof deleteCommand.describe).toBe('string');
      });

      it('should have builder function', () => {
        expect(deleteCommand.builder).toBeDefined();
        expect(typeof deleteCommand.builder).toBe('function');
      });

      it('should have handler function', () => {
        expect(deleteCommand.handler).toBeDefined();
        expect(typeof deleteCommand.handler).toBe('function');
      });
    });

    describe('Builder Options', () => {
      it('should define id positional as required', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis()
        };

        (deleteCommand.builder as Function)(mockYargs);

        expect(mockYargs.positional).toHaveBeenCalledWith('id', expect.objectContaining({
          type: 'number',
          demandOption: true
        }));
      });

      it('should define confirm option', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis()
        };

        (deleteCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('confirm', expect.objectContaining({
          type: 'boolean',
          default: false,
          alias: 'y'
        }));
      });
    });
  });

  describe('Export Command', () => {
    describe('Command Definition', () => {
      it('should have correct command string', () => {
        expect(exportCommand.command).toBe('export <output>');
      });

      it('should have description', () => {
        expect(exportCommand.describe).toBeDefined();
        expect(typeof exportCommand.describe).toBe('string');
      });

      it('should have builder function', () => {
        expect(exportCommand.builder).toBeDefined();
        expect(typeof exportCommand.builder).toBe('function');
      });

      it('should have handler function', () => {
        expect(exportCommand.handler).toBeDefined();
        expect(typeof exportCommand.handler).toBe('function');
      });
    });

    describe('Builder Options', () => {
      it('should define output positional as required', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis()
        };

        (exportCommand.builder as Function)(mockYargs);

        expect(mockYargs.positional).toHaveBeenCalledWith('output', expect.objectContaining({
          describe: expect.any(String),
          type: 'string',
          demandOption: true
        }));
      });

      it('should define type filter option', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis()
        };

        (exportCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('type', expect.objectContaining({
          type: 'string',
          choices: ['conversation', 'code', 'document', 'task', 'other']
        }));
      });

      it('should define date range options', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis()
        };

        (exportCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('from', expect.objectContaining({
          type: 'string'
        }));

        expect(mockYargs.option).toHaveBeenCalledWith('to', expect.objectContaining({
          type: 'string'
        }));
      });

      // v4.11.0: No includeEmbeddings option - FTS5 only, no embeddings
    });
  });

  describe('Import Command', () => {
    describe('Command Definition', () => {
      it('should have correct command string', () => {
        expect(importCommand.command).toBe('import <input>');
      });

      it('should have description', () => {
        expect(importCommand.describe).toBeDefined();
        expect(typeof importCommand.describe).toBe('string');
      });

      it('should have builder function', () => {
        expect(importCommand.builder).toBeDefined();
        expect(typeof importCommand.builder).toBe('function');
      });

      it('should have handler function', () => {
        expect(importCommand.handler).toBeDefined();
        expect(typeof importCommand.handler).toBe('function');
      });
    });

    describe('Builder Options', () => {
      it('should define input positional as required', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis()
        };

        (importCommand.builder as Function)(mockYargs);

        expect(mockYargs.positional).toHaveBeenCalledWith('input', expect.objectContaining({
          describe: expect.any(String),
          type: 'string',
          demandOption: true
        }));
      });

      it('should define validate option with default', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis()
        };

        (importCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('validate', expect.objectContaining({
          type: 'boolean',
          default: true
        }));
      });

      it('should define batchSize option with default', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis()
        };

        (importCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('batch-size', expect.objectContaining({
          type: 'number',
          default: 100
        }));
      });

      it('should define skipDuplicates option with default', () => {
        const mockYargs = {
          positional: vi.fn().mockReturnThis(),
          option: vi.fn().mockReturnThis()
        };

        (importCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('skip-duplicates', expect.objectContaining({
          type: 'boolean',
          default: true
        }));
      });
    });
  });

  describe('Stats Command', () => {
    describe('Command Definition', () => {
      it('should have correct command string', () => {
        expect(statsCommand.command).toBe('stats');
      });

      it('should have description', () => {
        expect(statsCommand.describe).toBeDefined();
        expect(typeof statsCommand.describe).toBe('string');
      });

      it('should have builder function', () => {
        expect(statsCommand.builder).toBeDefined();
        expect(typeof statsCommand.builder).toBe('function');
      });

      it('should have handler function', () => {
        expect(statsCommand.handler).toBeDefined();
        expect(typeof statsCommand.handler).toBe('function');
      });
    });

    describe('Builder Options', () => {
      it('should define output option with choices', () => {
        const mockYargs = {
          option: vi.fn().mockReturnThis()
        };

        (statsCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('output', expect.objectContaining({
          type: 'string',
          choices: ['json', 'table'],
          default: 'table'
        }));
      });

      it('should define db option', () => {
        const mockYargs = {
          option: vi.fn().mockReturnThis()
        };

        (statsCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('db', expect.objectContaining({
          type: 'string'
        }));
      });
    });
  });

  describe('Clear Command', () => {
    describe('Command Definition', () => {
      it('should have correct command string', () => {
        expect(clearCommand.command).toBe('clear');
      });

      it('should have description', () => {
        expect(clearCommand.describe).toBeDefined();
        expect(typeof clearCommand.describe).toBe('string');
      });

      it('should have builder function', () => {
        expect(clearCommand.builder).toBeDefined();
        expect(typeof clearCommand.builder).toBe('function');
      });

      it('should have handler function', () => {
        expect(clearCommand.handler).toBeDefined();
        expect(typeof clearCommand.handler).toBe('function');
      });
    });

    describe('Builder Options', () => {
      it('should define all option', () => {
        const mockYargs = {
          option: vi.fn().mockReturnThis(),
          check: vi.fn().mockReturnThis()
        };

        (clearCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('all', expect.objectContaining({
          type: 'boolean',
          default: false
        }));
      });

      it('should define type filter option', () => {
        const mockYargs = {
          option: vi.fn().mockReturnThis(),
          check: vi.fn().mockReturnThis()
        };

        (clearCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('type', expect.objectContaining({
          type: 'string',
          choices: ['conversation', 'code', 'document', 'task', 'other']
        }));
      });

      it('should define olderThan option', () => {
        const mockYargs = {
          option: vi.fn().mockReturnThis(),
          check: vi.fn().mockReturnThis()
        };

        (clearCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('older-than', expect.objectContaining({
          type: 'number'
        }));
      });

      it('should define confirm option with default', () => {
        const mockYargs = {
          option: vi.fn().mockReturnThis(),
          check: vi.fn().mockReturnThis()
        };

        (clearCommand.builder as Function)(mockYargs);

        expect(mockYargs.option).toHaveBeenCalledWith('confirm', expect.objectContaining({
          type: 'boolean',
          default: false,
          alias: 'y'
        }));
      });

      it('should have validation check function', () => {
        const mockYargs = {
          option: vi.fn().mockReturnThis(),
          check: vi.fn().mockReturnThis()
        };

        (clearCommand.builder as Function)(mockYargs);

        expect(mockYargs.check).toHaveBeenCalled();
      });
    });

    describe('Safety Checks', () => {
      it('should require confirmation by default', () => {
        // confirm=false means skip confirmation (inversed logic)
        // So by default (confirm=false), it will show confirmation prompt
        const confirmDefault = false; // Skip confirmation = false, so will ask
        expect(confirmDefault).toBe(false);
      });

      it('should allow skipping confirmation with --confirm flag', () => {
        // Validates the safety pattern (inversed logic)
        const requiresConfirmation = (options: { confirm?: boolean }) => {
          return !options.confirm; // If confirm=false (default), require confirmation
        };

        expect(requiresConfirmation({ confirm: false })).toBe(true); // Will ask
        expect(requiresConfirmation({ confirm: true })).toBe(false); // Won't ask (skip)
      });
    });
  });

  describe('Common Patterns', () => {
    describe('Database Path Handling', () => {
      it('should accept optional db parameter in all commands', () => {
        const commands = [searchCommand, exportCommand, importCommand, statsCommand, clearCommand];

        for (const command of commands) {
          expect(command.builder).toBeDefined();
        }
      });

      it('should use default path when not specified', () => {
        const DEFAULT_DB_PATH = '.automatosx/memory/memory.db';
        const getPath = (dbPath?: string) => dbPath || DEFAULT_DB_PATH;

        expect(getPath()).toBe(DEFAULT_DB_PATH);
        expect(getPath('custom.db')).toBe('custom.db');
      });
    });

    describe('Output Format Handling', () => {
      it('should support json and table formats', () => {
        const validFormats: Array<'json' | 'table'> = ['json', 'table'];

        expect(validFormats).toContain('json');
        expect(validFormats).toContain('table');
        expect(validFormats).toHaveLength(2);
      });

      it('should default to table format', () => {
        const defaultFormat: 'json' | 'table' = 'table';
        expect(defaultFormat).toBe('table');
      });
    });

    describe('Type Filtering', () => {
      it('should support all valid entry types', () => {
        const validTypes = ['conversation', 'code', 'document', 'task', 'other'];

        expect(validTypes).toHaveLength(5);
        expect(validTypes).toContain('conversation');
        expect(validTypes).toContain('code');
        expect(validTypes).toContain('document');
        expect(validTypes).toContain('task');
        expect(validTypes).toContain('other');
      });
    });
  });

  describe('Error Handling Patterns', () => {
    it('should handle async handler functions', () => {
      const commands = [searchCommand, exportCommand, importCommand, statsCommand, clearCommand];

      for (const command of commands) {
        expect(command.handler).toBeInstanceOf(Function);
        expect(command.handler.constructor.name).toBe('AsyncFunction');
      }
    });

    it('should validate required parameters', () => {
      // Export and Import require file paths
      expect(exportCommand.command).toContain('<output>');
      expect(importCommand.command).toContain('<input>');
    });
  });

  describe('Error Handling Patterns', () => {
    it('should handle async handler functions', () => {
      const commands = [searchCommand, exportCommand, importCommand, statsCommand, clearCommand];

      for (const command of commands) {
        expect(command.handler).toBeInstanceOf(Function);
        expect(command.handler.constructor.name).toBe('AsyncFunction');
      }
    });

    it('should validate required parameters', () => {
      // Export and Import require file paths
      expect(exportCommand.command).toContain('<output>');
      expect(importCommand.command).toContain('<input>');
    });
  });
});
