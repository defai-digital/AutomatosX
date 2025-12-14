import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  formatOutput,
  runCommand,
  listCommand,
  traceCommand,
  helpCommand,
  versionCommand,
  CLI_VERSION,
} from '@automatosx/cli';

describe('CLI', () => {
  describe('Parser', () => {
    it('should parse simple command', () => {
      const result = parseArgs(['node', 'cli', 'run', 'my-workflow']);

      expect(result.command).toBe('run');
      expect(result.args).toEqual(['my-workflow']);
    });

    it('should parse command with options', () => {
      const result = parseArgs([
        'node',
        'cli',
        'list',
        '--verbose',
        '--format',
        'json',
      ]);

      expect(result.command).toBe('list');
      expect(result.options.verbose).toBe(true);
      expect(result.options.format).toBe('json');
    });

    it('should parse short flags', () => {
      const result = parseArgs(['node', 'cli', '-v', '-h']);

      expect(result.options.verbose).toBe(true);
      expect(result.options.help).toBe(true);
    });

    it('should parse workflow-id option', () => {
      const result = parseArgs([
        'node',
        'cli',
        'run',
        '--workflow-id',
        'test-workflow',
      ]);

      expect(result.options.workflowId).toBe('test-workflow');
    });

    it('should parse limit option', () => {
      const result = parseArgs(['node', 'cli', 'list', '--limit', '5']);

      expect(result.options.limit).toBe(5);
    });

    it('should default to help command when no command provided', () => {
      const result = parseArgs(['node', 'cli']);

      expect(result.command).toBe('help');
    });
  });

  describe('Format Output', () => {
    it('should format string as text', () => {
      const result = formatOutput('Hello', 'text');
      expect(result).toBe('Hello');
    });

    it('should format object as JSON', () => {
      const result = formatOutput({ key: 'value' }, 'json');
      expect(result).toBe('{\n  "key": "value"\n}');
    });

    it('should format array as text', () => {
      const result = formatOutput(['a', 'b', 'c'], 'text');
      expect(result).toBe('a\nb\nc');
    });
  });

  describe('Run Command', () => {
    it('should require workflow ID', async () => {
      const result = await runCommand([], {
        help: false,
        version: false,
        verbose: false,
        format: 'text',
        workflowDir: undefined,
        workflowId: undefined,
        traceId: undefined,
        limit: undefined,
        input: undefined,
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.message).toContain('Workflow ID is required');
    });

    it('should execute workflow with ID from args', async () => {
      const result = await runCommand(['test-workflow'], {
        help: false,
        version: false,
        verbose: false,
        format: 'text',
        workflowDir: undefined,
        workflowId: undefined,
        traceId: undefined,
        limit: undefined,
        input: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain('completed successfully');
    });

    it('should execute workflow with ID from options', async () => {
      const result = await runCommand([], {
        help: false,
        version: false,
        verbose: false,
        format: 'text',
        workflowDir: undefined,
        workflowId: 'option-workflow',
        traceId: undefined,
        limit: undefined,
        input: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('List Command', () => {
    it('should list workflows', async () => {
      const result = await listCommand([], {
        help: false,
        version: false,
        verbose: false,
        format: 'text',
        workflowDir: undefined,
        workflowId: undefined,
        traceId: undefined,
        limit: undefined,
        input: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should respect limit option', async () => {
      const result = await listCommand([], {
        help: false,
        version: false,
        verbose: false,
        format: 'json',
        workflowDir: undefined,
        workflowId: undefined,
        traceId: undefined,
        limit: 2,
        input: undefined,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect((result.data as unknown[]).length).toBeLessThanOrEqual(2);
    });
  });

  describe('Trace Command', () => {
    it('should list traces when no ID provided', async () => {
      const result = await traceCommand([], {
        help: false,
        version: false,
        verbose: false,
        format: 'text',
        workflowDir: undefined,
        workflowId: undefined,
        traceId: undefined,
        limit: undefined,
        input: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should get specific trace by ID', async () => {
      const result = await traceCommand(['test-trace-id'], {
        help: false,
        version: false,
        verbose: false,
        format: 'json',
        workflowDir: undefined,
        workflowId: undefined,
        traceId: undefined,
        limit: undefined,
        input: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Help Command', () => {
    it('should return help text', async () => {
      const result = await helpCommand([], {
        help: false,
        version: false,
        verbose: false,
        format: 'text',
        workflowDir: undefined,
        workflowId: undefined,
        traceId: undefined,
        limit: undefined,
        input: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('automatosx');
      expect(result.message).toContain('Commands:');
    });
  });

  describe('Version Command', () => {
    it('should return version info', async () => {
      const result = await versionCommand([], {
        help: false,
        version: false,
        verbose: false,
        format: 'text',
        workflowDir: undefined,
        workflowId: undefined,
        traceId: undefined,
        limit: undefined,
        input: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain(CLI_VERSION);
    });
  });
});
