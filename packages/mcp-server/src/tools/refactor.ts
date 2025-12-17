import type { MCPTool, ToolHandler } from '../types.js';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { resolve, extname, basename, join } from 'path';
import {
  createScanResponse,
  createListResponse,
  successResponse,
  errorResponse,
  type ScanResultItem,
} from '../utils/response.js';
import { storeArtifact } from '../utils/artifact-store.js';

/**
 * Refactor scan tool definition
 */
export const refactorScanTool: MCPTool = {
  name: 'refactor_scan',
  description:
    'Scan code for refactoring opportunities (extract function, rename, simplify, etc.)',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        description: 'List of file or directory paths to scan',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 100,
      },
      types: {
        type: 'array',
        description:
          'Refactor types to scan for (extract-function, extract-variable, inline-function, rename, move, simplify-conditional, remove-duplication, improve-types, modernize-syntax, optimize-imports, other)',
        items: { type: 'string' },
      },
      maxImpact: {
        type: 'string',
        description: 'Maximum impact level to include (breaking, major, minor, trivial)',
        enum: ['breaking', 'major', 'minor', 'trivial'],
      },
      excludePatterns: {
        type: 'array',
        description: 'Glob patterns to exclude from scanning',
        items: { type: 'string' },
      },
      maxFiles: {
        type: 'number',
        description: 'Maximum number of files to scan',
        default: 100,
      },
      minConfidence: {
        type: 'number',
        description: 'Minimum confidence score (0-1)',
        default: 0.7,
      },
    },
    required: ['paths'],
  },
};

/**
 * Refactor apply tool definition
 */
export const refactorApplyTool: MCPTool = {
  name: 'refactor_apply',
  description: 'Apply a detected refactoring opportunity',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      opportunityId: {
        type: 'string',
        description: 'Opportunity ID from the scan results',
      },
      autoApply: {
        type: 'boolean',
        description: 'Automatically apply the refactoring',
        default: false,
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview refactoring without applying',
        default: true,
      },
      createBackup: {
        type: 'boolean',
        description: 'Create backup before applying',
        default: true,
      },
      runTests: {
        type: 'boolean',
        description: 'Run tests after applying refactoring',
        default: false,
      },
    },
    required: ['opportunityId'],
  },
};

/**
 * Refactor list tool definition
 */
export const refactorListTool: MCPTool = {
  name: 'refactor_list',
  description: 'List detected refactoring opportunities from previous scans',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      scanId: {
        type: 'string',
        description: 'Filter by scan ID',
      },
      type: {
        type: 'string',
        description: 'Filter by refactor type',
      },
      impact: {
        type: 'string',
        description: 'Filter by impact level',
        enum: ['breaking', 'major', 'minor', 'trivial'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 50,
      },
    },
  },
};

// In-memory storage for refactor opportunities
const opportunityStore = new Map<string, OpportunityRecord>();
const refactorScanStore = new Map<string, RefactorScanRecord>();

interface OpportunityRecord {
  opportunityId: string;
  scanId: string;
  type: string;
  impact: 'breaking' | 'major' | 'minor' | 'trivial';
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  lineEnd?: number;
  codeSnippet?: string;
  suggestedRefactor?: string;
  confidence: number;
  detectedAt: string;
}

interface RefactorScanRecord {
  scanId: string;
  paths: string[];
  filesScanned: number;
  opportunitiesFound: string[];
  completedAt: string;
}

// Refactoring opportunity patterns
interface RefactorPattern {
  id: string;
  name: string;
  type: string;
  impact: 'breaking' | 'major' | 'minor' | 'trivial';
  pattern: RegExp;
  description: string;
  suggestion: string;
  confidence: number;
  multiline?: boolean;
  minLength?: number;
}

const REFACTOR_PATTERNS: RefactorPattern[] = [
  // Extract Function Opportunities
  {
    id: 'extract-long-function',
    name: 'Long function',
    type: 'extract-function',
    impact: 'minor',
    pattern: /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))[^{]*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\}){150,}\}/,
    description: 'Function is longer than 150 characters, consider extracting into smaller functions',
    suggestion: 'Extract logical sections into smaller, single-purpose functions',
    confidence: 0.75,
    multiline: true,
  },
  {
    id: 'extract-repeated-code',
    name: 'Repeated code block',
    type: 'remove-duplication',
    impact: 'minor',
    pattern: /(.{50,})\n[\s\S]*?\1/,
    description: 'Repeated code block found, consider extracting into a reusable function',
    suggestion: 'Extract the duplicated code into a shared function',
    confidence: 0.65,
    multiline: true,
    minLength: 50,
  },

  // Simplify Conditional
  {
    id: 'simplify-nested-ternary',
    name: 'Nested ternary',
    type: 'simplify-conditional',
    impact: 'trivial',
    pattern: /\?\s*[^:]+:\s*[^?]+\?\s*[^:]+:/,
    description: 'Nested ternary operators reduce readability',
    suggestion: 'Replace nested ternaries with if-else blocks or extract into helper function',
    confidence: 0.85,
  },
  {
    id: 'simplify-complex-condition',
    name: 'Complex boolean condition',
    type: 'simplify-conditional',
    impact: 'minor',
    pattern: /if\s*\((?:[^()]+(?:&&|\|\|)){3,}[^()]*\)/,
    description: 'Complex boolean condition with 4+ operators is hard to understand',
    suggestion: 'Extract conditions into named boolean variables or a helper function',
    confidence: 0.8,
    multiline: true,
  },
  {
    id: 'simplify-early-return',
    name: 'Inverted if statement',
    type: 'simplify-conditional',
    impact: 'trivial',
    pattern: /if\s*\([^)]+\)\s*\{[\s\S]{100,}\}\s*(?:else\s*\{\s*return|\n\s*return)/,
    description: 'Large if block followed by return, consider inverting condition for early return',
    suggestion: 'Invert the condition and return early to reduce nesting',
    confidence: 0.7,
    multiline: true,
  },

  // Modernize Syntax
  {
    id: 'modernize-var-to-const',
    name: 'Use const instead of var',
    type: 'modernize-syntax',
    impact: 'trivial',
    pattern: /\bvar\s+\w+\s*=/,
    description: 'var keyword is outdated, use const or let',
    suggestion: 'Replace var with const (if not reassigned) or let (if reassigned)',
    confidence: 0.95,
  },
  {
    id: 'modernize-function-to-arrow',
    name: 'Convert to arrow function',
    type: 'modernize-syntax',
    impact: 'trivial',
    pattern: /function\s*\(\s*\)\s*\{[^}]{0,50}return\s+[^}]+\}/,
    description: 'Short anonymous function could be an arrow function',
    suggestion: 'Convert to arrow function: () => expression',
    confidence: 0.8,
    multiline: true,
  },
  {
    id: 'modernize-template-literal',
    name: 'String concatenation',
    type: 'modernize-syntax',
    impact: 'trivial',
    pattern: /['"][^'"]*['"]\s*\+\s*\w+\s*\+\s*['"][^'"]*['"]/,
    description: 'String concatenation could use template literals',
    suggestion: 'Replace with template literal: `${variable}`',
    confidence: 0.9,
  },
  {
    id: 'modernize-object-shorthand',
    name: 'Object property shorthand',
    type: 'modernize-syntax',
    impact: 'trivial',
    pattern: /\{\s*(\w+)\s*:\s*\1\s*[,}]/,
    description: 'Object property value matches property name',
    suggestion: 'Use object property shorthand: { name } instead of { name: name }',
    confidence: 0.95,
  },
  {
    id: 'modernize-promise-to-async',
    name: 'Promise chain to async/await',
    type: 'modernize-syntax',
    impact: 'minor',
    pattern: /\.then\s*\([^)]+\)\s*\.then\s*\([^)]+\)/,
    description: 'Promise chain could be simplified with async/await',
    suggestion: 'Convert to async/await for cleaner async code',
    confidence: 0.75,
    multiline: true,
  },

  // Improve Types
  {
    id: 'improve-explicit-any',
    name: 'Explicit any type',
    type: 'improve-types',
    impact: 'minor',
    pattern: /:\s*any(?:\[\])?\s*[;,=)]/,
    description: 'Explicit any type loses type safety',
    suggestion: 'Replace any with specific type or use unknown with type guards',
    confidence: 0.85,
  },
  {
    id: 'improve-type-assertion',
    name: 'Unsafe type assertion',
    type: 'improve-types',
    impact: 'minor',
    pattern: /as\s+\w+\s+as\s+\w+/,
    description: 'Double type assertion often indicates type problems',
    suggestion: 'Review the type design or use proper type guards',
    confidence: 0.8,
  },
  {
    id: 'improve-empty-interface',
    name: 'Empty interface',
    type: 'improve-types',
    impact: 'trivial',
    pattern: /interface\s+\w+\s*\{\s*\}/,
    description: 'Empty interface could be replaced with type alias or removed',
    suggestion: 'Use type alias for empty types: type Empty = Record<string, never>',
    confidence: 0.9,
  },

  // Optimize Imports
  {
    id: 'optimize-namespace-import',
    name: 'Namespace import for few items',
    type: 'optimize-imports',
    impact: 'trivial',
    pattern: /import\s+\*\s+as\s+(\w+)\s+from\s+['"][^'"]+['"]/,
    description: 'Namespace import used, consider using named imports instead',
    suggestion: 'Use named imports for better tree-shaking: import { x } from "module"',
    confidence: 0.5,
  },
  {
    id: 'optimize-default-export',
    name: 'Prefer named exports',
    type: 'optimize-imports',
    impact: 'trivial',
    pattern: /export\s+default\s+(?:function|class|const)/,
    description: 'Default exports make refactoring harder',
    suggestion: 'Consider using named exports for better refactoring support',
    confidence: 0.5,
  },

  // Extract Variable
  {
    id: 'extract-magic-number',
    name: 'Magic number',
    type: 'extract-variable',
    impact: 'trivial',
    pattern: /(?:===?|!==?|[<>]=?|[+\-*/])\s*(?:[2-9]\d{2,}|\d{4,})/,
    description: 'Magic number should be extracted to a named constant',
    suggestion: 'Extract to a well-named constant: const MAX_RETRIES = 3',
    confidence: 0.7,
  },
  {
    id: 'extract-magic-string',
    name: 'Magic string',
    type: 'extract-variable',
    impact: 'trivial',
    pattern: /['"](?:error|success|pending|loading|active|inactive|enabled|disabled)['"]/i,
    description: 'Magic string could be extracted to a constant or enum',
    suggestion: 'Use an enum or const object: const STATUS = { LOADING: "loading" }',
    confidence: 0.6,
  },

  // Rename Opportunities
  {
    id: 'rename-single-letter-var',
    name: 'Single-letter variable name',
    type: 'rename',
    impact: 'trivial',
    pattern: /(?:const|let|var)\s+([a-z])\s*=/i,
    description: 'Single-letter variable name reduces readability (except in loops)',
    suggestion: 'Use descriptive variable names that convey intent',
    confidence: 0.6,
  },
  {
    id: 'rename-data-suffix',
    name: 'Redundant data suffix',
    type: 'rename',
    impact: 'trivial',
    pattern: /(?:const|let|var)\s+\w+(?:Data|Info|Object|Array)\s*=/,
    description: 'Redundant type suffix in variable name',
    suggestion: 'Remove type suffix: userData → user, itemArray → items',
    confidence: 0.65,
  },
  {
    id: 'rename-handler-prefix',
    name: 'Inconsistent handler naming',
    type: 'rename',
    impact: 'trivial',
    pattern: /(?:on|handle)[A-Z]\w*\s*(?:=|:)\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/,
    description: 'Handler naming should be consistent (prefer handle prefix)',
    suggestion: 'Standardize handler naming: handleClick, handleSubmit',
    confidence: 0.55,
  },

  // Other
  {
    id: 'other-console-log',
    name: 'Console statement',
    type: 'other',
    impact: 'trivial',
    pattern: /console\.(?:log|warn|error|debug|info)\s*\(/,
    description: 'Console statements should be removed or replaced with proper logging',
    suggestion: 'Remove console statements or replace with a logging library',
    confidence: 0.9,
  },
  {
    id: 'other-commented-code',
    name: 'Commented out code',
    type: 'other',
    impact: 'trivial',
    pattern: /\/\/\s*(?:const|let|var|function|class|if|for|while|return|import|export)\s+/,
    description: 'Commented out code should be removed, use version control',
    suggestion: 'Remove commented code, rely on git history for old code',
    confidence: 0.75,
  },
  {
    id: 'other-todo-fixme',
    name: 'TODO/FIXME comment',
    type: 'other',
    impact: 'minor',
    pattern: /\/\/\s*(?:TODO|FIXME|HACK|XXX|BUG):/i,
    description: 'TODO/FIXME comments indicate incomplete work',
    suggestion: 'Address the TODO or create a tracked issue',
    confidence: 0.95,
  },
];

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.next', 'out']);

/**
 * Recursively collect files from a directory
 */
async function collectFilesRecursively(
  dirPath: string,
  files: string[],
  maxFiles: number
): Promise<void> {
  if (files.length >= maxFiles) return;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) break;

      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          await collectFilesRecursively(fullPath, files, maxFiles);
        }
      } else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry.name))) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory read error, skip
  }
}

/**
 * Get all files to scan from paths
 */
async function getFilesToScan(
  paths: string[],
  _excludePatterns: string[] = [],
  maxFiles: number
): Promise<string[]> {
  const files: string[] = [];

  for (const inputPath of paths) {
    if (files.length >= maxFiles) break;

    const resolvedPath = resolve(inputPath);
    try {
      const stat = await fs.stat(resolvedPath);

      if (stat.isDirectory()) {
        await collectFilesRecursively(resolvedPath, files, maxFiles);
      } else if (stat.isFile() && SUPPORTED_EXTENSIONS.has(extname(resolvedPath))) {
        files.push(resolvedPath);
      }
    } catch {
      // Path doesn't exist or isn't accessible, skip
    }
  }

  return files.slice(0, maxFiles);
}

/**
 * Scan a single file for refactoring opportunities
 */
async function scanFile(
  filePath: string,
  scanId: string,
  types?: string[],
  minConfidence: number = 0.7
): Promise<OpportunityRecord[]> {
  const opportunities: OpportunityRecord[] = [];

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const fileName = basename(filePath);

    // Skip test files for some patterns
    const isTestFile = /\.(?:test|spec)\.[tj]sx?$/.test(fileName);

    for (const pattern of REFACTOR_PATTERNS) {
      // Skip if type filter doesn't match
      if (types && types.length > 0 && !types.includes(pattern.type)) {
        continue;
      }

      // Skip console.log checks in test files
      if (isTestFile && pattern.id === 'other-console-log') {
        continue;
      }

      // Skip low confidence patterns if below threshold
      if (pattern.confidence < minConfidence) {
        continue;
      }

      // Apply pattern matching
      if (pattern.multiline) {
        const match = pattern.pattern.exec(content);
        if (match) {
          // Check minimum length if specified
          if (pattern.minLength && match[0].length < pattern.minLength) {
            continue;
          }

          const beforeMatch = content.slice(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;

          opportunities.push({
            opportunityId: randomUUID(),
            scanId,
            type: pattern.type,
            impact: pattern.impact,
            title: pattern.name,
            description: pattern.description,
            filePath,
            lineNumber,
            codeSnippet: match[0].slice(0, 200),
            suggestedRefactor: pattern.suggestion,
            confidence: pattern.confidence,
            detectedAt: new Date().toISOString(),
          });
        }
      } else {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const match = pattern.pattern.exec(line);
          if (match) {
            opportunities.push({
              opportunityId: randomUUID(),
              scanId,
              type: pattern.type,
              impact: pattern.impact,
              title: pattern.name,
              description: pattern.description,
              filePath,
              lineNumber: i + 1,
              codeSnippet: line.trim().slice(0, 200),
              suggestedRefactor: pattern.suggestion,
              confidence: pattern.confidence,
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Additional analysis: Function length check
    if (!types || types.length === 0 || types.includes('extract-function')) {
      const functionMatches = content.matchAll(
        /(?:function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))\s*[{(]/g
      );

      for (const match of functionMatches) {
        const funcName = match[1] ?? match[2];
        const startIdx = match.index! + match[0].length;

        // Count lines in function (simple heuristic)
        let braceCount = 1;
        let lineCount = 0;
        let idx = startIdx;

        while (idx < content.length && braceCount > 0) {
          if (content[idx] === '{') braceCount++;
          if (content[idx] === '}') braceCount--;
          if (content[idx] === '\n') lineCount++;
          idx++;
        }

        if (lineCount > 50) {
          const beforeMatch = content.slice(0, match.index);
          opportunities.push({
            opportunityId: randomUUID(),
            scanId,
            type: 'extract-function',
            impact: 'minor',
            title: `Long function: ${funcName}`,
            description: `Function "${funcName}" has ${lineCount} lines, consider breaking it down`,
            filePath,
            lineNumber: beforeMatch.split('\n').length,
            codeSnippet: match[0],
            suggestedRefactor: 'Extract logical sections into smaller, single-purpose functions',
            confidence: 0.8,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch {
    // File read error, skip
  }

  return opportunities;
}

/**
 * Filter opportunities by maximum impact
 */
function filterByImpact(
  opportunities: OpportunityRecord[],
  maxImpact: string | undefined
): OpportunityRecord[] {
  if (!maxImpact) return opportunities;

  const impactOrder: Record<string, number> = {
    trivial: 0,
    minor: 1,
    major: 2,
    breaking: 3,
  };

  const maxLevel = impactOrder[maxImpact] ?? 3;
  return opportunities.filter((o) => (impactOrder[o.impact] ?? 0) <= maxLevel);
}

/**
 * Handler for refactor_scan tool
 * INV-MCP-RESP-001: Response < 10KB with artifact storage for full results
 */
export const handleRefactorScan: ToolHandler = async (args) => {
  const paths = args.paths as string[];
  const maxFiles = (args.maxFiles as number) ?? 100;
  const types = args.types as string[] | undefined;
  const maxImpact = args.maxImpact as string | undefined;
  const minConfidence = (args.minConfidence as number) ?? 0.7;
  const excludePatterns = args.excludePatterns as string[] ?? [];

  try {
    const scanId = randomUUID();

    // Get files to scan
    const files = await getFilesToScan(paths, excludePatterns, maxFiles);

    if (files.length === 0) {
      return successResponse('No analyzable files found', {
        scanId,
        filesScanned: 0,
        count: 0,
      });
    }

    // Scan all files
    const allOpportunities: OpportunityRecord[] = [];
    for (const file of files) {
      const fileOpportunities = await scanFile(file, scanId, types, minConfidence);
      allOpportunities.push(...fileOpportunities);
    }

    // Filter by impact
    const filtered = filterByImpact(allOpportunities, maxImpact);

    // Sort by impact and confidence
    filtered.sort((a, b) => {
      const impactOrder: Record<string, number> = {
        breaking: 3, major: 2, minor: 1, trivial: 0,
      };
      const impactDiff = (impactOrder[b.impact] ?? 0) - (impactOrder[a.impact] ?? 0);
      if (impactDiff !== 0) return impactDiff;
      return b.confidence - a.confidence;
    });

    // Store opportunities and scan record
    for (const opp of filtered) {
      opportunityStore.set(opp.opportunityId, opp);
    }

    refactorScanStore.set(scanId, {
      scanId,
      paths,
      filesScanned: files.length,
      opportunitiesFound: filtered.map((o) => o.opportunityId),
      completedAt: new Date().toISOString(),
    });

    // Map impact to severity for response wrapper
    const impactToSeverity: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
      breaking: 'critical',
      major: 'high',
      minor: 'medium',
      trivial: 'low',
    };

    // Convert to ScanResultItem format for response wrapper
    const scanResults: ScanResultItem[] = filtered.map((o) => ({
      id: o.opportunityId,
      severity: impactToSeverity[o.impact] ?? 'info',
      message: o.title,
      file: o.filePath,
      line: o.lineNumber,
      type: o.type,
      confidence: o.confidence,
    }));

    // Use optimized scan response (returns top 5, stores rest in artifact)
    return createScanResponse(scanResults, {
      scanType: 'refactoring opportunities',
      scanId,
      topN: 5,
      artifactStore: storeArtifact,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse('SCAN_FAILED', message, { paths });
  }
};

/**
 * Handler for refactor_apply tool
 * INV-MCP-RESP-006: Response includes summary field
 */
export const handleRefactorApply: ToolHandler = async (args) => {
  const opportunityId = args.opportunityId as string;
  const dryRun = (args.dryRun as boolean) ?? true;

  try {
    const opportunity = opportunityStore.get(opportunityId);

    if (opportunity === undefined) {
      return errorResponse('OPPORTUNITY_NOT_FOUND', `Opportunity "${opportunityId}" not found`, { opportunityId });
    }

    // Return refactoring information with summary
    return successResponse(
      dryRun ? `Dry run: ${opportunity.title}` : `Ready: ${opportunity.title}`,
      {
        opportunityId,
        applied: false,
        opportunity: {
          title: opportunity.title,
          type: opportunity.type,
          impact: opportunity.impact,
          filePath: opportunity.filePath,
          lineNumber: opportunity.lineNumber,
        },
        suggestedRefactor: opportunity.suggestedRefactor?.slice(0, 200), // Truncate
        dryRun,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse('APPLY_FAILED', message, { opportunityId });
  }
};

/**
 * Handler for refactor_list tool
 * INV-MCP-RESP-002: Arrays limited to 10 items with pagination
 */
export const handleRefactorList: ToolHandler = async (args) => {
  const scanId = args.scanId as string | undefined;
  const type = args.type as string | undefined;
  const impact = args.impact as string | undefined;

  try {
    let opportunities = Array.from(opportunityStore.values());

    if (scanId !== undefined) {
      opportunities = opportunities.filter((o) => o.scanId === scanId);
    }
    if (type !== undefined) {
      opportunities = opportunities.filter((o) => o.type === type);
    }
    if (impact !== undefined) {
      opportunities = opportunities.filter((o) => o.impact === impact);
    }

    // Map impact to severity for display
    const impactToSeverity: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
      breaking: 'critical',
      major: 'high',
      minor: 'medium',
      trivial: 'low',
    };

    // Use createListResponse for automatic pagination (max 10 items)
    const listItems = opportunities.map((o) => ({
      id: o.opportunityId,
      label: o.title,
      severity: impactToSeverity[o.impact] ?? 'info',
      type: o.type,
      file: o.filePath,
    }));

    return createListResponse(listItems, {
      domain: 'refactoring opportunities',
      idField: 'id',
      labelField: 'label',
      limit: 10, // Enforce INV-MCP-RESP-002
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse('LIST_FAILED', message);
  }
};
