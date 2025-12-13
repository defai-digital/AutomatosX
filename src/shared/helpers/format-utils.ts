/**
 * Format Utilities
 * Common formatting functions for human-readable display
 * @module shared/helpers/format-utils
 * @version 12.8.0
 *
 * This module consolidates duplicated formatting code from:
 * - src/cli/commands/status.ts
 * - src/cli/commands/analytics.ts
 * - src/cli/commands/provider-limits.ts
 * - src/mcp/tools/get-status.ts
 * - src/mcp/tools/memory-stats.ts
 */

/**
 * Format bytes to human-readable string
 * Examples: "0 B", "1.5 KB", "256 MB", "1.2 GB"
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);

  return `${(bytes / Math.pow(k, index)).toFixed(decimals)} ${sizes[index]}`;
}

/**
 * Format duration in milliseconds to human-readable string
 * For short durations (under 1 minute)
 * Examples: "150ms", "2.5s", "45.0s"
 *
 * @param ms - Duration in milliseconds
 * @returns Human-readable string
 */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

/**
 * Format duration in milliseconds to human-readable string
 * For longer durations (hours and minutes)
 * Examples: "< 1m", "45m", "2h 30m", "5h"
 *
 * @param ms - Duration in milliseconds
 * @returns Human-readable string
 */
export function formatDurationHuman(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return '< 1m';
}

/**
 * Format percentage with fixed decimals
 * Example: "75.5%"
 *
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format number with thousand separators
 * Example: 1234567 -> "1,234,567"
 *
 * @param num - Number to format
 * @returns Formatted string with separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format count with singular/plural label
 * Examples: "1 item", "5 items", "0 files"
 *
 * @param count - The count
 * @param singular - Singular form of the label
 * @param plural - Plural form (defaults to singular + 's')
 * @returns Formatted string
 */
export function formatCount(count: number, singular: string, plural?: string): string {
  const label = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${label}`;
}

/**
 * Format uptime in seconds to human-readable string
 * Examples: "30s", "5m", "2h 30m", "1h 5m 30s"
 *
 * @param seconds - Uptime in seconds
 * @returns Human-readable string
 */
export function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
