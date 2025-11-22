/**
 * Token Estimation Utility for ax-cli SDK
 *
 * Provides content-based token estimation when SDK doesn't expose actual token counts.
 * Uses industry-standard heuristic: ~4 characters per token (OpenAI average).
 */

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export class TokenEstimator {
  /**
   * Average characters per token (industry standard heuristic)
   * Source: OpenAI tokenization research
   */
  private static readonly CHARS_PER_TOKEN = 4;

  /**
   * Minimum token count (always return at least 1 for non-empty content)
   */
  private static readonly MIN_TOKENS = 1;

  /**
   * Estimate token count from text content
   *
   * @param text - The text content to estimate tokens for
   * @returns Estimated token count
   */
  static estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Use 4 chars/token heuristic
    const estimated = Math.ceil(text.length / this.CHARS_PER_TOKEN);

    // Ensure at least 1 token for non-empty content
    return Math.max(estimated, this.MIN_TOKENS);
  }

  /**
   * Estimate token usage from prompt and completion
   *
   * @param prompt - The prompt text
   * @param completion - The completion text
   * @returns Estimated token usage object
   */
  static estimateUsage(prompt: string, completion: string): TokenUsage {
    const promptTokens = this.estimateTokens(prompt);
    const completionTokens = this.estimateTokens(completion);

    return {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens
    };
  }

  /**
   * Merge estimated tokens with actual tokens when available
   *
   * If SDK provides actual token counts in the future, this method allows
   * graceful fallback to estimates when actual counts are missing.
   *
   * @param estimated - Estimated token usage
   * @param actual - Actual token usage (if available)
   * @returns Merged token usage (prefers actual over estimated)
   */
  static mergeWithActual(
    estimated: TokenUsage,
    actual?: Partial<TokenUsage>
  ): TokenUsage {
    if (!actual) {
      return estimated;
    }

    return {
      prompt: actual.prompt ?? estimated.prompt,
      completion: actual.completion ?? estimated.completion,
      total: actual.total ?? estimated.total
    };
  }

  /**
   * Check if token usage appears to be estimated (all zeros or missing)
   *
   * @param usage - Token usage to check
   * @returns True if usage appears to be zero/missing (likely not from SDK)
   */
  static isEstimated(usage?: TokenUsage): boolean {
    if (!usage) {
      return true;
    }

    // If total is 0, it's likely missing/estimated
    return usage.total === 0;
  }

  /**
   * Create a zero token usage object (for errors or empty responses)
   *
   * @returns Zero token usage
   */
  static zero(): TokenUsage {
    return {
      prompt: 0,
      completion: 0,
      total: 0
    };
  }

  /**
   * Validate token usage object
   *
   * @param usage - Token usage to validate
   * @returns True if valid (non-negative, total >= prompt + completion)
   */
  static isValid(usage: TokenUsage): boolean {
    const { prompt, completion, total } = usage;

    // All values must be non-negative
    if (prompt < 0 || completion < 0 || total < 0) {
      return false;
    }

    // Total should equal or exceed sum of parts
    // (some providers may include overhead tokens in total)
    return total >= prompt + completion;
  }

  /**
   * Format token usage for logging
   *
   * @param usage - Token usage to format
   * @param isEstimate - Whether these are estimated tokens
   * @returns Formatted string
   */
  static format(usage: TokenUsage, isEstimate = false): string {
    const suffix = isEstimate ? ' (est.)' : '';
    return `${usage.prompt}p + ${usage.completion}c = ${usage.total}t${suffix}`;
  }
}
