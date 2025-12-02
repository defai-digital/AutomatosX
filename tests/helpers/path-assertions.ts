/**
 * Test helper for path-related assertions
 *
 * Provides custom assertion functions for testing path operations
 * across different platforms (Windows, macOS, Linux)
 *
 * @module tests/helpers/path-assertions
 * @since 5.7.0
 */

import { expect } from 'vitest';
import { normalizePath, pathsEqual, pathContains } from '../../src/utils/path-utils.js';

/**
 * Assert that two paths are equal (ignoring separator differences)
 *
 * @example
 * expectPathsToBeEqual('/foo/bar', '/foo\\bar');  // passes
 * expectPathsToBeEqual('/foo/bar', '/foo/baz');   // fails
 *
 * @param actual - Actual path
 * @param expected - Expected path
 */
export function expectPathsToBeEqual(actual: string, expected: string): void {
  const normalizedActual = normalizePath(actual);
  const normalizedExpected = normalizePath(expected);

  expect(
    pathsEqual(actual, expected),
    `Expected paths to be equal:\n` +
      `  Actual:   ${normalizedActual}\n` +
      `  Expected: ${normalizedExpected}`
  ).toBe(true);
}

/**
 * Assert that two paths are NOT equal
 *
 * @example
 * expectPathsToNotBeEqual('/foo/bar', '/foo/baz');  // passes
 * expectPathsToNotBeEqual('/foo/bar', '/foo\\bar'); // fails
 *
 * @param actual - Actual path
 * @param notExpected - Path that should not match
 */
export function expectPathsToNotBeEqual(actual: string, notExpected: string): void {
  const normalizedActual = normalizePath(actual);
  const normalizedNotExpected = normalizePath(notExpected);

  expect(
    pathsEqual(actual, notExpected),
    `Expected paths to NOT be equal:\n` +
      `  Actual:       ${normalizedActual}\n` +
      `  Not Expected: ${normalizedNotExpected}`
  ).toBe(false);
}

/**
 * Assert that a path contains a specific segment
 *
 * @example
 * expectPathToContain('/foo/bar/baz', 'bar/baz');   // passes
 * expectPathToContain('/foo/bar/baz', 'qux');       // fails
 *
 * @param fullPath - Full path to search in
 * @param segment - Segment to search for
 */
export function expectPathToContain(fullPath: string, segment: string): void {
  const normalizedFull = normalizePath(fullPath);
  const normalizedSegment = normalizePath(segment);

  expect(
    pathContains(fullPath, segment),
    `Expected path to contain segment:\n` +
      `  Path:    ${normalizedFull}\n` +
      `  Segment: ${normalizedSegment}`
  ).toBe(true);
}

/**
 * Assert that a path does NOT contain a specific segment
 *
 * @example
 * expectPathToNotContain('/foo/bar/baz', 'qux');    // passes
 * expectPathToNotContain('/foo/bar/baz', 'bar');    // fails
 *
 * @param fullPath - Full path to search in
 * @param segment - Segment that should not be found
 */
export function expectPathToNotContain(fullPath: string, segment: string): void {
  const normalizedFull = normalizePath(fullPath);
  const normalizedSegment = normalizePath(segment);

  expect(
    pathContains(fullPath, segment),
    `Expected path to NOT contain segment:\n` +
      `  Path:    ${normalizedFull}\n` +
      `  Segment: ${normalizedSegment}`
  ).toBe(false);
}

/**
 * Assert that a path uses forward slashes (normalized)
 *
 * @example
 * expectPathToBeNormalized('/foo/bar');     // passes
 * expectPathToBeNormalized('C:\\foo\\bar'); // fails
 *
 * @param path - Path to check
 */
export function expectPathToBeNormalized(path: string): void {
  expect(
    path,
    `Expected path to use forward slashes:\n  Path: ${path}`
  ).not.toContain('\\');
}

/**
 * Assert that a path starts with a specific prefix
 *
 * @example
 * expectPathToStartWith('/foo/bar/baz', '/foo/bar');  // passes
 * expectPathToStartWith('/foo/bar/baz', '/qux');      // fails
 *
 * @param path - Path to check
 * @param prefix - Expected prefix
 */
export function expectPathToStartWith(path: string, prefix: string): void {
  const normalizedPath = normalizePath(path);
  const normalizedPrefix = normalizePath(prefix);

  expect(
    normalizedPath.startsWith(normalizedPrefix),
    `Expected path to start with prefix:\n` +
      `  Path:   ${normalizedPath}\n` +
      `  Prefix: ${normalizedPrefix}`
  ).toBe(true);
}

/**
 * Assert that a path ends with a specific suffix
 *
 * @example
 * expectPathToEndWith('/foo/bar/baz.txt', 'baz.txt');  // passes
 * expectPathToEndWith('/foo/bar/baz.txt', 'qux.txt');  // fails
 *
 * @param path - Path to check
 * @param suffix - Expected suffix
 */
export function expectPathToEndWith(path: string, suffix: string): void {
  const normalizedPath = normalizePath(path);
  const normalizedSuffix = normalizePath(suffix);

  expect(
    normalizedPath.endsWith(normalizedSuffix),
    `Expected path to end with suffix:\n` +
      `  Path:   ${normalizedPath}\n` +
      `  Suffix: ${normalizedSuffix}`
  ).toBe(true);
}

/**
 * Assert that a path is absolute
 *
 * @example
 * expectPathToBeAbsolute('/foo/bar');         // passes (Unix)
 * expectPathToBeAbsolute('C:/foo/bar');       // passes (Windows)
 * expectPathToBeAbsolute('//server/share');   // passes (Windows UNC)
 * expectPathToBeAbsolute('foo/bar');          // fails
 *
 * @param path - Path to check
 */
export function expectPathToBeAbsolute(path: string): void {
  const normalizedPath = normalizePath(path);
  const isAbsolute =
    normalizedPath.startsWith('/') || // Unix absolute path
    /^[A-Z]:/i.test(normalizedPath) || // Windows absolute path (C:, D:, etc.)
    normalizedPath.startsWith('//'); // Windows UNC path (after normalization)

  expect(
    isAbsolute,
    `Expected path to be absolute:\n  Path: ${normalizedPath}`
  ).toBe(true);
}

/**
 * Assert that a path is relative
 *
 * @example
 * expectPathToBeRelative('foo/bar');          // passes
 * expectPathToBeRelative('../foo/bar');       // passes
 * expectPathToBeRelative('/foo/bar');         // fails
 * expectPathToBeRelative('C:/foo/bar');       // fails
 * expectPathToBeRelative('//server/share');   // fails (Windows UNC)
 *
 * @param path - Path to check
 */
export function expectPathToBeRelative(path: string): void {
  const normalizedPath = normalizePath(path);
  const isAbsolute =
    normalizedPath.startsWith('/') || // Unix absolute path
    /^[A-Z]:/i.test(normalizedPath) || // Windows absolute path (C:, D:, etc.)
    normalizedPath.startsWith('//'); // Windows UNC path (after normalization)

  expect(
    isAbsolute,
    `Expected path to be relative:\n  Path: ${normalizedPath}`
  ).toBe(false);
}

/**
 * Assert that multiple paths are all equal to each other
 *
 * @example
 * expectPathsToAllBeEqual([
 *   '/foo/bar',
 *   '/foo\\bar',
 *   'C:/foo/bar'  // only on Windows
 * ]);
 *
 * @param paths - Array of paths to compare
 */
export function expectPathsToAllBeEqual(paths: string[]): void {
  if (paths.length < 2) {
    throw new Error('expectPathsToAllBeEqual requires at least 2 paths');
  }

  const [first, ...rest] = paths;
  if (!first) {
    throw new Error('First path is undefined');
  }
  const normalizedFirst = normalizePath(first);

  for (const path of rest) {
    if (!path) {
      throw new Error('Path in rest is undefined');
    }
    const normalizedPath = normalizePath(path);
    expect(
      pathsEqual(first, path),
      `Expected all paths to be equal:\n` +
        `  First: ${normalizedFirst}\n` +
        `  Path:  ${normalizedPath}`
    ).toBe(true);
  }
}
