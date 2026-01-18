/**
 * Shared formatting utilities for CLI commands
 *
 * Centralizes common display formatting to avoid duplication.
 */

import {
  SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR,
  SECONDS_PER_DAY,
} from '@defai.digital/contracts';

/** Milliseconds per second */
const MS_PER_SECOND = 1000;

/** Milliseconds per minute */
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;

/** Milliseconds per hour */
const MS_PER_HOUR = SECONDS_PER_HOUR * MS_PER_SECOND;

/** Milliseconds per day */
const MS_PER_DAY = SECONDS_PER_DAY * MS_PER_SECOND;

/**
 * Formats a duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < MS_PER_SECOND) return `${ms}ms`;
  if (ms < MS_PER_MINUTE) return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
  const minutes = Math.floor(ms / MS_PER_MINUTE);
  const seconds = Math.floor((ms % MS_PER_MINUTE) / MS_PER_SECOND);
  return `${minutes}m ${seconds}s`;
}

/**
 * Formats bytes to human-readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/**
 * Formats an ISO date string to relative age (e.g., "5m ago", "2h ago", "3d ago")
 */
export function formatAge(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / MS_PER_MINUTE);
  const hours = Math.floor(diffMs / MS_PER_HOUR);
  const days = Math.floor(diffMs / MS_PER_DAY);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Truncates a string to max length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Pads a string to a fixed width (for aligned output)
 */
export function padEnd(str: string, width: number): string {
  return str.padEnd(width);
}

// ============================================================================
// CommandResult Builders - Reduce duplication across CLI commands
// ============================================================================

import type { CommandResult } from '../types.js';

/**
 * Creates a success CommandResult
 */
export function success(message: string, data?: unknown): CommandResult {
  return { success: true, message, data, exitCode: 0 };
}

/**
 * Creates a success CommandResult with JSON data (for --format json)
 */
export function successJson(data: unknown): CommandResult {
  return { success: true, message: undefined, data, exitCode: 0 };
}

/**
 * Creates a failure CommandResult
 */
export function failure(message: string, exitCode = 1): CommandResult {
  return { success: false, message, data: undefined, exitCode };
}

/**
 * Creates a failure CommandResult from an error
 */
export function failureFromError(action: string, error: unknown): CommandResult {
  const msg = error instanceof Error ? error.message : String(error);
  return failure(`Failed to ${action}: ${msg}`);
}

/**
 * Creates a usage error CommandResult
 */
export function usageError(usage: string): CommandResult {
  return failure(`Usage: ${usage}`);
}

/**
 * Formats a list with header and separator for CLI display
 */
export function formatList<T>(
  items: T[],
  columns: { header: string; width: number; getValue: (item: T) => string }[]
): string {
  const header = columns.map(c => c.header.padEnd(c.width)).join(' | ');
  const separator = '-'.repeat(header.length);
  const rows = items.map(item =>
    columns.map(c => truncate(c.getValue(item), c.width).padEnd(c.width)).join(' | ')
  );
  return [header, separator, ...rows].join('\n');
}
