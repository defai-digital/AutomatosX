// @ts-nocheck
/**
 * Run Command Handler Tests
 *
 * Tests actual handler execution for run command to improve coverage.
 * Uses simplified mocking strategy to focus on main execution paths.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { runCommand } from '../../src/cli/commands/run.js';

// Mock process.cwd to avoid worker issues
vi.mock('process', async () => {
  const actual = await vi.importActual('process') as any;
  return {
    ...actual,
    cwd: vi.fn().mockImplementation(() => {
      return (global as any).__testCwd || actual.cwd();
    })
  };
});

describe('Run Command Handlers', () => {
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let processCwdSpy: ReturnType<typeof vi.spyOn>;

  afterAll(() => {
    delete (global as any).__testCwd;
  });

  beforeEach(async () => {
    const timestamp = Date.now();
    testDir = join(tmpdir(), `run-handler-test-${timestamp}`);
    const automatosxDir = join(testDir, '.automatosx');

    // Set global test cwd for mock
    (global as any).__testCwd = testDir;

    // Create project structure
    await mkdir(join(automatosxDir, 'agents'), { recursive: true });
    await mkdir(join(automatosxDir, 'abilities'), { recursive: true });
    await mkdir(join(automatosxDir, 'memory'), { recursive: true });
    await mkdir(join(automatosxDir, 'workspaces'), { recursive: true });

    // Create a test agent with complete profile
    await writeFile(
      join(automatosxDir, 'agents', 'test-agent.yaml'),
      `name: test-agent
version: 1.0.0
description: Test agent for unit tests
role: assistant

systemPrompt: |
  You are a test agent for automated testing.
  Respond concisely to test tasks.

abilities:
  - test-ability

provider: claude
model: claude-3-5-sonnet-20241022
temperature: 0.7
maxTokens: 1000

tags:
  - test
`,
      'utf-8'
    );

    // Create a test ability
    await writeFile(
      join(automatosxDir, 'abilities', 'test-ability.md'),
      `# Test Ability

This is a test ability for unit testing.
`,
      'utf-8'
    );

    // Create config with proper provider settings
    await writeFile(
      join(testDir, 'automatosx.config.json'),
      JSON.stringify({
        providers: {
          'claude-code': {
            enabled: true,
            priority: 1,
            timeout: 120000,
            command: 'claude'
          },
          'gemini-cli': {
            enabled: true,
            priority: 2,
            timeout: 180000,
            command: 'gemini'
          }
        },
        memory: {
          maxEntries: 10000,
          persistPath: '.automatosx/memory',
          autoCleanup: true,
          cleanupDays: 30
        },
        workspace: {
          basePath: '.automatosx/workspaces',
          autoCleanup: true,
          cleanupDays: 7,
          maxFiles: 100
        },
        logging: {
          level: 'error',
          path: '.automatosx/logs',
          console: false
        },
        version: '4.0.0'
      }, null, 2),
      'utf-8'
    );

    // Mock process.cwd
    processCwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(testDir);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock process.exit to track calls without throwing
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      // Don't throw, just mock it
      return undefined as never;
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    delete (global as any).__testCwd;
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    processCwdSpy.mockRestore();
  });

  describe('Input Validation', () => {
    it('should require agent name', async () => {
      await runCommand.handler({
        agent: '',
        task: 'test task',
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should require task', async () => {
      await runCommand.handler({
        agent: 'test-agent',
        task: '',
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Basic Execution', () => {
    it('should execute agent with basic options', async () => {
      await runCommand.handler({
        agent: 'test-agent',
        task: 'Simple test task',
        memory: false,
        saveMemory: false,
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should execute with verbose output', async () => {
      await runCommand.handler({
        agent: 'test-agent',
        task: 'Verbose test',
        verbose: true,
        memory: false,
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Output Formats', () => {
    it('should support text format', async () => {
      await runCommand.handler({
        agent: 'test-agent',
        task: 'Text format test',
        format: 'text',
        memory: false,
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should support JSON format', async () => {
      await runCommand.handler({
        agent: 'test-agent',
        task: 'JSON format test',
        format: 'json',
        memory: false,
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should support markdown format', async () => {
      await runCommand.handler({
        agent: 'test-agent',
        task: 'Markdown format test',
        format: 'markdown',
        memory: false,
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Provider Options', () => {
    it('should accept provider override', async () => {
      await runCommand.handler({
        agent: 'test-agent',
        task: 'Provider override test',
        provider: 'claude',
        memory: false,
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should accept model override', async () => {
      await runCommand.handler({
        agent: 'test-agent',
        task: 'Model override test',
        model: 'claude-sonnet-4',
        memory: false,
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Memory Options', () => {
    it('should disable memory when requested', async () => {
      await runCommand.handler({
        agent: 'test-agent',
        task: 'No memory test',
        memory: false,
        saveMemory: false,
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Save Options', () => {
    it('should save output to file', async () => {
      const savePath = join(testDir, 'output.txt');

      await runCommand.handler({
        agent: 'test-agent',
        task: 'Save test',
        save: savePath,
        memory: false,
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(0);

      // Check file was created
      const { access } = await import('fs/promises');
      await expect(access(savePath)).resolves.not.toThrow();
    });
  });

  describe('Timeout Options', () => {
    it('should accept timeout option', async () => {
      await runCommand.handler({
        agent: 'test-agent',
        task: 'Timeout test',
        timeout: 60,
        memory: false,
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Streaming Options', () => {
    it('should support streaming mode', async () => {
      await runCommand.handler({
        agent: 'test-agent',
        task: 'Streaming test',
        stream: true,
        memory: false,
        _: [],
        $0: ''
      } as any);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    }, 60000);
  });
});
