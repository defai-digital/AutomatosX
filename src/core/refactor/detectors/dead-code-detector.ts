/**
 * Dead Code Detector
 * Detects unused imports, variables, functions, and unreachable code
 * @module core/refactor/detectors/dead-code-detector
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

export const DEAD_CODE_RULES: RefactorRule[] = [
  {
    id: 'unused-import',
    type: 'dead_code',
    description: 'Import is not used in the file',
    detector: 'typescript_analyzer',
    severity: 'low',
    confidence: 0.9,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Remove unused import',
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  {
    id: 'unused-variable',
    type: 'dead_code',
    description: 'Variable is declared but never used',
    detector: 'typescript_analyzer',
    severity: 'low',
    confidence: 0.85,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Remove unused variable or prefix with underscore',
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  {
    id: 'unreachable-code',
    type: 'dead_code',
    description: 'Code after return/throw/break is unreachable',
    pattern: /(?:return|throw|break|continue)\s+[^;]*;\s*\n\s*[^}\s]/,
    detector: 'regex',
    severity: 'medium',
    confidence: 0.95,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Remove unreachable code',
  },
  {
    id: 'commented-code-block',
    type: 'dead_code',
    description: 'Large block of commented-out code',
    pattern: /(?:\/\/\s*(?:const|let|var|function|class|if|for|while|return|import|export)\s+[\s\S]*?){3,}/,
    detector: 'regex',
    severity: 'low',
    confidence: 0.7,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Remove commented code (use version control for history)',
  },
  {
    id: 'empty-function',
    type: 'dead_code',
    description: 'Empty function body',
    pattern: /(?:function\s+\w+|=>\s*)\s*\([^)]*\)\s*{\s*}/,
    detector: 'regex',
    severity: 'low',
    confidence: 0.6,
    autoFixable: false,
    requiresLLM: false,
    suggestion: 'Implement function or add TODO comment',
  },
];

// ============================================================================
// Detector Function
// ============================================================================

export function detectDeadCode(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState,
  config: RefactorConfig
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Detect unused imports
  findings.push(...detectUnusedImports(filePath, content, lines, ignoreState));

  // Detect unused variables
  findings.push(...detectUnusedVariables(filePath, content, lines, ignoreState));

  // Detect unreachable code
  findings.push(...detectUnreachableCode(filePath, content, lines, ignoreState));

  // Detect commented code blocks
  findings.push(...detectCommentedCode(filePath, content, lines, ignoreState));

  return findings;
}

// ============================================================================
// Individual Detectors
// ============================================================================

function detectUnusedImports(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Find all imports
  const importRegex = /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const namedImports = match[1];
    const defaultImport = match[2];
    const lineNum = content.substring(0, match.index).split('\n').length;

    // Check if should ignore
    if (shouldIgnoreLine(lineNum, 'dead_code', ignoreState)) continue;

    // Check named imports
    if (namedImports) {
      const names = namedImports.split(',').map((n) => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts.length > 1 ? (parts[1]?.trim() ?? '') : (parts[0]?.trim() ?? '');
      });

      for (const name of names) {
        if (!name) continue;

        // Remove import statements from code for checking
        const codeWithoutImports = content.replace(
          /import[\s\S]*?from\s*['"][^'"]+['"];?/g,
          ''
        );

        // Check if name is used (excluding type-only usage in comments)
        const usageRegex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'g');
        const usages = codeWithoutImports.match(usageRegex);

        if (!usages || usages.length === 0) {
          findings.push(
            createFinding(
              filePath,
              lineNum,
              lineNum,
              'dead_code',
              'low',
              `Unused import: '${name}'`,
              lines[lineNum - 1] || '',
              'unused-import',
              0.9,
              'static',
              `Remove '${name}' from imports`,
              { linesRemoved: 0 }
            )
          );
        }
      }
    }

    // Check default import
    if (defaultImport) {
      const codeWithoutImports = content.replace(
        /import[\s\S]*?from\s*['"][^'"]+['"];?/g,
        ''
      );

      const usageRegex = new RegExp(`\\b${escapeRegex(defaultImport)}\\b`, 'g');
      const usages = codeWithoutImports.match(usageRegex);

      if (!usages || usages.length === 0) {
        findings.push(
          createFinding(
            filePath,
            lineNum,
            lineNum,
            'dead_code',
            'low',
            `Unused default import: '${defaultImport}'`,
            lines[lineNum - 1] || '',
            'unused-import',
            0.9,
            'static',
            `Remove import of '${defaultImport}'`,
            { linesRemoved: 1 }
          )
        );
      }
    }
  }

  return findings;
}

function detectUnusedVariables(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];

  // Find variable declarations
  const varRegex = /(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=/g;
  let match;

  while ((match = varRegex.exec(content)) !== null) {
    const varName = match[1];
    if (varName === undefined) continue;
    const lineNum = content.substring(0, match.index).split('\n').length;

    // Skip if underscore-prefixed (intentionally unused)
    if (varName.startsWith('_')) continue;

    // Skip common patterns
    if (['React', 'useState', 'useEffect', 'props', 'state'].includes(varName)) continue;

    // Check if should ignore
    if (shouldIgnoreLine(lineNum, 'dead_code', ignoreState)) continue;

    // Check usage (excluding the declaration itself)
    const codeAfterDeclaration = content.substring(match.index + (match[0]?.length ?? 0));
    const usageRegex = new RegExp(`\\b${escapeRegex(varName)}\\b`, 'g');
    const usages = codeAfterDeclaration.match(usageRegex);

    if (!usages || usages.length === 0) {
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'dead_code',
          'low',
          `Unused variable: '${varName}'`,
          lines[lineNum - 1] || '',
          'unused-variable',
          0.75, // Lower confidence - might be used in other files
          'static',
          `Remove or prefix with underscore: '_${varName}'`,
          { linesRemoved: 1 }
        )
      );
    }
  }

  return findings;
}

function detectUnreachableCode(
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

    // Check if should ignore
    if (shouldIgnoreLine(lineNum, 'dead_code', ignoreState)) continue;

    // Check for return/throw/break followed by code (not closing brace)
    if (/^\s*(?:return|throw|break|continue)\s/.test(line)) {
      // Check next non-empty line
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        const nextLineRaw = lines[j];
        if (nextLineRaw === undefined) continue;
        const nextLine = nextLineRaw.trim();

        // Skip empty lines and comments
        if (!nextLine || nextLine.startsWith('//') || nextLine.startsWith('/*')) continue;

        // If next line is closing brace, it's fine
        if (nextLine === '}' || nextLine.startsWith('}')) break;

        // If next line is case/default in switch, it's fine
        if (/^(?:case|default)\s/.test(nextLine)) break;

        // Otherwise, it's unreachable
        findings.push(
          createFinding(
            filePath,
            j + 1,
            j + 1,
            'dead_code',
            'medium',
            'Unreachable code after return/throw/break',
            lines[j] || '',
            'unreachable-code',
            0.95,
            'static',
            'Remove unreachable code',
            { linesRemoved: 1 }
          )
        );
        break;
      }
    }
  }

  return findings;
}

function detectCommentedCode(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): RefactorFinding[] {
  const findings: RefactorFinding[] = [];
  let commentBlockStart: number | null = null;
  let commentBlockLines = 0;

  const codePatterns = [
    /^\s*\/\/\s*(?:const|let|var|function|class|if|for|while|return|import|export)\s/,
    /^\s*\/\/\s*\w+\s*[=:]\s*/,
    /^\s*\/\/\s*}\s*$/,
    /^\s*\/\/\s*{\s*$/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;

    const looksLikeCode = codePatterns.some((p) => p.test(line));

    if (looksLikeCode) {
      if (commentBlockStart === null) {
        commentBlockStart = lineNum;
      }
      commentBlockLines++;
    } else {
      // End of potential block
      if (commentBlockStart !== null && commentBlockLines >= 3) {
        // Check if should ignore
        if (!shouldIgnoreLine(commentBlockStart, 'dead_code', ignoreState)) {
          findings.push(
            createFinding(
              filePath,
              commentBlockStart,
              lineNum - 1,
              'dead_code',
              'low',
              `Commented-out code block (${commentBlockLines} lines)`,
              lines[commentBlockStart - 1] || '',
              'commented-code-block',
              0.7,
              'static',
              'Remove commented code - use version control for history',
              { linesRemoved: commentBlockLines }
            )
          );
        }
      }
      commentBlockStart = null;
      commentBlockLines = 0;
    }
  }

  return findings;
}

// ============================================================================
// Utilities
// ============================================================================

function shouldIgnoreLine(
  lineNum: number,
  type: 'dead_code',
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
