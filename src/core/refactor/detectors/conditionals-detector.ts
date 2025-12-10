/**
 * Conditionals Detector
 * Detects complex conditionals that can be simplified
 * @module core/refactor/detectors/conditionals-detector
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

export const CONDITIONAL_RULES: RefactorRule[] = [
  {
    id: 'deeply-nested-if',
    type: 'conditionals',
    description: 'Deeply nested conditionals reduce readability',
    detector: 'ast',
    severity: 'medium',
    confidence: 0.85,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Use guard clauses (early returns) to flatten nesting',
  },
  {
    id: 'complex-condition',
    type: 'conditionals',
    description: 'Complex condition with multiple operators',
    pattern: /if\s*\([^)]*(?:&&|\|\|)[^)]*(?:&&|\|\|)[^)]*\)/,
    detector: 'regex',
    severity: 'medium',
    confidence: 0.8,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Extract complex condition to a named function',
  },
  {
    id: 'negated-condition',
    type: 'conditionals',
    description: 'Negated condition may be harder to understand',
    pattern: /if\s*\(\s*!\s*\([^)]+\)\s*\)/,
    detector: 'regex',
    severity: 'low',
    confidence: 0.6,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Consider inverting the condition for clarity',
  },
  {
    id: 'else-after-return',
    type: 'conditionals',
    description: 'Unnecessary else after return statement',
    pattern: /return[^;]*;\s*\n\s*}\s*else\s*{/,
    detector: 'regex',
    severity: 'low',
    confidence: 0.9,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Remove else clause - code after return is already unreachable from if branch',
  },
  {
    id: 'boolean-literal-comparison',
    type: 'conditionals',
    description: 'Comparing to boolean literal is redundant',
    pattern: /(?:===?|!==?)\s*(?:true|false)\b/,
    detector: 'regex',
    severity: 'low',
    confidence: 0.95,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Use the boolean directly or negate it',
  },
  {
    id: 'ternary-with-boolean',
    type: 'conditionals',
    description: 'Ternary returning boolean literals is redundant',
    pattern: /\?\s*true\s*:\s*false|\?\s*false\s*:\s*true/,
    detector: 'regex',
    severity: 'low',
    confidence: 0.95,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Use the condition directly (or negate it)',
  },
];

// ============================================================================
// Detector Function
// ============================================================================

export function detectConditionals(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState,
  _config: RefactorConfig
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Detect deeply nested conditionals
  findings.push(...detectDeeplyNestedIf(filePath, content, lines, ignoreState));

  // Detect complex conditions
  findings.push(...detectComplexConditions(filePath, content, lines, ignoreState));

  // Detect negated conditions
  findings.push(...detectNegatedConditions(filePath, content, lines, ignoreState));

  // Detect unnecessary else after return
  findings.push(...detectElseAfterReturn(filePath, content, lines, ignoreState));

  // Detect boolean literal comparisons
  findings.push(...detectBooleanLiteralComparison(filePath, content, lines, ignoreState));

  // Detect ternary with boolean
  findings.push(...detectTernaryWithBoolean(filePath, content, lines, ignoreState));

  return findings;
}

// ============================================================================
// Individual Detectors
// ============================================================================

function detectDeeplyNestedIf(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const MAX_NESTING = 3;

  let _currentNesting = 0; // Track for future endLine reporting
  let ifNesting = 0;
  let _ifStartLine = -1; // Track for future range reporting

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    // Track overall brace nesting
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;

    // Track if statement nesting
    if (/\bif\s*\(/.test(line)) {
      ifNesting++;
      if (ifNesting === 1) {
        _ifStartLine = lineNum;
      }

      if (ifNesting > MAX_NESTING) {
        if (!shouldIgnoreLine(lineNum, 'conditionals', ignoreState)) {
          findings.push(
            createFinding(
              filePath,
              lineNum,
              lineNum,
              'conditionals',
              'medium',
              `Deeply nested conditional (depth: ${ifNesting})`,
              line.trim(),
              'deeply-nested-if',
              0.85,
              'static',
              'Use guard clauses (early returns) to flatten nesting',
              { complexity: ifNesting * 2, readability: ifNesting * 3 }
            )
          );
        }
      }
    }

    _currentNesting += openBraces - closeBraces;

    // Reset if nesting when we leave the block
    if (closeBraces > 0 && ifNesting > 0) {
      ifNesting = Math.max(0, ifNesting - closeBraces);
    }
  }

  return findings;
}

function detectComplexConditions(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  // Match if with 2+ logical operators
  const pattern = /if\s*\(([^)]+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'conditionals', ignoreState)) continue;

    const match = pattern.exec(line);
    if (match) {
      const condition = match[1] ?? '';
      const operators = (condition.match(/&&|\|\|/g) || []).length;

      if (operators >= 2) {
        findings.push(
          createFinding(
            filePath,
            lineNum,
            lineNum,
            'conditionals',
            'medium',
            `Complex condition with ${operators + 1} parts`,
            line.trim(),
            'complex-condition',
            0.8,
            'static',
            'Extract to a named function like isValidUser() or hasPermission()',
            { complexity: operators * 2, readability: operators * 3 }
          )
        );
      }
    }
    pattern.lastIndex = 0;
  }

  return findings;
}

function detectNegatedConditions(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /if\s*\(\s*!\s*\([^)]+\)\s*\)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'conditionals', ignoreState)) continue;

    if (pattern.test(line)) {
      // Check if there's an else clause (if so, swap would be clearer)
      let hasElse = false;
      let braceCount = 0;
      for (let j = i; j < Math.min(i + 20, lines.length); j++) {
        const checkLine = lines[j];
        if (checkLine === undefined) continue;
        braceCount += (checkLine.match(/{/g) || []).length;
        braceCount -= (checkLine.match(/}/g) || []).length;
        if (braceCount === 0 && /}\s*else\s*{/.test(checkLine)) {
          hasElse = true;
          break;
        }
      }

      if (hasElse) {
        findings.push(
          createFinding(
            filePath,
            lineNum,
            lineNum,
            'conditionals',
            'low',
            'Negated condition with else clause - consider swapping branches',
            line.trim(),
            'negated-condition',
            0.6,
            'static',
            'Swap if/else branches and remove negation for clarity',
            { readability: 2 }
          )
        );
      }
    }
  }

  return findings;
}

function detectElseAfterReturn(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'conditionals', ignoreState)) continue;

    // Check for return followed by } else {
    if (/return\s+[^;]*;/.test(line)) {
      // Look for else in next few lines
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const checkLine = lines[j];
        if (checkLine === undefined) continue;
        if (/}\s*else\s*{/.test(checkLine)) {
          findings.push(
            createFinding(
              filePath,
              j + 1,
              j + 1,
              'conditionals',
              'low',
              'Unnecessary else after return',
              checkLine.trim(),
              'else-after-return',
              0.9,
              'static',
              'Remove else clause - the if branch already returns',
              { linesRemoved: 2 }
            )
          );
          break;
        }
        // Stop if we hit something that's not whitespace or closing brace
        if (checkLine.trim() && !checkLine.trim().startsWith('}')) break;
      }
    }
  }

  return findings;
}

function detectBooleanLiteralComparison(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /(\w+)\s*(?:===?|!==?)\s*(true|false)\b|(true|false)\s*(?:===?|!==?)\s*(\w+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'conditionals', ignoreState)) continue;

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    const match = line.match(pattern);
    if (match) {
      const variable = match[1] ?? match[4] ?? '';
      const boolLiteral = match[2] ?? match[3] ?? '';
      const isNegation = line.includes('!==') || line.includes('!=');
      const comparingToFalse = boolLiteral === 'false';

      let suggestion: string;
      if (isNegation !== comparingToFalse) {
        suggestion = `Use !${variable} directly`;
      } else {
        suggestion = `Use ${variable} directly`;
      }

      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'conditionals',
          'low',
          `Redundant comparison to ${boolLiteral}`,
          line.trim(),
          'boolean-literal-comparison',
          0.95,
          'static',
          suggestion,
          {}
        )
      );
    }
  }

  return findings;
}

function detectTernaryWithBoolean(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const patterns = [
    { pattern: /\?\s*true\s*:\s*false/, suggestion: 'Use the condition directly (cast to boolean with !!condition if needed)' },
    { pattern: /\?\s*false\s*:\s*true/, suggestion: 'Negate the condition (!condition or cast with !condition)' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'conditionals', ignoreState)) continue;

    for (const { pattern, suggestion } of patterns) {
      if (pattern.test(line)) {
        findings.push(
          createFinding(
            filePath,
            lineNum,
            lineNum,
            'conditionals',
            'low',
            'Ternary returning boolean literals is redundant',
            line.trim(),
            'ternary-with-boolean',
            0.95,
            'static',
            suggestion,
            {}
          )
        );
        break;
      }
    }
  }

  return findings;
}

// ============================================================================
// Utilities
// ============================================================================

function shouldIgnoreLine(
  lineNum: number,
  type: 'conditionals',
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
