/**
 * Tests for runs CLI command
 * Full coverage for handlers and all branches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted for ALL mock instances
const checkpointManagerInstance = vi.hoisted(() => ({
  listCheckpoints: vi.fn(),
  loadCheckpoint: vi.fn(),
  deleteCheckpoint: vi.fn()
}));

const promptHelperInstance = vi.hoisted(() => ({
  question: vi.fn(),
  close: vi.fn()
}));

const pathResolverMock = vi.hoisted(() => ({
  detectProjectRoot: vi.fn()
}));

const configLoaderMock = vi.hoisted(() => ({
  loadConfig: vi.fn()
}));

const fsMock = vi.hoisted(() => ({
  promises: {
    readdir: vi.fn(),
    stat: vi.fn()
  }
}));

// Mock dependencies before imports
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((s: string) => s),
    gray: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
    yellow: vi.fn((s: string) => s),
    red: Object.assign(vi.fn((s: string) => s), {
      bold: vi.fn((s: string) => s)
    }),
    blue: vi.fn((s: string) => s),
    magenta: vi.fn((s: string) => s),
    bold: vi.fn((s: string) => s)
  }
}));

vi.mock('fs', () => fsMock);

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

vi.mock('../../../../src/shared/helpers/prompt-helper.js', () => ({
  withPrompt: vi.fn().mockImplementation(async (fn: (prompt: any) => Promise<any>) => {
    return fn(promptHelperInstance);
  })
}));

describe('Runs Command', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  const defaultConfig = {
    execution: { stages: {} }
  };

  const defaultCheckpoint = {
    runId: 'test-run-12345678',
    agent: 'backend',
    task: 'test task',
    lastCompletedStageIndex: 1,
    stages: [
      { index: 0, name: 'Stage 1', status: 'completed', result: { duration: 5000 }, retries: 0 },
      { index: 1, name: 'Stage 2', status: 'running', retries: 1 }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mode: { interactive: false, streaming: true }
  };

  const defaultRuns = [
    { runId: 'run-001-abcdef', agent: 'backend', status: 'running', mode: { interactive: true, streaming: true }, completedStages: 2, totalStages: 5, updatedAt: Date.now() },
    { runId: 'run-002-ghijkl', agent: 'frontend', status: 'completed', mode: { interactive: true, streaming: false }, completedStages: 3, totalStages: 3, updatedAt: Date.now() },
    { runId: 'run-003-mnopqr', agent: 'backend', status: 'failed', mode: { interactive: false, streaming: true }, completedStages: 1, totalStages: 4, updatedAt: Date.now() }
  ];

  beforeEach(async () => {
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Clear call histories
    pathResolverMock.detectProjectRoot.mockClear();
    configLoaderMock.loadConfig.mockClear();
    checkpointManagerInstance.listCheckpoints.mockClear();
    checkpointManagerInstance.loadCheckpoint.mockClear();
    checkpointManagerInstance.deleteCheckpoint.mockClear();
    promptHelperInstance.question.mockClear();
    promptHelperInstance.close.mockClear();
    fsMock.promises.readdir.mockClear();
    fsMock.promises.stat.mockClear();

    // Re-setup constructor mock implementations
    const { CheckpointManager } = await import('../../../../src/core/session/checkpoint.js');
    const { withPrompt } = await import('../../../../src/shared/helpers/prompt-helper.js');

    vi.mocked(CheckpointManager).mockImplementation(function() {
      return checkpointManagerInstance as any;
    });
    vi.mocked(withPrompt).mockImplementation(async (fn: any) => {
      return fn(promptHelperInstance);
    });

    // Setup default mocks
    pathResolverMock.detectProjectRoot.mockResolvedValue('/test/project');
    configLoaderMock.loadConfig.mockResolvedValue(defaultConfig);
    checkpointManagerInstance.listCheckpoints.mockResolvedValue(defaultRuns);
    checkpointManagerInstance.loadCheckpoint.mockResolvedValue(defaultCheckpoint);
    checkpointManagerInstance.deleteCheckpoint.mockResolvedValue(undefined);
    promptHelperInstance.question.mockResolvedValue('yes');
    promptHelperInstance.close.mockReturnValue(undefined);
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    vi.resetModules();
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      expect(runsCommand.command).toBe('runs <command>');
    });

    it('should have description', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      expect(runsCommand.describe).toBe('Manage checkpoint runs');
    });

    it('should have builder function', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      expect(typeof runsCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      expect(typeof runsCommand.handler).toBe('function');
    });

    it('should register subcommands in builder', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');

      const mockYargs: any = {
        command: vi.fn().mockReturnThis(),
        demandCommand: vi.fn().mockReturnThis()
      };

      (runsCommand.builder as Function)(mockYargs);

      expect(mockYargs.command).toHaveBeenCalledTimes(3);
      expect(mockYargs.demandCommand).toHaveBeenCalledWith(1, expect.stringContaining('list, show, delete'));
    });

    it('should have parent handler that does nothing', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');

      // Parent handler should just return without doing anything
      expect(() => runsCommand.handler({} as any)).not.toThrow();
    });
  });

  describe('List Subcommand - Handler', () => {
    it('should list all checkpoint runs', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => {
          commands.push(cmd);
          return mockYargs;
        }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const listCommand = commands.find(c => c.command === 'list');
      await listCommand.handler({ limit: 20, _: ['runs', 'list'], $0: 'ax' });

      expect(checkpointManagerInstance.listCheckpoints).toHaveBeenCalled();
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Checkpoint Runs');
    });

    it('should filter by status', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const listCommand = commands.find(c => c.command === 'list');
      await listCommand.handler({ status: 'running', limit: 20, _: ['runs', 'list'], $0: 'ax' });

      // Only 'running' status should be shown
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('run-001');
      expect(allCalls).not.toContain('run-002'); // completed
    });

    it('should filter by agent', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const listCommand = commands.find(c => c.command === 'list');
      await listCommand.handler({ agent: 'backend', limit: 20, _: ['runs', 'list'], $0: 'ax' });

      // Only 'backend' agent runs should be shown
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('run-001');
      expect(allCalls).toContain('run-003');
      expect(allCalls).not.toContain('run-002'); // frontend
    });

    it('should limit results', async () => {
      checkpointManagerInstance.listCheckpoints.mockResolvedValueOnce(
        Array.from({ length: 50 }, (_, i) => ({
          ...defaultRuns[0],
          runId: `run-${String(i).padStart(3, '0')}`
        }))
      );

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const listCommand = commands.find(c => c.command === 'list');
      await listCommand.handler({ limit: 5, _: ['runs', 'list'], $0: 'ax' });

      // Should only show first 5
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('run-000');
      expect(allCalls).toContain('run-004');
      expect(allCalls).not.toContain('run-005');
    });

    it('should handle empty results', async () => {
      checkpointManagerInstance.listCheckpoints.mockResolvedValueOnce([]);

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const listCommand = commands.find(c => c.command === 'list');
      await listCommand.handler({ limit: 20, _: ['runs', 'list'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('No checkpoints found');
    });

    it('should handle list error', async () => {
      pathResolverMock.detectProjectRoot.mockRejectedValueOnce(new Error('Not a project'));

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const listCommand = commands.find(c => c.command === 'list');
      await listCommand.handler({ limit: 20, _: ['runs', 'list'], $0: 'ax' });

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should configure list builder options', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const listCommand = commands.find(c => c.command === 'list');
      const listYargs: any = {
        option: vi.fn().mockReturnThis()
      };
      listCommand.builder(listYargs);

      expect(listYargs.option).toHaveBeenCalledWith('status', expect.objectContaining({
        type: 'string',
        choices: ['running', 'paused', 'completed', 'failed', 'aborted']
      }));
      expect(listYargs.option).toHaveBeenCalledWith('agent', expect.objectContaining({
        type: 'string'
      }));
      expect(listYargs.option).toHaveBeenCalledWith('limit', expect.objectContaining({
        type: 'number',
        default: 20
      }));
    });
  });

  describe('Show Subcommand - Handler', () => {
    it('should validate run-id is required', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');

      try {
        await showCommand.handler({ 'run-id': undefined, _: ['runs', 'show'], $0: 'ax' });
      } catch {
        // Expected
      }

      expect(mockProcessExit).toHaveBeenCalledWith(1);
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Run ID is required');
    });

    it('should show checkpoint details', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');
      await showCommand.handler({ 'run-id': 'test-run-12345678', stages: true, artifacts: false, _: ['runs', 'show'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Checkpoint Details');
      expect(allCalls).toContain('test-run-12345678');
      expect(allCalls).toContain('backend');
    });

    it('should show stage details when enabled', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');
      await showCommand.handler({ 'run-id': 'test-run-12345678', stages: true, artifacts: false, _: ['runs', 'show'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Stage Execution History');
      expect(allCalls).toContain('Stage 1');
      expect(allCalls).toContain('Stage 2');
    });

    it('should show stage error details', async () => {
      checkpointManagerInstance.loadCheckpoint.mockResolvedValueOnce({
        ...defaultCheckpoint,
        stages: [
          { index: 0, name: 'Stage 1', status: 'error', result: { error: { message: 'Something failed' } }, retries: 2 }
        ]
      });

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');
      await showCommand.handler({ 'run-id': 'test-run-12345678', stages: true, artifacts: false, _: ['runs', 'show'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Something failed');
    });

    it('should show artifacts when enabled', async () => {
      fsMock.promises.readdir.mockResolvedValueOnce(['output.txt', 'result.json']);
      fsMock.promises.stat.mockResolvedValue({ size: 1024 });

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');
      await showCommand.handler({ 'run-id': 'test-run-12345678', stages: false, artifacts: true, _: ['runs', 'show'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Artifacts');
      expect(allCalls).toContain('output.txt');
      expect(allCalls).toContain('result.json');
    });

    it('should handle empty artifacts', async () => {
      fsMock.promises.readdir.mockResolvedValueOnce([]);

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');
      await showCommand.handler({ 'run-id': 'test-run-12345678', stages: false, artifacts: true, _: ['runs', 'show'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('No artifacts found');
    });

    it('should handle artifacts directory not found', async () => {
      fsMock.promises.readdir.mockRejectedValueOnce(new Error('ENOENT'));

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');
      await showCommand.handler({ 'run-id': 'test-run-12345678', stages: false, artifacts: true, _: ['runs', 'show'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('No artifacts found');
    });

    it('should handle show error', async () => {
      checkpointManagerInstance.loadCheckpoint.mockRejectedValueOnce(new Error('Checkpoint not found'));

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');
      await showCommand.handler({ 'run-id': 'nonexistent', stages: true, artifacts: false, _: ['runs', 'show'], $0: 'ax' });

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should configure show builder options', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');
      const showYargs: any = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis()
      };
      showCommand.builder(showYargs);

      expect(showYargs.positional).toHaveBeenCalledWith('run-id', expect.objectContaining({
        type: 'string',
        demandOption: true
      }));
      expect(showYargs.option).toHaveBeenCalledWith('stages', expect.objectContaining({
        type: 'boolean',
        default: true
      }));
      expect(showYargs.option).toHaveBeenCalledWith('artifacts', expect.objectContaining({
        type: 'boolean',
        default: false
      }));
    });
  });

  describe('Delete Subcommand - Handler', () => {
    it('should validate run-id is required', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const deleteCommand = commands.find(c => c.command === 'delete <run-id>');

      try {
        await deleteCommand.handler({ 'run-id': undefined, _: ['runs', 'delete'], $0: 'ax' });
      } catch {
        // Expected
      }

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should delete with force flag', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const deleteCommand = commands.find(c => c.command === 'delete <run-id>');
      await deleteCommand.handler({ 'run-id': 'test-run-12345678', force: true, _: ['runs', 'delete'], $0: 'ax' });

      expect(checkpointManagerInstance.deleteCheckpoint).toHaveBeenCalledWith('test-run-12345678');
      expect(promptHelperInstance.question).not.toHaveBeenCalled();
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Checkpoint deleted');
    });

    it('should prompt for confirmation without force', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const deleteCommand = commands.find(c => c.command === 'delete <run-id>');
      await deleteCommand.handler({ 'run-id': 'test-run-12345678', force: false, _: ['runs', 'delete'], $0: 'ax' });

      expect(promptHelperInstance.question).toHaveBeenCalled();
      // Note: close() is called internally by withPrompt(), not by the handler
      expect(checkpointManagerInstance.deleteCheckpoint).toHaveBeenCalled();
    });

    it('should accept "y" as confirmation', async () => {
      promptHelperInstance.question.mockResolvedValueOnce('y');

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const deleteCommand = commands.find(c => c.command === 'delete <run-id>');
      await deleteCommand.handler({ 'run-id': 'test-run-12345678', force: false, _: ['runs', 'delete'], $0: 'ax' });

      expect(checkpointManagerInstance.deleteCheckpoint).toHaveBeenCalled();
    });

    it('should cancel on negative confirmation', async () => {
      promptHelperInstance.question.mockResolvedValueOnce('no');

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const deleteCommand = commands.find(c => c.command === 'delete <run-id>');
      await deleteCommand.handler({ 'run-id': 'test-run-12345678', force: false, _: ['runs', 'delete'], $0: 'ax' });

      expect(checkpointManagerInstance.deleteCheckpoint).not.toHaveBeenCalled();
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Cancelled');
    });

    it('should handle delete error', async () => {
      checkpointManagerInstance.deleteCheckpoint.mockRejectedValueOnce(new Error('Delete failed'));

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const deleteCommand = commands.find(c => c.command === 'delete <run-id>');
      await deleteCommand.handler({ 'run-id': 'test-run-12345678', force: true, _: ['runs', 'delete'], $0: 'ax' });

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should configure delete builder options', async () => {
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const deleteCommand = commands.find(c => c.command === 'delete <run-id>');
      const deleteYargs: any = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis()
      };
      deleteCommand.builder(deleteYargs);

      expect(deleteYargs.positional).toHaveBeenCalledWith('run-id', expect.objectContaining({
        type: 'string',
        demandOption: true
      }));
      expect(deleteYargs.option).toHaveBeenCalledWith('force', expect.objectContaining({
        alias: 'f',
        type: 'boolean',
        default: false
      }));
    });
  });

  describe('Format Mode Helper', () => {
    it('should format hybrid mode through list', async () => {
      checkpointManagerInstance.listCheckpoints.mockResolvedValueOnce([
        { runId: 'run-001', agent: 'backend', status: 'running', mode: { interactive: true, streaming: true }, completedStages: 1, totalStages: 2, updatedAt: Date.now() }
      ]);

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const listCommand = commands.find(c => c.command === 'list');
      await listCommand.handler({ limit: 20, _: ['runs', 'list'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Hybrid');
    });

    it('should format interactive mode through list', async () => {
      checkpointManagerInstance.listCheckpoints.mockResolvedValueOnce([
        { runId: 'run-001', agent: 'backend', status: 'running', mode: { interactive: true, streaming: false }, completedStages: 1, totalStages: 2, updatedAt: Date.now() }
      ]);

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const listCommand = commands.find(c => c.command === 'list');
      await listCommand.handler({ limit: 20, _: ['runs', 'list'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Interactive');
    });

    it('should format streaming mode through show', async () => {
      checkpointManagerInstance.loadCheckpoint.mockResolvedValueOnce({
        ...defaultCheckpoint,
        mode: { interactive: false, streaming: true }
      });

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');
      await showCommand.handler({ 'run-id': 'test-run', stages: false, artifacts: false, _: ['runs', 'show'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Streaming');
    });

    it('should format standard mode through show', async () => {
      checkpointManagerInstance.loadCheckpoint.mockResolvedValueOnce({
        ...defaultCheckpoint,
        mode: { interactive: false, streaming: false }
      });

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');
      await showCommand.handler({ 'run-id': 'test-run', stages: false, artifacts: false, _: ['runs', 'show'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Standard');
    });
  });

  describe('Format Status Helper', () => {
    it('should format all status types', async () => {
      const statuses = ['running', 'paused', 'completed', 'failed', 'aborted'];

      for (const status of statuses) {
        checkpointManagerInstance.listCheckpoints.mockResolvedValueOnce([
          { runId: `run-${status}`, agent: 'backend', status, mode: { interactive: false, streaming: false }, completedStages: 1, totalStages: 2, updatedAt: Date.now() }
        ]);

        const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
        const builder = runsCommand.builder as Function;

        const commands: any[] = [];
        const mockYargs = {
          command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
          demandCommand: vi.fn().mockReturnThis()
        };
        builder(mockYargs);

        const listCommand = commands.find(c => c.command === 'list');
        await listCommand.handler({ limit: 20, _: ['runs', 'list'], $0: 'ax' });

        vi.resetModules();
      }
    });
  });

  describe('Format Stage Status Helper', () => {
    it('should format all stage status types', async () => {
      const stageStatuses = ['queued', 'running', 'checkpoint', 'completed', 'error', 'timeout', 'skipped'];

      for (const status of stageStatuses) {
        checkpointManagerInstance.loadCheckpoint.mockResolvedValueOnce({
          ...defaultCheckpoint,
          stages: [{ index: 0, name: 'Test Stage', status, retries: 0 }]
        });

        const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
        const builder = runsCommand.builder as Function;

        const commands: any[] = [];
        const mockYargs = {
          command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
          demandCommand: vi.fn().mockReturnThis()
        };
        builder(mockYargs);

        const showCommand = commands.find(c => c.command === 'show <run-id>');
        await showCommand.handler({ 'run-id': 'test-run', stages: true, artifacts: false, _: ['runs', 'show'], $0: 'ax' });

        vi.resetModules();
      }
    });

    it('should handle unknown stage status', async () => {
      checkpointManagerInstance.loadCheckpoint.mockResolvedValueOnce({
        ...defaultCheckpoint,
        stages: [{ index: 0, name: 'Test Stage', status: 'unknown-status', retries: 0 }]
      });

      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const showCommand = commands.find(c => c.command === 'show <run-id>');
      await showCommand.handler({ 'run-id': 'test-run', stages: true, artifacts: false, _: ['runs', 'show'], $0: 'ax' });

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('unknown-status');
    });
  });

  describe('Configuration', () => {
    it('should use custom checkpoint path from config', async () => {
      configLoaderMock.loadConfig.mockResolvedValueOnce({
        execution: {
          stages: {
            checkpointPath: '/custom/checkpoints'
          }
        }
      });

      const { CheckpointManager } = await import('../../../../src/core/session/checkpoint.js');
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const listCommand = commands.find(c => c.command === 'list');
      await listCommand.handler({ limit: 20, _: ['runs', 'list'], $0: 'ax' });

      expect(CheckpointManager).toHaveBeenCalledWith('/custom/checkpoints', expect.any(Number));
    });

    it('should use custom cleanup days from config', async () => {
      configLoaderMock.loadConfig.mockResolvedValueOnce({
        execution: {
          stages: {
            cleanupAfterDays: 14
          }
        }
      });

      const { CheckpointManager } = await import('../../../../src/core/session/checkpoint.js');
      const { runsCommand } = await import('../../../../src/cli/commands/runs.js');
      const builder = runsCommand.builder as Function;

      const commands: any[] = [];
      const mockYargs = {
        command: vi.fn((cmd: any) => { commands.push(cmd); return mockYargs; }),
        demandCommand: vi.fn().mockReturnThis()
      };
      builder(mockYargs);

      const listCommand = commands.find(c => c.command === 'list');
      await listCommand.handler({ limit: 20, _: ['runs', 'list'], $0: 'ax' });

      expect(CheckpointManager).toHaveBeenCalledWith(expect.any(String), 14);
    });
  });
});
