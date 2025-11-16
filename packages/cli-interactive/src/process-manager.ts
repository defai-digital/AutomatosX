/**
 * Process Manager
 *
 * Manages code execution with background processes, streaming output,
 * and process lifecycle control.
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ProcessInfo {
  pid: number;
  command: string;
  status: 'running' | 'completed' | 'failed' | 'killed';
  startTime: Date;
  endTime?: Date;
  exitCode?: number;
  stdout: string[];
  stderr: string[];
  childPid?: number; // Actual OS process ID
}

export interface ExecuteOptions {
  background?: boolean;
  timeout?: number; // milliseconds
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  onOutput?: (data: string) => void;
  onError?: (data: string) => void;
}

export interface ExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
}

export class ProcessManager extends EventEmitter {
  private processes: Map<number, ProcessInfo>;
  private childProcesses: Map<number, ChildProcess>;
  private nextPid: number;
  private readonly maxProcesses: number;
  private readonly maxOutputSize: number; // bytes
  private readonly maxOutputLines: number;
  private readonly defaultTimeout: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options?: {
    maxProcesses?: number;
    maxOutputSize?: number;
    maxOutputLines?: number;
    defaultTimeout?: number;
  }) {
    super();
    this.processes = new Map();
    this.childProcesses = new Map();
    this.nextPid = 1;
    this.maxProcesses = options?.maxProcesses || 50;
    this.maxOutputSize = options?.maxOutputSize || 10 * 1024 * 1024; // 10MB
    this.maxOutputLines = options?.maxOutputLines || 10000;
    this.defaultTimeout = options?.defaultTimeout || 300000; // 5 minutes

    // Auto-cleanup completed processes every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup(3600000); // Remove processes older than 1 hour
    }, 300000);
  }

  /**
   * Execute command and wait for completion
   */
  async execute(
    command: string,
    options: ExecuteOptions = {}
  ): Promise<ExecuteResult> {
    if (options.background) {
      const pid = this.executeBackground(command, options);
      return this.waitFor(pid, options.timeout);
    }

    // Foreground execution
    return new Promise<ExecuteResult>((resolve, reject) => {
      const timeout = options.timeout || this.defaultTimeout;
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Parse command and args
      const { cmd, args } = this.parseCommand(command);

      // Spawn process
      const child = spawn(cmd, args, {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...(options.env || {}) },
        shell: options.shell !== undefined ? options.shell : true
      });

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');

        // Force kill after 5 seconds
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      // Collect stdout
      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        if (options.onOutput) {
          options.onOutput(text);
        }
      });

      // Collect stderr
      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        if (options.onError) {
          options.onError(text);
        }
      });

      // Handle completion
      child.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);
        resolve({
          exitCode: code ?? -1,
          stdout,
          stderr,
          timedOut
        });
      });

      // Handle errors
      child.on('error', (error: Error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  }

  /**
   * Execute command in background
   */
  executeBackground(command: string, options: ExecuteOptions = {}): number {
    // Check process limit
    const runningCount = Array.from(this.processes.values()).filter(
      p => p.status === 'running'
    ).length;

    if (runningCount >= this.maxProcesses) {
      throw new Error(`Process limit reached (${this.maxProcesses}). Kill some processes first.`);
    }

    // Allocate PID
    const pid = this.nextPid++;

    // Create process info
    const processInfo: ProcessInfo = {
      pid,
      command,
      status: 'running',
      startTime: new Date(),
      stdout: [],
      stderr: []
    };

    this.processes.set(pid, processInfo);

    // Parse command and args
    const { cmd, args } = this.parseCommand(command);

    // Spawn process
    const child = spawn(cmd, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      shell: options.shell !== undefined ? options.shell : true,
      detached: false
    });

    processInfo.childPid = child.pid;
    this.childProcesses.set(pid, child);

    // Set timeout
    const timeout = options.timeout || this.defaultTimeout;
    const timeoutHandle = setTimeout(() => {
      this.killProcess(pid, false);
    }, timeout);

    // Collect stdout
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      const lines = text.split('\n');

      processInfo.stdout.push(...lines);

      // Enforce output limits
      if (processInfo.stdout.length > this.maxOutputLines) {
        processInfo.stdout = processInfo.stdout.slice(-this.maxOutputLines);
      }

      // Check total size
      const totalSize = processInfo.stdout.join('\n').length +
                       processInfo.stderr.join('\n').length;
      if (totalSize > this.maxOutputSize) {
        // Truncate old output
        processInfo.stdout = processInfo.stdout.slice(-Math.floor(this.maxOutputLines / 2));
      }

      if (options.onOutput) {
        options.onOutput(text);
      }

      this.emit('output', pid, text);
    });

    // Collect stderr
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      const lines = text.split('\n');

      processInfo.stderr.push(...lines);

      // Enforce output limits
      if (processInfo.stderr.length > this.maxOutputLines) {
        processInfo.stderr = processInfo.stderr.slice(-this.maxOutputLines);
      }

      if (options.onError) {
        options.onError(text);
      }

      this.emit('error', pid, text);
    });

    // Handle completion
    child.on('close', (code: number | null) => {
      clearTimeout(timeoutHandle);
      processInfo.endTime = new Date();
      processInfo.exitCode = code ?? -1;
      processInfo.status = code === 0 ? 'completed' : 'failed';

      this.childProcesses.delete(pid);
      this.emit('complete', pid, code);
    });

    // Handle errors
    child.on('error', (error: Error) => {
      clearTimeout(timeoutHandle);
      processInfo.endTime = new Date();
      processInfo.status = 'failed';
      processInfo.stderr.push(error.message);

      this.childProcesses.delete(pid);
      this.emit('error', pid, error.message);
    });

    return pid;
  }

  /**
   * List all processes
   */
  listProcesses(includeCompleted = false): ProcessInfo[] {
    const processes = Array.from(this.processes.values());

    if (includeCompleted) {
      return processes;
    }

    return processes.filter(p => p.status === 'running');
  }

  /**
   * Get process by PID
   */
  getProcess(pid: number): ProcessInfo | null {
    return this.processes.get(pid) || null;
  }

  /**
   * Kill process
   */
  killProcess(pid: number, force = false): boolean {
    const processInfo = this.processes.get(pid);
    if (!processInfo) {
      return false;
    }

    if (processInfo.status !== 'running') {
      return false;
    }

    const child = this.childProcesses.get(pid);
    if (!child) {
      return false;
    }

    try {
      if (force) {
        child.kill('SIGKILL');
      } else {
        child.kill('SIGTERM');

        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (this.childProcesses.has(pid)) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }

      processInfo.status = 'killed';
      processInfo.endTime = new Date();

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get process output
   */
  getOutput(pid: number): { stdout: string[]; stderr: string[] } | null {
    const processInfo = this.processes.get(pid);
    if (!processInfo) {
      return null;
    }

    return {
      stdout: processInfo.stdout,
      stderr: processInfo.stderr
    };
  }

  /**
   * Stream process output
   */
  streamOutput(pid: number, callback: (line: string) => void): () => void {
    const outputListener = (_pid: number, data: string) => {
      if (_pid === pid) {
        callback(data);
      }
    };

    this.on('output', outputListener);

    // Return cleanup function
    return () => {
      this.removeListener('output', outputListener);
    };
  }

  /**
   * Wait for process completion
   */
  async waitFor(pid: number, timeout?: number): Promise<ExecuteResult> {
    const processInfo = this.processes.get(pid);
    if (!processInfo) {
      throw new Error(`Process ${pid} not found`);
    }

    // Already completed
    if (processInfo.status !== 'running') {
      return {
        exitCode: processInfo.exitCode ?? -1,
        stdout: processInfo.stdout.join('\n'),
        stderr: processInfo.stderr.join('\n')
      };
    }

    // Wait for completion
    return new Promise<ExecuteResult>((resolve, reject) => {
      const completeListener = (_pid: number, code: number | null) => {
        if (_pid === pid) {
          this.removeListener('complete', completeListener);
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }

          resolve({
            exitCode: code ?? -1,
            stdout: processInfo.stdout.join('\n'),
            stderr: processInfo.stderr.join('\n')
          });
        }
      };

      this.on('complete', completeListener);

      // Set timeout if provided
      let timeoutHandle: NodeJS.Timeout | undefined;
      if (timeout) {
        timeoutHandle = setTimeout(() => {
          this.removeListener('complete', completeListener);
          this.killProcess(pid, false);
          reject(new Error(`Process ${pid} timed out after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  /**
   * Clean up completed processes
   */
  cleanup(olderThan = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [pid, processInfo] of this.processes.entries()) {
      if (processInfo.status === 'running') {
        continue;
      }

      const age = processInfo.endTime
        ? now - processInfo.endTime.getTime()
        : 0;

      if (age > olderThan) {
        this.processes.delete(pid);
        this.childProcesses.delete(pid);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Parse command into cmd and args
   * BUG #39 FIX: Handle backslash escaping for spaces and quotes
   */
  private parseCommand(command: string): { cmd: string; args: string[] } {
    // Simple parsing - split on spaces but respect quotes and backslash escapes
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      const nextChar = i < command.length - 1 ? command[i + 1] : '';

      // BUG #39 FIX: Handle backslash escaping
      if (char === '\\' && (nextChar === ' ' || nextChar === '"' || nextChar === "'" || nextChar === '\\')) {
        // Escape sequence: consume backslash and add next char literally
        current += nextChar;
        i++; // Skip next char since we already consumed it
      } else if ((char === '"' || char === "'") && !inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuote) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    const cmd = parts[0] || '';
    const args = parts.slice(1);

    return { cmd, args };
  }

  /**
   * Close process manager and kill all running processes
   */
  close(): void {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Kill all running processes
    for (const pid of this.childProcesses.keys()) {
      this.killProcess(pid, true);
    }

    // Clear all data
    this.processes.clear();
    this.childProcesses.clear();
    this.removeAllListeners();
  }
}
