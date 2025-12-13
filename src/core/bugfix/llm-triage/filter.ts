/**
 * LLM Triage Filter
 *
 * Core component that reviews detected findings using LLM to filter false positives.
 * Implements batching, confidence thresholds, and fallback behavior.
 *
 * @module core/bugfix/llm-triage/filter
 * @since v12.9.0
 * @see PRD-020: LLM Triage Filter for Bugfix Tool
 */

import { randomUUID } from 'crypto';
import type { BugFinding } from '../types.js';
import type {
  LLMTriageConfig,
  TriageVerdict,
  TriageResult,
  TriageMetrics,
  TriageBatch,
  TriageFilterOptions,
} from './types.js';
import { DEFAULT_LLM_TRIAGE_CONFIG, COST_ESTIMATES } from './constants.js';
import { buildTriagePrompt, estimateTokens } from './prompt-builder.js';
import { parseTriageResponse, validateVerdictCoverage, createDefaultVerdicts } from './response-parser.js';
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
 * LLM Triage Filter
 *
 * Reviews detected findings using LLM to filter false positives.
 *
 * ## Features
 * - Confidence-based filtering (skip LLM for high-confidence findings)
 * - Batching for cost efficiency
 * - Request cap to limit costs
 * - Fallback behavior on LLM errors
 *
 * ## Usage
 * ```typescript
 * const filter = new LLMTriageFilter({
 *   config: { ...DEFAULT_LLM_TRIAGE_CONFIG, enabled: true },
 *   router: myRouter,
 * });
 * const results = await filter.triage(findings);
 * ```
 */
export class LLMTriageFilter {
  private config: LLMTriageConfig;
  private router: Router | null;
  private logger: Logger;
  private requestCount = 0;
  private metrics: TriageMetrics;

  constructor(options: TriageFilterOptions & { router?: Router }) {
    this.config = { ...DEFAULT_LLM_TRIAGE_CONFIG, ...options.config };
    this.router = options.router ?? null;
    this.logger = options.logger ?? noopLogger;
    this.metrics = this.initMetrics();
  }

  /**
   * Initialize empty metrics
   */
  private initMetrics(): TriageMetrics {
    return {
      findingsTotal: 0,
      findingsTriaged: 0,
      findingsAccepted: 0,
      findingsRejected: 0,
      findingsSkipped: 0,
      findingsFallback: 0,
      llmRequests: 0,
      llmTokensUsed: 0,
      llmCostEstimateUsd: 0,
      triageDurationMs: 0,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): TriageMetrics {
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
   * Triage a list of findings
   *
   * @param findings - Array of bug findings from AST detection
   * @returns Array of triage results
   */
  async triage(findings: BugFinding[]): Promise<TriageResult[]> {
    const startTime = Date.now();
    this.resetMetrics();
    this.metrics.findingsTotal = findings.length;

    // If disabled, pass through all findings unchanged
    if (!this.config.enabled) {
      this.logger.debug('LLM triage disabled, passing through all findings');
      return findings.map(f => ({
        original: f,
        verdict: null,
        source: 'ast' as const,
      }));
    }

    // Partition findings by confidence
    const { toTriage, toSkip } = this.partitionByConfidence(findings);
    this.metrics.findingsSkipped = toSkip.length;

    this.logger.info('Starting LLM triage', {
      total: findings.length,
      toTriage: toTriage.length,
      toSkip: toSkip.length,
    });

    // Process findings that need triage
    let verdicts: Map<string, TriageVerdict> = new Map();
    if (toTriage.length > 0 && this.router) {
      const batches = this.createBatches(toTriage);
      verdicts = await this.processAllBatches(batches);
    } else if (toTriage.length > 0 && !this.router) {
      this.logger.warn('No router available, falling back to AST results');
      this.metrics.findingsFallback = toTriage.length;
    }

    // Merge results
    const results = this.mergeResults(findings, verdicts, toSkip);

    // Update final metrics
    this.metrics.triageDurationMs = Date.now() - startTime;
    this.metrics.findingsAccepted = results.filter(
      r => r.verdict?.accepted === true || r.source === 'ast' || r.source === 'fallback'
    ).length;
    this.metrics.findingsRejected = results.filter(r => r.verdict?.accepted === false).length;

    this.logger.info('LLM triage complete', {
      accepted: this.metrics.findingsAccepted,
      rejected: this.metrics.findingsRejected,
      skipped: this.metrics.findingsSkipped,
      fallback: this.metrics.findingsFallback,
      llmRequests: this.metrics.llmRequests,
      durationMs: this.metrics.triageDurationMs,
    });

    return results;
  }

  /**
   * Determine if a finding should be triaged with LLM
   */
  private shouldTriageWithLLM(finding: BugFinding): boolean {
    // High confidence = trust AST
    if (finding.confidence >= this.config.minConfidenceToSkip) {
      return false;
    }
    // Low confidence or mid-range = verify with LLM
    return true;
  }

  /**
   * Partition findings into those needing LLM triage and those to skip
   */
  private partitionByConfidence(findings: BugFinding[]): {
    toTriage: BugFinding[];
    toSkip: BugFinding[];
  } {
    const toTriage: BugFinding[] = [];
    const toSkip: BugFinding[] = [];

    for (const finding of findings) {
      if (this.shouldTriageWithLLM(finding)) {
        toTriage.push(finding);
      } else {
        toSkip.push(finding);
      }
    }

    return { toTriage, toSkip };
  }

  /**
   * Create batches of findings, grouped by file for better context
   */
  private createBatches(findings: BugFinding[]): TriageBatch[] {
    const batches: TriageBatch[] = [];

    // Group by file first
    const byFile = new Map<string, BugFinding[]>();
    for (const finding of findings) {
      const existing = byFile.get(finding.file) ?? [];
      existing.push(finding);
      byFile.set(finding.file, existing);
    }

    // Create batches from file groups
    for (const [file, fileFindings] of byFile) {
      // Split file findings into batch-size chunks
      for (let i = 0; i < fileFindings.length; i += this.config.batchSize) {
        const chunk = fileFindings.slice(i, i + this.config.batchSize);
        batches.push({
          batchId: randomUUID(),
          findings: chunk,
          file,
        });
      }
    }

    return batches;
  }

  /**
   * Process all batches, respecting request limits
   */
  private async processAllBatches(batches: TriageBatch[]): Promise<Map<string, TriageVerdict>> {
    const verdicts = new Map<string, TriageVerdict>();

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;

      // Check request limit
      if (this.requestCount >= this.config.maxRequestsPerRun) {
        // Count ALL remaining batches (from current index to end) as fallback
        const remainingBatches = batches.slice(i);
        const remainingFindingsCount = remainingBatches.reduce(
          (sum, b) => sum + b.findings.length,
          0
        );

        this.logger.warn('Request limit reached, remaining findings will fallback to AST', {
          requestCount: this.requestCount,
          maxRequests: this.config.maxRequestsPerRun,
          remainingBatches: remainingBatches.length,
          remainingFindings: remainingFindingsCount,
        });

        // Count all remaining findings as fallback
        this.metrics.findingsFallback += remainingFindingsCount;
        break;
      }

      // Process batch
      const batchVerdicts = await this.processBatch(batch);
      for (const verdict of batchVerdicts) {
        verdicts.set(verdict.findingId, verdict);
      }
    }

    return verdicts;
  }

  /**
   * Process a single batch with LLM
   */
  private async processBatch(batch: TriageBatch): Promise<TriageVerdict[]> {
    const findingIds = batch.findings.map(f => f.id);

    try {
      // Build prompt
      const prompt = buildTriagePrompt(batch.findings);
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
        maxTokens: 2000,
        temperature: 0.2, // Low temperature for consistent results
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
      const parseResult = parseTriageResponse(response.content);
      if (!parseResult.success || !parseResult.verdicts) {
        this.logger.warn('Failed to parse LLM response', {
          batchId: batch.batchId,
          error: parseResult.error,
        });
        return this.handleFallback(batch.findings);
      }

      // Validate coverage
      const coverage = validateVerdictCoverage(parseResult.verdicts, findingIds);
      if (coverage.missing.length > 0) {
        this.logger.warn('LLM response missing some findings', {
          batchId: batch.batchId,
          missing: coverage.missing,
        });
        // Add default verdicts for missing
        const defaults = createDefaultVerdicts(coverage.missing);
        parseResult.verdicts.push(...defaults);
      }

      this.metrics.findingsTriaged += batch.findings.length;
      return parseResult.verdicts;
    } catch (err) {
      this.logger.error('LLM request failed', {
        batchId: batch.batchId,
        error: err instanceof Error ? err.message : String(err),
      });
      return this.handleFallback(batch.findings);
    }
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
   * Handle fallback for failed batches
   */
  private handleFallback(findings: BugFinding[]): TriageVerdict[] {
    this.metrics.findingsFallback += findings.length;

    switch (this.config.fallbackBehavior) {
      case 'bypass':
        // Accept all findings (don't hide bugs)
        return findings.map(f => ({
          findingId: f.id,
          accepted: true,
          confidence: f.confidence,
          reason: 'LLM unavailable, using AST result',
        }));

      case 'drop':
        // Reject all uncertain findings
        return findings.map(f => ({
          findingId: f.id,
          accepted: false,
          confidence: 0.5,
          reason: 'LLM unavailable, dropping uncertain finding',
        }));

      case 'ast-only':
        // Tag as fallback source
        return findings.map(f => ({
          findingId: f.id,
          accepted: true,
          confidence: f.confidence,
          reason: 'LLM unavailable, fallback to AST',
        }));
    }
  }

  /**
   * Merge results from triage, skipped, and fallback
   */
  private mergeResults(
    allFindings: BugFinding[],
    verdicts: Map<string, TriageVerdict>,
    skipped: BugFinding[]
  ): TriageResult[] {
    const skippedIds = new Set(skipped.map(f => f.id));

    return allFindings.map(finding => {
      // Skipped (high confidence) - pass through
      if (skippedIds.has(finding.id)) {
        return {
          original: finding,
          verdict: null,
          source: 'ast' as const,
        };
      }

      // Has verdict from LLM
      const verdict = verdicts.get(finding.id);
      if (verdict) {
        return {
          original: finding,
          verdict,
          source: verdict.reason?.includes('fallback') || verdict.reason?.includes('unavailable')
            ? 'fallback' as const
            : 'llm' as const,
        };
      }

      // No verdict - treat as fallback
      return {
        original: finding,
        verdict: {
          findingId: finding.id,
          accepted: true,
          confidence: finding.confidence,
          reason: 'No LLM verdict, using AST result',
        },
        source: 'fallback' as const,
      };
    });
  }

  /**
   * Estimate cost based on tokens and provider
   */
  private estimateCost(inputTokens: number, outputTokens: number): number {
    let inputCost: number;
    let outputCost: number;

    switch (this.config.provider) {
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
        // Exhaustive check - if provider type is extended, TypeScript will catch it
        const _exhaustiveCheck: never = this.config.provider;
        // Default to Claude costs as fallback for runtime safety
        inputCost = COST_ESTIMATES.CLAUDE_INPUT_COST_PER_1K;
        outputCost = COST_ESTIMATES.CLAUDE_OUTPUT_COST_PER_1K;
        this.logger.warn('Unknown provider for cost estimation, using Claude defaults', {
          provider: _exhaustiveCheck,
        });
      }
    }

    return (inputTokens / 1000) * inputCost + (outputTokens / 1000) * outputCost;
  }
}

/**
 * Create a triage filter with default configuration
 *
 * @param router - Router for making LLM requests
 * @param overrides - Configuration overrides
 * @returns Configured LLMTriageFilter instance
 */
export function createTriageFilter(
  router: Router,
  overrides: Partial<LLMTriageConfig> = {}
): LLMTriageFilter {
  return new LLMTriageFilter({
    config: { ...DEFAULT_LLM_TRIAGE_CONFIG, ...overrides },
    router,
  });
}
