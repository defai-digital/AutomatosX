/**
 * Dead Code Detector
 * Detects unused imports, variables, functions, and unreachable code
 * @module core/refactor/detectors/dead-code-detector
 * @version 12.7.0
 * @updated 12.8.0 - Added AST-based unreachable code detection (Phase 4)
 * @updated 12.9.0 - Added TypeScript Language Service integration (PRD-019)
 * @updated 12.10.0 - Added Python dead code detection support
 */

import { extname } from 'path';
import type {
  RefactorFinding,
  RefactorRule,
  RefactorConfig,
  RefactorIgnoreState,
} from '../types.js';
import { createFinding } from '../refactor-detector.js';
import { ASTAnalyzer, createASTAnalyzer } from '../../bugfix/ast-analyzer.js';
import type { SemanticDeadCodeAnalyzer, PySemanticDeadCodeAnalyzer } from '../semantic/index.js';

// Shared AST analyzer instance for dead code detection
let astAnalyzer: ASTAnalyzer | null = null;
let astInitialized = false;

// Shared semantic analyzer instance (PRD-019)
let semanticAnalyzer: SemanticDeadCodeAnalyzer | null = null;
let semanticInitialized = false;
let semanticRootDir: string | null = null;

// Shared Python semantic analyzer instance (v12.10.0)
let pySemanticAnalyzer: PySemanticDeadCodeAnalyzer | null = null;
let pySemanticInitialized = false;
let pySemanticRootDir: string | null = null;

async function getASTAnalyzer(): Promise<ASTAnalyzer> {
  if (!astAnalyzer) {
    astAnalyzer = createASTAnalyzer(50); // Smaller cache for refactor detector
  }
  if (!astInitialized) {
    await astAnalyzer.init();
    astInitialized = true;
  }
  return astAnalyzer;
}

/**
 * Get or create a semantic analyzer for high-precision dead code detection
 * PRD-019: TypeScript Language Service integration
 */
async function getSemanticAnalyzer(rootDir: string): Promise<SemanticDeadCodeAnalyzer> {
  // Recreate analyzer if rootDir changed (bug fix: analyzer cached wrong rootDir)
  if (semanticAnalyzer && semanticRootDir !== rootDir) {
    semanticAnalyzer.dispose();
    semanticAnalyzer = null;
    semanticInitialized = false;
  }

  if (!semanticAnalyzer) {
    // Lazy-load to avoid bundling issues
    const { createSemanticAnalyzer } = await import('../semantic/index.js');
    semanticAnalyzer = createSemanticAnalyzer(rootDir, {
      includeExports: false,
      includeTypeOnly: false,
      minConfidence: 0.7,
    });
    semanticRootDir = rootDir;
  }
  if (!semanticInitialized) {
    await semanticAnalyzer.init();
    semanticInitialized = true;
  }
  return semanticAnalyzer;
}

/**
 * Get or create a Python semantic analyzer for dead code detection
 * v12.10.0: Python dead code detection support
 */
async function getPySemanticAnalyzer(rootDir: string): Promise<PySemanticDeadCodeAnalyzer> {
  // Recreate analyzer if rootDir changed (bug fix: analyzer cached wrong rootDir)
  if (pySemanticAnalyzer && pySemanticRootDir !== rootDir) {
    pySemanticAnalyzer.dispose();
    pySemanticAnalyzer = null;
    pySemanticInitialized = false;
  }

  if (!pySemanticAnalyzer) {
    // Lazy-load to avoid bundling issues
    const { createPySemanticAnalyzer } = await import('../semantic/index.js');
    pySemanticAnalyzer = createPySemanticAnalyzer(rootDir, {
      includeExports: false,
      includePrivate: true,
      minConfidence: 0.7,
    });
    pySemanticRootDir = rootDir;
  }
  if (!pySemanticInitialized) {
    await pySemanticAnalyzer.init();
    pySemanticInitialized = true;
  }
  return pySemanticAnalyzer;
}

/**
 * Dispose of the semantic analyzer (call when done with analysis)
 */
export function disposeSemanticAnalyzer(): void {
  if (semanticAnalyzer) {
    semanticAnalyzer.dispose();
    semanticAnalyzer = null;
    semanticInitialized = false;
    semanticRootDir = null;
  }
}

/**
 * Dispose of the Python semantic analyzer (call when done with analysis)
 */
export function disposePySemanticAnalyzer(): void {
  if (pySemanticAnalyzer) {
    pySemanticAnalyzer.dispose();
    pySemanticAnalyzer = null;
    pySemanticInitialized = false;
    pySemanticRootDir = null;
  }
}

/**
 * Dispose of all semantic analyzers
 */
export function disposeAllSemanticAnalyzers(): void {
  disposeSemanticAnalyzer();
  disposePySemanticAnalyzer();
}

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
  // v12.8.0: Changed to AST-based detection for better accuracy
  // AST analysis correctly handles switch/case statements and nested blocks
  {
    id: 'unreachable-code',
    type: 'dead_code',
    description: 'Code after return/throw/break is unreachable',
    pattern: /(?:return|throw|break|continue)\s+[^;]*;\s*\n\s*[^}\s]/,
    detector: 'ast', // Changed from 'regex' to 'ast'
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
  // v12.9.0: PRD-019 semantic analysis rule for high-precision detection
  {
    id: 'semantic-dead-code',
    type: 'dead_code',
    description: 'Symbol declared but never used (TypeScript Language Service)',
    detector: 'semantic',
    severity: 'medium',
    confidence: 0.95, // High confidence from type-aware analysis
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Remove unused symbol',
    fileExtensions: ['.ts', '.tsx'],
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
  // v12.10.0: Python dead code detection rules
  {
    id: 'py-unused-import',
    type: 'dead_code',
    description: 'Python import is not used in the file',
    detector: 'semantic',
    severity: 'low',
    confidence: 0.9,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Remove unused import',
    fileExtensions: ['.py', '.pyw'],
  },
  {
    id: 'py-unused-function',
    type: 'dead_code',
    description: 'Python function is defined but never called',
    detector: 'semantic',
    severity: 'medium',
    confidence: 0.85,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Remove unused function',
    fileExtensions: ['.py', '.pyw'],
  },
  {
    id: 'py-unused-class',
    type: 'dead_code',
    description: 'Python class is defined but never used',
    detector: 'semantic',
    severity: 'medium',
    confidence: 0.85,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Remove unused class',
    fileExtensions: ['.py', '.pyw'],
  },
  {
    id: 'py-unused-variable',
    type: 'dead_code',
    description: 'Python variable is assigned but never used',
    detector: 'semantic',
    severity: 'low',
    confidence: 0.85,
    autoFixable: true,
    requiresLLM: false,
    suggestion: 'Remove unused variable',
    fileExtensions: ['.py', '.pyw'],
  },
];

// ============================================================================
// Detector Function
// ============================================================================

/**
 * Options for dead code detection
 */
export interface DeadCodeDetectionOptions {
  /** Use semantic analysis (TypeScript Language Service) for high-precision detection */
  useSemantic?: boolean;
  /** Root directory for semantic analysis (required if useSemantic is true) */
  rootDir?: string;
}

export async function detectDeadCode(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState,
  _config: RefactorConfig,
  options?: DeadCodeDetectionOptions
): Promise<RefactorFinding[]> {
  const findings: RefactorFinding[] = [];
  const ext = extname(filePath).toLowerCase();

  // v12.10.0: Use Python semantic analysis for Python files
  if (options?.useSemantic && options.rootDir && (ext === '.py' || ext === '.pyw')) {
    findings.push(...await detectPythonSemanticDeadCode(filePath, options.rootDir, ignoreState));
    return findings;
  }

  // Use semantic analysis for high-precision detection (PRD-019)
  if (options?.useSemantic && options.rootDir && filePath.match(/\.[tj]sx?$/)) {
    findings.push(...await detectSemanticDeadCode(filePath, options.rootDir, ignoreState));
    // Skip regex-based detection when using semantic analysis
    // (semantic analysis is more accurate)
    return findings;
  }

  // Fallback to regex-based detection
  // Detect unused imports
  findings.push(...detectUnusedImports(filePath, content, lines, ignoreState));

  // Detect unused variables
  findings.push(...detectUnusedVariables(filePath, content, lines, ignoreState));

  // Detect unreachable code (async to lazy-load TypeScript)
  findings.push(...await detectUnreachableCode(filePath, content, lines, ignoreState));

  // Detect commented code blocks
  findings.push(...detectCommentedCode(filePath, content, lines, ignoreState));

  return findings;
}

/**
 * Detect dead code using TypeScript Language Service (PRD-019)
 * High-precision detection with proper symbol resolution
 */
async function detectSemanticDeadCode(
  filePath: string,
  rootDir: string,
  ignoreState: RefactorIgnoreState
): Promise<RefactorFinding[]> {
  const findings: RefactorFinding[] = [];

  try {
    const analyzer = await getSemanticAnalyzer(rootDir);
    const result = await analyzer.analyze([filePath]);

    for (const finding of result.findings) {
      const lineNum = finding.symbol.line;

      // Check if should ignore
      if (shouldIgnoreLine(lineNum, 'dead_code', ignoreState)) {
        continue;
      }

      // Convert semantic finding to refactor finding
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'dead_code',
          finding.falsePositiveRisk === 'low' ? 'medium' : 'low',
          `${finding.symbol.kind} '${finding.symbol.name}' is ${finding.reason.replace(/_/g, ' ')}`,
          finding.symbol.declarations[0]?.text.split('\n')[0] || '',
          'semantic-dead-code',
          finding.confidence,
          'static',
          finding.suggestedAction === 'remove'
            ? `Remove unused ${finding.symbol.kind} '${finding.symbol.name}'`
            : `Review ${finding.symbol.kind} '${finding.symbol.name}'`,
          { linesRemoved: 1, safeToAutoFix: finding.safeToAutoFix }
        )
      );
    }
  } catch (error) {
    // Log but don't fail - fallback to regex detection is handled by caller
    console.warn('Semantic dead code analysis failed:', error);
  }

  return findings;
}

/**
 * Detect dead code in Python files using Python semantic analyzer
 * v12.10.0: Python dead code detection support
 */
async function detectPythonSemanticDeadCode(
  filePath: string,
  rootDir: string,
  ignoreState: RefactorIgnoreState
): Promise<RefactorFinding[]> {
  const findings: RefactorFinding[] = [];

  try {
    const analyzer = await getPySemanticAnalyzer(rootDir);
    const result = await analyzer.analyze([filePath]);

    for (const finding of result.findings) {
      const lineNum = finding.symbol.line;

      // Check if should ignore
      if (shouldIgnoreLine(lineNum, 'dead_code', ignoreState)) {
        continue;
      }

      // Map Python symbol kind to rule ID
      const ruleId = mapPySymbolKindToRuleId(finding.symbol.kind);

      // Convert Python finding to refactor finding
      findings.push(
        createFinding(
          filePath,
          lineNum,
          lineNum,
          'dead_code',
          finding.falsePositiveRisk === 'low' ? 'medium' : 'low',
          finding.explanation,
          `${finding.symbol.kind} ${finding.symbol.name}`,
          ruleId,
          finding.confidence,
          'static',
          finding.suggestedAction === 'remove'
            ? `Remove unused ${finding.symbol.kind} '${finding.symbol.name}'`
            : `Review ${finding.symbol.kind} '${finding.symbol.name}'`,
          { linesRemoved: 1, safeToAutoFix: finding.safeToAutoFix }
        )
      );
    }
  } catch (error) {
    // Log but don't fail - Python analysis is best-effort
    console.warn('Python semantic dead code analysis failed:', error);
  }

  return findings;
}

/**
 * Map Python symbol kind to corresponding rule ID
 */
function mapPySymbolKindToRuleId(kind: string): string {
  switch (kind) {
    case 'import':
      return 'py-unused-import';
    case 'function':
    case 'method':
      return 'py-unused-function';
    case 'class':
      return 'py-unused-class';
    case 'variable':
    case 'parameter':
      return 'py-unused-variable';
    default:
      return 'py-unused-variable';
  }
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

/**
 * Detect unreachable code using AST analysis
 * v12.8.0: Phase 4 - Reduced false positives via control flow analysis
 */
async function detectUnreachableCode(
  filePath: string,
  content: string,
  lines: string[],
  ignoreState: RefactorIgnoreState
): Promise<RefactorFinding[]> {
  const findings: RefactorFinding[] = [];

  try {
    // Use AST-based detection for better accuracy
    const analyzer = await getASTAnalyzer();
    const sourceFile = analyzer.parseFile(content, filePath);
    const unreachableInfos = analyzer.analyzeUnreachableCode(sourceFile);

    for (const info of unreachableInfos) {
      // Skip false positives (switch case statements, etc.)
      if (info.isFalsePositive) {
        continue;
      }

      // Check if should ignore
      if (shouldIgnoreLine(info.line, 'dead_code', ignoreState)) {
        continue;
      }

      findings.push(
        createFinding(
          filePath,
          info.line,
          info.line,
          'dead_code',
          'medium',
          `Unreachable code after ${info.reason} statement`,
          info.code,
          'unreachable-code',
          0.95,
          'static',
          'Remove unreachable code',
          { linesRemoved: 1 }
        )
      );
    }
  } catch {
    // Fallback to regex-based detection on AST failure
    findings.push(...detectUnreachableCodeFallback(filePath, lines, ignoreState));
  }

  return findings;
}

/**
 * Fallback regex-based detection for unreachable code
 * Used when AST parsing fails
 */
function detectUnreachableCodeFallback(
  filePath: string,
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
            0.85, // Lower confidence for fallback
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
