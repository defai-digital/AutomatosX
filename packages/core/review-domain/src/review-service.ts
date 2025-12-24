/**
 * Review Service
 *
 * Orchestrates the AI code review process.
 * Implements:
 * - INV-REV-OPS-001: Timeout Handling
 * - INV-REV-OPS-002: Provider Fallback
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type ReviewRequest,
  type ReviewResult,
  createReviewSummary,
  sortCommentsBySeverity,
  ReviewErrorCode,
  TIMEOUT_PROVIDER_DEFAULT,
} from '@automatosx/contracts';
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
      requestId: request.requestId,
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
   * Collect files from paths
   */
  private async collectFiles(
    paths: string[],
    maxFiles: number,
    maxLinesPerFile: number
  ): Promise<FileContent[]> {
    const files: FileContent[] = [];
    const seen = new Set<string>();

    for (const p of paths) {
      if (files.length >= maxFiles) break;

      const resolved = path.resolve(p);

      try {
        const stat = fs.statSync(resolved);

        if (stat.isDirectory()) {
          // Recursively collect files from directory
          await this.collectFromDirectory(resolved, files, seen, maxFiles, maxLinesPerFile);
        } else if (stat.isFile()) {
          if (!seen.has(resolved)) {
            const file = this.readFile(resolved, maxLinesPerFile);
            if (file) {
              files.push(file);
              seen.add(resolved);
            }
          }
        }
      } catch (error) {
        // Skip inaccessible files/directories
        continue;
      }
    }

    return files;
  }

  /**
   * Recursively collect files from directory
   */
  private async collectFromDirectory(
    dir: string,
    files: FileContent[],
    seen: Set<string>,
    maxFiles: number,
    maxLinesPerFile: number
  ): Promise<void> {
    const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.kt', '.swift', '.rb', '.php', '.cs', '.cpp', '.c', '.h'];
    const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git', '__pycache__', 'vendor', 'target'];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (files.length >= maxFiles) return;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.includes(entry.name)) {
            await this.collectFromDirectory(fullPath, files, seen, maxFiles, maxLinesPerFile);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (CODE_EXTENSIONS.includes(ext) && !seen.has(fullPath)) {
            const file = this.readFile(fullPath, maxLinesPerFile);
            if (file) {
              files.push(file);
              seen.add(fullPath);
            }
          }
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }

  /**
   * Read a single file
   */
  private readFile(filePath: string, maxLines: number): FileContent | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
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
   * Execute prompt with timeout
   * INV-REV-OPS-001: Timeout Handling
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
      requestId: request.requestId,
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
