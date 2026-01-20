/**
 * Process manager for spawning CLI processes
 *
 * Handles:
 * - Process spawning with stdin/stdout
 * - Timeout handling with graceful shutdown
 * - Command availability checking
 */

import { spawn, exec, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { TIMEOUT_GRACEFUL_SHUTDOWN } from '@defai.digital/contracts';
import type { SpawnOptions, SpawnResult } from './types.js';

const execAsync = promisify(exec);

/**
 * INV-PROC-001: Process Cleanup on Parent Exit
 * Tracks all active child processes to ensure cleanup on parent process exit.
 * Prevents zombie processes if parent crashes between SIGTERM and SIGKILL.
 */
const activeProcesses = new Set<ChildProcess>();

/**
 * Cleanup handler registered once on module load.
 * Kills all active child processes on parent exit.
 */
let cleanupRegistered = false;

function registerCleanupHandler(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  // Handle normal exit
  process.on('exit', () => {
    for (const child of activeProcesses) {
      try {
        child.kill('SIGKILL');
      } catch {
        // Process may already be dead
      }
    }
  });

  // Handle signals that could terminate the process
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  for (const signal of signals) {
    process.on(signal, () => {
      for (const child of activeProcesses) {
        try {
          child.kill('SIGKILL');
        } catch {
          // Process may already be dead
        }
      }
      // Re-raise the signal after cleanup
      process.exit(128 + (signal === 'SIGINT' ? 2 : signal === 'SIGTERM' ? 15 : 1));
    });
  }
}

/**
 * Default grace period before SIGKILL
 */
const SIGKILL_GRACE_PERIOD = TIMEOUT_GRACEFUL_SHUTDOWN;

/**
 * Maximum output size in bytes to prevent memory exhaustion
 * 10MB should be more than enough for any LLM response
 */
const MAX_OUTPUT_SIZE = 10 * 1024 * 1024;

/**
 * Validates a command name to prevent command injection
 * Only allows alphanumeric characters, hyphens, underscores, and dots
 *
 * @param command - The command to validate
 * @returns true if the command is safe, false otherwise
 */
function isValidCommandName(command: string): boolean {
  // Must be non-empty and contain only safe characters
  // Allows: letters, numbers, hyphens, underscores, dots (for extensions like .exe)
  return /^[a-zA-Z0-9_.-]+$/.test(command);
}

/**
 * Spawns a CLI process and returns the result
 *
 * @param options - Spawn options including command, args, stdin, env, timeout
 * @returns Promise resolving to spawn result with stdout, stderr, exitCode
 */
export async function spawnCLI(options: SpawnOptions): Promise<SpawnResult> {
  // INV-PROC-001: Register cleanup handler on first use
  registerCleanupHandler();

  return new Promise((resolve, reject) => {
    // Validate command name to prevent injection
    if (!isValidCommandName(options.command)) {
      reject(new Error(`Invalid command name: ${options.command}`));
      return;
    }

    // On Windows, spawn() doesn't search PATH without shell: true
    // This is required for commands like 'claude', 'gemini' to resolve properly
    const isWindows = process.platform === 'win32';

    const child = spawn(options.command, [...options.args], {
      env: { ...process.env, ...options.env } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: options.cwd,
      shell: isWindows,
    });

    // INV-PROC-001: Track active process for cleanup
    activeProcesses.add(child);

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let earlyTerminated = false;
    let killed = false;
    let killTimeoutId: ReturnType<typeof setTimeout> | undefined;

    // Timeout handling with graceful shutdown
    const timeoutId = setTimeout(() => {
      timedOut = true;
      killed = true;

      // First, try SIGTERM for graceful shutdown
      child.kill('SIGTERM');

      // If still running after grace period, force kill
      killTimeoutId = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, SIGKILL_GRACE_PERIOD);
    }, options.timeout);

    // Collect stdout (with size limit to prevent memory exhaustion)
    let stdoutTruncated = false;
    child.stdout.on('data', (data: Buffer) => {
      if (!stdoutTruncated && stdout.length < MAX_OUTPUT_SIZE) {
        const str = data.toString();
        if (stdout.length + str.length > MAX_OUTPUT_SIZE) {
          stdout += str.slice(0, MAX_OUTPUT_SIZE - stdout.length);
          stdoutTruncated = true;
        } else {
          stdout += str;
        }
      }

      // Check for early termination condition (e.g., complete JSON output received)
      // This is useful for CLIs that hang during shutdown after producing valid output
      if (
        options.earlyTerminateOn !== undefined &&
        !killed &&
        options.earlyTerminateOn(stdout)
      ) {
        killed = true;
        earlyTerminated = true;
        clearTimeout(timeoutId);

        // Kill immediately - no graceful shutdown needed since we got what we wanted
        child.kill('SIGKILL');
      }
    });

    // Collect stderr (with size limit to prevent memory exhaustion)
    let stderrTruncated = false;
    child.stderr.on('data', (data: Buffer) => {
      if (!stderrTruncated && stderr.length < MAX_OUTPUT_SIZE) {
        const str = data.toString();
        if (stderr.length + str.length > MAX_OUTPUT_SIZE) {
          stderr += str.slice(0, MAX_OUTPUT_SIZE - stderr.length);
          stderrTruncated = true;
        } else {
          stderr += str;
        }
      }
    });

    // Handle stdin errors (e.g., EPIPE if process exits immediately)
    child.stdin.on('error', (err: Error & { code?: string }) => {
      // EPIPE is expected if the child process exits before reading all input
      // We ignore it since the 'close' event will still fire
      if (err.code !== 'EPIPE') {
        stderr += `stdin error: ${err.message}\n`;
      }
    });

    // Write prompt to stdin and close
    if (options.stdin.length > 0) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();

    // Handle process completion
    child.on('close', (code: number | null) => {
      // INV-PROC-001: Remove from tracking on completion
      activeProcesses.delete(child);

      clearTimeout(timeoutId);
      if (killTimeoutId !== undefined) {
        clearTimeout(killTimeoutId);
      }

      resolve({
        stdout,
        stderr,
        exitCode: code ?? (killed ? 137 : 1),
        timedOut,
        earlyTerminated,
      });
    });

    // Handle spawn errors (command not found, etc.)
    child.on('error', (error: Error) => {
      // INV-PROC-001: Remove from tracking on error
      activeProcesses.delete(child);

      clearTimeout(timeoutId);
      if (killTimeoutId !== undefined) {
        clearTimeout(killTimeoutId);
      }
      reject(error);
    });
  });
}

/**
 * Checks if a CLI command is available on the system PATH
 *
 * @param command - The command to check
 * @returns Promise resolving to true if available, false otherwise
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  // Validate command to prevent command injection
  if (!isValidCommandName(command)) {
    return false;
  }

  try {
    // Use 'which' on Unix, 'where' on Windows
    const whichCommand = process.platform === 'win32' ? 'where' : 'which';
    await execAsync(`${whichCommand} ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the version of a CLI command if available
 *
 * @param command - The command to check
 * @param versionFlag - The flag to get version (default: --version)
 * @returns Promise resolving to version string or undefined
 */
export async function getCommandVersion(
  command: string,
  versionFlag = '--version'
): Promise<string | undefined> {
  // Validate command to prevent command injection
  if (!isValidCommandName(command)) {
    return undefined;
  }

  // Validate versionFlag - only allow flags starting with - and containing safe chars
  if (!/^--?[a-zA-Z0-9_-]+$/.test(versionFlag)) {
    return undefined;
  }

  try {
    const { stdout } = await execAsync(`${command} ${versionFlag}`);
    // Extract version number from output (common patterns)
    const versionMatch = /(\d+\.\d+\.\d+)/.exec(stdout);
    return versionMatch?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Builds a prompt string from messages for CLI input
 *
 * @param messages - Array of messages
 * @param systemPrompt - Optional system prompt
 * @returns Formatted prompt string
 */
export function buildPromptFromMessages(
  messages: { role: string; content: string }[],
  systemPrompt?: string
): string {
  const parts: string[] = [];

  // Add system prompt if provided
  if (systemPrompt !== undefined && systemPrompt.length > 0) {
    parts.push(`[System]\n${systemPrompt}\n`);
  }

  // Add messages
  for (const msg of messages) {
    if (msg.role === 'user') {
      parts.push(msg.content);
    } else if (msg.role === 'assistant') {
      parts.push(`[Assistant]\n${msg.content}\n`);
    } else if (msg.role === 'system' && systemPrompt === undefined) {
      // Include system messages if no explicit system prompt
      parts.push(`[System]\n${msg.content}\n`);
    }
  }

  return parts.join('\n');
}
