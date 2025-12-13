/**
 * Shared Detector Utilities
 * Common functions used across all refactoring detectors
 * @module core/refactor/detectors/detector-utils
 * @version 12.8.0
 *
 * This module consolidates duplicated code from:
 * - dead-code-detector.ts
 * - naming-detector.ts
 * - conditionals-detector.ts
 * - duplication-detector.ts
 * - performance-detector.ts
 * - hardcode-detector.ts
 * - type-safety-detector.ts
 * - readability-detector.ts
 */

import type { RefactorIgnoreState, RefactorType } from '../types.js';

/**
 * Check if a line should be ignored for a specific refactor type
 *
 * Handles three types of ignores:
 * 1. `ax-ignore` - ignores all checks on this line
 * 2. `ax-ignore <type>` - ignores specific type on this line
 * 3. `ax-ignore-start/end` - block ignores
 *
 * @param lineNum - 1-indexed line number
 * @param type - The refactor type being checked
 * @param ignoreState - Current ignore state from parsing
 * @returns true if the line should be ignored
 */
export function shouldIgnoreLine(
  lineNum: number,
  type: RefactorType,
  ignoreState: RefactorIgnoreState
): boolean {
  // Check if line is in the global ignore set
  if (ignoreState.ignoreAllLines.has(lineNum)) return true;

  // Check if line has type-specific ignores
  const typeIgnores = ignoreState.ignoreTypeLines.get(lineNum);
  if (typeIgnores?.has(type)) return true;

  // Check if line is within an ignore block
  for (const block of ignoreState.ignoreBlocks) {
    if (lineNum >= block.start && lineNum <= block.end) return true;
  }

  return false;
}

/**
 * Escape special regex characters in a string
 *
 * Used when building regex patterns from user-provided or dynamic strings
 * to prevent regex injection or unexpected behavior.
 *
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get the line number from a character offset in content
 *
 * @param content - Full file content
 * @param offset - Character offset
 * @returns 1-indexed line number
 */
export function getLineNumberFromOffset(content: string, offset: number): number {
  return content.substring(0, offset).split('\n').length;
}

/**
 * Safely get a line from the lines array
 *
 * @param lines - Array of lines
 * @param index - 0-indexed line index
 * @returns Line content or empty string if out of bounds
 */
export function getLine(lines: string[], index: number): string {
  return lines[index] ?? '';
}

/**
 * Check if a line is a comment or empty
 *
 * @param line - Line content
 * @returns true if line is a comment or empty
 */
export function isCommentOrEmpty(line: string): boolean {
  const trimmed = line.trim();
  return !trimmed ||
         trimmed.startsWith('//') ||
         trimmed.startsWith('/*') ||
         trimmed.startsWith('*');
}

/**
 * Calculate cyclomatic complexity for a function/method
 * McCabe complexity = E - N + 2P where E=edges, N=nodes, P=connected components
 * Simplified: count decision points + 1
 *
 * @param code - Code string to analyze
 * @returns Cyclomatic complexity score
 */
export function calculateCyclomaticComplexity(code: string): number {
  // Count decision points
  const decisionPatterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bwhile\s*\(/g,
    /\bfor\s*\(/g,
    /\bcase\s+[^:]+:/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:]+\s*:/g, // Ternary
    /&&/g,
    /\|\|/g,
    /\?\?/g, // Nullish coalescing
  ];

  let complexity = 1; // Base complexity

  for (const pattern of decisionPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}
