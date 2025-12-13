/**
 * Refactor Command Unit Tests
 *
 * Full coverage for autonomous code refactoring CLI command.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Create mock functions with vi.hoisted
const mockExecute = vi.hoisted(() => vi.fn());
const mockScan = vi.hoisted(() => vi.fn());
const mockGetSessionId = vi.hoisted(() => vi.fn());
const mockGetConfig = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());

// Hoisted variable to capture RefactorController options
const capturedOptions = vi.hoisted(() => ({ current: null as any }));

// Mock ora spinner
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
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

vi.mock('../../../../src/core/refactor/index.js', () => ({
  RefactorController: function MockRefactorController(opts: any) {
    capturedOptions.current = opts;
    return {
      execute: mockExecute,
      scan: mockScan,
      getSessionId: mockGetSessionId,
      getConfig: mockGetConfig,
    };
  },
}));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  writeFileSync: mockWriteFileSync,
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

describe('refactorCommand', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockProcessExit: ReturnType<typeof vi.spyOn>;

  // Default execute result
  const defaultResult = {
    sessionId: 'test-session',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    finalState: 'COMPLETE',
    config: {},
    findings: [],
    attempts: [],
    metricsBefore: { complexity: 100, maintainability: 50 },
    metricsAfter: { complexity: 80, maintainability: 60 },
    improvements: [
      { metric: 'complexity', before: 100, after: 80, improvementPercent: 20 },
    ],
    stats: {
      opportunitiesFound: 5,
      refactorsApplied: 3,
      refactorsFailed: 1,
      refactorsSkipped: 1,
      totalAttempts: 5,
      successRate: 0.6,
      totalDurationMs: 5000,
      complexityReduced: 20,
      duplicationRemoved: 10,
      maintainabilityImproved: 10,
      linesRemoved: 50,
      stopReason: 'completed',
      opportunitiesByType: { dead_code: 3, type_safety: 2 },
      opportunitiesBySeverity: { high: 2, medium: 3 },
      iterationsCompleted: 1,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    capturedOptions.current = null;

    // Setup default mocks
    mockExecute.mockResolvedValue(defaultResult);
    mockScan.mockResolvedValue({
      findings: [],
      metrics: { complexity: 100 },
    });
    mockGetSessionId.mockReturnValue('test-session');
    mockGetConfig.mockReturnValue({});
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
    vi.resetModules();
  });

  describe('command definition', () => {
    it('should have correct command name', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      expect(refactorCommand.command).toBe('refactor [check]');
    });

    it('should have a description', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      expect(refactorCommand.describe).toContain('refactoring');
    });

    it('should have builder with options', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      expect(refactorCommand.builder).toBeDefined();
    });

    it('should define check option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder.check).toBeDefined();
    });

    it('should define focus option with valid choices', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, { choices?: string[] }>;
      expect(builder.focus).toBeDefined();
      expect(builder.focus?.choices).toContain('dead_code');
      expect(builder.focus?.choices).toContain('type_safety');
    });

    it('should define iterations option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder.iterations).toBeDefined();
    });

    it('should define scope option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder.scope).toBeDefined();
    });

    it('should define conservative option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder.conservative).toBeDefined();
    });

    it('should define dry-run option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder['dry-run']).toBeDefined();
    });

    it('should define no-llm option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder['no-llm']).toBeDefined();
    });

    it('should define max-changes option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder['max-changes']).toBeDefined();
    });

    it('should define min-improvement option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder['min-improvement']).toBeDefined();
    });

    it('should define severity option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, { choices?: string[] }>;
      expect(builder.severity).toBeDefined();
      expect(builder.severity?.choices).toContain('low');
      expect(builder.severity?.choices).toContain('high');
    });

    it('should define verbose option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder.verbose).toBeDefined();
    });

    it('should define quiet option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder.quiet).toBeDefined();
    });

    it('should define json option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder.json).toBeDefined();
    });

    it('should define report option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder.report).toBeDefined();
    });

    it('should define changed option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder.changed).toBeDefined();
    });

    it('should define staged option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder.staged).toBeDefined();
    });

    it('should define since option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');
      const builder = refactorCommand.builder as Record<string, unknown>;
      expect(builder.since).toBeDefined();
    });
  });

  describe('handler - normal mode', () => {
    it('should execute refactoring in normal mode', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockExecute).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should pass focus areas to controller', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        focus: ['dead_code', 'type_safety'],
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.focusAreas).toContain('dead_code');
      expect(capturedOptions.current.config.focusAreas).toContain('type_safety');
    });

    it('should pass iterations to controller', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        iterations: 3,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.maxIterations).toBe(3);
    });

    it('should pass scope to controller', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        scope: 'src/components',
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.rootDir).toBe('src/components');
    });

    it('should pass conservative option to controller', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        conservative: false,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.conservative).toBe(false);
    });

    it('should pass dry-run option to controller', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        dryRun: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.dryRun).toBe(true);
    });

    it('should pass no-llm option to controller', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        noLlm: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.useLLMForDetection).toBe(false);
      expect(capturedOptions.current.config.useLLMForRefactoring).toBe(false);
    });

    it('should pass max-changes option to controller', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        maxChanges: 5,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.maxChangesPerFile).toBe(5);
    });

    it('should pass min-improvement option to controller', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        minImprovement: 0.2,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.minImprovementThreshold).toBe(0.2);
    });

    it('should pass severity option to controller', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        severity: 'high',
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.severityThreshold).toBe('high');
    });

    it('should pass verbose option to controller', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        verbose: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.verbose).toBe(true);
    });
  });

  describe('handler - check mode', () => {
    it('should execute scan in check mode', async () => {
      mockScan.mockResolvedValue({
        findings: [],
        metrics: { complexity: 100 },
      });

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        check: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockScan).toHaveBeenCalled();
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should exit with code 1 in check mode when issues found', async () => {
      mockScan.mockResolvedValue({
        findings: [
          { id: 'f1', type: 'dead_code', severity: 'high', file: 'test.ts', lineStart: 10, message: 'test' },
        ],
        metrics: { complexity: 100 },
      });

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        check: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should not exit with error in check mode when no issues', async () => {
      mockScan.mockResolvedValue({
        findings: [],
        metrics: { complexity: 100 },
      });

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        check: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockProcessExit).not.toHaveBeenCalledWith(1);
    });

    it('should set dryRun to true in check mode', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        check: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.dryRun).toBe(true);
    });
  });

  describe('handler - quiet mode', () => {
    it('should suppress output in quiet mode', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        quiet: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      // spinner.start should not be called
      expect(mockSpinner.start).not.toHaveBeenCalled();
    });

    it('should suppress output in json mode', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        json: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      // Should output JSON
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('handler - json mode', () => {
    it('should output JSON in json mode', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        json: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      // Find the JSON output call
      const jsonCall = mockConsoleLog.mock.calls.find((call: unknown[]) => {
        try {
          JSON.parse(call[0] as string);
          return true;
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
    });

    it('should include sessionId in JSON output', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        json: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const jsonCall = mockConsoleLog.mock.calls.find((call: unknown[]) => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.sessionId !== undefined;
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
    });

    it('should include mapped findings in JSON output', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        findings: [
          {
            id: 'f1',
            type: 'dead_code',
            severity: 'high',
            file: 'test.ts',
            lineStart: 10,
            message: 'Unused import',
            suggestedFix: 'Remove it',
            confidence: 0.9,
          },
        ],
      });

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        json: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const jsonCall = mockConsoleLog.mock.calls.find((call: unknown[]) => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.findings && parsed.findings.length > 0;
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();

      const parsed = JSON.parse(jsonCall![0]);
      expect(parsed.findings[0]).toHaveProperty('id', 'f1');
      expect(parsed.findings[0]).toHaveProperty('line', 10);
    });
  });

  describe('handler - report generation', () => {
    it('should generate report when report option is provided', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        report: './test-report.md',
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        './test-report.md',
        expect.stringContaining('# Refactoring Report')
      );
    });

    it('should use default report path when report is non-string', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        report: true as any,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        './refactor-report.md',
        expect.any(String)
      );
    });

    it('should include summary in report', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        report: './report.md',
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const reportContent = mockWriteFileSync.mock.calls[0]![1];
      expect(reportContent).toContain('## Summary');
    });
  });

  describe('handler - git-aware scanning', () => {
    it('should handle changed option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        changed: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should handle staged option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        staged: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should handle since option', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        since: 'main',
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockSpinner.succeed).toHaveBeenCalled();
    });
  });

  describe('handler - error handling', () => {
    it('should handle errors gracefully', async () => {
      mockExecute.mockRejectedValue(new Error('Refactoring failed'));

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockSpinner.fail).toHaveBeenCalledWith('Refactoring failed');
      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects', async () => {
      mockExecute.mockRejectedValue('Unknown error');

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('handler - callbacks', () => {
    it('should call onProgress in verbose mode', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        verbose: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.onProgress).toBeDefined();
      capturedOptions.current.onProgress('scanning', 'Test message', { data: true });
      expect(mockLoggerInfo).toHaveBeenCalled();
    });

    it('should not call onProgress in quiet mode', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        quiet: true,
        verbose: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      capturedOptions.current.onProgress('scanning', 'Test message', {});
      expect(mockLoggerInfo).not.toHaveBeenCalled();
    });

    it('should call onFindingFound callback', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.onFindingFound).toBeDefined();
      capturedOptions.current.onFindingFound({
        id: 'f1',
        type: 'dead_code',
        severity: 'high',
        file: 'test.ts',
        lineStart: 10,
        message: 'Unused import',
      });
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should show suggestion in verbose mode', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        verbose: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      capturedOptions.current.onFindingFound({
        id: 'f1',
        type: 'dead_code',
        severity: 'high',
        file: 'test.ts',
        lineStart: 10,
        message: 'Unused import',
        suggestedFix: 'Remove the import',
      });
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should not show finding in quiet mode', async () => {
      mockConsoleLog.mockClear();

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        quiet: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      capturedOptions.current.onFindingFound({
        id: 'f1',
        type: 'dead_code',
        severity: 'high',
        file: 'test.ts',
        lineStart: 10,
        message: 'Unused import',
      });

      // Console should not be called for finding in quiet mode
      const findingCalls = mockConsoleLog.mock.calls.filter((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('test.ts')
      );
      expect(findingCalls).toHaveLength(0);
    });
  });

  describe('handler - display output', () => {
    it('should display summary in normal mode', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const calls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(calls).toContain('Refactoring Summary');
    });

    it('should display stop reason when present', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        stats: { ...defaultResult.stats, stopReason: 'max_iterations' },
      });

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should not display summary in quiet mode', async () => {
      mockConsoleLog.mockClear();

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        quiet: true,
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const summaryCalls = mockConsoleLog.mock.calls.filter((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('Summary')
      );
      expect(summaryCalls).toHaveLength(0);
    });
  });

  describe('parseFocusAreas helper', () => {
    it('should return all types when no focus provided', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const areas = capturedOptions.current.config.focusAreas;
      expect(areas).toContain('dead_code');
      expect(areas).toContain('type_safety');
      expect(areas).toContain('duplication');
    });

    it('should handle comma-separated focus areas', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        focus: ['dead_code,type_safety'],
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const areas = capturedOptions.current.config.focusAreas;
      expect(areas).toContain('dead_code');
      expect(areas).toContain('type_safety');
    });

    it('should handle shorthand hardcoded', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        focus: ['hardcoded'],
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const areas = capturedOptions.current.config.focusAreas;
      expect(areas).toContain('hardcoded_values');
    });

    it('should filter invalid focus areas', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        focus: ['invalid_type', 'dead_code'],
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const areas = capturedOptions.current.config.focusAreas;
      expect(areas).toContain('dead_code');
      expect(areas).not.toContain('invalid_type');
    });

    it('should return all types when all focus areas are invalid', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        focus: ['invalid1', 'invalid2'],
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const areas = capturedOptions.current.config.focusAreas;
      // Should fall back to all valid types
      expect(areas.length).toBe(8);
    });
  });

  describe('parseSeverity helper', () => {
    it('should default to low severity', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.severityThreshold).toBe('low');
    });

    it('should accept valid severity levels', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        severity: 'critical',
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.severityThreshold).toBe('critical');
    });

    it('should default to low for invalid severity', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        severity: 'invalid',
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.severityThreshold).toBe('low');
    });
  });

  describe('formatSeverity helper', () => {
    it('should format all severity levels through findings', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        _: ['refactor'],
        $0: 'ax',
      } as any);

      // Test critical severity
      capturedOptions.current.onFindingFound({
        id: 'f1', type: 'dead_code', severity: 'critical',
        file: 'test.ts', lineStart: 10, message: 'Test',
      });

      // Test high severity
      capturedOptions.current.onFindingFound({
        id: 'f2', type: 'dead_code', severity: 'high',
        file: 'test.ts', lineStart: 20, message: 'Test',
      });

      // Test medium severity
      capturedOptions.current.onFindingFound({
        id: 'f3', type: 'dead_code', severity: 'medium',
        file: 'test.ts', lineStart: 30, message: 'Test',
      });

      // Test low severity
      capturedOptions.current.onFindingFound({
        id: 'f4', type: 'dead_code', severity: 'low',
        file: 'test.ts', lineStart: 40, message: 'Test',
      });

      // Test unknown severity
      capturedOptions.current.onFindingFound({
        id: 'f5', type: 'dead_code', severity: 'unknown' as any,
        file: 'test.ts', lineStart: 50, message: 'Test',
      });

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('formatRefactorType helper', () => {
    it('should format all refactor types through findings', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const types = [
        'duplication', 'readability', 'performance', 'hardcoded_values',
        'naming', 'conditionals', 'dead_code', 'type_safety',
      ];

      for (const type of types) {
        capturedOptions.current.onFindingFound({
          id: `f-${type}`, type, severity: 'high',
          file: 'test.ts', lineStart: 10, message: 'Test',
        });
      }

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('generateMarkdownReport helper', () => {
    it('should include improvements in report', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        improvements: [
          { metric: 'complexity', before: 100, after: 80, improvementPercent: 20 },
          { metric: 'lines', before: 1000, after: 950, improvementPercent: -5 },
          { metric: 'unchanged', before: 50, after: 50, improvementPercent: 0 },
        ],
      });

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        report: './report.md',
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const reportContent = mockWriteFileSync.mock.calls[0]![1];
      expect(reportContent).toContain('## Metrics Comparison');
    });

    it('should include findings by type in report', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        stats: {
          ...defaultResult.stats,
          opportunitiesByType: { dead_code: 5, type_safety: 3 },
        },
      });

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        report: './report.md',
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const reportContent = mockWriteFileSync.mock.calls[0]![1];
      expect(reportContent).toContain('## Findings by Type');
    });

    it('should include detailed findings in report', async () => {
      mockExecute.mockResolvedValue({
        ...defaultResult,
        findings: [
          {
            id: 'f1',
            type: 'dead_code',
            severity: 'high',
            file: 'test.ts',
            lineStart: 10,
            message: 'Unused import',
            suggestedFix: 'Remove it',
            context: 'import { foo } from "bar";',
          },
        ],
      });

      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        report: './report.md',
        _: ['refactor'],
        $0: 'ax',
      } as any);

      const reportContent = mockWriteFileSync.mock.calls[0]![1];
      expect(reportContent).toContain('## Detailed Findings');
      expect(reportContent).toContain('test.ts:10');
    });
  });

  describe('default values', () => {
    it('should use default values when options not provided', async () => {
      const { refactorCommand } = await import('../../../../src/cli/commands/refactor.js');

      await refactorCommand.handler({
        _: ['refactor'],
        $0: 'ax',
      } as any);

      expect(capturedOptions.current.config.maxIterations).toBe(1);
      expect(capturedOptions.current.config.conservative).toBe(true);
      expect(capturedOptions.current.config.maxChangesPerFile).toBe(3);
      expect(capturedOptions.current.config.minImprovementThreshold).toBe(0.1);
    });
  });
});
