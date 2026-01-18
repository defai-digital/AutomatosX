/**
 * Process manager for spawning CLI processes
 *
 * Handles:
 * - Process spawning with stdin/stdout
 * - Timeout handling with graceful shutdown
 * - Command availability checking
 */

import { spawn, exec } from 'node:child_process';
import { promisify } from 'node:util';
import { TIMEOUT_GRACEFUL_SHUTDOWN } from '@defai.digital/contracts';
import type { SpawnOptions, SpawnResult } from './types.js';

const execAsync = promisify(exec);

/**
 * Default grace period before SIGKILL
 */
const SIGKILL_GRACE_PERIOD = TIMEOUT_GRACEFUL_SHUTDOWN;

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
  return new Promise((resolve, reject) => {
    // Validate command name to prevent injection
    if (!isValidCommandName(options.command)) {
      reject(new Error(`Invalid command name: ${options.command}`));
      return;
    }

    const child = spawn(options.command, [...options.args], {
      env: { ...process.env, ...options.env } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: options.cwd,
    });

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

    // Collect stdout
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();

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

    // Collect stderr
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
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
