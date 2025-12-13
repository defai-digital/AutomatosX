/**
 * LLM Refactor Service
 *
 * Core service that performs code refactoring using LLM.
 * Handles batching, verification, and safe application of changes.
 *
 * @module core/refactor/llm-refactor/refactor-service
 * @since v12.10.0
 * @see PRD-022: Refactor Tool LLM Enhancement
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { RefactorFinding } from '../types.js';
import type {
  LLMRefactorConfig,
  LLMRefactorMetrics,
  LLMRefactorServiceOptions,
  RefactorBatch,
  RefactorOperationResult,
} from './types.js';
import { DEFAULT_LLM_REFACTOR_CONFIG, COST_ESTIMATES, AUTO_APPLY_SAFETY_RULES } from './constants.js';
import { buildRefactorPrompt, estimateTokens } from './prompt-builder.js';
import {
  parseRefactorResponse,
  validateResultCoverage,
  createDefaultResults,
  sanitizeRefactoredCode,
} from './response-parser.js';
import type { Router } from '../../router/router.js';
import type { ExecutionRequest, ExecutionResponse } from '../../../types/provider.js';

/**
 * Logger interface for dependency injection
 */
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default no-op logger
 */
const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * LLM Refactor Service
 *
 * Performs code refactoring using LLM with:
 * - Batching for efficiency
 * - Safety checks before auto-applying
 * - File backup and rollback support
 * - Cost tracking and limits
 */
export class LLMRefactorService {
  private config: LLMRefactorConfig;
  private router: Router | null;
  private logger: Logger;
  private requestCount = 0;
  private metrics: LLMRefactorMetrics;
  private backupDir: string;

  constructor(options: LLMRefactorServiceOptions & { router?: Router; backupDir?: string }) {
    this.config = { ...DEFAULT_LLM_REFACTOR_CONFIG, ...options.config };
    this.router = options.router ?? null;
    this.logger = options.logger ?? noopLogger;
    this.backupDir = options.backupDir ?? '.automatosx/refactor-backups';
    this.metrics = this.initMetrics();
  }

  /**
   * Initialize empty metrics
   */
  private initMetrics(): LLMRefactorMetrics {
    return {
      findingsTotal: 0,
      findingsRefactored: 0,
      findingsSkipped: 0,
      findingsFailed: 0,
      llmRequests: 0,
      llmTokensUsed: 0,
      llmCostEstimateUsd: 0,
      durationMs: 0,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): LLMRefactorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics for a new run
   */
  resetMetrics(): void {
    this.metrics = this.initMetrics();
    this.requestCount = 0;
  }

  /**
   * Refactor a list of findings
   *
   * @param findings - Array of refactor findings
   * @param rootDir - Root directory for file operations
   * @returns Array of refactoring results
   */
  async refactor(
    findings: RefactorFinding[],
    rootDir: string
  ): Promise<RefactorOperationResult[]> {
    const startTime = Date.now();
    this.resetMetrics();
    this.metrics.findingsTotal = findings.length;

    if (!this.config.enabled) {
      this.logger.debug('LLM refactoring disabled');
      return findings.map(f => this.createSkippedResult(f, 'LLM refactoring disabled'));
    }

    if (!this.router) {
      this.logger.warn('No router available for LLM requests');
      return findings.map(f => this.createSkippedResult(f, 'No LLM router available'));
    }

    this.logger.info('Starting LLM refactoring', {
      total: findings.length,
      maxRequests: this.config.maxRequestsPerRun,
    });

    // Ensure backup directory exists
    await this.ensureBackupDir(rootDir);

    // Create batches grouped by file
    const { batches, unbatchedFindings } = await this.createBatches(findings, rootDir);

    // Process batches
    const results: RefactorOperationResult[] = [];

    // First, add skipped results for findings whose files couldn't be read
    for (const finding of unbatchedFindings) {
      results.push(this.createSkippedResult(finding, 'Could not read source file'));
    }

    // Process the batches
    for (const batch of batches) {
      if (this.requestCount >= this.config.maxRequestsPerRun) {
        this.logger.warn('Request limit reached', {
          requestCount: this.requestCount,
          maxRequests: this.config.maxRequestsPerRun,
        });
        // Mark remaining findings as skipped
        for (const finding of batch.findings) {
          results.push(this.createSkippedResult(finding, 'Request limit reached'));
        }
        continue;
      }

      const batchResults = await this.processBatch(batch, rootDir);
      results.push(...batchResults);
    }

    // Update final metrics - categories are mutually exclusive
    this.metrics.durationMs = Date.now() - startTime;
    // Refactored: successful AND safe to auto-apply
    this.metrics.findingsRefactored = results.filter(r => r.success && r.safeToAutoApply).length;
    // Skipped: successful BUT needs manual review (not auto-applied)
    this.metrics.findingsSkipped = results.filter(r => r.success && !r.safeToAutoApply).length;
    // Failed: not successful (actual failures)
    this.metrics.findingsFailed = results.filter(r => !r.success).length;

    this.logger.info('LLM refactoring complete', {
      refactored: this.metrics.findingsRefactored,
      skipped: this.metrics.findingsSkipped,
      failed: this.metrics.findingsFailed,
      llmRequests: this.metrics.llmRequests,
      durationMs: this.metrics.durationMs,
    });

    return results;
  }

  /**
   * Create batches of findings grouped by file
   * Returns both successful batches and findings that couldn't be batched
   */
  private async createBatches(
    findings: RefactorFinding[],
    rootDir: string
  ): Promise<{ batches: RefactorBatch[]; unbatchedFindings: RefactorFinding[] }> {
    const batches: RefactorBatch[] = [];
    const unbatchedFindings: RefactorFinding[] = [];

    // Group by file
    const byFile = new Map<string, RefactorFinding[]>();
    for (const finding of findings) {
      const existing = byFile.get(finding.file) ?? [];
      existing.push(finding);
      byFile.set(finding.file, existing);
    }

    // Create batches from file groups
    for (const [file, fileFindings] of byFile) {
      const absolutePath = path.isAbsolute(file) ? file : path.join(rootDir, file);

      // Read file content
      let fileContent: string;
      try {
        fileContent = await fs.promises.readFile(absolutePath, 'utf-8');
      } catch (err) {
        this.logger.warn(`Could not read file: ${file}`, { error: err });
        // Track findings that couldn't be processed due to file read failure
        unbatchedFindings.push(...fileFindings);
        continue;
      }

      // Split into batch-size chunks
      for (let i = 0; i < fileFindings.length; i += this.config.batchSize) {
        const chunk = fileFindings.slice(i, i + this.config.batchSize);
        batches.push({
          batchId: randomUUID(),
          file,
          fileContent,
          findings: chunk,
        });
      }
    }

    return { batches, unbatchedFindings };
  }

  /**
   * Process a single batch with LLM
   */
  private async processBatch(
    batch: RefactorBatch,
    rootDir: string
  ): Promise<RefactorOperationResult[]> {
    const findingIds = batch.findings.map(f => f.id);

    try {
      // Build prompt
      const prompt = buildRefactorPrompt(batch);
      const estimatedTokens = estimateTokens(prompt);

      this.logger.debug('Processing batch', {
        batchId: batch.batchId,
        findingCount: batch.findings.length,
        file: batch.file,
        estimatedTokens,
      });

      // Make LLM request
      const request: ExecutionRequest = {
        systemPrompt: prompt.system,
        prompt: prompt.user,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      };

      this.requestCount++;
      this.metrics.llmRequests++;

      const response = await this.executeWithTimeout(request);

      // Update token metrics
      if (response.tokensUsed) {
        this.metrics.llmTokensUsed += response.tokensUsed.total;
        this.metrics.llmCostEstimateUsd += this.estimateCost(
          response.tokensUsed.prompt,
          response.tokensUsed.completion
        );
      }

      // Parse response
      const parseResult = parseRefactorResponse(response.content);
      if (!parseResult.success || !parseResult.response) {
        this.logger.warn('Failed to parse LLM response', {
          batchId: batch.batchId,
          error: parseResult.error,
        });
        return batch.findings.map(f =>
          this.createSkippedResult(f, `Parse error: ${parseResult.error}`)
        );
      }

      // Validate coverage
      const coverage = validateResultCoverage(parseResult.response, findingIds);
      if (coverage.missing.length > 0) {
        this.logger.warn('LLM response missing some findings', {
          batchId: batch.batchId,
          missing: coverage.missing,
        });
        const defaults = createDefaultResults(coverage.missing);
        parseResult.response.refactorings.push(...defaults);
      }

      // Convert LLM results to operation results
      return this.convertToOperationResults(batch, parseResult.response);
    } catch (err) {
      this.logger.error('LLM request failed', {
        batchId: batch.batchId,
        error: err instanceof Error ? err.message : String(err),
      });
      return batch.findings.map(f =>
        this.createSkippedResult(f, `LLM error: ${err instanceof Error ? err.message : 'Unknown'}`)
      );
    }
  }

  /**
   * Convert LLM response to operation results
   */
  private convertToOperationResults(
    batch: RefactorBatch,
    llmResponse: import('./types.js').LLMRefactorResponse
  ): RefactorOperationResult[] {
    const results: RefactorOperationResult[] = [];
    const resultMap = new Map(llmResponse.refactorings.map(r => [r.id, r]));

    for (const finding of batch.findings) {
      const llmResult = resultMap.get(finding.id);

      if (!llmResult || !llmResult.success) {
        results.push(this.createSkippedResult(
          finding,
          llmResult?.error || 'No result from LLM'
        ));
        continue;
      }

      // Sanitize refactored code
      const refactoredCode = sanitizeRefactoredCode(llmResult.refactoredCode);
      if (!refactoredCode) {
        results.push(this.createSkippedResult(finding, 'Invalid refactored code'));
        continue;
      }

      // Determine if safe to auto-apply
      const safetyCheck = this.checkAutoApplySafety(
        finding,
        refactoredCode,
        llmResult.confidence,
        llmResult.safeToAutoApply
      );

      results.push({
        findingId: finding.id,
        success: true,
        refactoredCode,
        originalCode: finding.context,
        lineStart: finding.lineStart,
        lineEnd: finding.lineEnd,
        explanation: llmResult.explanation,
        confidence: llmResult.confidence,
        safeToAutoApply: safetyCheck.safe,
        manualReviewReason: safetyCheck.reason,
      });
    }

    return results;
  }

  /**
   * Check if a refactoring is safe to auto-apply
   */
  private checkAutoApplySafety(
    finding: RefactorFinding,
    refactoredCode: string,
    confidence: number,
    llmSaysOk: boolean
  ): { safe: boolean; reason?: string } {
    // LLM says not safe
    if (!llmSaysOk) {
      return { safe: false, reason: 'LLM marked for manual review' };
    }

    // Confidence too low
    if (confidence < AUTO_APPLY_SAFETY_RULES.MIN_CONFIDENCE) {
      return {
        safe: false,
        reason: `Confidence ${(confidence * 100).toFixed(0)}% below threshold ${AUTO_APPLY_SAFETY_RULES.MIN_CONFIDENCE * 100}%`,
      };
    }

    // Too many lines changed - use the larger of original or new line count
    const originalLines = finding.context.split('\n').length;
    const newLines = refactoredCode.split('\n').length;
    const linesAffected = Math.max(originalLines, newLines);
    if (linesAffected > AUTO_APPLY_SAFETY_RULES.MAX_LINES_CHANGED) {
      return {
        safe: false,
        reason: `Change affects ${linesAffected} lines (max ${AUTO_APPLY_SAFETY_RULES.MAX_LINES_CHANGED})`,
      };
    }

    // Check for risky patterns
    for (const pattern of AUTO_APPLY_SAFETY_RULES.MANUAL_REVIEW_PATTERNS) {
      if (pattern.test(finding.context) || pattern.test(refactoredCode)) {
        return {
          safe: false,
          reason: 'Contains patterns requiring manual review (exports, constructors, etc.)',
        };
      }
    }

    // Check if type is in safe list
    const isSafeType = (AUTO_APPLY_SAFETY_RULES.SAFE_TYPES as readonly string[]).includes(finding.type);
    if (!isSafeType && confidence < 0.9) {
      return {
        safe: false,
        reason: `Type "${finding.type}" requires higher confidence for auto-apply`,
      };
    }

    return { safe: true };
  }

  /**
   * Execute request with timeout
   */
  private async executeWithTimeout(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (!this.router) {
      throw new Error('Router not available');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.router.execute({
        ...request,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Create a skipped result for a finding
   */
  private createSkippedResult(
    finding: RefactorFinding,
    reason: string
  ): RefactorOperationResult {
    return {
      findingId: finding.id,
      success: false,
      originalCode: finding.context,
      lineStart: finding.lineStart,
      lineEnd: finding.lineEnd,
      confidence: 0,
      safeToAutoApply: false,
      manualReviewReason: reason,
      error: reason,
    };
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDir(rootDir: string): Promise<void> {
    const fullPath = path.join(rootDir, this.backupDir);
    try {
      await fs.promises.mkdir(fullPath, { recursive: true });
    } catch (err) {
      this.logger.warn('Could not create backup directory', { path: fullPath, error: err });
    }
  }

  /**
   * Create a backup of a file before modification
   */
  async createBackup(filePath: string, rootDir: string): Promise<string | null> {
    // Ensure backup directory exists (for direct calls to createBackup)
    await this.ensureBackupDir(rootDir);

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${path.basename(filePath)}.${timestamp}.bak`;
    const backupPath = path.join(rootDir, this.backupDir, backupName);

    try {
      await fs.promises.copyFile(absolutePath, backupPath);
      this.logger.debug('Created backup', { original: filePath, backup: backupPath });
      return backupPath;
    } catch (err) {
      this.logger.error('Failed to create backup', { file: filePath, error: err });
      return null;
    }
  }

  /**
   * Restore a file from backup
   */
  async restoreFromBackup(backupPath: string, originalPath: string): Promise<boolean> {
    try {
      await fs.promises.copyFile(backupPath, originalPath);
      this.logger.debug('Restored from backup', { backup: backupPath, original: originalPath });
      return true;
    } catch (err) {
      this.logger.error('Failed to restore from backup', { backup: backupPath, error: err });
      return false;
    }
  }

  /**
   * Apply a refactoring to a file
   *
   * Safety: Validates that content at target lines matches expected original
   * before applying changes to prevent line drift corruption.
   */
  async applyRefactoring(
    result: RefactorOperationResult,
    filePath: string,
    rootDir: string
  ): Promise<{ success: boolean; error?: string; backupPath?: string }> {
    if (!result.success || !result.refactoredCode) {
      return { success: false, error: 'No refactored code available' };
    }

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);

    try {
      // Read current file content BEFORE creating backup to validate
      const content = await fs.promises.readFile(absolutePath, 'utf-8');
      const lines = content.split('\n');

      // SAFETY: Validate line numbers are within bounds
      if (result.lineStart < 1 || result.lineEnd > lines.length || result.lineStart > result.lineEnd) {
        return {
          success: false,
          error: `Invalid line range ${result.lineStart}-${result.lineEnd} for file with ${lines.length} lines`,
        };
      }

      // SAFETY: Validate that content at target lines matches expected original
      // This prevents corruption from line number drift between detection and application
      if (result.originalCode) {
        const currentContent = lines.slice(result.lineStart - 1, result.lineEnd).join('\n');
        const normalizedCurrent = this.normalizeWhitespace(currentContent);
        const normalizedOriginal = this.normalizeWhitespace(result.originalCode);

        if (normalizedCurrent !== normalizedOriginal) {
          this.logger.warn('Content mismatch detected - file may have changed since detection', {
            file: filePath,
            lines: `${result.lineStart}-${result.lineEnd}`,
            expectedLength: result.originalCode.length,
            actualLength: currentContent.length,
          });
          return {
            success: false,
            error: 'Content at target lines does not match expected - file may have been modified',
          };
        }
      }

      // Create backup AFTER validation passes
      const backupPath = await this.createBackup(filePath, rootDir);
      if (!backupPath) {
        return { success: false, error: 'Failed to create backup' };
      }

      // Replace the lines
      const newLines = [
        ...lines.slice(0, result.lineStart - 1),
        result.refactoredCode,
        ...lines.slice(result.lineEnd),
      ];

      // Write back
      await fs.promises.writeFile(absolutePath, newLines.join('\n'), 'utf-8');

      this.logger.info('Applied refactoring', {
        file: filePath,
        lines: `${result.lineStart}-${result.lineEnd}`,
      });

      return { success: true, backupPath };
    } catch (err) {
      return {
        success: false,
        error: `Failed to apply: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Normalize whitespace for content comparison
   * Trims lines and collapses multiple spaces to single space
   */
  private normalizeWhitespace(content: string): string {
    return content
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Estimate cost based on tokens and provider
   */
  private estimateCost(inputTokens: number, outputTokens: number): number {
    let inputCost: number;
    let outputCost: number;

    const provider = this.config.provider;
    switch (provider) {
      case 'claude':
        inputCost = COST_ESTIMATES.CLAUDE_INPUT_COST_PER_1K;
        outputCost = COST_ESTIMATES.CLAUDE_OUTPUT_COST_PER_1K;
        break;
      case 'gemini':
        inputCost = COST_ESTIMATES.GEMINI_INPUT_COST_PER_1K;
        outputCost = COST_ESTIMATES.GEMINI_OUTPUT_COST_PER_1K;
        break;
      case 'openai':
        inputCost = COST_ESTIMATES.OPENAI_INPUT_COST_PER_1K;
        outputCost = COST_ESTIMATES.OPENAI_OUTPUT_COST_PER_1K;
        break;
      default: {
        // Exhaustive check - TypeScript will error if a new provider is added
        const _exhaustiveCheck: never = provider;
        // Default to Claude costs as fallback
        this.logger.warn('Unknown provider for cost estimation', { provider: _exhaustiveCheck });
        inputCost = COST_ESTIMATES.CLAUDE_INPUT_COST_PER_1K;
        outputCost = COST_ESTIMATES.CLAUDE_OUTPUT_COST_PER_1K;
      }
    }

    return (inputTokens / 1000) * inputCost + (outputTokens / 1000) * outputCost;
  }
}

/**
 * Create a refactor service with default configuration
 *
 * @param router - Router for making LLM requests
 * @param overrides - Configuration overrides
 * @returns Configured LLMRefactorService instance
 */
export function createRefactorService(
  router: Router,
  overrides: Partial<LLMRefactorConfig> = {}
): LLMRefactorService {
  return new LLMRefactorService({
    config: { ...DEFAULT_LLM_REFACTOR_CONFIG, ...overrides },
    router,
  });
}
