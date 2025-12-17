import type { MCPTool, ToolHandler } from '../types.js';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { resolve, extname, join } from 'path';
import {
  createScanResponse,
  createListResponse,
  successResponse,
  errorResponse,
  type ScanResultItem,
} from '../utils/response.js';
import { storeArtifact } from '../utils/artifact-store.js';

/**
 * Bugfix scan tool definition
 */
export const bugfixScanTool: MCPTool = {
  name: 'bugfix_scan',
  description: 'Scan code for potential bugs (resource leaks, null references, type errors, etc.)',
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
      categories: {
        type: 'array',
        description:
          'Bug categories to scan for (resource-leak, memory-leak, timer-leak, null-reference, type-error, logic-error, concurrency, security, performance, other)',
        items: { type: 'string' },
      },
      minSeverity: {
        type: 'string',
        description: 'Minimum severity to report (critical, high, medium, low, info)',
        enum: ['critical', 'high', 'medium', 'low', 'info'],
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
      useAst: {
        type: 'boolean',
        description: 'Use AST-based analysis for deeper detection',
        default: true,
      },
    },
    required: ['paths'],
  },
};

/**
 * Bugfix run tool definition
 */
export const bugfixRunTool: MCPTool = {
  name: 'bugfix_run',
  description: 'Attempt to fix a detected bug',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      bugId: {
        type: 'string',
        description: 'Bug ID from the scan results',
      },
      autoApply: {
        type: 'boolean',
        description: 'Automatically apply the fix',
        default: false,
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview fix without applying',
        default: true,
      },
      createBackup: {
        type: 'boolean',
        description: 'Create backup before applying fix',
        default: true,
      },
    },
    required: ['bugId'],
  },
};

/**
 * Bugfix list tool definition
 */
export const bugfixListTool: MCPTool = {
  name: 'bugfix_list',
  description: 'List detected bugs from previous scans',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      scanId: {
        type: 'string',
        description: 'Filter by scan ID',
      },
      severity: {
        type: 'string',
        description: 'Filter by severity',
        enum: ['critical', 'high', 'medium', 'low', 'info'],
      },
      category: {
        type: 'string',
        description: 'Filter by category',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 50,
      },
    },
  },
};

// In-memory storage for detected bugs
const bugStore = new Map<string, BugRecord>();
const scanStore = new Map<string, ScanRecord>();

interface BugRecord {
  bugId: string;
  scanId: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  lineEnd?: number;
  codeSnippet?: string;
  suggestedFix?: string;
  confidence: number;
  detectedAt: string;
}

interface ScanRecord {
  scanId: string;
  paths: string[];
  filesScanned: number;
  bugsFound: string[];
  completedAt: string;
}

// Bug detection patterns
interface BugPattern {
  id: string;
  name: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  pattern: RegExp;
  description: string;
  suggestion: string;
  confidence: number;
  multiline?: boolean;
}

const BUG_PATTERNS: BugPattern[] = [
  // Resource Leaks
  {
    id: 'resource-leak-fs-open',
    name: 'Unclosed file handle',
    category: 'resource-leak',
    severity: 'high',
    pattern: /\b(fs\.open(?:Sync)?|fs\.createReadStream|fs\.createWriteStream)\s*\([^)]+\)(?![\s\S]*?\.close\(\))/,
    description: 'File handle opened but not closed, may cause resource exhaustion',
    suggestion: 'Ensure file handle is closed in a finally block or use fs.promises with automatic cleanup',
    confidence: 0.7,
    multiline: true,
  },
  {
    id: 'resource-leak-event-listener',
    name: 'Event listener not removed',
    category: 'resource-leak',
    severity: 'medium',
    pattern: /\.addEventListener\s*\([^)]+\)(?![\s\S]{0,500}\.removeEventListener)/,
    description: 'Event listener added but not removed, may cause memory leaks',
    suggestion: 'Remove event listeners in cleanup/unmount functions',
    confidence: 0.6,
    multiline: true,
  },

  // Timer Leaks
  {
    id: 'timer-leak-interval',
    name: 'setInterval without clearInterval',
    category: 'timer-leak',
    severity: 'high',
    pattern: /setInterval\s*\([^)]+\)(?![\s\S]{0,300}clearInterval)/,
    description: 'setInterval created but not cleared, causes memory leak and continued execution',
    suggestion: 'Store interval ID and call clearInterval in cleanup',
    confidence: 0.75,
    multiline: true,
  },
  {
    id: 'timer-leak-timeout',
    name: 'setTimeout in loop without cleanup',
    category: 'timer-leak',
    severity: 'medium',
    pattern: /(?:while|for)\s*\([^)]*\)\s*\{[^}]*setTimeout/,
    description: 'setTimeout inside loop may create many pending timers',
    suggestion: 'Consider using single setTimeout with recursion or async/await with delay',
    confidence: 0.65,
    multiline: true,
  },

  // Null/Undefined References
  {
    id: 'null-ref-optional-chain-missing',
    name: 'Missing optional chaining',
    category: 'null-reference',
    severity: 'medium',
    pattern: /(\w+)\s*&&\s*\1\.\w+\s*&&\s*\1\.\w+\.\w+/,
    description: 'Repeated null checks could use optional chaining (?.) for clarity',
    suggestion: 'Replace with optional chaining: object?.property?.nested',
    confidence: 0.8,
  },
  {
    id: 'null-ref-array-access',
    name: 'Unchecked array access',
    category: 'null-reference',
    severity: 'medium',
    pattern: /\[\s*(\w+)\s*\](?!\s*\?\?|\s*\|\||\s*\?\.)(?=\s*\.)/,
    description: 'Array element accessed without null check before property access',
    suggestion: 'Add optional chaining: array[index]?.property or check for undefined first',
    confidence: 0.6,
  },

  // Type Errors
  {
    id: 'type-error-any-cast',
    name: 'Unsafe any cast',
    category: 'type-error',
    severity: 'medium',
    pattern: /as\s+any(?!\[\])/,
    description: 'Casting to any loses type safety',
    suggestion: 'Use specific type or unknown with type guards instead of any',
    confidence: 0.85,
  },
  {
    id: 'type-error-non-null-assertion',
    name: 'Non-null assertion',
    category: 'type-error',
    severity: 'low',
    pattern: /!\s*\.\w+|!\s*\[/,
    description: 'Non-null assertion (!) bypasses type checking',
    suggestion: 'Add proper null checks or use optional chaining instead',
    confidence: 0.7,
  },

  // Logic Errors
  {
    id: 'logic-error-assignment-in-condition',
    name: 'Assignment in condition',
    category: 'logic-error',
    severity: 'high',
    pattern: /if\s*\(\s*\w+\s*=\s*[^=]/,
    description: 'Assignment (=) used in condition instead of comparison (==, ===)',
    suggestion: 'Use === for comparison or extract assignment before the if statement',
    confidence: 0.9,
  },
  {
    id: 'logic-error-loose-equality',
    name: 'Loose equality comparison',
    category: 'logic-error',
    severity: 'low',
    pattern: /[^!=]==(?!=)|[^!]==[^=]/,
    description: 'Loose equality (==) may cause unexpected type coercion',
    suggestion: 'Use strict equality (===) for predictable comparisons',
    confidence: 0.6,
  },
  {
    id: 'logic-error-empty-catch',
    name: 'Empty catch block',
    category: 'logic-error',
    severity: 'medium',
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
    description: 'Empty catch block silently swallows errors',
    suggestion: 'Log the error or re-throw if the error cannot be handled',
    confidence: 0.95,
  },

  // Concurrency Issues
  {
    id: 'concurrency-race-condition',
    name: 'Potential race condition',
    category: 'concurrency',
    severity: 'high',
    pattern: /await\s+Promise\.all\s*\([^)]*\.map\s*\([^)]*=>\s*[^)]*\+\+|await\s+Promise\.all[^)]*\+\+/,
    description: 'Shared mutable state accessed in parallel promises',
    suggestion: 'Use atomic operations or collect results instead of mutating shared state',
    confidence: 0.7,
    multiline: true,
  },
  {
    id: 'concurrency-missing-await',
    name: 'Missing await on async call',
    category: 'concurrency',
    severity: 'high',
    pattern: /(?<!await\s)(?<!return\s)(?<!\.\s)(?<!then\()(?<!catch\()async\s+function|\b(?<!await\s)(?<!return\s)\w+Async\s*\(/,
    description: 'Async function called without await may cause unhandled promise',
    suggestion: 'Add await keyword or handle the returned promise',
    confidence: 0.5,
  },

  // Security Issues
  {
    id: 'security-eval',
    name: 'Use of eval()',
    category: 'security',
    severity: 'critical',
    pattern: /\beval\s*\(/,
    description: 'eval() executes arbitrary code and is a security risk',
    suggestion: 'Use JSON.parse for JSON data or safer alternatives like Function constructor with caution',
    confidence: 0.95,
  },
  {
    id: 'security-innerhtml',
    name: 'innerHTML with dynamic content',
    category: 'security',
    severity: 'high',
    pattern: /\.innerHTML\s*=\s*(?!['"`])/,
    description: 'Setting innerHTML with dynamic content may cause XSS vulnerabilities',
    suggestion: 'Use textContent for text or sanitize HTML before insertion',
    confidence: 0.85,
  },
  {
    id: 'security-hardcoded-secret',
    name: 'Hardcoded secret',
    category: 'security',
    severity: 'critical',
    pattern: /(?:password|secret|api_key|apikey|auth_token|access_token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    description: 'Hardcoded credentials or secrets in source code',
    suggestion: 'Use environment variables or secure secret management',
    confidence: 0.8,
  },
  {
    id: 'security-sql-injection',
    name: 'Potential SQL injection',
    category: 'security',
    severity: 'critical',
    pattern: /(?:query|execute)\s*\(\s*[`'"]\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP)[^`'"]*\$\{/i,
    description: 'String interpolation in SQL query may allow SQL injection',
    suggestion: 'Use parameterized queries or prepared statements',
    confidence: 0.85,
    multiline: true,
  },

  // Performance Issues
  {
    id: 'performance-sync-fs',
    name: 'Synchronous file system operation',
    category: 'performance',
    severity: 'medium',
    pattern: /fs\.(?:readFileSync|writeFileSync|existsSync|mkdirSync|readdirSync|statSync|unlinkSync|rmdirSync)\s*\(/,
    description: 'Synchronous file operations block the event loop',
    suggestion: 'Use async versions: fs.promises.readFile, fs.promises.writeFile, etc.',
    confidence: 0.9,
  },
  {
    id: 'performance-nested-loops',
    name: 'Deeply nested loops',
    category: 'performance',
    severity: 'medium',
    pattern: /for\s*\([^)]+\)\s*\{[^}]*for\s*\([^)]+\)\s*\{[^}]*for\s*\([^)]+\)\s*\{/,
    description: 'Triple nested loops may have O(n³) complexity',
    suggestion: 'Consider using hash maps, early returns, or restructuring the algorithm',
    confidence: 0.75,
    multiline: true,
  },
  {
    id: 'performance-array-in-loop',
    name: 'Array method creating functions in loop',
    category: 'performance',
    severity: 'low',
    pattern: /(?:map|filter|reduce|forEach)\s*\([^)]*=>[^)]*(?:map|filter|reduce|forEach)\s*\([^)]*=>/,
    description: 'Chained array methods create intermediate arrays',
    suggestion: 'Consider using a single reduce or traditional loop for large arrays',
    confidence: 0.6,
    multiline: true,
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
 * Scan a single file for bugs
 */
async function scanFile(
  filePath: string,
  scanId: string,
  categories?: string[]
): Promise<BugRecord[]> {
  const bugs: BugRecord[] = [];

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const pattern of BUG_PATTERNS) {
      // Skip if category filter doesn't match
      if (categories && categories.length > 0 && !categories.includes(pattern.category)) {
        continue;
      }

      // Apply pattern matching
      if (pattern.multiline) {
        // For multiline patterns, search the whole content
        const match = pattern.pattern.exec(content);
        if (match) {
          // Find line number
          const beforeMatch = content.slice(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;

          bugs.push({
            bugId: randomUUID(),
            scanId,
            category: pattern.category,
            severity: pattern.severity,
            title: pattern.name,
            description: pattern.description,
            filePath,
            lineNumber,
            codeSnippet: match[0].slice(0, 200),
            suggestedFix: pattern.suggestion,
            confidence: pattern.confidence,
            detectedAt: new Date().toISOString(),
          });
        }
      } else {
        // For single-line patterns, search line by line
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const match = pattern.pattern.exec(line);
          if (match) {
            bugs.push({
              bugId: randomUUID(),
              scanId,
              category: pattern.category,
              severity: pattern.severity,
              title: pattern.name,
              description: pattern.description,
              filePath,
              lineNumber: i + 1,
              codeSnippet: line.trim().slice(0, 200),
              suggestedFix: pattern.suggestion,
              confidence: pattern.confidence,
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  } catch {
    // File read error, skip
  }

  return bugs;
}

/**
 * Filter bugs by minimum severity
 */
function filterBySeverity(
  bugs: BugRecord[],
  minSeverity: string | undefined
): BugRecord[] {
  if (!minSeverity) return bugs;

  const severityOrder: Record<string, number> = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  const minLevel = severityOrder[minSeverity] ?? 0;
  return bugs.filter((b) => (severityOrder[b.severity] ?? 0) >= minLevel);
}

/**
 * Handler for bugfix_scan tool
 * INV-MCP-RESP-001: Response < 10KB with artifact storage for full results
 */
export const handleBugfixScan: ToolHandler = async (args) => {
  const paths = args.paths as string[];
  const maxFiles = (args.maxFiles as number) ?? 100;
  const categories = args.categories as string[] | undefined;
  const minSeverity = args.minSeverity as string | undefined;
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
    const allBugs: BugRecord[] = [];
    for (const file of files) {
      const fileBugs = await scanFile(file, scanId, categories);
      allBugs.push(...fileBugs);
    }

    // Filter by severity
    const filteredBugs = filterBySeverity(allBugs, minSeverity);

    // Sort by severity and confidence
    filteredBugs.sort((a, b) => {
      const severityOrder: Record<string, number> = {
        critical: 4, high: 3, medium: 2, low: 1, info: 0,
      };
      const severityDiff = (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });

    // Store bugs and scan record
    for (const bug of filteredBugs) {
      bugStore.set(bug.bugId, bug);
    }

    scanStore.set(scanId, {
      scanId,
      paths,
      filesScanned: files.length,
      bugsFound: filteredBugs.map((b) => b.bugId),
      completedAt: new Date().toISOString(),
    });

    // Convert to ScanResultItem format for response wrapper
    const scanResults: ScanResultItem[] = filteredBugs.map((b) => ({
      id: b.bugId,
      severity: b.severity,
      message: b.title,
      file: b.filePath,
      line: b.lineNumber,
      category: b.category,
      confidence: b.confidence,
    }));

    // Use optimized scan response (returns top 5, stores rest in artifact)
    return createScanResponse(scanResults, {
      scanType: 'bugs',
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
 * Handler for bugfix_run tool
 * INV-MCP-RESP-006: Response includes summary field
 */
export const handleBugfixRun: ToolHandler = async (args) => {
  const bugId = args.bugId as string;
  const dryRun = (args.dryRun as boolean) ?? true;

  try {
    const bug = bugStore.get(bugId);

    if (bug === undefined) {
      return errorResponse('BUG_NOT_FOUND', `Bug "${bugId}" not found`, { bugId });
    }

    // Return fix information with summary
    return successResponse(
      dryRun ? `Dry run: ${bug.title}` : `Fix ready: ${bug.title}`,
      {
        bugId,
        fixed: false,
        applied: false,
        bug: {
          title: bug.title,
          category: bug.category,
          severity: bug.severity,
          filePath: bug.filePath,
          lineNumber: bug.lineNumber,
        },
        suggestedFix: bug.suggestedFix?.slice(0, 200), // Truncate
        dryRun,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse('FIX_FAILED', message, { bugId });
  }
};

/**
 * Handler for bugfix_list tool
 * INV-MCP-RESP-002: Arrays limited to 10 items with pagination
 */
export const handleBugfixList: ToolHandler = async (args) => {
  const scanId = args.scanId as string | undefined;
  const severity = args.severity as string | undefined;
  const category = args.category as string | undefined;

  try {
    let bugs = Array.from(bugStore.values());

    if (scanId !== undefined) {
      bugs = bugs.filter((b) => b.scanId === scanId);
    }
    if (severity !== undefined) {
      bugs = bugs.filter((b) => b.severity === severity);
    }
    if (category !== undefined) {
      bugs = bugs.filter((b) => b.category === category);
    }

    // Use createListResponse for automatic pagination (max 10 items)
    const listItems = bugs.map((b) => ({
      id: b.bugId,
      label: b.title,
      severity: b.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
      category: b.category,
      file: b.filePath,
    }));

    return createListResponse(listItems, {
      domain: 'bugs',
      idField: 'id',
      labelField: 'label',
      limit: 10, // Enforce INV-MCP-RESP-002
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse('LIST_FAILED', message);
  }
};
