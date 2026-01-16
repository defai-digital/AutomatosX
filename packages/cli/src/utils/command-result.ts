/**
 * Command Result Utilities
 *
 * Factory functions for creating consistent CommandResult objects.
 * Reduces boilerplate and ensures consistent response structure.
 */

import type { CommandResult } from '../types.js';

/**
 * Create a successful command result
 */
export function success(data?: unknown, message?: string): CommandResult {
  return {
    success: true,
    exitCode: 0,
    message,
    data,
  };
}

/**
 * Create a failed command result
 */
export function failure(message: string, data?: unknown): CommandResult {
  return {
    success: false,
    exitCode: 1,
    message,
    data,
  };
}

/**
 * Create a failed command result with custom exit code
 */
export function failureWithCode(
  message: string,
  exitCode: number,
  data?: unknown
): CommandResult {
  return {
    success: false,
    exitCode,
    message,
    data,
  };
}
