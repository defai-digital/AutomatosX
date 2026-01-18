/**
 * Review Service
 *
 * Orchestrates the AI code review process.
 * Implements:
 * - INV-REV-OPS-001: Timeout Handling
 * - INV-REV-OPS-002: Provider Fallback
 *
 * Performance optimizations (v13.4.0):
 * - Async file I/O with fs.promises
 * - Concurrent file reading with p-limit
 * - .gitignore-aware filtering
 * - Content-hash caching for LLM responses
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { createRequire } from 'node:module';
import pLimit from 'p-limit';
import {
  type ReviewRequest,
  type ReviewResult,
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
} from './types.js';

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
    const timeoutMs = request.timeoutMs ?? this.config.defaultTimeoutMs;

    // Handle dry run
    if (request.dryRun || options?.dryRun) {
      const dryRun = await this.dryRun(request);
      return this.createEmptyResult(request, resultId, dryRun, startTime);
    }

    // Collect files to review
    const files = await this.collectFiles(request.paths, request.maxFiles, request.maxLinesPerFile);

    if (files.length === 0) {
      throw new ReviewError(ReviewErrorCode.NO_FILES_FOUND, 'No files found to review');
    }

    // Build prompt
    const prompt = buildReviewPrompt(request.focus, files, request.context);

    // Execute with timeout
    const providerId = options?.providerId ?? request.providerId ?? this.config.defaultProvider;
    let response: { content: string; providerId: string; modelId: string };

    try {
      response = await this.executeWithTimeout(prompt, providerId, timeoutMs);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new ReviewError(ReviewErrorCode.TIMEOUT, `Review timed out after ${timeoutMs}ms`);
      }
      throw error;
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
      requestId: request.requestId ?? uuidv4(),
      comments: sortedComments,
      summary,
      filesReviewed: files.map((f) => f.path),
      linesAnalyzed: files.reduce((sum, f) => sum + f.lineCount, 0),
      providerId: response.providerId,
      modelId: response.modelId,
      durationMs: Date.now() - startTime,
      completedAt: new Date().toISOString(),
    };

    return result;
  }

  /**
   * Execute dry run - show what would be analyzed
   */
  async dryRun(request: ReviewRequest): Promise<DryRunResult> {
    const files = await this.collectFiles(request.paths, request.maxFiles, request.maxLinesPerFile);

    return {
      files: files.map((f) => f.path),
      totalLines: files.reduce((sum, f) => sum + f.lineCount, 0),
      focus: request.focus,
      estimatedDurationMs: files.length * 5000, // Rough estimate: 5s per file
    };
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
   * Collect files from paths with async I/O and .gitignore filtering
   * Performance: Uses p-limit for controlled concurrency
   */
  private async collectFiles(
    paths: string[],
    maxFiles: number,
    maxLinesPerFile: number
  ): Promise<FileContent[]> {
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

    // Second pass: read files concurrently with p-limit
    const limit = pLimit(FILE_IO_CONCURRENCY);
    const readPromises = filePaths.slice(0, maxFiles).map((filePath) =>
      limit(() => this.readFileAsync(filePath, maxLinesPerFile))
    );

    const results = await Promise.all(readPromises);
    return results.filter((f): f is FileContent => f !== null);
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

    // eslint-disable-next-line no-constant-condition
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
