import type { CommandResult } from '../types.js';

/**
 * Build a success command result.
 */
export function success(message: string, data: unknown = undefined): CommandResult {
  return {
    success: true,
    message,
    data,
    exitCode: 0,
  };
}

/**
 * Build a failure command result.
 */
export function failure(message: string, data: unknown = undefined): CommandResult {
  return {
    success: false,
    message,
    data,
    exitCode: 1,
  };
}

/**
 * Build a failure command result from an error.
 */
export function failureFromError(action: string, error: unknown): CommandResult {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return failure(`Failed to ${action}: ${message}`, stack !== undefined ? { stack } : undefined);
}

/**
 * Build a usage error command result.
 */
export function usageError(usage: string): CommandResult {
  return failure(`Usage: ${usage}`);
}

