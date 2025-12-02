/**
 * Cross-platform path utility functions
 *
 * This module provides utilities for handling file paths consistently
 * across different operating systems (Windows, macOS, Linux).
 *
 * @module path-utils
 * @since 5.6.4
 */

import path from 'node:path';
import os from 'node:os';
import { realpath } from 'node:fs/promises';

/**
 * Normalize path separators to forward slashes (for display and logging)
 *
 * This function converts all path separators to forward slashes, which is
 * useful for consistent display across platforms and for comparison in tests.
 *
 * @example
 * // Windows
 * normalizePath('C:\\Users\\foo\\bar') // => 'C:/Users/foo/bar'
 *
 * // Unix
 * normalizePath('/Users/foo/bar') // => '/Users/foo/bar'
 *
 * @param filePath - The path to normalize
 * @returns Path with forward slashes
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return filePath;
  // Replace all backslashes with forward slashes
  // This works consistently across all platforms
  return filePath.replace(/\\/g, '/');
}

/**
 * Convert path to platform-native format (for filesystem operations)
 *
 * This function normalizes the path to use the platform's native separator,
 * which is necessary for filesystem operations.
 *
 * @example
 * // Windows
 * platformPath('foo/bar/baz') // => 'foo\\bar\\baz'
 *
 * // Unix
 * platformPath('foo/bar/baz') // => 'foo/bar/baz'
 *
 * @param filePath - The path to convert
 * @returns Path with platform-native separators
 */
export function platformPath(filePath: string): string {
  if (!filePath) return filePath;
  return path.normalize(filePath);
}

/**
 * Compare two paths for equality (ignoring separator differences)
 *
 * This function compares two paths by normalizing both to forward slashes
 * and then comparing case-insensitively on Windows.
 *
 * @example
 * // Windows
 * pathsEqual('foo/bar', 'foo\\bar') // => true
 * pathsEqual('Foo/Bar', 'foo/bar') // => true
 *
 * // Unix
 * pathsEqual('foo/bar', 'foo/bar') // => true
 * pathsEqual('Foo/Bar', 'foo/bar') // => false
 *
 * @param path1 - First path to compare
 * @param path2 - Second path to compare
 * @returns True if paths are equal
 */
export function pathsEqual(path1: string, path2: string): boolean {
  // Handle null/undefined/empty cases
  if (!path1 || !path2) {
    return path1 === path2;
  }

  const normalized1 = normalizePath(path1);
  const normalized2 = normalizePath(path2);

  // Windows is case-insensitive
  if (isWindows()) {
    return normalized1.toLowerCase() === normalized2.toLowerCase();
  }

  return normalized1 === normalized2;
}

/**
 * Check if a path contains a segment (cross-platform)
 *
 * This function checks if a full path contains a specific segment,
 * normalizing both paths before comparison.
 *
 * @example
 * // Windows
 * pathContains('C:\\foo\\bar\\baz', 'bar/baz') // => true
 *
 * // Unix
 * pathContains('/foo/bar/baz', 'bar/baz') // => true
 *
 * @param fullPath - The full path to search in
 * @param segment - The segment to search for
 * @returns True if the segment is found
 */
export function pathContains(fullPath: string, segment: string): boolean {
  // Handle null/undefined/empty cases
  if (!segment) return true; // Empty segment is always contained
  if (!fullPath) return false; // Empty path cannot contain non-empty segment

  const normalizedFull = normalizePath(fullPath);
  const normalizedSegment = normalizePath(segment);

  // Windows is case-insensitive
  if (isWindows()) {
    return normalizedFull.toLowerCase().includes(normalizedSegment.toLowerCase());
  }

  return normalizedFull.includes(normalizedSegment);
}

/**
 * Get relative path from one location to another (normalized for display)
 *
 * This function calculates the relative path and normalizes it to use
 * forward slashes for consistent display.
 *
 * @example
 * getRelativePath('/foo/bar', '/foo/baz') // => '../baz'
 *
 * @param from - Starting path
 * @param to - Target path
 * @returns Normalized relative path
 */
export function getRelativePath(from: string, to: string): string {
  const relativePath = path.relative(from, to);
  return normalizePath(relativePath);
}

/**
 * Detect if the current platform is Windows
 *
 * @example
 * isWindows() // => true on Windows, false on Unix
 *
 * @returns True if running on Windows
 */
export function isWindows(): boolean {
  return os.platform() === 'win32';
}

/**
 * Check if a path is absolute (cross-platform)
 *
 * This is a wrapper around Node.js path.isAbsolute() which correctly handles
 * all platform-specific absolute path formats including:
 * - Unix: /foo/bar
 * - Windows Drive: C:\foo\bar or C:/foo/bar
 * - Windows UNC: \\server\share or //server/share
 *
 * @example
 * isAbsolutePath('/foo/bar') // => true (Unix)
 * isAbsolutePath('C:/foo/bar') // => true (Windows)
 * isAbsolutePath('//server/share') // => true (Windows UNC)
 * isAbsolutePath('foo/bar') // => false (relative)
 *
 * @param filePath - The path to check
 * @returns True if the path is absolute
 */
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

/**
 * Expand Windows short path names (8.3 format) to full paths
 *
 * Windows uses short path names (like PROGRA~1) for compatibility.
 * This function expands them to full names.
 *
 * @example
 * // Windows
 * await expandShortPath('C:\\PROGRA~1\\') // => 'C:\\Program Files\\'
 *
 * // Unix (no-op)
 * await expandShortPath('/usr/bin') // => '/usr/bin'
 *
 * @param shortPath - Path potentially containing short names
 * @returns Expanded path, or original if not on Windows or if expansion fails
 */
export async function expandShortPath(shortPath: string): Promise<string> {
  if (!shortPath) return shortPath;
  if (!isWindows()) return shortPath;

  try {
    // realpath resolves short paths to full paths on Windows
    const expandedPath = await realpath(shortPath);
    return expandedPath;
  } catch (error) {
    // If realpath fails (e.g., path doesn't exist), return original
    return shortPath;
  }
}

/**
 * Expand Windows short path names synchronously
 *
 * Synchronous version of expandShortPath. Use sparingly as it blocks.
 *
 * @param shortPath - Path potentially containing short names
 * @returns Expanded path, or original if not on Windows or if expansion fails
 */
export function expandShortPathSync(shortPath: string): string {
  if (!shortPath) return shortPath;
  if (!isWindows()) return shortPath;

  try {
    const { realpathSync } = require('node:fs');
    const expandedPath = realpathSync(shortPath);
    return expandedPath;
  } catch (error) {
    return shortPath;
  }
}

/**
 * Join path segments and normalize to platform format
 *
 * This is a wrapper around path.join that ensures the result
 * is in platform-native format.
 *
 * @example
 * joinPath('foo', 'bar', 'baz.txt') // => 'foo/bar/baz.txt' (Unix)
 * joinPath('foo', 'bar', 'baz.txt') // => 'foo\\bar\\baz.txt' (Windows)
 *
 * @param segments - Path segments to join
 * @returns Joined path in platform format
 */
export function joinPath(...segments: string[]): string {
  return path.join(...segments);
}

/**
 * Join path segments and normalize to display format (forward slashes)
 *
 * Similar to joinPath but normalizes to forward slashes for display.
 *
 * @example
 * joinPathDisplay('foo', 'bar', 'baz.txt') // => 'foo/bar/baz.txt' (all platforms)
 *
 * @param segments - Path segments to join
 * @returns Joined path with forward slashes
 */
export function joinPathDisplay(...segments: string[]): string {
  const joined = path.join(...segments);
  return normalizePath(joined);
}

/**
 * Resolve path segments to an absolute path
 *
 * This is a wrapper around path.resolve.
 *
 * @param segments - Path segments to resolve
 * @returns Absolute path
 */
export function resolvePath(...segments: string[]): string {
  return path.resolve(...segments);
}

/**
 * Get the directory name from a path
 *
 * This is a wrapper around path.dirname.
 *
 * @param filePath - The file path
 * @returns Directory name
 */
export function dirname(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Get the base name from a path
 *
 * This is a wrapper around path.basename.
 *
 * @param filePath - The file path
 * @param ext - Optional extension to remove
 * @returns Base name
 */
export function basename(filePath: string, ext?: string): string {
  return path.basename(filePath, ext);
}

/**
 * Get the file extension from a path
 *
 * This is a wrapper around path.extname.
 *
 * @param filePath - The file path
 * @returns File extension (including the dot)
 */
export function extname(filePath: string): string {
  return path.extname(filePath);
}
