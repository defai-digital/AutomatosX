/**
 * Formatting Utilities
 *
 * Shared formatting functions for consistent display across the platform.
 *
 * @module @ax/schemas/format
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import {
  BYTES_PER_KB,
  BYTES_PER_MB,
  BYTES_PER_GB,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  MS_PER_WEEK,
} from './constants.js';

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  // Handle edge cases: NaN, Infinity, negative
  if (!Number.isFinite(bytes) || Number.isNaN(bytes)) {
    return '0 B';
  }
  if (bytes < 0) {
    return '0 B';
  }

  if (bytes < BYTES_PER_KB) return `${Math.round(bytes)} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  if (bytes < BYTES_PER_GB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  // Handle edge cases: NaN, Infinity, negative
  if (!Number.isFinite(ms) || Number.isNaN(ms) || ms < 0) {
    return '0ms';
  }

  if (ms < MS_PER_SECOND) return `${Math.round(ms)}ms`;
  if (ms < MS_PER_MINUTE) return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
  if (ms < MS_PER_HOUR) return `${Math.floor(ms / MS_PER_MINUTE)}m`;
  return `${Math.floor(ms / MS_PER_HOUR)}h`;
}

/**
 * Format duration with more detail (includes days and weeks)
 */
export function formatDurationLong(ms: number): string {
  if (ms < MS_PER_SECOND) return `${ms}ms`;
  if (ms < MS_PER_MINUTE) return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
  if (ms < MS_PER_HOUR) return `${Math.floor(ms / MS_PER_MINUTE)}m ${Math.floor((ms % MS_PER_MINUTE) / MS_PER_SECOND)}s`;
  if (ms < MS_PER_DAY) return `${Math.floor(ms / MS_PER_HOUR)}h ${Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE)}m`;
  if (ms < MS_PER_WEEK) return `${Math.floor(ms / MS_PER_DAY)}d ${Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR)}h`;
  return `${Math.floor(ms / MS_PER_WEEK)}w ${Math.floor((ms % MS_PER_WEEK) / MS_PER_DAY)}d`;
}

/**
 * Format a date relative to now (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 0) {
    return 'in the future';
  }

  if (diffMs < MS_PER_MINUTE) {
    return 'just now';
  }

  if (diffMs < MS_PER_HOUR) {
    const mins = Math.floor(diffMs / MS_PER_MINUTE);
    return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  }

  if (diffMs < MS_PER_DAY) {
    const hours = Math.floor(diffMs / MS_PER_HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  if (diffMs < MS_PER_WEEK) {
    const days = Math.floor(diffMs / MS_PER_DAY);
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
  }

  const weeks = Math.floor(diffMs / MS_PER_WEEK);
  if (weeks === 1) return 'last week';
  if (weeks < 4) return `${weeks} weeks ago`;

  // Fall back to date string for older dates
  return date.toLocaleDateString();
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Truncate ID (typically UUIDs) to a short display form
 */
export function truncateId(id: string, length = 8): string {
  return id.slice(0, length);
}
