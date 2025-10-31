/**
 * Timeout Estimator - Smart dynamic timeout calculation
 *
 * Calculates optimal timeouts based on:
 * - Prompt token count and complexity
 * - Historical execution times
 * - Task type (streaming vs non-streaming)
 * - Model characteristics
 *
 * v6.0.7: Phase 1 enhancement for better UX
 */

import { logger } from '../utils/logger.js';

export interface TimeoutEstimate {
  timeoutMs: number;
  estimatedDurationMs: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
}

export interface TimeoutOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string | null;
  streaming?: boolean;
  maxTokens?: number;
  historicalAverage?: number;
}

/**
 * Estimate optimal timeout for a request
 */
export function estimateTimeout(options: TimeoutOptions): TimeoutEstimate {
  const {
    prompt,
    systemPrompt,
    model,
    streaming = false,
    maxTokens,
    historicalAverage
  } = options;

  // Calculate total input tokens
  const inputTokens = estimateTokenCount(prompt) + (systemPrompt ? estimateTokenCount(systemPrompt) : 0);

  // Estimate output tokens (use maxTokens or reasonable default)
  const estimatedOutputTokens = maxTokens || Math.min(inputTokens * 2, 4096);

  // Base timing estimates (ms per 1K tokens)
  const timing = getModelTiming(model);

  // Calculate base duration
  let estimatedDuration = timing.baseLatency;
  estimatedDuration += (inputTokens / 1000) * timing.inputTokensPerSecond * 1000;
  estimatedDuration += (estimatedOutputTokens / 1000) * timing.outputTokensPerSecond * 1000;

  // Adjust for streaming (slightly faster due to immediate start)
  if (streaming) {
    estimatedDuration *= 0.9;
  }

  // Use historical average if available (weighted combination)
  let finalEstimate = estimatedDuration;
  let confidence: 'low' | 'medium' | 'high' = 'medium';

  if (historicalAverage) {
    // Weight 70% historical, 30% calculated
    finalEstimate = historicalAverage * 0.7 + estimatedDuration * 0.3;
    confidence = 'high';
  } else if (inputTokens < 100) {
    // Very short prompts are less predictable
    confidence = 'low';
  }

  // Add safety buffer (2.5x for timeout)
  const timeoutMs = Math.ceil(finalEstimate * 2.5);

  // Cap at reasonable limits
  const cappedTimeout = Math.min(Math.max(timeoutMs, 30000), 300000); // 30s - 5min

  const reasoning = buildReasoning({
    inputTokens,
    estimatedOutputTokens,
    baseLatency: timing.baseLatency,
    estimatedDuration,
    finalEstimate,
    timeoutMs: cappedTimeout,
    streaming,
    hasHistorical: !!historicalAverage
  });

  logger.debug('Timeout estimated', {
    inputTokens,
    estimatedOutputTokens,
    estimatedDurationMs: Math.round(finalEstimate),
    timeoutMs: cappedTimeout,
    confidence
  });

  return {
    timeoutMs: cappedTimeout,
    estimatedDurationMs: Math.round(finalEstimate),
    confidence,
    reasoning
  };
}

/**
 * Estimate token count from text (simple approximation)
 */
export function estimateTokenCount(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English
  // More accurate would use tiktoken, but this is fast enough
  return Math.ceil(text.length / 4);
}

/**
 * Get timing characteristics for model
 */
function getModelTiming(model?: string | null): {
  baseLatency: number;
  inputTokensPerSecond: number;
  outputTokensPerSecond: number;
} {
  // Default timing for codex/gpt-4o class models
  const defaults = {
    baseLatency: 1000, // 1s base latency
    inputTokensPerSecond: 50, // 50ms per 1K input tokens
    outputTokensPerSecond: 200 // 200ms per 1K output tokens
  };

  if (!model) {
    return defaults;
  }

  // Model-specific timing adjustments
  if (model.includes('o1-')) {
    // o1 models are slower due to reasoning
    return {
      baseLatency: 2000,
      inputTokensPerSecond: 100,
      outputTokensPerSecond: 400
    };
  }

  if (model.includes('mini')) {
    // Mini models are faster
    return {
      baseLatency: 500,
      inputTokensPerSecond: 30,
      outputTokensPerSecond: 100
    };
  }

  return defaults;
}

/**
 * Build human-readable reasoning
 */
function buildReasoning(params: {
  inputTokens: number;
  estimatedOutputTokens: number;
  baseLatency: number;
  estimatedDuration: number;
  finalEstimate: number;
  timeoutMs: number;
  streaming: boolean;
  hasHistorical: boolean;
}): string {
  const lines: string[] = [];

  lines.push(`Input: ~${params.inputTokens} tokens`);
  lines.push(`Expected output: ~${params.estimatedOutputTokens} tokens`);
  lines.push(`Estimated duration: ${Math.round(params.finalEstimate / 1000)}s`);

  if (params.hasHistorical) {
    lines.push('(based on historical average)');
  }

  if (params.streaming) {
    lines.push('Streaming mode: faster initial response');
  }

  lines.push(`Timeout set to: ${Math.round(params.timeoutMs / 1000)}s (2.5x buffer)`);

  return lines.join('\n  ');
}

/**
 * Format timeout estimate for display
 */
export function formatTimeoutEstimate(estimate: TimeoutEstimate): string {
  const durationSec = Math.round(estimate.estimatedDurationMs / 1000);
  const timeoutSec = Math.round(estimate.timeoutMs / 1000);

  const confidenceEmoji = {
    low: '⚠️',
    medium: '📊',
    high: '✓'
  }[estimate.confidence];

  return `${confidenceEmoji} Estimated: ${durationSec}s (timeout: ${timeoutSec}s)`;
}

/**
 * Progress tracker for long-running operations
 */
export class ProgressTracker {
  private startTime: number;
  private estimatedDurationMs: number;
  private lastUpdate: number = 0;
  private updateInterval: number = 2000; // Update every 2s

  constructor(estimatedDurationMs: number) {
    this.startTime = Date.now();
    this.estimatedDurationMs = estimatedDurationMs;
  }

  /**
   * Get current progress (0-100)
   */
  getProgress(): number {
    const elapsed = Date.now() - this.startTime;
    const progress = Math.min((elapsed / this.estimatedDurationMs) * 100, 95);
    return Math.round(progress);
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedSeconds(): number {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get estimated remaining time in seconds
   */
  getEstimatedRemaining(): number {
    const elapsed = Date.now() - this.startTime;
    const remaining = this.estimatedDurationMs - elapsed;
    return Math.max(0, Math.round(remaining / 1000));
  }

  /**
   * Should we update the display?
   */
  shouldUpdate(): boolean {
    const now = Date.now();
    if (now - this.lastUpdate >= this.updateInterval) {
      this.lastUpdate = now;
      return true;
    }
    return false;
  }

  /**
   * Format progress for display
   */
  formatProgress(): string {
    const progress = this.getProgress();
    const elapsed = this.getElapsedSeconds();
    const remaining = this.getEstimatedRemaining();

    const bar = this.createProgressBar(progress);

    if (remaining > 0) {
      return `${bar} ${progress}% (${elapsed}s elapsed, ~${remaining}s remaining)`;
    } else {
      return `${bar} ${progress}% (${elapsed}s elapsed, finishing...)`;
    }
  }

  /**
   * Create ASCII progress bar
   */
  private createProgressBar(progress: number): string {
    const width = 20;
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;

    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }
}
