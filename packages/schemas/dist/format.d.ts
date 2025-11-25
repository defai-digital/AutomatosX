/**
 * Formatting Utilities
 *
 * Shared formatting functions for consistent display across the platform.
 *
 * @module @ax/schemas/format
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Format bytes to human-readable string
 */
declare function formatBytes(bytes: number): string;
/**
 * Format duration in milliseconds to human-readable string
 */
declare function formatDuration(ms: number): string;
/**
 * Format duration with more detail (includes days and weeks)
 */
declare function formatDurationLong(ms: number): string;
/**
 * Format a date relative to now (e.g., "2 hours ago", "yesterday")
 */
declare function formatRelativeTime(date: Date): string;
/**
 * Truncate string with ellipsis
 */
declare function truncate(str: string, maxLength: number): string;
/**
 * Truncate ID (typically UUIDs) to a short display form
 */
declare function truncateId(id: string, length?: number): string;

export { formatBytes, formatDuration, formatDurationLong, formatRelativeTime, truncate, truncateId };
