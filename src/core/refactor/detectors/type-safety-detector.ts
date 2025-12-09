/**
 * Type Safety Detector
 * Detects TypeScript type safety issues (any types, type assertions, etc.)
 * @module core/refactor/detectors/type-safety-detector
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

export const TYPE_SAFETY_RULES: RefactorRule[] = [
  {
    id: 'explicit-any',
    type: 'type_safety',
    description: 'Explicit any type reduces type safety',
    pattern: /:\s*any(?:\s*[;,)\]\}]|\s*$)/,
    detector: 'regex',
    severity: 'medium',
    confidence: 0.95,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Replace any with a more specific type',
    fileExtensions: ['.ts', '.tsx'],
  },
  {
    id: 'type-assertion-chain',
    type: 'type_safety',
    description: 'Double type assertion often indicates type system workaround',
    pattern: /as\s+\w+\s+as\s+\w+/,
    detector: 'regex',
    severity: 'high',
    confidence: 0.9,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Refactor to avoid double type assertion',
    fileExtensions: ['.ts', '.tsx'],
  },
  {
    id: 'non-null-assertion',
    type: 'type_safety',
    description: 'Non-null assertion bypasses null checking',
    pattern: /\w+!\./,
    detector: 'regex',
    severity: 'low',
    confidence: 0.7,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Use optional chaining or explicit null check',
    fileExtensions: ['.ts', '.tsx'],
  },
  {
    id: 'unsafe-as-any',
    type: 'type_safety',
    description: 'Casting to any removes all type information',
    pattern: /as\s+any\b/,
    detector: 'regex',
    severity: 'high',
    confidence: 0.95,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Use a more specific type or fix the type mismatch',
    fileExtensions: ['.ts', '.tsx'],
  },
  {
    id: 'generic-object-type',
    type: 'type_safety',
    description: 'Generic object type provides little type safety',
    pattern: /:\s*(?:object|Object)(?:\s*[;,)\]\}]|\s*$)/,
    detector: 'regex',
    severity: 'medium',
    confidence: 0.8,
    autoFixable: false,
    requiresLLM: true,
    suggestion: 'Define a specific interface or type',
    fileExtensions: ['.ts', '.tsx'],
  },
  {
    id: 'empty-interface',
    type: 'type_safety',
    description: 'Empty interface is equivalent to {}',
    pattern: /interface\s+\w+\s*{\s*}/,
    detector: 'regex',
    severity: 'low',
    confidence: 0.85,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Add properties or remove empty interface',
    fileExtensions: ['.ts', '.tsx'],
  },
];

// ============================================================================
// Detector Function
// ============================================================================

export function detectTypeSafety(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState,
  config: RefactorConfig
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Only run on TypeScript files
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
    return findings;
  }

  // Detect explicit any types
  findings.push(...detectAnyTypes(filePath, content, lines, ignoreState));

  // Detect type assertion chains
  findings.push(...detectTypeAssertionChains(filePath, content, lines, ignoreState));

  // Detect non-null assertions
  findings.push(...detectNonNullAssertions(filePath, content, lines, ignoreState));

  // Detect unsafe as any
  findings.push(...detectUnsafeAsAny(filePath, content, lines, ignoreState));

  // Detect generic object types
  findings.push(...detectGenericObjectTypes(filePath, content, lines, ignoreState));

  // Detect empty interfaces
  findings.push(...detectEmptyInterfaces(filePath, content, lines, ignoreState));

  return findings;
}

// ============================================================================
// Individual Detectors
// ============================================================================

function detectAnyTypes(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /:\s*any(?:\s*[;,)\]\}]|\s*$)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    // Check if should ignore
    if (shouldIgnoreLine(lineNum, 'type_safety', ignoreState)) continue;

    // Skip type definition files
    if (filePath.endsWith('.d.ts')) continue;

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    if (pattern.test(line)) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;

      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'type_safety',
          'medium',
          'Explicit any type reduces type safety',
          line.trim(),
          'explicit-any',
          0.95,
          'static',
          'Replace any with a more specific type (string, number, unknown, etc.)',
          { readability: 5 }
        )
      );
    }
  }

  return findings;
}

function detectTypeAssertionChains(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /as\s+\w+\s+as\s+\w+/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'type_safety', ignoreState)) continue;

    if (pattern.test(line)) {
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'type_safety',
          'high',
          'Double type assertion indicates type system workaround',
          line.trim(),
          'type-assertion-chain',
          0.9,
          'static',
          'Refactor to avoid double type assertion - fix underlying type issue',
          { complexity: 5 }
        )
      );
    }
  }

  return findings;
}

function detectNonNullAssertions(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  // Match word followed by ! then . (non-null assertion before property access)
  const pattern = /\b\w+!\./g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'type_safety', ignoreState)) continue;

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    const matches = line.match(pattern);
    if (matches) {
      // Limit to first match per line to avoid spam
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'type_safety',
          'low',
          'Non-null assertion (!) bypasses null checking',
          line.trim(),
          'non-null-assertion',
          0.7,
          'static',
          'Use optional chaining (?.) or explicit null check',
          {}
        )
      );
    }
  }

  return findings;
}

function detectUnsafeAsAny(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /as\s+any\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'type_safety', ignoreState)) continue;

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    if (pattern.test(line)) {
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'type_safety',
          'high',
          'Casting to any removes all type information',
          line.trim(),
          'unsafe-as-any',
          0.95,
          'static',
          'Use a more specific type assertion or fix the type mismatch',
          { readability: 10 }
        )
      );
    }
  }

  return findings;
}

function detectGenericObjectTypes(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /:\s*(?:object|Object)(?:\s*[;,)\]\}]|\s*$)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'type_safety', ignoreState)) continue;

    if (pattern.test(line)) {
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'type_safety',
          'medium',
          'Generic object type provides little type safety',
          line.trim(),
          'generic-object-type',
          0.8,
          'static',
          'Define a specific interface or type with expected properties',
          {}
        )
      );
    }
  }

  return findings;
}

function detectEmptyInterfaces(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  const pattern = /interface\s+(\w+)\s*{\s*}/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    if (shouldIgnoreLine(lineNum, 'type_safety', ignoreState)) continue;

    const match = line.match(pattern);
    if (match) {
      // Check if it extends something (valid use case)
      if (!/extends\s+\w+/.test(line)) {
        findings.push(
          createFinding(
            filePath,
            lineNum,
            lineNum,
            'type_safety',
            'low',
            `Empty interface '${match[1] ?? 'unknown'}' is equivalent to {}`,
            line.trim(),
            'empty-interface',
            0.85,
            'static',
            'Add properties or remove empty interface',
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
  type: 'type_safety',
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
