/**
 * Naming Detector
 * Detects naming convention issues and poor variable names
 * @module core/refactor/detectors/naming-detector
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

export const NAMING_RULES: RefactorRule[] = [
  {
    id: 'single-letter-variable',
    type: 'naming',
    description: 'Single-letter variable name (except loop counters)',
    pattern: /(?:const|let|var)\s+([a-z])\s*[=:]/,
    negativePatterns: [
      /for\s*\(\s*(?:const|let|var)\s+[ijk]/, // Loop counters
      /\.map\s*\(\s*[a-z]\s*=>/, // Short arrow functions
      /\.filter\s*\(\s*[a-z]\s*=>/, // Short arrow functions
      /\.reduce\s*\(\s*\([a-z],\s*[a-z]\)/, // Reduce callbacks
    ],
    detector: 'regex',
    severity: 'low',
    confidence: 0.7,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Use a descriptive name',
  },
  {
    id: 'hungarian-notation',
    type: 'naming',
    description: 'Hungarian notation is discouraged in TypeScript',
    pattern: /(?:const|let|var)\s+(str|int|bool|arr|obj|num|fn)[A-Z]/,
    detector: 'regex',
    severity: 'low',
    confidence: 0.85,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Remove type prefix - TypeScript provides type information',
  },
  {
    id: 'inconsistent-naming',
    type: 'naming',
    description: 'Inconsistent naming convention',
    pattern: /(?:const|let|var)\s+([a-z]+_[a-z]+)\s*[=:]/, // snake_case in JS
    detector: 'regex',
    severity: 'low',
    confidence: 0.8,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Use camelCase for variables in TypeScript/JavaScript',
  },
  {
    id: 'constant-not-uppercase',
    type: 'naming',
    description: 'Constant should use UPPER_SNAKE_CASE',
    pattern: /const\s+([a-z][a-zA-Z0-9]*)\s*=\s*(?:['"`]|[\d.]+|true|false)/,
    negativePatterns: [
      /const\s+\w+\s*=\s*(?:new|await|async|function|class)/, // Not a simple constant
      /const\s+\{\s*\w+/, // Destructuring
      /const\s+\[\s*\w+/, // Array destructuring
    ],
    detector: 'regex',
    severity: 'low',
    confidence: 0.5, // Low confidence - many valid exceptions
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Consider using UPPER_SNAKE_CASE for true constants',
  },
  {
    id: 'generic-name',
    type: 'naming',
    description: 'Generic variable name lacks meaning',
    pattern: /(?:const|let|var)\s+(data|result|value|item|temp|tmp|foo|bar|baz|test)\s*[=:]/i,
    detector: 'regex',
    severity: 'low',
    confidence: 0.6,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Use a more descriptive name that indicates purpose',
  },
  {
    id: 'boolean-without-prefix',
    type: 'naming',
    description: 'Boolean variable should have is/has/can/should prefix',
    pattern: /(?:const|let|var)\s+(\w+)\s*:\s*boolean\s*=/,
    negativePatterns: [
      /(?:const|let|var)\s+(?:is|has|can|should|was|will|did|does)[A-Z]/, // Has prefix
    ],
    detector: 'regex',
    severity: 'low',
    confidence: 0.7,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Use is/has/can/should prefix for boolean variables',
  },
]

// ============================================================================
// Detector Function
// ============================================================================

export function detectNaming(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState,
  _config: RefactorConfig
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Detect single-letter variables
  findings.push(...detectSingleLetterVariables(filePath, content, lines, ignoreState));

  // Detect Hungarian notation
  findings.push(...detectHungarianNotation(filePath, content, lines, ignoreState));

  // Detect inconsistent naming (snake_case)
  findings.push(...detectSnakeCaseVariables(filePath, content, lines, ignoreState));

  // Detect generic names
  findings.push(...detectGenericNames(filePath, content, lines, ignoreState));

  // Detect boolean naming
  findings.push(...detectBooleanNaming(filePath, content, lines, ignoreState));

  return findings;
}

// ============================================================================
// Individual Detectors
// ============================================================================

function detectSingleLetterVariables(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /(?:const|let|var)\s+([a-z])\s*[=:]/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'naming', ignoreState)) continue;

    // Skip loop counters
    if (/for\s*\(\s*(?:const|let|var)\s+[ijk]/.test(line)) continue;

    // Skip short arrow functions in common methods
    if (/\.(map|filter|find|some|every|forEach)\s*\(\s*[a-z]\s*=>/.test(line)) continue;

    const match = pattern.exec(line);
    if (match) {
      const varName = match[1];
      if (varName === undefined) continue;

      // Skip common acceptable single letters
      if (['e', 'i', 'j', 'k', 'n', 'x', 'y', 'z', '_'].includes(varName)) {
        pattern.lastIndex = 0;
        continue;
      }

      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'naming',
          'low',
          `Single-letter variable '${varName}' lacks descriptive meaning`,
          line.trim(),
          'single-letter-variable',
          0.7,
          'static',
          'Use a descriptive name that indicates the variable\'s purpose',
          { readability: 2 }
        )
      );
    }
    pattern.lastIndex = 0;
  }

  return findings;
}

function detectHungarianNotation(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /(?:const|let|var)\s+(str|int|bool|arr|obj|num|fn)([A-Z]\w*)\s*[=:]/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'naming', ignoreState)) continue;

    const match = pattern.exec(line);
    if (match) {
      const prefix = match[1];
      const name = match[2];
      if (prefix === undefined || name === undefined) continue;
      const fullName = prefix + name;
      const suggestedName = name.charAt(0).toLowerCase() + name.slice(1);

      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'naming',
          'low',
          `Hungarian notation '${fullName}' is discouraged in TypeScript`,
          line.trim(),
          'hungarian-notation',
          0.85,
          'static',
          `Rename to '${suggestedName}' - TypeScript provides type information`,
          { readability: 1 }
        )
      );
    }
    pattern.lastIndex = 0;
  }

  return findings;
}

function detectSnakeCaseVariables(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /(?:const|let|var)\s+([a-z]+_[a-z_]+)\s*[=:]/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'naming', ignoreState)) continue;

    // Skip destructuring from external APIs
    if (/{\s*[a-z_]+\s*}/.test(line)) continue;

    const match = pattern.exec(line);
    if (match) {
      const varName = match[1];
      if (varName === undefined) continue;

      // Skip UPPER_SNAKE_CASE constants
      if (varName === varName.toUpperCase()) {
        pattern.lastIndex = 0;
        continue;
      }

      // Convert to camelCase
      const camelCase = varName.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'naming',
          'low',
          `snake_case '${varName}' should be camelCase in TypeScript`,
          line.trim(),
          'inconsistent-naming',
          0.8,
          'static',
          `Rename to '${camelCase}'`,
          { readability: 1 }
        )
      );
    }
    pattern.lastIndex = 0;
  }

  return findings;
}

function detectGenericNames(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const genericNames = ['data', 'result', 'value', 'item', 'temp', 'tmp', 'foo', 'bar', 'baz', 'obj', 'arr'];
  const pattern = new RegExp(`(?:const|let|var)\\s+(${genericNames.join('|')})\\s*[=:]`, 'gi');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'naming', ignoreState)) continue;

    // Skip test files - generic names are more acceptable there
    if (filePath.includes('.test.') || filePath.includes('.spec.')) continue;

    const match = pattern.exec(line);
    if (match) {
      const varName = match[1];
      if (varName === undefined) continue;

      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'naming',
          'low',
          `Generic variable name '${varName}' lacks descriptive meaning`,
          line.trim(),
          'generic-name',
          0.6,
          'static',
          'Use a more specific name like userData, apiResult, configValue, etc.',
          { readability: 2 }
        )
      );
    }
    pattern.lastIndex = 0;
  }

  return findings;
}

function detectBooleanNaming(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /(?:const|let|var)\s+(\w+)\s*:\s*boolean\s*=/g;
  const goodPrefixes = ['is', 'has', 'can', 'should', 'was', 'will', 'did', 'does', 'are', 'were'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'naming', ignoreState)) continue;

    const match = pattern.exec(line);
    if (match) {
      const varName = match[1];
      if (varName === undefined) continue;

      // Check if already has a good prefix
      const hasGoodPrefix = goodPrefixes.some(
        (prefix) => varName.toLowerCase().startsWith(prefix) && varName.length > prefix.length
      );

      if (!hasGoodPrefix) {
        // Suggest a better name
        const suggestion = `is${varName.charAt(0).toUpperCase()}${varName.slice(1)}`;

        findings.push(
          createFinding(
            filePath,
            lineNum,
            lineNum,
            'naming',
            'low',
            `Boolean '${varName}' should have is/has/can/should prefix`,
            line.trim(),
            'boolean-without-prefix',
            0.7,
            'static',
            `Rename to '${suggestion}' or similar (isActive, hasError, canEdit, shouldUpdate)`,
            { readability: 1 }
          )
        );
      }
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
  type: 'naming',
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
