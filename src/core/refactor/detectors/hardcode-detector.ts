/**
 * Hardcode Detector
 * Detects hard-coded values that should be constants or configuration
 * @module core/refactor/detectors/hardcode-detector
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

export const HARDCODE_RULES: RefactorRule[] = [
  {
    id: 'magic-number',
    type: 'hardcoded_values',
    description: 'Magic number should be a named constant',
    pattern: /(?<![a-zA-Z_\d.])(?:0x[0-9a-fA-F]+|\d{2,})(?![a-zA-Z_\d])/,
    negativePatterns: [
      /(?:const|let|var)\s+[A-Z_][A-Z0-9_]*\s*=/, // Already a constant
      /^\s*\/\//, // Comment
      /import\s+.*from/, // Import statement
      /:\s*\d+/, // Port number in type annotation
    ],
    detector: 'regex',
    severity: 'low',
    confidence: 0.7,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Extract to a named constant',
  },
  {
    id: 'hardcoded-url',
    type: 'hardcoded_values',
    description: 'URL should be configurable',
    pattern: /['"`]https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^'"`]+['"`]/,
    detector: 'regex',
    severity: 'medium',
    confidence: 0.85,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Move URL to environment variable or config file',
  },
  {
    id: 'hardcoded-path',
    type: 'hardcoded_values',
    description: 'Absolute path should be configurable',
    pattern: /['"`]\/(?:Users|home|var|etc|tmp|opt)\/[^'"`]+['"`]/,
    detector: 'regex',
    severity: 'high',
    confidence: 0.9,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Use path.join() with configurable base path',
  },
  {
    id: 'hardcoded-credentials',
    type: 'hardcoded_values',
    description: 'Potential credentials should not be hardcoded',
    pattern: /(?:password|secret|api_?key|token|auth)\s*[:=]\s*['"`][^'"`]{8,}['"`]/i,
    detector: 'regex',
    severity: 'critical',
    confidence: 0.95,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Move to environment variable or secrets manager',
  },
  {
    id: 'hardcoded-port',
    type: 'hardcoded_values',
    description: 'Port number should be configurable',
    pattern: /(?:port|PORT)\s*[:=]\s*(\d{4,5})/,
    detector: 'regex',
    severity: 'low',
    confidence: 0.75,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Use environment variable (process.env.PORT)',
  },
  {
    id: 'hardcoded-timeout',
    type: 'hardcoded_values',
    description: 'Timeout value should be configurable',
    pattern: /timeout\s*[:=]\s*\d{4,}/i,
    detector: 'regex',
    severity: 'low',
    confidence: 0.7,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Extract timeout to a named constant or config',
  },
];

// ============================================================================
// Detector Function
// ============================================================================

export function detectHardcode(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState,
  config: RefactorConfig
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Detect magic numbers
  findings.push(...detectMagicNumbers(filePath, content, lines, ignoreState));

  // Detect hardcoded URLs
  findings.push(...detectHardcodedUrls(filePath, content, lines, ignoreState));

  // Detect hardcoded paths
  findings.push(...detectHardcodedPaths(filePath, content, lines, ignoreState));

  // Detect potential credentials
  findings.push(...detectHardcodedCredentials(filePath, content, lines, ignoreState));

  // Detect hardcoded ports
  findings.push(...detectHardcodedPorts(filePath, content, lines, ignoreState));

  // Detect hardcoded timeouts
  findings.push(...detectHardcodedTimeouts(filePath, content, lines, ignoreState));

  return findings;
}

// ============================================================================
// Individual Detectors
// ============================================================================

function detectMagicNumbers(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Common acceptable numbers
  const acceptableNumbers = new Set([
    '0', '1', '2', '-1', '10', '100', '1000',
    '24', '60', '365', // Time constants
    '16', '32', '64', '128', '256', '512', '1024', // Powers of 2
  ]);

  // Pattern for numbers that look like magic numbers
  const numberPattern = /(?<![a-zA-Z_\d.])(\d{2,})(?![a-zA-Z_\d])/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'hardcoded_values', ignoreState)) continue;

    // Skip common false positives
    if (/^\s*\/\//.test(line)) continue; // Comments
    if (/^\s*\*/.test(line)) continue; // Block comment
    if (/import\s+/.test(line)) continue; // Imports
    if (/(?:const|let|var)\s+[A-Z_][A-Z0-9_]*\s*=/.test(line)) continue; // Already constant
    if (/^\s*export\s+/.test(line) && /[A-Z_][A-Z0-9_]*\s*=/.test(line)) continue; // Exported constant

    let match;
    while ((match = numberPattern.exec(line)) !== null) {
      const number = match[1];
      if (number === undefined) continue;

      // Skip acceptable numbers
      if (acceptableNumbers.has(number)) continue;

      // Skip array indices
      if (/\[\d+\]/.test(line.substring(match.index - 1, match.index + number.length + 1))) continue;

      // Skip version numbers
      if (/\d+\.\d+\.\d+/.test(line)) continue;

      // Skip hex colors
      if (/#[0-9a-fA-F]{6}/.test(line)) continue;

      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'hardcoded_values',
          'low',
          `Magic number ${number} should be a named constant`,
          line.trim(),
          'magic-number',
          0.7,
          'static',
          `Extract to constant: const MEANINGFUL_NAME = ${number};`,
          { readability: 2 }
        )
      );
    }
    numberPattern.lastIndex = 0;
  }

  return findings;
}

function detectHardcodedUrls(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /['"`](https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^'"`]+)['"`]/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'hardcoded_values', ignoreState)) continue;

    // Skip comments
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

    // Skip test files
    if (filePath.includes('.test.') || filePath.includes('.spec.')) continue;

    let match;
    while ((match = pattern.exec(line)) !== null) {
      const url = match[1];
      if (url === undefined) continue;

      // Skip documentation URLs
      if (url.includes('github.com') && (url.includes('/blob/') || url.includes('/issues/'))) continue;
      if (url.includes('example.com')) continue;

      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'hardcoded_values',
          'medium',
          'Hardcoded URL should be configurable',
          line.trim(),
          'hardcoded-url',
          0.85,
          'static',
          'Move to environment variable: process.env.API_URL',
          { readability: 3 }
        )
      );
    }
    pattern.lastIndex = 0;
  }

  return findings;
}

function detectHardcodedPaths(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /['"`](\/(?:Users|home|var|etc|tmp|opt)\/[^'"`]+)['"`]/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'hardcoded_values', ignoreState)) continue;

    // Skip comments
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

    let match;
    while ((match = pattern.exec(line)) !== null) {
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'hardcoded_values',
          'high',
          'Absolute path should not be hardcoded',
          line.trim(),
          'hardcoded-path',
          0.9,
          'static',
          'Use path.join() with configurable base path or environment variable',
          { readability: 5 }
        )
      );
    }
    pattern.lastIndex = 0;
  }

  return findings;
}

function detectHardcodedCredentials(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /(?:password|secret|api_?key|token|auth)\s*[:=]\s*['"`]([^'"`]{8,})['"`]/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'hardcoded_values', ignoreState)) continue;

    // Skip comments
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

    // Skip test files
    if (filePath.includes('.test.') || filePath.includes('.spec.')) continue;

    // Skip example/placeholder values
    if (/(?:example|placeholder|dummy|test|xxx)/i.test(line)) continue;

    let match;
    while ((match = pattern.exec(line)) !== null) {
      // Skip process.env references
      if (/process\.env/.test(line)) continue;

      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'hardcoded_values',
          'critical',
          'Potential credentials should not be hardcoded',
          line.trim().replace(/['"`][^'"`]{8,}['"`]/, "'***'"),
          'hardcoded-credentials',
          0.95,
          'static',
          'Move to environment variable or secrets manager',
          {}
        )
      );
    }
    pattern.lastIndex = 0;
  }

  return findings;
}

function detectHardcodedPorts(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /(?:port|PORT)\s*[:=]\s*(\d{4,5})/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'hardcoded_values', ignoreState)) continue;

    // Skip if already using process.env
    if (/process\.env/.test(line)) continue;

    // Skip comments
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

    // Skip constants
    if (/(?:const|let|var)\s+[A-Z_]/.test(line)) continue;

    const match = pattern.exec(line);
    if (match) {
      const portNum = match[1] ?? 'unknown';
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'hardcoded_values',
          'low',
          `Hardcoded port ${portNum} should be configurable`,
          line.trim(),
          'hardcoded-port',
          0.75,
          'static',
          'Use: process.env.PORT || 3000',
          {}
        )
      );
    }
    pattern.lastIndex = 0;
  }

  return findings;
}

function detectHardcodedTimeouts(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /timeout\s*[:=]\s*(\d{4,})/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'hardcoded_values', ignoreState)) continue;

    // Skip constants
    if (/(?:const|let|var)\s+[A-Z_]/.test(line)) continue;

    // Skip comments
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

    const match = pattern.exec(line);
    if (match) {
      const timeoutStr = match[1] ?? '0';
      const ms = parseInt(timeoutStr, 10);
      const seconds = ms / 1000;

      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'hardcoded_values',
          'low',
          `Hardcoded timeout ${timeoutStr}ms (${seconds}s) should be configurable`,
          line.trim(),
          'hardcoded-timeout',
          0.7,
          'static',
          'Extract to constant: const TIMEOUT_MS = ' + timeoutStr + ';',
          {}
        )
      );
    }
    pattern.lastIndex = 0;
  }

  return findings;
}

// ============================================================================
// Utilities
// ============================================================================

function shouldIgnoreLine(
  lineNum: number,
  type: 'hardcoded_values',
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
