/**
 * CLI Command Helpers
 *
 * Reusable utilities for building consistent CLI commands.
 * Provides common flags, error handling, and output formatting.
 *
 * @module command-helpers
 */

import type { Argv, Options } from 'yargs';
import { logger } from '../../shared/logging/logger.js';
import chalk from 'chalk';

// ============================================
// Common Flag Definitions
// ============================================

/**
 * Common CLI flags that can be added to any command
 */
export const commonFlags = {
  /**
   * Verbose output flag
   */
  verbose: {
    alias: 'v',
    type: 'boolean',
    default: false,
    describe: 'Enable verbose output',
  } as const satisfies Options,

  /**
   * Quiet mode flag (suppress non-essential output)
   */
  quiet: {
    alias: 'q',
    type: 'boolean',
    default: false,
    describe: 'Suppress non-essential output',
  } as const satisfies Options,

  /**
   * JSON output flag
   */
  json: {
    type: 'boolean',
    default: false,
    describe: 'Output results as JSON',
  } as const satisfies Options,

  /**
   * Config file path flag
   */
  config: {
    alias: 'c',
    type: 'string',
    describe: 'Path to configuration file',
  } as const satisfies Options,

  /**
   * Output file path flag
   */
  output: {
    alias: 'o',
    type: 'string',
    describe: 'Output file path',
  } as const satisfies Options,

  /**
   * Dry run flag
   */
  dryRun: {
    type: 'boolean',
    default: false,
    describe: 'Preview changes without applying them',
  } as const satisfies Options,

  /**
   * Force flag (skip confirmations)
   */
  force: {
    alias: 'f',
    type: 'boolean',
    default: false,
    describe: 'Skip confirmation prompts',
  } as const satisfies Options,

  /**
   * Provider selection flag
   */
  provider: {
    alias: 'p',
    type: 'string',
    describe: 'Provider to use (claude, gemini, codex, glm, grok)',
  } as const satisfies Options,

  /**
   * Agent selection flag
   */
  agent: {
    alias: 'a',
    type: 'string',
    describe: 'Agent to use for the task',
  } as const satisfies Options,

  /**
   * Timeout flag
   */
  timeout: {
    alias: 't',
    type: 'number',
    describe: 'Timeout in milliseconds',
  } as const satisfies Options,
} as const;

/**
 * Add common flags to a yargs command
 */
export function withCommonFlags<T>(
  yargs: Argv<T>,
  flags: (keyof typeof commonFlags)[]
): Argv<T> {
  let result = yargs;
  for (const flag of flags) {
    result = result.option(flag, commonFlags[flag]) as Argv<T>;
  }
  return result;
}

// ============================================
// Command Handler Wrapper
// ============================================

/**
 * Options for the command handler wrapper
 */
export interface CommandHandlerOptions {
  /** Command name for logging */
  name: string;
  /** Whether to exit with code 1 on error (default: true) */
  exitOnError?: boolean;
  /** Whether to log errors (default: true) */
  logErrors?: boolean;
}

/**
 * Wrap a command handler with standard error handling
 *
 * @example
 * ```typescript
 * export const handler = createCommandHandler(
 *   async (args) => {
 *     // Command implementation
 *   },
 *   { name: 'my-command' }
 * );
 * ```
 */
export function createCommandHandler<T>(
  handler: (args: T) => Promise<void>,
  options: CommandHandlerOptions
): (args: T) => Promise<void> {
  const { name, exitOnError = true, logErrors = true } = options;

  return async (args: T): Promise<void> => {
    try {
      await handler(args);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (logErrors) {
        logger.error(`[${name}] Command failed`, { error: errorMessage });
      }

      // Output error for CLI user
      console.error(chalk.red(`Error: ${errorMessage}`));

      if (exitOnError) {
        process.exitCode = 1;
      }
    }
  };
}

// ============================================
// Output Formatting
// ============================================

/**
 * Output data based on format preference
 */
export function outputResult<T>(
  data: T,
  options: { json?: boolean; quiet?: boolean }
): void {
  if (options.quiet) {
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(data);
  }
}

/**
 * Format a success message
 */
export function formatSuccess(message: string): string {
  return chalk.green(`✓ ${message}`);
}

/**
 * Format an error message
 */
export function formatError(message: string): string {
  return chalk.red(`✗ ${message}`);
}

/**
 * Format a warning message
 */
export function formatWarning(message: string): string {
  return chalk.yellow(`⚠ ${message}`);
}

/**
 * Format an info message
 */
export function formatInfo(message: string): string {
  return chalk.blue(`ℹ ${message}`);
}

/**
 * Format a header/title
 */
export function formatHeader(text: string): string {
  return chalk.bold.underline(text);
}

/**
 * Format a key-value pair for display
 */
export function formatKeyValue(key: string, value: unknown): string {
  const formattedValue =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `${chalk.dim(key + ':')} ${formattedValue}`;
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate that a required string argument is provided
 */
export function requireString(
  value: unknown,
  name: string
): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required and cannot be empty`);
  }
}

/**
 * Validate that a number is within range
 */
export function requireNumberInRange(
  value: unknown,
  name: string,
  min: number,
  max: number
): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${name} must be a valid number`);
  }
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
}

/**
 * Validate that a value is one of allowed options
 */
export function requireOneOf<T extends string>(
  value: unknown,
  name: string,
  allowedValues: readonly T[]
): asserts value is T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(
      `${name} must be one of: ${allowedValues.join(', ')}`
    );
  }
}

// ============================================
// Progress Indicators
// ============================================

/**
 * Simple spinner for CLI progress indication
 */
export class SimpleSpinner {
  private intervalHandle: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private readonly frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    if (this.intervalHandle) return;

    process.stdout.write(`${this.frames[0]} ${this.message}`);

    this.intervalHandle = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      process.stdout.write(
        `\r${this.frames[this.frameIndex]} ${this.message}`
      );
    }, 80);

    // Unref to allow process exit
    if (this.intervalHandle.unref) {
      this.intervalHandle.unref();
    }
  }

  stop(finalMessage?: string): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    // Clear the line and write final message
    process.stdout.write('\r\x1b[K');
    if (finalMessage) {
      console.log(finalMessage);
    }
  }

  updateMessage(message: string): void {
    this.message = message;
  }
}

/**
 * Create and start a spinner
 */
export function createSpinner(message: string): SimpleSpinner {
  const spinner = new SimpleSpinner(message);
  spinner.start();
  return spinner;
}
