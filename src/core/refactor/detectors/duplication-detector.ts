/**
 * Duplication Detector
 * Detects duplicate code blocks and similar patterns
 * @module core/refactor/detectors/duplication-detector
 * @version 12.7.0
 */

import type {
  RefactorFinding,
  RefactorRule,
  RefactorConfig,
  RefactorIgnoreState,
} from '../types.js';
import { createFinding } from '../refactor-detector.js';

// ============================================================================
// Detection Rules
// ============================================================================

export const DUPLICATION_RULES: RefactorRule[] = [
  {
    id: 'exact-duplicate-block',
    type: 'duplication',
    description: 'Exact duplicate code block found',
    detector: 'token_hash',
    severity: 'high',
    confidence: 0.95,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Extract to a shared function',
  },
  {
    id: 'near-duplicate-block',
    type: 'duplication',
    description: 'Near-duplicate code block (>85% similar)',
    detector: 'token_hash',
    severity: 'medium',
    confidence: 0.8,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Consider extracting to a parameterized function',
  },
  {
    id: 'repeated-conditional',
    type: 'duplication',
    description: 'Same conditional check repeated multiple times',
    detector: 'regex',
    severity: 'medium',
    confidence: 0.85,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Extract to a variable or early return',
  },
  {
    id: 'duplicate-string-literal',
    type: 'duplication',
    description: 'Same string literal used multiple times',
    detector: 'regex',
    severity: 'low',
    confidence: 0.7,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Extract to a named constant',
  },
];

// ============================================================================
// Detector Function
// ============================================================================

export function detectDuplication(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState,
  _config: RefactorConfig
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Detect duplicate code blocks
  findings.push(...detectDuplicateBlocks(filePath, content, lines, ignoreState));

  // Detect repeated conditionals
  findings.push(...detectRepeatedConditionals(filePath, content, lines, ignoreState));

  // Detect duplicate string literals
  findings.push(...detectDuplicateStrings(filePath, content, lines, ignoreState));

  return findings;
}

// ============================================================================
// Individual Detectors
// ============================================================================

/**
 * Detect duplicate code blocks using token-based hashing
 */
function detectDuplicateBlocks(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const MIN_BLOCK_SIZE = 4; // Minimum lines to consider as a block
  const blockHashes = new Map<string, Array<{ start: number; end: number }>>();

  // Normalize lines for comparison
  const normalizedLines = lines.map((line) =>
    line
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/['"`][^'"`]*['"`]/g, 'STRING')
      .replace(/\b\d+\b/g, 'NUM')
  );

  // Find duplicate blocks
  for (let i = 0; i <= normalizedLines.length - MIN_BLOCK_SIZE; i++) {
    if (shouldIgnoreLine(i + 1, 'duplication', ignoreState)) continue;

    // Skip empty or trivial lines
    const normalizedLine = normalizedLines[i];
    if (!normalizedLine || normalizedLine.length < 5) continue;

    // Create hash for block
    const blockLines = normalizedLines.slice(i, i + MIN_BLOCK_SIZE);
    const blockHash = blockLines.join('\n');

    // Skip blocks that are mostly braces/punctuation
    const contentChars = blockHash.replace(/[{}();,\s]/g, '');
    if (contentChars.length < 20) continue;

    if (!blockHashes.has(blockHash)) {
      blockHashes.set(blockHash, []);
    }
    blockHashes.get(blockHash)!.push({ start: i + 1, end: i + MIN_BLOCK_SIZE });
  }

  // Report duplicates
  for (const [_hash, locations] of blockHashes) {
    if (locations.length > 1) {
      // Only report the second occurrence onward
      for (let i = 1; i < locations.length; i++) {
        const loc = locations[i];
        const firstLoc = locations[0];
        if (loc === undefined || firstLoc === undefined) continue;

        findings.push(
          createFinding(
            filePath,
            loc.start,
            loc.end,
            'duplication',
            'high',
            `Duplicate code block (first occurrence at line ${firstLoc.start})`,
            lines.slice(loc.start - 1, loc.end).join('\n'),
            'exact-duplicate-block',
            0.95,
            'static',
            'Extract to a shared function to avoid duplication',
            { duplication: MIN_BLOCK_SIZE, linesRemoved: MIN_BLOCK_SIZE - 2 }
          )
        );
      }
    }
  }

  return findings;
}

/**
 * Detect the same conditional being checked multiple times
 */
function detectRepeatedConditionals(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const conditionalCounts = new Map<string, Array<number>>();

  // Pattern for if conditions
  const conditionPattern = /if\s*\(([^)]+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'duplication', ignoreState)) continue;

    let match;
    while ((match = conditionPattern.exec(line)) !== null) {
      const matchedCondition = match[1];
      if (matchedCondition === undefined) continue;
      const condition = matchedCondition
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/['"`][^'"`]*['"`]/g, 'STRING');

      // Skip simple conditions
      if (condition.length < 10) continue;

      if (!conditionalCounts.has(condition)) {
        conditionalCounts.set(condition, []);
      }
      conditionalCounts.get(condition)!.push(lineNum);
    }
    conditionPattern.lastIndex = 0;
  }

  // Report repeated conditionals
  for (const [_condition, lineNums] of conditionalCounts) {
    if (lineNums.length >= 2) {
      // Report on second occurrence
      const firstLine = lineNums[0];
      const secondLine = lineNums[1];
      if (firstLine === undefined || secondLine === undefined) continue;

      findings.push(
        createFinding(
          filePath,
          secondLine,
          secondLine,
          'duplication',
          'medium',
          `Same conditional repeated ${lineNums.length} times (first at line ${firstLine})`,
          lines[secondLine - 1] ?? '',
          'repeated-conditional',
          0.85,
          'static',
          'Extract condition to a variable: const isValid = ...; or use early return',
          { duplication: lineNums.length }
        )
      );
    }
  }

  return findings;
}

/**
 * Detect duplicate string literals
 */
function detectDuplicateStrings(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const stringCounts = new Map<string, Array<number>>();

  // Pattern for string literals (longer than 10 chars)
  const stringPattern = /(['"`])([^'"`]{10,})\1/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'duplication', ignoreState)) continue;

    // Skip imports and requires
    if (/import\s+/.test(line) || /require\s*\(/.test(line)) continue;

    // Skip comments
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

    let match;
    while ((match = stringPattern.exec(line)) !== null) {
      const stringValue = match[2];
      if (stringValue === undefined) continue;

      // Skip common acceptable duplicates
      if (/^[a-zA-Z_]+$/.test(stringValue)) continue; // Single words
      if (/^\d+$/.test(stringValue)) continue; // Numbers
      if (/^\//.test(stringValue)) continue; // Paths/routes (often intentionally duplicated)

      if (!stringCounts.has(stringValue)) {
        stringCounts.set(stringValue, []);
      }
      stringCounts.get(stringValue)!.push(lineNum);
    }
    stringPattern.lastIndex = 0;
  }

  // Report duplicated strings
  for (const [stringValue, lineNums] of stringCounts) {
    if (lineNums.length >= 3) {
      const secondOccurrence = lineNums[1];
      if (secondOccurrence === undefined) continue;
      // Only report if used 3+ times
      findings.push(
        createFinding(
          filePath,
          secondOccurrence, // Second occurrence
          secondOccurrence,
          'duplication',
          'low',
          `String literal repeated ${lineNums.length} times: "${stringValue.substring(0, 30)}..."`,
          lines[secondOccurrence - 1] ?? '',
          'duplicate-string-literal',
          0.7,
          'static',
          'Extract to a named constant: const MESSAGE = "...";',
          { duplication: lineNums.length }
        )
      );
    }
  }

  return findings;
}

// ============================================================================
// Utilities
// ============================================================================

function shouldIgnoreLine(
  lineNum: number,
  type: 'duplication',
  ignoreState: RefactorIgnoreState
): boolean {
  if (ignoreState.ignoreAllLines.has(lineNum)) return true;

  const typeIgnores = ignoreState.ignoreTypeLines.get(lineNum);
  if (typeIgnores?.has(type)) return true;

  for (const block of ignoreState.ignoreBlocks) {
    if (lineNum >= block.start && lineNum <= block.end) return true;
  }

  return false;
}
