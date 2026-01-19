/**
 * Review Service
 *
 * Orchestrates the AI code review process.
 * Implements:
 * - INV-REV-OPS-001: Timeout Handling
 * - INV-REV-OPS-002: Provider Fallback
 *
 * Performance optimizations:
 * - Tier 1 (v13.4.0): Async file I/O with fs.promises, concurrent file reading with p-limit,
 *   .gitignore-aware filtering, content-hash caching for LLM responses
 * - Tier 2 (v13.5.0): Smart batching by focus mode, --since <commit> git filtering,
 *   provider-aware timeout configuration
 * - Tier 3 (v13.5.0): Dependency graph construction for file ordering, memory management
 *   for large codebases, partial result recovery on failure
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import pLimit from 'p-limit';
import {
  type ReviewRequest,
  type ReviewResult,
  type ReviewFocus,
  createReviewSummary,
  sortCommentsBySeverity,
  ReviewErrorCode,
  TIMEOUT_PROVIDER_DEFAULT,
  CODE_EXTENSIONS,
  IGNORE_DIRECTORIES,
} from '@defai.digital/contracts';
import { buildReviewPrompt } from './focus-modes.js';
import { parseReviewResponse, filterCommentsByConfidence } from './comment-builder.js';
import { formatReviewAsMarkdown, formatCompactSummary } from './markdown-formatter.js';
import { formatReviewAsSarif, formatSarifAsJson } from './sarif-formatter.js';
import type {
  FileContent,
  ReviewServiceConfig,
  ReviewPromptExecutor,
  ReviewExecutionOptions,
  DryRunResult,
  FileBatch,
  ProviderTimeoutConfig,
  DependencyNode,
  PartialReviewResult,
} from './types.js';

const execAsync = promisify(exec);

// Use createRequire for CJS package interop with the 'ignore' package
const require = createRequire(import.meta.url);
const ignore: () => IgnoreInstance = require('ignore');

// Type definition for the ignore package
interface IgnoreInstance {
  add(patterns: string | readonly string[]): this;
  ignores(pathname: string): boolean;
  filter(pathnames: readonly string[]): string[];
}

/**
 * Concurrency limit for file I/O operations
 * Balances throughput with system resource usage
 */
const FILE_IO_CONCURRENCY = 15;

/**
 * Maximum files to hold in memory at once for large codebase memory management (Tier 3)
 */
const MAX_FILES_IN_MEMORY = 50;

/**
 * Batch size for smart batching (Tier 2)
 */
const SMART_BATCH_SIZE = 10;

/**
 * Cache entry for LLM responses
 */
interface CacheEntry {
  response: { content: string; providerId: string; modelId: string };
  timestamp: number;
}

/**
 * In-memory cache for LLM responses, keyed by content hash
 * Cache entries expire after 1 hour
 */
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * In-memory store for partial results recovery (Tier 3)
 */
const partialResultsStore = new Map<string, PartialReviewResult>();

/**
 * Provider-aware timeout configuration (Tier 2)
 * Different providers have different performance characteristics
 */
const PROVIDER_TIMEOUT_CONFIGS: Record<string, ProviderTimeoutConfig> = {
  claude: {
    providerId: 'claude',
    baseTimeoutMs: 60000,
    perFileTimeoutMs: 5000,
    maxTimeoutMs: 300000,
  },
  gemini: {
    providerId: 'gemini',
    baseTimeoutMs: 45000,
    perFileTimeoutMs: 4000,
    maxTimeoutMs: 240000,
  },
  codex: {
    providerId: 'codex',
    baseTimeoutMs: 90000,
    perFileTimeoutMs: 6000,
    maxTimeoutMs: 360000,
  },
  grok: {
    providerId: 'grok',
    baseTimeoutMs: 50000,
    perFileTimeoutMs: 4500,
    maxTimeoutMs: 250000,
  },
  default: {
    providerId: 'default',
    baseTimeoutMs: 60000,
    perFileTimeoutMs: 5000,
    maxTimeoutMs: 300000,
  },
};

/**
 * File patterns relevant for each focus mode (Tier 2 - Smart Batching)
 */
const FOCUS_MODE_FILE_PATTERNS: Record<ReviewFocus, { high: RegExp[]; medium: RegExp[]; low: RegExp[] }> = {
  security: {
    high: [
      /auth/i, /login/i, /password/i, /credential/i, /token/i,
      /crypto/i, /encrypt/i, /decrypt/i, /hash/i, /secret/i,
      /sanitize/i, /validate/i, /sql/i, /query/i, /api/i,
      /middleware/i, /session/i, /permission/i, /role/i,
    ],
    medium: [/controller/i, /handler/i, /route/i, /service/i, /util/i],
    low: [/test/i, /spec/i, /mock/i, /fixture/i],
  },
  architecture: {
    high: [
      /index\.(ts|js)$/i, /main\.(ts|js)$/i, /app\.(ts|js)$/i,
      /module/i, /interface/i, /contract/i, /factory/i,
      /repository/i, /service/i, /domain/i,
    ],
    medium: [/controller/i, /handler/i, /adapter/i, /port/i],
    low: [/test/i, /spec/i, /mock/i, /util/i, /helper/i],
  },
  performance: {
    high: [
      /loop/i, /batch/i, /cache/i, /queue/i, /worker/i,
      /stream/i, /buffer/i, /async/i, /parallel/i,
      /database/i, /query/i, /sql/i, /orm/i,
    ],
    medium: [/service/i, /handler/i, /process/i, /transform/i],
    low: [/test/i, /spec/i, /mock/i, /config/i],
  },
  maintainability: {
    high: [/util/i, /helper/i, /common/i, /shared/i, /lib/i],
    medium: [/service/i, /handler/i, /controller/i],
    low: [/test/i, /spec/i, /mock/i],
  },
  correctness: {
    high: [
      /calculator/i, /parser/i, /validator/i, /transform/i,
      /convert/i, /format/i, /process/i,
    ],
    medium: [/service/i, /handler/i, /util/i],
    low: [/test/i, /spec/i, /mock/i, /type/i, /interface/i],
  },
  all: {
    high: [],
    medium: [],
    low: [/test/i, /spec/i, /mock/i, /fixture/i],
  },
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ReviewServiceConfig> = {
  defaultProvider: 'claude',
  defaultTimeoutMs: TIMEOUT_PROVIDER_DEFAULT,
  providerFallbackOrder: ['claude', 'gemini', 'codex'],
};

/**
 * Review service for orchestrating AI code review
 */
export class ReviewService {
  private readonly config: Required<ReviewServiceConfig>;
  private readonly promptExecutor: ReviewPromptExecutor | undefined;

  constructor(config?: ReviewServiceConfig, promptExecutor?: ReviewPromptExecutor) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.promptExecutor = promptExecutor;
  }

  /**
   * Execute a code review
   * INV-REV-OPS-001: Reviews MUST complete or fail within configured timeout
   */
  async review(
    request: ReviewRequest,
    options?: ReviewExecutionOptions
  ): Promise<ReviewResult> {
    const startTime = Date.now();
    const resultId = uuidv4();
    const requestId = request.requestId ?? uuidv4();
    const providerId = options?.providerId ?? request.providerId ?? this.config.defaultProvider;

    // Handle dry run
    if (request.dryRun || options?.dryRun) {
      const dryRun = await this.dryRun(request);
      return this.createEmptyResult(request, resultId, dryRun, startTime);
    }

    // Initialize partial result for recovery (Tier 3)
    if (request.enableRecovery !== false) {
      this.initializePartialResult(requestId);
    }

    try {
      // Collect files to review (with optional git filtering)
      let files = await this.collectFiles(
        request.paths,
        request.maxFiles,
        request.maxLinesPerFile,
        request.since // Tier 2: --since flag
      );

      if (files.length === 0) {
        throw new ReviewError(ReviewErrorCode.NO_FILES_FOUND, 'No files found to review');
      }

      // Tier 3: Build dependency graph for file ordering
      if (request.dependencyOrdering) {
        files = await this.orderByDependencies(files);
      }

      // Tier 2: Smart batching by focus mode
      let response: { content: string; providerId: string; modelId: string };

      if (request.smartBatching !== false && files.length > SMART_BATCH_SIZE) {
        response = await this.executeWithSmartBatching(
          files,
          request.focus,
          request.context,
          providerId,
          request.timeoutMs,
          requestId,
          request.enableRecovery !== false
        );
      } else {
        // Build prompt for all files at once
        const prompt = buildReviewPrompt(request.focus, files, request.context);

        // Calculate provider-aware timeout (Tier 2)
        const timeoutMs = this.calculateProviderTimeout(providerId, files.length, request.timeoutMs);

        // Execute with timeout
        response = await this.executeWithTimeout(prompt, providerId, timeoutMs);
      }

      // Parse response
      const parsed = parseReviewResponse(response.content, request.focus, request.minConfidence);

      // Filter by confidence (INV-REV-002)
      const filteredComments = filterCommentsByConfidence(parsed.comments, request.minConfidence);

      // Sort by severity (INV-REV-OUT-001)
      const sortedComments = sortCommentsBySeverity(filteredComments);

      // Build summary
      const summary = createReviewSummary(sortedComments);

      const result: ReviewResult = {
        resultId,
        requestId,
        comments: sortedComments,
        summary,
        filesReviewed: files.map((f) => f.path),
        linesAnalyzed: files.reduce((sum, f) => sum + f.lineCount, 0),
        providerId: response.providerId,
        modelId: response.modelId,
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      };

      // Clean up partial result on success
      if (request.enableRecovery !== false) {
        partialResultsStore.delete(requestId);
      }

      return result;
    } catch (error) {
      // Tier 3: Update partial result with error
      if (request.enableRecovery !== false) {
        this.updatePartialResultError(requestId, error instanceof Error ? error.message : 'Unknown error');
      }

      if (error instanceof Error && error.message.includes('timeout')) {
        throw new ReviewError(ReviewErrorCode.TIMEOUT, `Review timed out: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Execute dry run - show what would be analyzed
   */
  async dryRun(request: ReviewRequest): Promise<DryRunResult> {
    const files = await this.collectFiles(
      request.paths,
      request.maxFiles,
      request.maxLinesPerFile,
      request.since
    );

    return {
      files: files.map((f) => f.path),
      totalLines: files.reduce((sum, f) => sum + f.lineCount, 0),
      focus: request.focus,
      estimatedDurationMs: files.length * 5000, // Rough estimate: 5s per file
    };
  }

  /**
   * Recover partial results from a failed review (Tier 3)
   */
  getPartialResult(requestId: string): PartialReviewResult | undefined {
    return partialResultsStore.get(requestId);
  }

  /**
   * Resume a failed review from partial results (Tier 3)
   */
  async resumeFromPartial(
    requestId: string,
    request: ReviewRequest,
    options?: ReviewExecutionOptions
  ): Promise<ReviewResult> {
    const partial = partialResultsStore.get(requestId);
    if (!partial) {
      throw new ReviewError(ReviewErrorCode.INVALID_INPUT, `No partial result found for request ${requestId}`);
    }

    // Continue from where we left off by excluding already reviewed files
    const modifiedRequest: ReviewRequest = {
      ...request,
      requestId,
    };

    // The review will pick up from partial comments in the store
    return this.review(modifiedRequest, options);
  }

  /**
   * Format result based on output format
   */
  formatResult(result: ReviewResult, format: 'markdown' | 'json' | 'sarif'): string {
    switch (format) {
      case 'markdown':
        return formatReviewAsMarkdown(result);
      case 'sarif':
        return formatSarifAsJson(formatReviewAsSarif(result));
      case 'json':
        return JSON.stringify(result, null, 2);
    }
  }

  /**
   * Get compact summary for CLI
   */
  getCompactSummary(result: ReviewResult): string {
    return formatCompactSummary(result);
  }

  /**
   * Execute with smart batching by focus mode (Tier 2)
   * Groups files by relevance to the focus mode and processes high-priority files first
   */
  private async executeWithSmartBatching(
    files: FileContent[],
    focus: ReviewFocus,
    context: string | undefined,
    providerId: string,
    baseTimeoutMs: number | undefined,
    requestId: string,
    enableRecovery: boolean
  ): Promise<{ content: string; providerId: string; modelId: string }> {
    // Create batches based on focus mode relevance
    const batches = this.createSmartBatches(files, focus);

    const allResponses: string[] = [];
    let lastProviderId = providerId;
    let lastModelId = 'unknown';

    // Process batches in priority order (high priority first)
    for (const batch of batches.sort((a, b) => b.priority - a.priority)) {
      // Skip empty batches
      if (batch.files.length === 0) continue;

      const prompt = buildReviewPrompt(focus, batch.files, context);
      const timeoutMs = this.calculateProviderTimeout(providerId, batch.files.length, baseTimeoutMs);

      try {
        const response = await this.executeWithTimeout(prompt, providerId, timeoutMs);
        allResponses.push(response.content);
        lastProviderId = response.providerId;
        lastModelId = response.modelId;

        // Update partial result on batch success (Tier 3)
        if (enableRecovery) {
          this.updatePartialResultBatch(requestId, batch.batchId, batch.files.map((f) => f.path));
        }
      } catch (error) {
        // On batch failure, record it but continue with other batches
        if (enableRecovery) {
          this.recordFailedBatch(requestId, batch.batchId);
        }
        // Re-throw if this is a critical batch (high priority)
        if (batch.priority >= 3) {
          throw error;
        }
        // Continue processing other batches for lower priority failures
      }
    }

    if (allResponses.length === 0) {
      throw new ReviewError(ReviewErrorCode.REVIEW_FAILED, 'All batches failed');
    }

    // Merge responses from all batches
    const mergedContent = this.mergeJsonArrayResponses(allResponses);

    return {
      content: mergedContent,
      providerId: lastProviderId,
      modelId: lastModelId,
    };
  }

  /**
   * Create smart batches based on focus mode (Tier 2)
   */
  private createSmartBatches(files: FileContent[], focus: ReviewFocus): FileBatch[] {
    const patterns = FOCUS_MODE_FILE_PATTERNS[focus];
    const highPriority: FileContent[] = [];
    const mediumPriority: FileContent[] = [];
    const lowPriority: FileContent[] = [];
    const general: FileContent[] = [];

    for (const file of files) {
      const filename = path.basename(file.path);
      const filepath = file.path;

      if (patterns.high.some((p) => p.test(filename) || p.test(filepath))) {
        highPriority.push(file);
      } else if (patterns.medium.some((p) => p.test(filename) || p.test(filepath))) {
        mediumPriority.push(file);
      } else if (patterns.low.some((p) => p.test(filename) || p.test(filepath))) {
        lowPriority.push(file);
      } else {
        general.push(file);
      }
    }

    const batches: FileBatch[] = [];

    // Create batches from each priority level
    const createBatchesFromFiles = (
      fileList: FileContent[],
      priority: number,
      category: FileBatch['category']
    ) => {
      for (let i = 0; i < fileList.length; i += SMART_BATCH_SIZE) {
        batches.push({
          batchId: uuidv4(),
          files: fileList.slice(i, i + SMART_BATCH_SIZE),
          priority,
          category,
        });
      }
    };

    createBatchesFromFiles(highPriority, 3, this.getFocusCategory(focus));
    createBatchesFromFiles(mediumPriority, 2, 'general');
    createBatchesFromFiles(general, 1, 'general');
    createBatchesFromFiles(lowPriority, 0, 'test');

    return batches;
  }

  /**
   * Get the primary category for a focus mode
   */
  private getFocusCategory(focus: ReviewFocus): FileBatch['category'] {
    switch (focus) {
      case 'security':
        return 'security';
      case 'architecture':
        return 'architecture';
      case 'performance':
        return 'performance';
      default:
        return 'general';
    }
  }

  /**
   * Merge multiple JSON array responses into one
   */
  private mergeJsonArrayResponses(responses: string[]): string {
    const allComments: unknown[] = [];

    for (const response of responses) {
      try {
        // Try to extract JSON array from response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            allComments.push(...parsed);
          }
        }
      } catch {
        // Skip unparseable responses
      }
    }

    return JSON.stringify(allComments);
  }

  /**
   * Calculate provider-aware timeout (Tier 2)
   */
  private calculateProviderTimeout(
    providerId: string,
    fileCount: number,
    requestedTimeoutMs?: number
  ): number {
    const config = PROVIDER_TIMEOUT_CONFIGS[providerId] ?? PROVIDER_TIMEOUT_CONFIGS['default'];
    // Default config is guaranteed to exist
    const safeConfig = config!;

    // Calculate based on file count
    const calculatedTimeout = safeConfig.baseTimeoutMs + fileCount * safeConfig.perFileTimeoutMs;

    // Use requested timeout if provided, otherwise use calculated
    const timeout = requestedTimeoutMs ?? calculatedTimeout;

    // Clamp to max
    return Math.min(timeout, safeConfig.maxTimeoutMs);
  }

  /**
   * Collect files from paths with async I/O, .gitignore filtering, and optional git diff (Tier 2)
   * Performance: Uses p-limit for controlled concurrency
   */
  private async collectFiles(
    paths: string[],
    maxFiles: number,
    maxLinesPerFile: number,
    since?: string // Tier 2: --since flag
  ): Promise<FileContent[]> {
    // If --since is provided, use git to get changed files
    if (since) {
      return this.collectChangedFilesSince(paths, maxFiles, maxLinesPerFile, since);
    }

    const seen = new Set<string>();
    const filePaths: string[] = [];

    // First pass: collect all file paths (fast, low I/O)
    for (const p of paths) {
      const resolved = path.resolve(p);

      try {
        const stat = await fs.stat(resolved);

        if (stat.isDirectory()) {
          // Load .gitignore filter for this directory
          const ig = await this.loadGitignore(resolved);
          // Recursively collect file paths from directory
          await this.collectPathsFromDirectory(resolved, resolved, filePaths, seen, maxFiles, ig);
        } else if (stat.isFile()) {
          if (!seen.has(resolved) && filePaths.length < maxFiles) {
            filePaths.push(resolved);
            seen.add(resolved);
          }
        }
      } catch {
        // Skip inaccessible files/directories
        continue;
      }
    }

    // Tier 3: Memory management - limit files loaded at once
    const filesToRead = filePaths.slice(0, Math.min(maxFiles, MAX_FILES_IN_MEMORY));

    // Second pass: read files concurrently with p-limit
    const limit = pLimit(FILE_IO_CONCURRENCY);
    const readPromises = filesToRead.map((filePath) =>
      limit(() => this.readFileAsync(filePath, maxLinesPerFile))
    );

    const results = await Promise.all(readPromises);
    return results.filter((f): f is FileContent => f !== null);
  }

  /**
   * Collect files changed since a specific git commit (Tier 2)
   */
  private async collectChangedFilesSince(
    basePaths: string[],
    maxFiles: number,
    maxLinesPerFile: number,
    since: string
  ): Promise<FileContent[]> {
    // Determine the working directory (use first path's directory or current)
    const firstPath = basePaths[0];
    const workDir = firstPath ? path.dirname(path.resolve(firstPath)) : process.cwd();

    try {
      // Get list of changed files since the commit
      const { stdout } = await execAsync(`git diff --name-only ${since}...HEAD`, {
        cwd: workDir,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large repos
      });

      const changedFiles = stdout
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
        .map((f) => path.resolve(workDir, f));

      // Filter to only include files that match base paths
      const relevantFiles: string[] = [];
      for (const file of changedFiles) {
        for (const basePath of basePaths) {
          const resolved = path.resolve(basePath);
          if (file.startsWith(resolved) || file === resolved) {
            relevantFiles.push(file);
            break;
          }
        }
      }

      // Also check if any base path is a file that's in the changed list
      for (const basePath of basePaths) {
        const resolved = path.resolve(basePath);
        if (changedFiles.includes(resolved) && !relevantFiles.includes(resolved)) {
          relevantFiles.push(resolved);
        }
      }

      // Limit to maxFiles
      const filesToRead = relevantFiles.slice(0, Math.min(maxFiles, MAX_FILES_IN_MEMORY));

      // Filter to code extensions
      const codeFiles = filesToRead.filter((f) => {
        const ext = path.extname(f);
        return CODE_EXTENSIONS.includes(ext as typeof CODE_EXTENSIONS[number]);
      });

      // Read files concurrently
      const limit = pLimit(FILE_IO_CONCURRENCY);
      const readPromises = codeFiles.map((filePath) =>
        limit(() => this.readFileAsync(filePath, maxLinesPerFile))
      );

      const results = await Promise.all(readPromises);
      return results.filter((f): f is FileContent => f !== null);
    } catch (error) {
      // If git command fails, fall back to regular file collection
      console.warn(`Git diff failed, falling back to regular file collection: ${error}`);
      return this.collectFiles(basePaths, maxFiles, maxLinesPerFile, undefined);
    }
  }

  /**
   * Order files by dependency graph (Tier 3)
   * Files with more dependents are reviewed first for better context
   */
  private async orderByDependencies(files: FileContent[]): Promise<FileContent[]> {
    const graph = await this.buildDependencyGraph(files);

    // Sort by number of importedBy (files that depend on this file)
    // Files with more dependents should be reviewed first
    return [...files].sort((a, b) => {
      const nodeA = graph.get(a.path);
      const nodeB = graph.get(b.path);
      const countA = nodeA?.importedBy.length ?? 0;
      const countB = nodeB?.importedBy.length ?? 0;
      return countB - countA; // Descending order
    });
  }

  /**
   * Build dependency graph from files (Tier 3)
   */
  private async buildDependencyGraph(files: FileContent[]): Promise<Map<string, DependencyNode>> {
    const graph = new Map<string, DependencyNode>();
    const fileSet = new Set(files.map((f) => f.path));

    // Initialize nodes
    for (const file of files) {
      graph.set(file.path, {
        path: file.path,
        imports: [],
        importedBy: [],
        depth: 0,
      });
    }

    // Parse imports from each file
    for (const file of files) {
      const imports = this.extractImports(file.content, file.path);
      const node = graph.get(file.path)!;

      for (const importPath of imports) {
        // Resolve the import to an absolute path
        const resolvedImport = this.resolveImportPath(importPath, file.path);

        // Only track imports that are in our file set
        if (resolvedImport && fileSet.has(resolvedImport)) {
          node.imports.push(resolvedImport);

          // Update the imported file's importedBy
          const importedNode = graph.get(resolvedImport);
          if (importedNode) {
            importedNode.importedBy.push(file.path);
          }
        }
      }
    }

    // Calculate depths using BFS
    this.calculateDependencyDepths(graph);

    return graph;
  }

  /**
   * Extract import paths from file content
   */
  private extractImports(content: string, filePath: string): string[] {
    const imports: string[] = [];
    const ext = path.extname(filePath);

    // TypeScript/JavaScript imports
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts'].includes(ext)) {
      // ES imports: import X from 'path'
      const esImportRegex = /import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g;
      let match: RegExpExecArray | null;
      while ((match = esImportRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath) imports.push(importPath);
      }

      // CommonJS requires: require('path')
      const cjsRequireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = cjsRequireRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath) imports.push(importPath);
      }

      // Dynamic imports: import('path')
      const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = dynamicImportRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath) imports.push(importPath);
      }
    }

    // Python imports
    if (['.py'].includes(ext)) {
      // from X import Y
      const fromImportRegex = /from\s+([\w.]+)\s+import/g;
      let match: RegExpExecArray | null;
      while ((match = fromImportRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath) imports.push(importPath);
      }

      // import X
      const importRegex = /^import\s+([\w.]+)/gm;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath) imports.push(importPath);
      }
    }

    return imports;
  }

  /**
   * Resolve an import path to an absolute file path
   */
  private resolveImportPath(importPath: string, fromFile: string): string | null {
    // Skip node_modules and external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    const dir = path.dirname(fromFile);
    const resolved = path.resolve(dir, importPath);

    // Check if import already has an extension
    const importExt = path.extname(importPath);
    if (importExt) {
      return resolved;
    }

    // If no extension in import, add .ts as default for TypeScript projects
    return resolved + '.ts';
  }

  /**
   * Calculate dependency depths using BFS
   */
  private calculateDependencyDepths(graph: Map<string, DependencyNode>): void {
    // Find root nodes (files with no imports)
    const roots = Array.from(graph.values()).filter((n) => n.imports.length === 0);

    // BFS from roots
    const visited = new Set<string>();
    const queue: { path: string; depth: number }[] = roots.map((r) => ({ path: r.path, depth: 0 }));

    while (queue.length > 0) {
      const { path: currentPath, depth } = queue.shift()!;
      if (visited.has(currentPath)) continue;
      visited.add(currentPath);

      const node = graph.get(currentPath);
      if (node) {
        node.depth = Math.max(node.depth, depth);

        // Add files that import this file to queue
        for (const dependentPath of node.importedBy) {
          if (!visited.has(dependentPath)) {
            queue.push({ path: dependentPath, depth: depth + 1 });
          }
        }
      }
    }
  }

  /**
   * Load .gitignore file from directory and its parents
   * Returns an ignore instance with all applicable patterns
   */
  private async loadGitignore(dir: string): Promise<IgnoreInstance> {
    const ig = ignore();

    // Always ignore common directories (built-in patterns)
    ig.add(IGNORE_DIRECTORIES.map((d) => `${d}/`));

    // Walk up directory tree to find .gitignore files
    let currentDir = dir;
    const gitignoreFiles: string[] = [];

    while (true) {
      const gitignorePath = path.join(currentDir, '.gitignore');
      try {
        await fs.access(gitignorePath);
        gitignoreFiles.unshift(gitignorePath); // Parent patterns first
      } catch {
        // No .gitignore in this directory
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Reached root
      currentDir = parentDir;
    }

    // Load all .gitignore files (parent patterns applied first)
    for (const gitignorePath of gitignoreFiles) {
      try {
        const content = await fs.readFile(gitignorePath, 'utf-8');
        ig.add(content);
      } catch {
        // Skip unreadable .gitignore
      }
    }

    return ig;
  }

  /**
   * Recursively collect file paths from directory (no file reading yet)
   * Uses .gitignore filtering to skip ignored paths early
   */
  private async collectPathsFromDirectory(
    baseDir: string,
    dir: string,
    filePaths: string[],
    seen: Set<string>,
    maxFiles: number,
    ig: IgnoreInstance
  ): Promise<void> {
    if (filePaths.length >= maxFiles) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (filePaths.length >= maxFiles) return;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        // Check gitignore (use relative path for pattern matching)
        if (ig.ignores(relativePath)) continue;

        if (entry.isDirectory()) {
          // Skip hardcoded ignore directories as well (redundant but fast check)
          if (!IGNORE_DIRECTORIES.includes(entry.name as typeof IGNORE_DIRECTORIES[number])) {
            await this.collectPathsFromDirectory(baseDir, fullPath, filePaths, seen, maxFiles, ig);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (CODE_EXTENSIONS.includes(ext as typeof CODE_EXTENSIONS[number]) && !seen.has(fullPath)) {
            filePaths.push(fullPath);
            seen.add(fullPath);
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  /**
   * Read a single file asynchronously
   */
  private async readFileAsync(filePath: string, maxLines: number): Promise<FileContent | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const lineCount = lines.length;

      // Truncate if too many lines
      const truncatedContent =
        lineCount > maxLines ? lines.slice(0, maxLines).join('\n') + '\n// ... truncated' : content;

      return {
        path: filePath,
        content: truncatedContent,
        lineCount: Math.min(lineCount, maxLines),
      };
    } catch {
      return null;
    }
  }

  /**
   * Execute prompt with timeout and content-hash caching
   * INV-REV-OPS-001: Timeout Handling
   * Performance: Caches responses by prompt hash to avoid repeated LLM calls
   */
  private async executeWithTimeout(
    prompt: string,
    providerId: string,
    timeoutMs: number
  ): Promise<{ content: string; providerId: string; modelId: string }> {
    if (!this.promptExecutor) {
      throw new ReviewError(
        ReviewErrorCode.PROVIDER_UNAVAILABLE,
        'No prompt executor configured'
      );
    }

    // Generate cache key from prompt hash + provider
    const cacheKey = this.generateCacheKey(prompt, providerId);

    // Check cache first
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }

    // Create cancellable timeout to prevent timer leaks
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Review timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([
        this.promptExecutor.execute(prompt, { providerId, timeoutMs }),
        timeoutPromise,
      ]);

      // Clean up timeout
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      // Cache successful response
      this.cacheResponse(cacheKey, result);

      return result;
    } catch (error) {
      // Clean up timeout on error too
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      throw error;
    }
  }

  /**
   * Generate a cache key from prompt content and provider
   * Uses SHA-256 hash for deterministic, collision-resistant keys
   */
  private generateCacheKey(prompt: string, providerId: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(prompt);
    hash.update(providerId);
    return hash.digest('hex');
  }

  /**
   * Get cached response if valid (not expired)
   */
  private getCachedResponse(cacheKey: string): { content: string; providerId: string; modelId: string } | undefined {
    const entry = responseCache.get(cacheKey);
    if (!entry) return undefined;

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > CACHE_TTL_MS) {
      responseCache.delete(cacheKey);
      return undefined;
    }

    return entry.response;
  }

  /**
   * Cache a response with timestamp
   * Also performs cleanup of old entries
   */
  private cacheResponse(cacheKey: string, response: { content: string; providerId: string; modelId: string }): void {
    const now = Date.now();

    // Clean up old entries periodically (every 100 cache writes)
    if (responseCache.size > 0 && responseCache.size % 100 === 0) {
      this.cleanupExpiredCache(now);
    }

    responseCache.set(cacheKey, {
      response,
      timestamp: now,
    });
  }

  /**
   * Remove expired cache entries
   */
  private cleanupExpiredCache(now: number): void {
    for (const [key, entry] of responseCache) {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        responseCache.delete(key);
      }
    }
  }

  /**
   * Initialize partial result for recovery (Tier 3)
   */
  private initializePartialResult(requestId: string): void {
    partialResultsStore.set(requestId, {
      requestId,
      completedBatches: [],
      failedBatches: [],
      partialComments: [],
      filesReviewed: [],
      lastSuccessAt: new Date().toISOString(),
    });
  }

  /**
   * Update partial result after successful batch (Tier 3)
   */
  private updatePartialResultBatch(requestId: string, batchId: string, files: string[]): void {
    const partial = partialResultsStore.get(requestId);
    if (partial) {
      partial.completedBatches.push(batchId);
      partial.filesReviewed.push(...files);
      partial.lastSuccessAt = new Date().toISOString();
    }
  }

  /**
   * Record a failed batch (Tier 3)
   */
  private recordFailedBatch(requestId: string, batchId: string): void {
    const partial = partialResultsStore.get(requestId);
    if (partial) {
      partial.failedBatches.push(batchId);
    }
  }

  /**
   * Update partial result with error (Tier 3)
   */
  private updatePartialResultError(requestId: string, error: string): void {
    const partial = partialResultsStore.get(requestId);
    if (partial) {
      partial.error = error;
    }
  }

  /**
   * Create empty result for dry run
   */
  private createEmptyResult(
    request: ReviewRequest,
    resultId: string,
    dryRun: DryRunResult,
    startTime: number
  ): ReviewResult {
    return {
      resultId,
      requestId: request.requestId ?? uuidv4(),
      comments: [],
      summary: {
        bySeverity: { critical: 0, warning: 0, suggestion: 0, note: 0 },
        byFocus: {},
        hotspots: [],
        healthScore: 100,
        verdict: `Dry run: Would analyze ${dryRun.files.length} files, ${dryRun.totalLines} lines`,
      },
      filesReviewed: dryRun.files,
      linesAnalyzed: dryRun.totalLines,
      providerId: 'dry-run',
      modelId: 'dry-run',
      durationMs: Date.now() - startTime,
      completedAt: new Date().toISOString(),
    };
  }
}

/**
 * Review error with error code
 */
export class ReviewError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ReviewError';
  }
}

/**
 * Create a review service instance
 */
export function createReviewService(
  config?: ReviewServiceConfig,
  promptExecutor?: ReviewPromptExecutor
): ReviewService {
  return new ReviewService(config, promptExecutor);
}

/**
 * Clear the LLM response cache
 * Useful for testing or when cache should be invalidated
 */
export function clearReviewCache(): void {
  responseCache.clear();
}

/**
 * Get cache statistics
 * Returns the current cache size and hit/miss info
 */
export function getReviewCacheStats(): { size: number; ttlMs: number } {
  return {
    size: responseCache.size,
    ttlMs: CACHE_TTL_MS,
  };
}

/**
 * Clear partial results store (Tier 3)
 * Useful for testing or cleanup
 */
export function clearPartialResults(): void {
  partialResultsStore.clear();
}

/**
 * Get all partial results (Tier 3)
 * Useful for debugging or monitoring
 */
export function getPartialResultsStats(): { count: number; requestIds: string[] } {
  return {
    count: partialResultsStore.size,
    requestIds: Array.from(partialResultsStore.keys()),
  };
}
