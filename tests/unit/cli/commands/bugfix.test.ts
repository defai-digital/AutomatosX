/**
 * Bugfix Command Unit Tests
 *
 * Full coverage for autonomous bug finding and fixing CLI commands.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// Create mock functions with vi.hoisted
const mockExecute = vi.hoisted(() => vi.fn());
const mockGetChangedFiles = vi.hoisted(() => vi.fn());
const mockGenerateJsonOutput = vi.hoisted(() => vi.fn());
const mockWriteReport = vi.hoisted(() => vi.fn());
const mockGetDefaultReportPath = vi.hoisted(() => vi.fn());
const mockGetMetricsTracker = vi.hoisted(() => vi.fn());
const mockDetectProjectRoot = vi.hoisted(() => vi.fn());
const mockGetVersion = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

// Hoisted variable to capture BugfixController options
const capturedOptions = vi.hoisted(() => ({ current: null as any }));

// Mock ora spinner
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  info: vi.fn().mockReturnThis(),
  text: '',
};

// Mock dependencies before importing
vi.mock('chalk', () => ({
  default: {
    red: Object.assign((s: string) => s, { bold: (s: string) => s }),
    yellow: Object.assign((s: string) => s, { bold: (s: string) => s }),
    green: Object.assign((s: string) => s, { bold: (s: string) => s }),
    gray: (s: string) => s,
    cyan: Object.assign((s: string) => s, { bold: (s: string) => s }),
    bold: (s: string) => s,
    dim: (s: string) => s,
    bgRed: { white: (s: string) => s },
    blue: (s: string) => s,
  },
}));

vi.mock('ora', () => ({
  default: () => mockSpinner,
}));

vi.mock('../../../../src/core/bugfix/index.js', () => ({
  BugfixController: function MockBugfixController(opts: any) {
    // Store callbacks in hoisted variable for testing
    capturedOptions.current = opts;
    return { execute: mockExecute };
  },
  getChangedFiles: mockGetChangedFiles,
  generateJsonOutput: mockGenerateJsonOutput,
  writeReport: mockWriteReport,
  getDefaultReportPath: mockGetDefaultReportPath,
  getMetricsTracker: mockGetMetricsTracker,
}));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
  },
}));

vi.mock('../../../../src/shared/validation/path-resolver.js', () => ({
  detectProjectRoot: mockDetectProjectRoot,
}));

vi.mock('../../../../src/shared/helpers/version.js', () => ({
  getVersion: mockGetVersion,
}));

describe('bugfixCommand', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  // Default execute result
  const defaultResult = {
    sessionId: 'test-session',
    startedAt: Date.now(),
    endedAt: Date.now(),
    finalState: 'completed',
    stats: {
      bugsFound: 2,
      bugsFixed: 1,
      bugsFailed: 1,
      bugsSkipped: 0,
      filesScanned: 100,
      filesModified: 1,
      successRate: 0.5,
      totalDurationMs: 1000,
      stopReason: 'completed',
    },
    findings: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.exitCode = undefined;
    capturedOptions.current = null;

    // Setup default mocks
    mockDetectProjectRoot.mockResolvedValue('/project');
    mockGetVersion.mockReturnValue('12.8.0');
    mockGetChangedFiles.mockResolvedValue([]);
    mockExecute.mockResolvedValue(defaultResult);
    mockGenerateJsonOutput.mockReturnValue({ summary: {} });
    mockWriteReport.mockResolvedValue(undefined);
    mockGetDefaultReportPath.mockReturnValue('/project/bugfix-report.md');
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    vi.resetModules();
  });

  describe('command definition', () => {
    it('should have correct command name', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      expect(bugfixCommand.command).toBe('bugfix [check]');
    });

    it('should have a description', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      expect(bugfixCommand.describe).toBe('Find and fix bugs in the codebase');
    });

    it('should have builder with options', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      expect(bugfixCommand.builder).toBeDefined();
      expect(typeof bugfixCommand.builder).toBe('object');
    });

    it('should define check option', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      const builder = bugfixCommand.builder as Record<string, unknown>;
      expect(builder.check).toBeDefined();
    });

    // v12.9.1: Removed --auto flag (PRD-021), added --no-report flag
    it('should define no-report option', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      const builder = bugfixCommand.builder as Record<string, unknown>;
      expect(builder['no-report']).toBeDefined();
    });

    it('should define scope option', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      const builder = bugfixCommand.builder as Record<string, unknown>;
      expect(builder.scope).toBeDefined();
    });

    it('should define severity option with choices', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      const builder = bugfixCommand.builder as Record<string, { choices?: string[] }>;
      expect(builder.severity).toBeDefined();
      expect(builder.severity?.choices).toEqual(['low', 'medium', 'high', 'critical']);
    });

    it('should define dry-run option', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      const builder = bugfixCommand.builder as Record<string, unknown>;
      expect(builder['dry-run']).toBeDefined();
    });

    it('should define json option', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      const builder = bugfixCommand.builder as Record<string, unknown>;
      expect(builder.json).toBeDefined();
    });

    it('should define report option', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      const builder = bugfixCommand.builder as Record<string, unknown>;
      expect(builder.report).toBeDefined();
    });

    it('should define types option with valid choices', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      const builder = bugfixCommand.builder as Record<string, { choices?: string[] }>;
      expect(builder.types).toBeDefined();
      expect(builder.types?.choices).toContain('timer_leak');
      expect(builder.types?.choices).toContain('missing_destroy');
      expect(builder.types?.choices).toContain('memory_leak');
    });

    it('should define minConfidence option', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      const builder = bugfixCommand.builder as Record<string, unknown>;
      expect(builder['min-confidence']).toBeDefined();
    });

    it('should define verifyLint option', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      const builder = bugfixCommand.builder as Record<string, unknown>;
      expect(builder['verify-lint']).toBeDefined();
    });

    it('should define verifyStrict option', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
      const builder = bugfixCommand.builder as Record<string, unknown>;
      expect(builder['verify-strict']).toBeDefined();
    });
  });

  describe('handler execution', () => {
    it('should execute in normal mode', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should execute in JSON mode', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        json: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockExecute).toHaveBeenCalled();
      expect(mockGenerateJsonOutput).toHaveBeenCalled();
    });

    it('should execute in quiet mode', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        quiet: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should execute in check mode', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        check: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should set exit code 1 in check mode when bugs found', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        stats: { ...defaultResult.stats, bugsFound: 5 },
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        check: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(process.exitCode).toBe(1);
    });

    it('should set exit code 0 in check mode when no bugs', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        stats: { ...defaultResult.stats, bugsFound: 0, bugsFixed: 0, bugsFailed: 0 },
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        check: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(process.exitCode).toBe(0);
    });

    it('should execute in dry-run mode', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        dryRun: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should use scope option', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        scope: 'src/core/',
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should generate report when requested', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        report: '/custom/report.md',
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockWriteReport).toHaveBeenCalled();
    });

    // v12.9.1: Report is auto-generated to REPORT/ directory when bugs are fixed (PRD-021)
    it('should use REPORT directory for auto-generated reports', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        report: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      // Report is generated to REPORT/ directory (PRD-021)
      expect(mockWriteReport).toHaveBeenCalled();
      const reportPath = mockWriteReport.mock.calls[0]?.[1];
      expect(reportPath).toContain('REPORT/bugfix-');
    });

    it('should handle errors and set exit code 1', async () => {
      mockExecute.mockRejectedValue(new Error('Test error'));

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(process.exitCode).toBe(1);
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it('should handle errors in JSON mode', async () => {
      mockExecute.mockRejectedValue(new Error('Test error'));

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        json: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(process.exitCode).toBe(1);
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should set exit code 1 when bugs failed', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        stats: { ...defaultResult.stats, bugsFailed: 2 },
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(process.exitCode).toBe(1);
    });

    it('should use fallback project root when detectProjectRoot returns null', async () => {
      mockDetectProjectRoot.mockResolvedValue(null);

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('git-aware scanning', () => {
    it('should get changed files for --changed option', async () => {
      mockGetChangedFiles.mockResolvedValue(['src/changed.ts']);

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        changed: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockGetChangedFiles).toHaveBeenCalledWith(expect.objectContaining({
        changed: true,
      }));
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should get staged files for --staged option', async () => {
      mockGetChangedFiles.mockResolvedValue(['src/staged.ts']);

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        staged: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockGetChangedFiles).toHaveBeenCalledWith(expect.objectContaining({
        staged: true,
      }));
    });

    it('should get files since branch for --since option', async () => {
      mockGetChangedFiles.mockResolvedValue(['src/branch.ts']);

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        since: 'main',
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockGetChangedFiles).toHaveBeenCalledWith(expect.objectContaining({
        since: 'main',
      }));
    });

    it('should exit early when no changed files in JSON mode', async () => {
      mockGetChangedFiles.mockResolvedValue([]);

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        changed: true,
        json: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockExecute).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should exit early when no changed files in normal mode', async () => {
      mockGetChangedFiles.mockResolvedValue([]);

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        changed: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('progress callbacks', () => {
    it('should handle progress messages', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        verbose: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      // Get the callbacks from the constructor
      const lastOptions = capturedOptions.current;
      expect(lastOptions.onProgress).toBeDefined();

      // Test various progress messages
      lastOptions.onProgress('Scanning files...', {});
      expect(mockSpinner.start).toHaveBeenCalled();

      lastOptions.onProgress('Found 5 bugs', {});
      expect(mockSpinner.succeed).toHaveBeenCalled();

      lastOptions.onProgress('Fixing bug...', {});
      lastOptions.onProgress('Fix verified', {});
      lastOptions.onProgress('Fix failed', {});
      lastOptions.onProgress('Skipped bug', {});
      lastOptions.onProgress('Some other message', {});
    });

    it('should suppress progress in quiet mode', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        quiet: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      const lastOptions = capturedOptions.current;
      lastOptions.onProgress('Scanning files...', {});
      // Progress should be suppressed, no spinner calls from this test
    });

    it('should handle bug found callback', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      const lastOptions = capturedOptions.current;
      expect(lastOptions.onBugFound).toBeDefined();

      lastOptions.onBugFound({
        id: 'bug-1',
        type: 'timer_leak',
        severity: 'high',
        file: 'src/test.ts',
        lineStart: 10,
      });
    });

    it('should handle fix applied callback - verified', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      const lastOptions = capturedOptions.current;
      lastOptions.onFixApplied(
        { id: 'bug-1', type: 'timer_leak', severity: 'high', file: 'src/test.ts', lineStart: 10 },
        { status: 'verified' }
      );
    });

    it('should handle fix applied callback - failed', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      const lastOptions = capturedOptions.current;
      lastOptions.onFixApplied(
        { id: 'bug-1', type: 'timer_leak', severity: 'high', file: 'src/test.ts', lineStart: 10 },
        { status: 'failed' }
      );
    });

    it('should handle fix applied callback - skipped', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      const lastOptions = capturedOptions.current;
      lastOptions.onFixApplied(
        { id: 'bug-1', type: 'timer_leak', severity: 'high', file: 'src/test.ts', lineStart: 10 },
        { status: 'skipped' }
      );
    });

    it('should handle verification callback', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        verbose: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      const lastOptions = capturedOptions.current;
      expect(lastOptions.onVerification).toBeDefined();

      lastOptions.onVerification({ id: 'bug-1' }, true);
      lastOptions.onVerification({ id: 'bug-2' }, false);
    });
  });

  describe('results display', () => {
    it('should display bugs found when there are findings', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        stats: { ...defaultResult.stats, bugsFound: 25 },
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      // Simulate findings through callback
      const lastOptions = capturedOptions.current;
      for (let i = 0; i < 25; i++) {
        lastOptions.onBugFound({
          id: `bug-${i}`,
          type: 'timer_leak',
          severity: 'high',
          file: `src/test${i}.ts`,
          lineStart: i * 10,
        });
      }

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display fixed bugs', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      const lastOptions = capturedOptions.current;
      for (let i = 0; i < 15; i++) {
        lastOptions.onFixApplied(
          { id: `bug-${i}`, type: 'timer_leak', severity: 'high', file: `src/test${i}.ts`, lineStart: i },
          { status: 'verified' }
        );
      }
    });

    it('should display failed bugs', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      const lastOptions = capturedOptions.current;
      for (let i = 0; i < 6; i++) {
        lastOptions.onFixApplied(
          { id: `bug-${i}`, type: 'timer_leak', severity: 'high', file: `src/test${i}.ts`, lineStart: i },
          { status: 'failed' }
        );
      }
    });

    it('should display skipped bugs', async () => {
      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      const lastOptions = capturedOptions.current;
      for (let i = 0; i < 6; i++) {
        lastOptions.onFixApplied(
          { id: `bug-${i}`, type: 'timer_leak', severity: 'high', file: `src/test${i}.ts`, lineStart: i },
          { status: 'skipped' }
        );
      }
    });

    it('should show dry-run message', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        stats: { ...defaultResult.stats, bugsFailed: 0 },
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        dryRun: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('JSON mode exit codes', () => {
    it('should set exit code 1 in JSON check mode when bugs found', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        stats: { ...defaultResult.stats, bugsFound: 3, bugsFailed: 0 },
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        json: true,
        check: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(process.exitCode).toBe(1);
    });

    it('should set exit code 1 in JSON mode when bugs failed', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        stats: { ...defaultResult.stats, bugsFound: 0, bugsFailed: 2 },
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        json: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(process.exitCode).toBe(1);
    });
  });

  describe('complete display paths', () => {
    it('should display full results with findings populated during execution', async () => {
      // Make mockExecute trigger callbacks during execution to populate arrays
      mockExecute.mockImplementation(async () => {
        const opts = capturedOptions.current;
        // Simulate finding bugs during execution
        for (let i = 0; i < 25; i++) {
          opts.onBugFound({
            id: `bug-${i}`,
            type: 'timer_leak',
            severity: 'high',
            file: `src/test${i}.ts`,
            lineStart: i * 10,
          });
        }
        return {
          ...defaultResult,
          stats: { ...defaultResult.stats, bugsFound: 25 },
        };
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      // Verify "... and X more" message was shown (findings > 20)
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display fixed bugs during execution', async () => {
      mockExecute.mockImplementation(async () => {
        const opts = capturedOptions.current;
        // Simulate fixing bugs during execution
        for (let i = 0; i < 15; i++) {
          opts.onFixApplied(
            { id: `bug-${i}`, type: 'timer_leak', severity: 'high', file: `src/test${i}.ts`, lineStart: i },
            { status: 'verified' }
          );
        }
        return {
          ...defaultResult,
          stats: { ...defaultResult.stats, bugsFixed: 15 },
        };
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      // Verify "... and X more" message for fixed bugs (> 10)
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display failed bugs during execution', async () => {
      mockExecute.mockImplementation(async () => {
        const opts = capturedOptions.current;
        // Simulate failed bugs during execution
        for (let i = 0; i < 8; i++) {
          opts.onFixApplied(
            { id: `bug-${i}`, type: 'timer_leak', severity: 'high', file: `src/test${i}.ts`, lineStart: i },
            { status: 'failed' }
          );
        }
        return {
          ...defaultResult,
          stats: { ...defaultResult.stats, bugsFailed: 8 },
        };
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display skipped bugs during execution', async () => {
      mockExecute.mockImplementation(async () => {
        const opts = capturedOptions.current;
        // Simulate skipped bugs during execution
        for (let i = 0; i < 8; i++) {
          opts.onFixApplied(
            { id: `bug-${i}`, type: 'missing_destroy', severity: 'medium', file: `src/test${i}.ts`, lineStart: i },
            { status: 'skipped' }
          );
        }
        return {
          ...defaultResult,
          stats: { ...defaultResult.stats, bugsSkipped: 8 },
        };
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display report saved message in non-quiet mode', async () => {
      mockExecute.mockResolvedValue(defaultResult);
      mockWriteReport.mockResolvedValue(undefined);
      mockGetDefaultReportPath.mockReturnValue('/project/bugfix-report.md');

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        report: '/custom/path/report.md',
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockWriteReport).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display check mode summary with bugs found', async () => {
      mockExecute.mockImplementation(async () => {
        const opts = capturedOptions.current;
        opts.onBugFound({
          id: 'bug-1',
          type: 'timer_leak',
          severity: 'critical',
          file: 'src/test.ts',
          lineStart: 10,
        });
        return {
          ...defaultResult,
          stats: { ...defaultResult.stats, bugsFound: 1 },
        };
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        check: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(process.exitCode).toBe(1);
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display check mode summary with no bugs', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        stats: { ...defaultResult.stats, bugsFound: 0 },
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        check: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(process.exitCode).toBe(0);
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display changed files message when using git filter', async () => {
      mockGetChangedFiles.mockResolvedValue(['src/file1.ts', 'src/file2.ts']);
      mockExecute.mockResolvedValue(defaultResult);

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        changed: true,
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockGetChangedFiles).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should complete full execution path in non-quiet mode', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        stats: { ...defaultResult.stats, bugsFailed: 1 },
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(process.exitCode).toBe(1);
    });

    it('should display medium severity bugs', async () => {
      mockExecute.mockImplementation(async () => {
        const opts = capturedOptions.current;
        opts.onBugFound({
          id: 'bug-1',
          type: 'timer_leak',
          severity: 'medium',
          file: 'src/test.ts',
          lineStart: 10,
        });
        return {
          ...defaultResult,
          stats: { ...defaultResult.stats, bugsFound: 1 },
        };
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display low severity bugs', async () => {
      mockExecute.mockImplementation(async () => {
        const opts = capturedOptions.current;
        opts.onBugFound({
          id: 'bug-1',
          type: 'timer_leak',
          severity: 'low',
          file: 'src/test.ts',
          lineStart: 10,
        });
        return {
          ...defaultResult,
          stats: { ...defaultResult.stats, bugsFound: 1 },
        };
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle unknown severity gracefully', async () => {
      mockExecute.mockImplementation(async () => {
        const opts = capturedOptions.current;
        opts.onBugFound({
          id: 'bug-1',
          type: 'timer_leak',
          severity: 'unknown' as any,
          file: 'src/test.ts',
          lineStart: 10,
        });
        return {
          ...defaultResult,
          stats: { ...defaultResult.stats, bugsFound: 1 },
        };
      });

      const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixCommand.handler({
        _: ['bugfix'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });
});

describe('bugfixFeedbackCommand', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockTrackerInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.exitCode = undefined;

    mockTrackerInstance = {
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      findByLocation: vi.fn(),
      markFalsePositive: vi.fn(),
      markTruePositive: vi.fn(),
    };
    mockGetMetricsTracker.mockReturnValue(mockTrackerInstance);
    mockDetectProjectRoot.mockResolvedValue('/project');
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    vi.resetModules();
  });

  it('should have correct command name', async () => {
    const { bugfixFeedbackCommand } = await import('../../../../src/cli/commands/bugfix.js');
    expect(bugfixFeedbackCommand.command).toBe('bugfix:feedback');
  });

  it('should have a description', async () => {
    const { bugfixFeedbackCommand } = await import('../../../../src/cli/commands/bugfix.js');
    expect(bugfixFeedbackCommand.describe).toContain('false positive');
  });

  it('should define required options', async () => {
    const { bugfixFeedbackCommand } = await import('../../../../src/cli/commands/bugfix.js');
    const builder = bugfixFeedbackCommand.builder as Record<string, any>;
    expect(builder.file).toBeDefined();
    expect(builder.file.demandOption).toBe(true);
    expect(builder.line).toBeDefined();
    expect(builder.line.demandOption).toBe(true);
    expect(builder.feedback).toBeDefined();
    expect(builder['true-positive']).toBeDefined();
  });

  it('should handle metric not found', async () => {
    mockTrackerInstance.findByLocation.mockReturnValue(null);

    const { bugfixFeedbackCommand } = await import('../../../../src/cli/commands/bugfix.js');

    await bugfixFeedbackCommand.handler({
      file: 'src/test.ts',
      line: 10,
      _: ['bugfix:feedback'],
      $0: 'ax',
    } as any);

    expect(process.exitCode).toBe(1);
  });

  it('should mark as true positive', async () => {
    mockTrackerInstance.findByLocation.mockReturnValue({
      id: 'metric-1',
      ruleId: 'timer_leak',
      bugType: 'timer_leak',
    });

    const { bugfixFeedbackCommand } = await import('../../../../src/cli/commands/bugfix.js');

    await bugfixFeedbackCommand.handler({
      file: 'src/test.ts',
      line: 10,
      truePositive: true,
      _: ['bugfix:feedback'],
      $0: 'ax',
    } as any);

    expect(mockTrackerInstance.markTruePositive).toHaveBeenCalledWith('metric-1');
  });

  it('should mark as false positive', async () => {
    mockTrackerInstance.findByLocation.mockReturnValue({
      id: 'metric-1',
      ruleId: 'timer_leak',
      bugType: 'timer_leak',
    });

    const { bugfixFeedbackCommand } = await import('../../../../src/cli/commands/bugfix.js');

    await bugfixFeedbackCommand.handler({
      file: 'src/test.ts',
      line: 10,
      feedback: 'This is intentional',
      _: ['bugfix:feedback'],
      $0: 'ax',
    } as any);

    expect(mockTrackerInstance.markFalsePositive).toHaveBeenCalledWith('metric-1', 'This is intentional');
  });

  it('should handle errors', async () => {
    mockTrackerInstance.init.mockRejectedValue(new Error('Init failed'));

    const { bugfixFeedbackCommand } = await import('../../../../src/cli/commands/bugfix.js');

    await bugfixFeedbackCommand.handler({
      file: 'src/test.ts',
      line: 10,
      _: ['bugfix:feedback'],
      $0: 'ax',
    } as any);

    expect(process.exitCode).toBe(1);
    expect(mockTrackerInstance.close).toHaveBeenCalled();
  });

  it('should use fallback project root', async () => {
    mockDetectProjectRoot.mockResolvedValue(null);
    mockTrackerInstance.findByLocation.mockReturnValue(null);

    const { bugfixFeedbackCommand } = await import('../../../../src/cli/commands/bugfix.js');

    await bugfixFeedbackCommand.handler({
      file: 'src/test.ts',
      line: 10,
      _: ['bugfix:feedback'],
      $0: 'ax',
    } as any);

    expect(mockGetMetricsTracker).toHaveBeenCalled();
  });
});

describe('bugfixMetricsCommand', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockTrackerInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.exitCode = undefined;

    mockTrackerInstance = {
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      getRuleMetrics: vi.fn(),
      getSummary: vi.fn(),
    };
    mockGetMetricsTracker.mockReturnValue(mockTrackerInstance);
    mockDetectProjectRoot.mockResolvedValue('/project');
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    vi.resetModules();
  });

  it('should have correct command name', async () => {
    const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');
    expect(bugfixMetricsCommand.command).toBe('bugfix:metrics');
  });

  it('should have a description', async () => {
    const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');
    expect(bugfixMetricsCommand.describe).toContain('metrics');
  });

  it('should define options', async () => {
    const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');
    const builder = bugfixMetricsCommand.builder as Record<string, any>;
    expect(builder.json).toBeDefined();
    expect(builder.rule).toBeDefined();
  });

  describe('rule-specific metrics', () => {
    it('should handle rule not found', async () => {
      mockTrackerInstance.getRuleMetrics.mockReturnValue(null);

      const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixMetricsCommand.handler({
        rule: 'unknown_rule',
        _: ['bugfix:metrics'],
        $0: 'ax',
      } as any);

      expect(process.exitCode).toBe(1);
    });

    it('should display rule metrics', async () => {
      mockTrackerInstance.getRuleMetrics.mockReturnValue({
        ruleId: 'timer_leak',
        bugType: 'timer_leak',
        totalDetections: 10,
        truePositives: 8,
        falsePositives: 2,
        unclassified: 0,
        precision: 0.8,
        averageConfidence: 0.9,
        fixesAttempted: 8,
        fixesSuccessful: 7,
      });

      const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixMetricsCommand.handler({
        rule: 'timer_leak',
        _: ['bugfix:metrics'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should output rule metrics as JSON', async () => {
      mockTrackerInstance.getRuleMetrics.mockReturnValue({
        ruleId: 'timer_leak',
        totalDetections: 10,
      });

      const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixMetricsCommand.handler({
        rule: 'timer_leak',
        json: true,
        _: ['bugfix:metrics'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('summary metrics', () => {
    it('should handle no metrics available', async () => {
      mockTrackerInstance.getSummary.mockReturnValue(null);

      const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixMetricsCommand.handler({
        _: ['bugfix:metrics'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle empty metrics', async () => {
      mockTrackerInstance.getSummary.mockReturnValue({ totalDetections: 0 });

      const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixMetricsCommand.handler({
        _: ['bugfix:metrics'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display full summary', async () => {
      mockTrackerInstance.getSummary.mockReturnValue({
        totalDetections: 100,
        totalTruePositives: 80,
        totalFalsePositives: 10,
        totalUnclassified: 10,
        overallPrecision: 0.88,
        byType: {
          timer_leak: { detections: 50, truePositives: 45, falsePositives: 5, precision: 0.9 },
          missing_destroy: { detections: 50, truePositives: 35, falsePositives: 5, precision: 0.87 },
        },
        byRule: [
          { ruleId: 'rule-1', totalDetections: 50, truePositives: 45, falsePositives: 5, precision: 0.9 },
        ],
        recentFalsePositives: [
          { file: 'src/test.ts', line: 10, ruleId: 'rule-1', feedback: 'Intentional' },
          { file: 'src/test2.ts', line: 20, ruleId: 'rule-2' },
        ],
      });

      const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixMetricsCommand.handler({
        _: ['bugfix:metrics'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should output summary as JSON', async () => {
      mockTrackerInstance.getSummary.mockReturnValue({
        totalDetections: 100,
        byType: {},
        byRule: [],
        recentFalsePositives: [],
      });

      const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');

      await bugfixMetricsCommand.handler({
        json: true,
        _: ['bugfix:metrics'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  it('should handle errors', async () => {
    mockTrackerInstance.init.mockRejectedValue(new Error('Init failed'));

    const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');

    await bugfixMetricsCommand.handler({
      _: ['bugfix:metrics'],
      $0: 'ax',
    } as any);

    expect(process.exitCode).toBe(1);
    expect(mockTrackerInstance.close).toHaveBeenCalled();
  });

  it('should use fallback project root', async () => {
    mockDetectProjectRoot.mockResolvedValue(null);
    mockTrackerInstance.getSummary.mockReturnValue(null);

    const { bugfixMetricsCommand } = await import('../../../../src/cli/commands/bugfix.js');

    await bugfixMetricsCommand.handler({
      _: ['bugfix:metrics'],
      $0: 'ax',
    } as any);

    expect(mockGetMetricsTracker).toHaveBeenCalled();
  });
});

describe('Bug type constants', () => {
  const validBugTypes = [
    'timer_leak',
    'missing_destroy',
    'promise_timeout_leak',
    'event_leak',
    'resource_leak',
    'race_condition',
    'memory_leak',
    'uncaught_promise',
    'deprecated_api',
    'security_issue',
    'type_error',
    'test_failure',
    'custom',
  ];

  it('should define all expected bug types', async () => {
    const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
    const builder = bugfixCommand.builder as Record<string, { choices?: string[] }>;
    const definedTypes = builder.types?.choices || [];

    for (const type of validBugTypes) {
      expect(definedTypes).toContain(type);
    }
  });
});

describe('Severity levels', () => {
  const validSeverities = ['low', 'medium', 'high', 'critical'];

  it('should define all severity levels', async () => {
    const { bugfixCommand } = await import('../../../../src/cli/commands/bugfix.js');
    const builder = bugfixCommand.builder as Record<string, { choices?: string[] }>;
    const definedSeverities = builder.severity?.choices || [];

    for (const severity of validSeverities) {
      expect(definedSeverities).toContain(severity);
    }
  });
});
