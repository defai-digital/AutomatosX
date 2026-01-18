import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseArgs,
  formatOutput,
  runCommand,
  listCommand,
  traceCommand,
  doctorCommand,
  helpCommand,
  versionCommand,
  CLI_VERSION,
  resetStepExecutor,
  getTraceStore,
} from '@defai.digital/cli';
import type { CLIOptions } from '@defai.digital/cli';

/**
 * Create default CLI options with overrides
 */
function createOptions(overrides: Partial<CLIOptions> = {}): CLIOptions {
  return {
    help: false,
    version: false,
    verbose: false,
    format: 'text',
    workflowDir: undefined,
    workflowId: undefined,
    traceId: undefined,
    limit: undefined,
    input: undefined,
    iterate: false,
    maxIterations: undefined,
    maxTime: undefined,
    noContext: false,
    category: undefined,
    tags: undefined,
    agent: undefined,
    task: undefined,
    core: undefined,
    maxTokens: undefined,
    ...overrides,
  };
}

describe('CLI', () => {
  // Reset step executor before each test to use placeholder (not production executor)
  // This prevents tests from making real LLM calls
  beforeEach(() => {
    resetStepExecutor();
  });

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
      const result = await runCommand([], createOptions());

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.message).toContain('ax run');
    });

    it('should execute workflow with ID from args', async () => {
      // Use a real workflow from examples/workflows/
      const result = await runCommand(['analyst'], createOptions());

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain('completed successfully');
    });

    it('should execute workflow with ID from options', async () => {
      // Use a real workflow from examples/workflows/
      const result = await runCommand([], createOptions({ workflowId: 'analyst' }));

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('List Command', () => {
    it('should list workflows', async () => {
      const result = await listCommand([], createOptions());

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should respect limit option', async () => {
      const result = await listCommand([], createOptions({ format: 'json', limit: 2 }));

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect((result.data as unknown[]).length).toBeLessThanOrEqual(2);
    });
  });

  describe('Trace Command', () => {
    it('should list traces when no ID provided', async () => {
      const result = await traceCommand([], createOptions());

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should get specific trace by ID', async () => {
      // First, write a trace event so there's something to query
      const traceStore = getTraceStore();
      const testTraceId = 'test-trace-id';
      await traceStore.write({
        eventId: crypto.randomUUID(),
        traceId: testTraceId,
        type: 'run.start',
        timestamp: new Date().toISOString(),
        sequence: 0,
        payload: { workflowId: 'test-workflow' },
        status: 'running',
      });

      const result = await traceCommand([testTraceId], createOptions({ format: 'json' }));

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for nonexistent trace', async () => {
      const result = await traceCommand(['nonexistent-trace-id'], createOptions());

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.message).toContain('Trace not found');
    });
  });

  describe('Help Command', () => {
    it('should return help text', async () => {
      const result = await helpCommand([], createOptions());

      expect(result.success).toBe(true);
      expect(result.message).toContain('AutomatosX');
      expect(result.message).toContain('Commands:');
    });
  });

  describe('Version Command', () => {
    it('should return version info', async () => {
      const result = await versionCommand([], createOptions());

      expect(result.success).toBe(true);
      expect(result.message).toContain(CLI_VERSION);
    });
  });

  describe('Doctor Command', () => {
    it('should run system health check', async () => {
      const result = await doctorCommand([], createOptions());

      expect(result.success).toBeDefined();
      expect(result.exitCode).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should support JSON format output', async () => {
      const result = await doctorCommand([], createOptions({ format: 'json' }));

      expect(result.success).toBeDefined();
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('object');
    });

    it('should check specific provider when argument provided', async () => {
      const result = await doctorCommand(['claude'], createOptions());

      expect(result.success).toBeDefined();
      expect(result.exitCode).toBeDefined();
    });

    it('should support verbose mode', async () => {
      const result = await doctorCommand([], createOptions({ verbose: true }));

      expect(result.success).toBeDefined();
      expect(result.message).toBeDefined();
    });
  });
});
