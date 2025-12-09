/**
 * Readability Detector
 * Detects code complexity and readability issues
 * @module core/refactor/detectors/readability-detector
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

export const READABILITY_RULES: RefactorRule[] = [
  {
    id: 'high-cyclomatic-complexity',
    type: 'readability',
    description: 'Function has high cyclomatic complexity',
    detector: 'ast',
    severity: 'high',
    confidence: 0.9,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Break down into smaller functions',
  },
  {
    id: 'long-function',
    type: 'readability',
    description: 'Function is too long',
    detector: 'ast',
    severity: 'medium',
    confidence: 0.85,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Extract logical sections into separate functions',
  },
  {
    id: 'deep-nesting',
    type: 'readability',
    description: 'Code has deep nesting level',
    detector: 'ast',
    severity: 'medium',
    confidence: 0.9,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Use guard clauses or extract nested logic',
  },
  {
    id: 'long-line',
    type: 'readability',
    description: 'Line exceeds recommended length',
    detector: 'regex',
    severity: 'low',
    confidence: 0.95,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Break into multiple lines',
  },
  {
    id: 'too-many-parameters',
    type: 'readability',
    description: 'Function has too many parameters',
    detector: 'regex',
    severity: 'medium',
    confidence: 0.85,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Use an options object instead',
  },
  {
    id: 'complex-expression',
    type: 'readability',
    description: 'Expression is too complex',
    detector: 'regex',
    severity: 'medium',
    confidence: 0.7,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Break into intermediate variables',
  },
];

// ============================================================================
// Thresholds
// ============================================================================

const THRESHOLDS = {
  maxLineLength: 120,
  maxFunctionLength: 50,
  maxParameterCount: 4,
  maxNestingDepth: 4,
  maxCyclomaticComplexity: 10,
  maxChainedCalls: 4,
};

// ============================================================================
// Detector Function
// ============================================================================

export function detectReadability(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState,
  config: RefactorConfig
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Detect long functions
  findings.push(...detectLongFunctions(filePath, content, lines, ignoreState));

  // Detect deep nesting
  findings.push(...detectDeepNesting(filePath, content, lines, ignoreState));

  // Detect long lines
  findings.push(...detectLongLines(filePath, content, lines, ignoreState));

  // Detect too many parameters
  findings.push(...detectTooManyParameters(filePath, content, lines, ignoreState));

  // Detect complex expressions
  findings.push(...detectComplexExpressions(filePath, content, lines, ignoreState));

  // Detect high complexity functions
  findings.push(...detectHighComplexity(filePath, content, lines, ignoreState));

  return findings;
}

// ============================================================================
// Individual Detectors
// ============================================================================

function detectLongFunctions(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Find function definitions
  const functionPattern = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>))/g;
  let match;

  while ((match = functionPattern.exec(content)) !== null) {
    const functionName = match[1] || match[2];
    const startIndex = match.index;
    const startLine = content.substring(0, startIndex).split('\n').length;

    if (shouldIgnoreLine(startLine, 'readability', ignoreState)) continue;

    // Find function end
    let braceCount = 0;
    let endLine = startLine;
    let foundStart = false;

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      const opens = (line.match(/{/g) || []).length;
      const closes = (line.match(/}/g) || []).length;

      if (opens > 0) foundStart = true;
      braceCount += opens - closes;

      if (foundStart && braceCount === 0) {
        endLine = i + 1;
        break;
      }
    }

    const functionLength = endLine - startLine + 1;

    if (functionLength > THRESHOLDS.maxFunctionLength) {
      findings.push(
        createFinding(
          filePath,
          startLine,
          endLine,
          'readability',
          'medium',
          `Function '${functionName}' is ${functionLength} lines (max: ${THRESHOLDS.maxFunctionLength})`,
          lines[startLine - 1] || '',
          'long-function',
          0.85,
          'static',
          'Extract logical sections into smaller, focused functions',
          { complexity: Math.ceil(functionLength / 10), readability: functionLength - THRESHOLDS.maxFunctionLength }
        )
      );
    }
  }

  return findings;
}

function detectDeepNesting(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const reportedLines = new Set<number>();

  let nestingLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    const opens = (line.match(/{/g) || []).length;
    const closes = (line.match(/}/g) || []).length;

    nestingLevel += opens;

    if (nestingLevel > THRESHOLDS.maxNestingDepth && opens > 0) {
      if (!shouldIgnoreLine(lineNum, 'readability', ignoreState) && !reportedLines.has(lineNum)) {
        reportedLines.add(lineNum);

        findings.push(
          createFinding(
            filePath,
            lineNum,
            lineNum,
            'readability',
            'medium',
            `Deep nesting level: ${nestingLevel} (max: ${THRESHOLDS.maxNestingDepth})`,
            line.trim(),
            'deep-nesting',
            0.9,
            'static',
            'Use guard clauses (early returns) or extract nested logic to functions',
            { complexity: nestingLevel, readability: nestingLevel * 2 }
          )
        );
      }
    }

    nestingLevel -= closes;
    nestingLevel = Math.max(0, nestingLevel);
  }

  return findings;
}

function detectLongLines(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'readability', ignoreState)) continue;

    // Skip imports (often long but acceptable)
    if (/^\s*import\s+/.test(line)) continue;

    // Skip URLs and long strings (intentionally long)
    if (/https?:\/\//.test(line)) continue;

    if (line.length > THRESHOLDS.maxLineLength) {
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'readability',
          'low',
          `Line is ${line.length} characters (max: ${THRESHOLDS.maxLineLength})`,
          line.substring(0, 80) + '...',
          'long-line',
          0.95,
          'static',
          'Break into multiple lines for better readability',
          { readability: 1 }
        )
      );
    }
  }

  return findings;
}

function detectTooManyParameters(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Match function declarations with parameters
  const functionPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:function)?)\s*\(([^)]*)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'readability', ignoreState)) continue;

    const match = functionPattern.exec(line);
    if (match) {
      const params = match[1];
      if (params === undefined) {
        functionPattern.lastIndex = 0;
        continue;
      }
      // Count parameters (split by comma, accounting for destructuring and defaults)
      const paramList = params.split(',').filter((p) => p.trim().length > 0);

      if (paramList.length > THRESHOLDS.maxParameterCount) {
        findings.push(
          createFinding(
            filePath,
            lineNum,
            lineNum,
            'readability',
            'medium',
            `Function has ${paramList.length} parameters (max: ${THRESHOLDS.maxParameterCount})`,
            line.trim(),
            'too-many-parameters',
            0.85,
            'static',
            'Use an options object: function foo({ param1, param2, ... })',
            { complexity: paramList.length - THRESHOLDS.maxParameterCount }
          )
        );
      }
    }
    functionPattern.lastIndex = 0;
  }

  return findings;
}

function detectComplexExpressions(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'readability', ignoreState)) continue;

    // Detect long chained method calls
    const chainedCalls = (line.match(/\.\w+\s*\(/g) || []).length;
    if (chainedCalls > THRESHOLDS.maxChainedCalls) {
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'readability',
          'medium',
          `Long method chain (${chainedCalls} calls)`,
          line.trim().substring(0, 80) + (line.length > 80 ? '...' : ''),
          'complex-expression',
          0.7,
          'static',
          'Break into intermediate variables for clarity',
          { readability: chainedCalls - THRESHOLDS.maxChainedCalls }
        )
      );
    }

    // Detect complex ternary expressions
    const ternaries = (line.match(/\?[^:]*:/g) || []).length;
    if (ternaries >= 2) {
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'readability',
          'medium',
          `Nested ternary operators (${ternaries} levels)`,
          line.trim().substring(0, 80) + (line.length > 80 ? '...' : ''),
          'complex-expression',
          0.8,
          'static',
          'Use if/else statements or extract to a function',
          { readability: ternaries * 2 }
        )
      );
    }
  }

  return findings;
}

function detectHighComplexity(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Find function definitions and calculate complexity
  const functionPattern = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>))/g;
  let match;

  while ((match = functionPattern.exec(content)) !== null) {
    const functionName = match[1] || match[2];
    const startIndex = match.index;
    const startLine = content.substring(0, startIndex).split('\n').length;

    if (shouldIgnoreLine(startLine, 'readability', ignoreState)) continue;

    // Find function body
    let braceCount = 0;
    let endLine = startLine;
    let foundStart = false;
    let functionBody = '';

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      functionBody += line + '\n';

      const opens = (line.match(/{/g) || []).length;
      const closes = (line.match(/}/g) || []).length;

      if (opens > 0) foundStart = true;
      braceCount += opens - closes;

      if (foundStart && braceCount === 0) {
        endLine = i + 1;
        break;
      }
    }

    // Calculate cyclomatic complexity
    const complexity = calculateCyclomaticComplexity(functionBody);

    if (complexity > THRESHOLDS.maxCyclomaticComplexity) {
      findings.push(
        createFinding(
          filePath,
          startLine,
          startLine,
          'readability',
          'high',
          `Function '${functionName}' has cyclomatic complexity ${complexity} (max: ${THRESHOLDS.maxCyclomaticComplexity})`,
          lines[startLine - 1] || '',
          'high-cyclomatic-complexity',
          0.9,
          'static',
          'Reduce complexity by extracting conditions or using early returns',
          { complexity: complexity - THRESHOLDS.maxCyclomaticComplexity }
        )
      );
    }
  }

  return findings;
}

// ============================================================================
// Utilities
// ============================================================================

function calculateCyclomaticComplexity(code: string): number {
  let complexity = 1;

  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bwhile\s*\(/g,
    /\bfor\s*\(/g,
    /\bcase\s+[^:]+:/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:]+\s*:/g,
    /&&/g,
    /\|\|/g,
    /\?\?/g,
  ];

  for (const pattern of patterns) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

function shouldIgnoreLine(
  lineNum: number,
  type: 'readability',
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
