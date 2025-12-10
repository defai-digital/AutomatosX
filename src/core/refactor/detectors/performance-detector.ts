/**
 * Performance Detector
 * Detects performance anti-patterns and optimization opportunities
 * @module core/refactor/detectors/performance-detector
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

export const PERFORMANCE_RULES: RefactorRule[] = [
  {
    id: 'sync-in-async',
    type: 'performance',
    description: 'Synchronous operation in async context',
    pattern: /await\s+[\w.]+\s*\([^)]*\)[\s\S]*?(?:readFileSync|writeFileSync|existsSync|mkdirSync|readdirSync)/,
    detector: 'regex',
    severity: 'high',
    confidence: 0.9,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Use async fs methods (fs/promises) instead of sync methods',
  },
  {
    id: 'n-plus-one-query',
    type: 'performance',
    description: 'Potential N+1 query pattern',
    pattern: /for\s*\([^)]+\)\s*{[^}]*(?:await\s+)?(?:db|query|fetch|findOne|findById)\s*\(/,
    detector: 'regex',
    severity: 'high',
    confidence: 0.75,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Batch queries instead of querying in a loop',
  },
  {
    id: 'sequential-awaits',
    type: 'performance',
    description: 'Sequential awaits could be parallelized',
    pattern: /await\s+\w+[^;]*;\s*\n\s*await\s+\w+/,
    detector: 'regex',
    severity: 'medium',
    confidence: 0.6,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Use Promise.all() for independent async operations',
  },
  {
    id: 'inefficient-array-method',
    type: 'performance',
    description: 'Array method chain could be optimized',
    pattern: /\.filter\([^)]+\)\.map\([^)]+\)/,
    detector: 'regex',
    severity: 'low',
    confidence: 0.5,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Consider using reduce() or a single loop for better performance',
  },
  {
    id: 'object-in-loop',
    type: 'performance',
    description: 'Object/array creation inside loop',
    pattern: /for\s*\([^)]+\)\s*{[^}]*(?:new\s+(?:Object|Array|Map|Set)|(?:\[\s*\]|\{\s*\}))/,
    detector: 'regex',
    severity: 'medium',
    confidence: 0.7,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Move object creation outside the loop if possible',
  },
  {
    id: 'regex-in-loop',
    type: 'performance',
    description: 'RegExp creation inside loop',
    pattern: /for\s*\([^)]+\)\s*{[^}]*new\s+RegExp\s*\(/,
    detector: 'regex',
    severity: 'medium',
    confidence: 0.9,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Move RegExp creation outside the loop',
  },
  {
    id: 'unnecessary-await-in-return',
    type: 'performance',
    description: 'Unnecessary await before return',
    pattern: /return\s+await\s+(?!Promise\.all)/,
    detector: 'regex',
    severity: 'low',
    confidence: 0.7,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Remove await - async functions automatically wrap return values in promises',
  },
];

// ============================================================================
// Detector Function
// ============================================================================

export function detectPerformance(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState,
  _config: RefactorConfig
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Detect sync operations in async context
  findings.push(...detectSyncInAsync(filePath, content, lines, ignoreState));

  // Detect N+1 query patterns
  findings.push(...detectNPlusOne(filePath, content, lines, ignoreState));

  // Detect sequential awaits
  findings.push(...detectSequentialAwaits(filePath, content, lines, ignoreState));

  // Detect inefficient array methods
  findings.push(...detectInefficientArrayMethods(filePath, content, lines, ignoreState));

  // Detect object creation in loops
  findings.push(...detectObjectInLoop(filePath, content, lines, ignoreState));

  // Detect regex in loops
  findings.push(...detectRegexInLoop(filePath, content, lines, ignoreState));

  // Detect unnecessary await in return
  findings.push(...detectUnnecessaryAwaitReturn(filePath, content, lines, ignoreState));

  return findings;
}

// ============================================================================
// Individual Detectors
// ============================================================================

function detectSyncInAsync(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const syncMethods = [
    'readFileSync',
    'writeFileSync',
    'existsSync',
    'mkdirSync',
    'readdirSync',
    'statSync',
    'unlinkSync',
    'copyFileSync',
    'appendFileSync',
  ];

  const syncPattern = new RegExp(`\\b(${syncMethods.join('|')})\\s*\\(`, 'g');

  // First, find async functions
  let inAsyncFunction = false;
  let asyncStartLine = -1;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    // Track async function boundaries
    if (/\basync\s+(?:function|\w+\s*=>|\w+\s*\()/.test(line)) {
      inAsyncFunction = true;
      asyncStartLine = lineNum;
      braceCount = 0;
    }

    if (inAsyncFunction) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (braceCount <= 0 && asyncStartLine !== lineNum) {
        inAsyncFunction = false;
      }

      // Check for sync methods
      if (syncPattern.test(line)) {
        if (!shouldIgnoreLine(lineNum, 'performance', ignoreState)) {
          const methodMatch = line.match(syncPattern);
          if (methodMatch) {
            const matchedMethod = methodMatch[1];
            if (matchedMethod === undefined) continue;
            const asyncMethod = matchedMethod.replace('Sync', '');

            findings.push(
              createFinding(
                filePath,
                lineNum,
                lineNum,
                'performance',
                'high',
                `Synchronous '${matchedMethod}' in async function`,
                line.trim(),
                'sync-in-async',
                0.9,
                'static',
                `Use async '${asyncMethod}' from 'fs/promises' instead`,
                { complexity: 5 }
              )
            );
          }
        }
      }
      syncPattern.lastIndex = 0;
    }
  }

  return findings;
}

function detectNPlusOne(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const queryMethods = ['query', 'fetch', 'findOne', 'findById', 'findByPk', 'get', 'load'];

  let inLoop = false;
  let loopStartLine = -1;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    // Track loop boundaries
    if (/\b(?:for|while)\s*\(/.test(line)) {
      inLoop = true;
      loopStartLine = lineNum;
      braceCount = 0;
    }

    if (inLoop) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (braceCount <= 0 && loopStartLine !== lineNum && line.includes('}')) {
        inLoop = false;
      }

      // Check for query methods
      const queryPattern = new RegExp(`(?:await\\s+)?(?:\\w+\\.)?(?:${queryMethods.join('|')})\\s*\\(`, 'i');
      if (queryPattern.test(line)) {
        if (!shouldIgnoreLine(lineNum, 'performance', ignoreState)) {
          findings.push(
            createFinding(
              filePath,
              lineNum,
              lineNum,
              'performance',
              'high',
              'Potential N+1 query: database/API call inside loop',
              line.trim(),
              'n-plus-one-query',
              0.75,
              'static',
              'Batch queries: fetch all data before the loop or use WHERE IN clause',
              { complexity: 10 }
            )
          );
        }
      }
    }
  }

  return findings;
}

function detectSequentialAwaits(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    if (line === undefined || nextLine === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'performance', ignoreState)) continue;

    // Check for consecutive awaits
    if (/^\s*(?:const|let|var)?\s*\w*\s*=?\s*await\s+/.test(line)) {
      if (/^\s*(?:const|let|var)?\s*\w*\s*=?\s*await\s+/.test(nextLine)) {
        // Check if they're independent (heuristic: different variable names)
        const var1Match = line.match(/(?:const|let|var)\s+(\w+)/);
        const usage2Match = nextLine.match(/await\s+\w+[^;]*/);

        if (var1Match && usage2Match) {
          const var1 = var1Match[1];
          const usage2 = usage2Match[0];
          if (var1 === undefined || usage2 === undefined) continue;
          // If var1 is not used in the second await, they might be parallelizable
          if (!usage2.includes(var1)) {
            findings.push(
              createFinding(
                filePath,
                lineNum,
                lineNum + 1,
                'performance',
                'medium',
                'Sequential awaits could potentially be parallelized',
                `${line.trim()}\n${nextLine.trim()}`,
                'sequential-awaits',
                0.6,
                'static',
                'If operations are independent, use Promise.all([op1(), op2()])',
                { complexity: 3 }
              )
            );
          }
        }
      }
    }
  }

  return findings;
}

function detectInefficientArrayMethods(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /\.filter\s*\([^)]+\)\s*\.map\s*\([^)]+\)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'performance', ignoreState)) continue;

    if (pattern.test(line)) {
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'performance',
          'low',
          'Chained filter().map() iterates array twice',
          line.trim(),
          'inefficient-array-method',
          0.5,
          'static',
          'Consider using reduce() or flatMap() for single-pass processing',
          { complexity: 2 }
        )
      );
    }
  }

  return findings;
}

function detectObjectInLoop(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  let inLoop = false;
  let loopStartLine = -1;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (/\b(?:for|while)\s*\(/.test(line)) {
      inLoop = true;
      loopStartLine = lineNum;
      braceCount = 0;
    }

    if (inLoop) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (braceCount <= 0 && loopStartLine !== lineNum && line.includes('}')) {
        inLoop = false;
        continue;
      }

      if (shouldIgnoreLine(lineNum, 'performance', ignoreState)) continue;

      // Check for new Map/Set/Array/Object
      if (/new\s+(?:Map|Set|Array|Object)\s*\(/.test(line)) {
        findings.push(
          createFinding(
            filePath,
            lineNum,
            lineNum,
            'performance',
            'medium',
            'Object/collection creation inside loop',
            line.trim(),
            'object-in-loop',
            0.7,
            'static',
            'Move instantiation outside the loop if the object can be reused',
            { complexity: 3 }
          )
        );
      }
    }
  }

  return findings;
}

function detectRegexInLoop(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  let inLoop = false;
  let loopStartLine = -1;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (/\b(?:for|while)\s*\(/.test(line)) {
      inLoop = true;
      loopStartLine = lineNum;
      braceCount = 0;
    }

    if (inLoop) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (braceCount <= 0 && loopStartLine !== lineNum && line.includes('}')) {
        inLoop = false;
        continue;
      }

      if (shouldIgnoreLine(lineNum, 'performance', ignoreState)) continue;

      // Check for RegExp creation
      if (/new\s+RegExp\s*\(/.test(line) || /\/[^/]+\/[gimsuvy]*/.test(line)) {
        // Skip if it's using a variable (dynamic regex)
        if (/new\s+RegExp\s*\(\s*\w+/.test(line)) continue;

        findings.push(
          createFinding(
            filePath,
            lineNum,
            lineNum,
            'performance',
            'medium',
            'RegExp creation inside loop',
            line.trim(),
            'regex-in-loop',
            0.9,
            'static',
            'Move RegExp to a constant outside the loop',
            { complexity: 2 }
          )
        );
      }
    }
  }

  return findings;
}

function detectUnnecessaryAwaitReturn(
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

    if (shouldIgnoreLine(lineNum, 'performance', ignoreState)) continue;

    // Match return await but not return await Promise.all
    if (/return\s+await\s+(?!Promise\.all)/.test(line)) {
      // Check if in try block (await is needed for proper error handling in try)
      let inTryBlock = false;
      for (let j = i - 1; j >= 0 && j > i - 20; j--) {
        const checkLine = lines[j];
        if (checkLine === undefined) continue;
        if (/\btry\s*{/.test(checkLine)) {
          inTryBlock = true;
          break;
        }
        if (/\bcatch\s*\(/.test(checkLine)) break;
      }

      if (!inTryBlock) {
        findings.push(
          createFinding(
            filePath,
            lineNum,
            lineNum,
            'performance',
            'low',
            'Unnecessary await before return in async function',
            line.trim(),
            'unnecessary-await-in-return',
            0.7,
            'static',
            'Remove await - async functions automatically return promises',
            {}
          )
        );
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
  type: 'performance',
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
