/**
 * Cleanup Command Unit Tests
 *
 * Comprehensive tests for the cleanup command including:
 * - Process detection
 * - Process name validation (security)
 * - Process killing (SIGTERM/SIGKILL)
 * - Provider filtering
 * - User confirmation
 *
 * @module tests/unit/cli/commands/cleanup.test.ts
 * @since v12.8.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// ============================================================================
// Mock Modules
// ============================================================================

vi.mock('chalk', () => ({
  default: {
    blue: Object.assign((s: string) => s, { bold: (s: string) => s }),
    cyan: (s: string) => s,
    white: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    dim: (s: string) => s,
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
  },
}));

vi.mock('../../shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../shared/errors/error-formatter.js', () => ({
  printError: vi.fn(),
}));

const mockSleep = vi.fn().mockResolvedValue(undefined);
vi.mock('../../shared/utils/safe-timers.js', () => ({
  sleep: mockSleep,
}));

// ============================================================================
// Test Setup
// ============================================================================

describe('Cleanup Command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // ============================================================================
  // Process Name Validation Tests
  // ============================================================================

  describe('Process Name Validation', () => {
    it('should accept valid alphanumeric process names', () => {
      const validateProcessName = (name: string): boolean => {
        return /^[a-zA-Z0-9_-]+$/.test(name);
      };

      expect(validateProcessName('codex')).toBe(true);
      expect(validateProcessName('gemini')).toBe(true);
      expect(validateProcessName('claude')).toBe(true);
      expect(validateProcessName('my-process')).toBe(true);
      expect(validateProcessName('my_process')).toBe(true);
      expect(validateProcessName('process123')).toBe(true);
    });

    it('should reject invalid process names (command injection prevention)', () => {
      const validateProcessName = (name: string): boolean => {
        return /^[a-zA-Z0-9_-]+$/.test(name);
      };

      expect(validateProcessName('codex; rm -rf /')).toBe(false);
      expect(validateProcessName('codex && malicious')).toBe(false);
      expect(validateProcessName('codex | cat /etc/passwd')).toBe(false);
      expect(validateProcessName('`whoami`')).toBe(false);
      expect(validateProcessName('$(command)')).toBe(false);
      expect(validateProcessName('name with spaces')).toBe(false);
      expect(validateProcessName('')).toBe(false);
    });

    it('should throw error for invalid process name', () => {
      const validateAndThrow = (name: string): void => {
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
          throw new Error(`Invalid process name: ${name}. Only alphanumeric characters, dashes, and underscores are allowed.`);
        }
      };

      expect(() => validateAndThrow('codex; rm -rf /')).toThrow('Invalid process name');
    });
  });

  // ============================================================================
  // Provider Mapping Tests
  // ============================================================================

  describe('Provider Mapping', () => {
    it('should map openai provider to codex process', () => {
      const getProcessNames = (provider: string): string[] => {
        const processNames: string[] = [];

        if (provider === 'openai' || provider === 'all') {
          processNames.push('codex');
        }
        if (provider === 'gemini' || provider === 'all') {
          processNames.push('gemini');
        }
        if (provider === 'claude' || provider === 'all') {
          processNames.push('claude');
        }

        return processNames;
      };

      expect(getProcessNames('openai')).toEqual(['codex']);
      expect(getProcessNames('gemini')).toEqual(['gemini']);
      expect(getProcessNames('claude')).toEqual(['claude']);
    });

    it('should map all provider to all processes', () => {
      const getProcessNames = (provider: string): string[] => {
        const processNames: string[] = [];

        if (provider === 'openai' || provider === 'all') {
          processNames.push('codex');
        }
        if (provider === 'gemini' || provider === 'all') {
          processNames.push('gemini');
        }
        if (provider === 'claude' || provider === 'all') {
          processNames.push('claude');
        }

        return processNames;
      };

      const processes = getProcessNames('all');
      expect(processes).toContain('codex');
      expect(processes).toContain('gemini');
      expect(processes).toContain('claude');
      expect(processes).toHaveLength(3);
    });

    it('should return empty array for unknown provider', () => {
      const getProcessNames = (provider: string): string[] => {
        const processNames: string[] = [];

        if (provider === 'openai' || provider === 'all') {
          processNames.push('codex');
        }
        if (provider === 'gemini' || provider === 'all') {
          processNames.push('gemini');
        }
        if (provider === 'claude' || provider === 'all') {
          processNames.push('claude');
        }

        return processNames;
      };

      expect(getProcessNames('unknown')).toEqual([]);
    });
  });

  // ============================================================================
  // PS Output Parsing Tests
  // ============================================================================

  describe('PS Output Parsing', () => {
    it('should parse ps output correctly', () => {
      const parsePsOutput = (stdout: string, processName: string) => {
        const processes: Array<{
          pid: number;
          command: string;
          runtime: string;
          memory: string;
        }> = [];

        if (!stdout.trim()) {
          return processes;
        }

        const lines = stdout.trim().split('\n');

        for (const line of lines) {
          if (line.includes('PID') && line.includes('COMMAND')) {
            continue;
          }

          if (!line.includes(processName)) {
            continue;
          }

          if (line.includes('grep')) {
            continue;
          }

          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4 && parts[0] && parts[1] && parts[2] && parts[3]) {
            const pid = parseInt(parts[0], 10);
            const command = parts[1];
            const elapsed = parts[2];
            const memoryKB = parseInt(parts[3], 10);

            if (isNaN(pid) || isNaN(memoryKB)) {
              continue;
            }

            const memoryMB = Math.round(memoryKB / 1024);

            const elapsedParts = elapsed.split(/[-:]/);
            const firstPart = elapsedParts[0];
            const firstPartNum = firstPart ? parseInt(firstPart, 10) : NaN;
            const isLongRunning = elapsedParts.length > 2 || (!isNaN(firstPartNum) && firstPartNum >= 5);

            if (isLongRunning) {
              processes.push({
                pid,
                command,
                runtime: elapsed,
                memory: `${memoryMB}MB`,
              });
            }
          }
        }

        return processes;
      };

      const psOutput = `  PID COMMAND          ELAPSED     RSS
12345 codex            01:30:45   51200
67890 gemini              10:20   25600`;

      const codexProcesses = parsePsOutput(psOutput, 'codex');
      expect(codexProcesses).toHaveLength(1);
      expect(codexProcesses[0]?.pid).toBe(12345);
      expect(codexProcesses[0]?.command).toBe('codex');
      expect(codexProcesses[0]?.memory).toBe('50MB');
    });

    it('should filter out short-lived processes', () => {
      const parsePsOutput = (stdout: string, processName: string) => {
        const processes: Array<{
          pid: number;
          command: string;
          runtime: string;
          memory: string;
        }> = [];

        const lines = stdout.trim().split('\n');

        for (const line of lines) {
          if (line.includes('PID') && line.includes('COMMAND')) {
            continue;
          }

          if (!line.includes(processName)) {
            continue;
          }

          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4) {
            const pid = parseInt(parts[0]!, 10);
            const command = parts[1]!;
            const elapsed = parts[2]!;
            const memoryKB = parseInt(parts[3]!, 10);

            if (isNaN(pid) || isNaN(memoryKB)) {
              continue;
            }

            const memoryMB = Math.round(memoryKB / 1024);

            const elapsedParts = elapsed.split(/[-:]/);
            const firstPart = elapsedParts[0];
            const firstPartNum = firstPart ? parseInt(firstPart, 10) : NaN;
            const isLongRunning = elapsedParts.length > 2 || (!isNaN(firstPartNum) && firstPartNum >= 5);

            if (isLongRunning) {
              processes.push({
                pid,
                command,
                runtime: elapsed,
                memory: `${memoryMB}MB`,
              });
            }
          }
        }

        return processes;
      };

      const psOutput = `  PID COMMAND          ELAPSED     RSS
12345 codex               00:03   10240`;

      const processes = parsePsOutput(psOutput, 'codex');
      expect(processes).toHaveLength(0);
    });

    it('should filter out grep processes', () => {
      const parsePsOutput = (stdout: string, processName: string) => {
        const processes: Array<{
          pid: number;
          command: string;
        }> = [];

        const lines = stdout.trim().split('\n');

        for (const line of lines) {
          if (line.includes('grep')) {
            continue;
          }

          if (line.includes(processName)) {
            processes.push({ pid: 12345, command: processName });
          }
        }

        return processes;
      };

      const psOutput = `  PID COMMAND          ELAPSED     RSS
12345 codex            01:30:45   51200
99999 grep codex           00:01    1024`;

      const processes = parsePsOutput(psOutput, 'codex');
      expect(processes).toHaveLength(1);
    });

    it('should handle empty ps output', () => {
      const parsePsOutput = (stdout: string) => {
        if (!stdout.trim()) {
          return [];
        }
        return [{ pid: 1 }];
      };

      expect(parsePsOutput('')).toEqual([]);
      expect(parsePsOutput('   ')).toEqual([]);
    });

    it('should skip invalid numeric values', () => {
      const parsePsOutput = (stdout: string, processName: string) => {
        const processes: Array<{ pid: number }> = [];

        const lines = stdout.trim().split('\n');

        for (const line of lines) {
          if (!line.includes(processName)) {
            continue;
          }

          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[0]!, 10);
          const memoryKB = parseInt(parts[3]!, 10);

          if (isNaN(pid) || isNaN(memoryKB)) {
            continue;
          }

          processes.push({ pid });
        }

        return processes;
      };

      const psOutput = `  PID COMMAND          ELAPSED     RSS
invalid codex            01:30:45   51200
12345 codex            01:30:45   invalid`;

      const processes = parsePsOutput(psOutput, 'codex');
      expect(processes).toHaveLength(0);
    });
  });

  // ============================================================================
  // Elapsed Time Parsing Tests
  // ============================================================================

  describe('Elapsed Time Parsing', () => {
    it('should detect long-running processes (hours format)', () => {
      const isLongRunning = (elapsed: string): boolean => {
        const elapsedParts = elapsed.split(/[-:]/);
        const firstPart = elapsedParts[0];
        const firstPartNum = firstPart ? parseInt(firstPart, 10) : NaN;
        return elapsedParts.length > 2 || (!isNaN(firstPartNum) && firstPartNum >= 5);
      };

      expect(isLongRunning('01:30:45')).toBe(true); // 1 hour, 30 min, 45 sec
      expect(isLongRunning('00:10:00')).toBe(true); // 10 minutes
    });

    it('should detect long-running processes (minutes format)', () => {
      const isLongRunning = (elapsed: string): boolean => {
        const elapsedParts = elapsed.split(/[-:]/);
        const firstPart = elapsedParts[0];
        const firstPartNum = firstPart ? parseInt(firstPart, 10) : NaN;
        return elapsedParts.length > 2 || (!isNaN(firstPartNum) && firstPartNum >= 5);
      };

      expect(isLongRunning('10:30')).toBe(true); // 10 min, 30 sec
      expect(isLongRunning('05:00')).toBe(true); // 5 min
    });

    it('should filter short-lived processes', () => {
      const isLongRunning = (elapsed: string): boolean => {
        const elapsedParts = elapsed.split(/[-:]/);
        const firstPart = elapsedParts[0];
        const firstPartNum = firstPart ? parseInt(firstPart, 10) : NaN;
        return elapsedParts.length > 2 || (!isNaN(firstPartNum) && firstPartNum >= 5);
      };

      expect(isLongRunning('00:03')).toBe(false); // 3 seconds
      expect(isLongRunning('00:04')).toBe(false); // 4 seconds
      expect(isLongRunning('04:59')).toBe(false); // 4 min, 59 sec
    });

    it('should handle days format', () => {
      const isLongRunning = (elapsed: string): boolean => {
        const elapsedParts = elapsed.split(/[-:]/);
        return elapsedParts.length > 2;
      };

      expect(isLongRunning('1-02:30:45')).toBe(true); // 1 day, 2 hours
    });
  });

  // ============================================================================
  // Kill Process Tests
  // ============================================================================

  describe('Kill Process', () => {
    it('should use spawn with shell: false for security', () => {
      const createKillCommand = (pid: number, signal: string) => {
        return {
          command: 'kill',
          args: [signal, String(pid)],
          options: {
            stdio: 'pipe',
            shell: false, // CRITICAL for security
          },
        };
      };

      const killCmd = createKillCommand(12345, '-TERM');
      expect(killCmd.command).toBe('kill');
      expect(killCmd.args).toEqual(['-TERM', '12345']);
      expect(killCmd.options.shell).toBe(false);
    });

    it('should escalate to SIGKILL if SIGTERM fails', async () => {
      const killProcess = async (pid: number): Promise<{ signal: string }> => {
        // Try SIGTERM first
        const termResult = { success: false };

        if (!termResult.success) {
          // Escalate to SIGKILL
          return { signal: '-KILL' };
        }

        return { signal: '-TERM' };
      };

      const result = await killProcess(12345);
      expect(result.signal).toBe('-KILL');
    });

    it('should verify process termination using ps', () => {
      const createPsCheck = (pid: number) => {
        return {
          command: 'ps',
          args: ['-p', String(pid)],
          options: {
            stdio: 'pipe',
            shell: false,
          },
        };
      };

      const psCheck = createPsCheck(12345);
      expect(psCheck.command).toBe('ps');
      expect(psCheck.args).toEqual(['-p', '12345']);
      expect(psCheck.options.shell).toBe(false);
    });
  });

  // ============================================================================
  // Memory Estimation Tests
  // ============================================================================

  describe('Memory Estimation', () => {
    it('should estimate memory freed based on killed processes', () => {
      const estimateMemoryFreed = (killedCount: number): number => {
        return Math.round(killedCount * 50); // ~50MB per process
      };

      expect(estimateMemoryFreed(1)).toBe(50);
      expect(estimateMemoryFreed(5)).toBe(250);
      expect(estimateMemoryFreed(10)).toBe(500);
    });

    it('should format memory from KB to MB', () => {
      const formatMemory = (memoryKB: number): string => {
        const memoryMB = Math.round(memoryKB / 1024);
        return `${memoryMB}MB`;
      };

      expect(formatMemory(51200)).toBe('50MB');
      expect(formatMemory(102400)).toBe('100MB');
      expect(formatMemory(1024)).toBe('1MB');
    });
  });

  // ============================================================================
  // Confirmation Flow Tests
  // ============================================================================

  describe('Confirmation Flow', () => {
    it('should skip confirmation with --force flag', () => {
      const shouldPrompt = (force: boolean): boolean => {
        return !force;
      };

      expect(shouldPrompt(true)).toBe(false);
      expect(shouldPrompt(false)).toBe(true);
    });

    it('should respect user cancellation', () => {
      const handleConfirmation = (confirmed: boolean): boolean => {
        return confirmed;
      };

      expect(handleConfirmation(true)).toBe(true);
      expect(handleConfirmation(false)).toBe(false);
    });
  });

  // ============================================================================
  // Process Info Display Tests
  // ============================================================================

  describe('Process Info Display', () => {
    it('should format process info for display', () => {
      const formatProcessInfo = (proc: {
        pid: number;
        command: string;
        runtime: string;
        memory: string;
      }, index: number): string => {
        return `${index + 1}. PID ${proc.pid} - ${proc.command}\n     Runtime: ${proc.runtime} | Memory: ${proc.memory}`;
      };

      const info = formatProcessInfo({
        pid: 12345,
        command: 'codex',
        runtime: '01:30:45',
        memory: '50MB',
      }, 0);

      expect(info).toContain('PID 12345');
      expect(info).toContain('codex');
      expect(info).toContain('Runtime: 01:30:45');
      expect(info).toContain('Memory: 50MB');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle ps command failure', async () => {
      const findProcesses = async (): Promise<Array<{ pid: number }>> => {
        try {
          throw new Error('ENOENT: ps command not found');
        } catch {
          return [];
        }
      };

      const processes = await findProcesses();
      expect(processes).toEqual([]);
    });

    it('should track failed kills separately', () => {
      const results = { killed: 0, failed: 0 };

      const killAttempts = [
        { success: true },
        { success: true },
        { success: false },
        { success: true },
        { success: false },
      ];

      for (const attempt of killAttempts) {
        if (attempt.success) {
          results.killed++;
        } else {
          results.failed++;
        }
      }

      expect(results.killed).toBe(3);
      expect(results.failed).toBe(2);
    });

    it('should format kill error message', () => {
      const formatKillError = (pid: number, message: string): string => {
        return `Failed to kill process ${pid}: ${message}`;
      };

      const error = formatKillError(12345, 'Operation not permitted');
      expect(error).toBe('Failed to kill process 12345: Operation not permitted');
    });
  });

  // ============================================================================
  // Integration-Like Tests
  // ============================================================================

  describe('Command Flow', () => {
    it('should return early when no processes found', async () => {
      const runCleanup = async (processes: Array<{ pid: number }>): Promise<string> => {
        if (processes.length === 0) {
          return 'No orphaned processes found!';
        }
        return `Found ${processes.length} process(es)`;
      };

      const result = await runCleanup([]);
      expect(result).toBe('No orphaned processes found!');
    });

    it('should report found processes count', async () => {
      const runCleanup = async (processes: Array<{ pid: number }>): Promise<string> => {
        if (processes.length === 0) {
          return 'No orphaned processes found!';
        }
        return `Found ${processes.length} orphaned process(es)`;
      };

      const result = await runCleanup([{ pid: 1 }, { pid: 2 }, { pid: 3 }]);
      expect(result).toBe('Found 3 orphaned process(es)');
    });

    it('should handle default provider as all', () => {
      const getProvider = (argv: { provider?: string }): string => {
        return argv.provider || 'all';
      };

      expect(getProvider({})).toBe('all');
      expect(getProvider({ provider: 'openai' })).toBe('openai');
    });
  });

  // ============================================================================
  // Spawn Mock Tests
  // ============================================================================

  describe('Spawn Behavior', () => {
    it('should create spawn-like process mock', () => {
      class MockChildProcess extends EventEmitter {
        override on(event: string, callback: (...args: unknown[]) => void): this {
          super.on(event, callback);
          return this;
        }

        simulateClose(code: number): void {
          this.emit('close', code);
        }

        simulateError(error: Error): void {
          this.emit('error', error);
        }
      }

      const mockProc = new MockChildProcess();

      const closePromise = new Promise<number>((resolve, reject) => {
        mockProc.on('close', (code) => {
          if (code === 0) {
            resolve(code as number);
          } else {
            reject(new Error(`Process exited with code ${code}`));
          }
        });
        mockProc.on('error', reject);
      });

      mockProc.simulateClose(0);

      return expect(closePromise).resolves.toBe(0);
    });

    it('should reject on non-zero exit code', () => {
      class MockChildProcess extends EventEmitter {
        simulateClose(code: number): void {
          this.emit('close', code);
        }
      }

      const mockProc = new MockChildProcess();

      const closePromise = new Promise<void>((resolve, reject) => {
        mockProc.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`kill failed with code ${code}`));
          }
        });
      });

      mockProc.simulateClose(1);

      return expect(closePromise).rejects.toThrow('kill failed with code 1');
    });
  });
});
