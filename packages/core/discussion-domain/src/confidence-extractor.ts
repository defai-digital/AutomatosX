/**
 * Confidence Extractor
 *
 * Extracts confidence scores from provider responses for early exit decisions.
 * Supports cascading confidence where high-confidence first responses can
 * short-circuit the discussion.
 *
 * Invariants:
 * - INV-DISC-622: Confidence threshold configurable (default 0.9)
 * - INV-DISC-623: Minimum 2 providers for quality
 */

import type { CascadingConfidenceConfig } from '@defai.digital/contracts';

/**
 * Result of confidence extraction from a response
 */
export interface ExtractedConfidence {
  /** Confidence score 0-1, or null if not extractable */
  score: number | null;

  /** Method used to extract confidence */
  method: 'explicit' | 'heuristic' | 'none';

  /** Explanation of confidence assessment */
  explanation?: string;
}

/**
 * Result of early exit evaluation
 */
export interface EarlyExitDecision {
  /** Whether to exit early */
  shouldExit: boolean;

  /** Reason for decision */
  reason: string;

  /** Confidence score that triggered decision */
  confidence?: number;

  /** Number of providers that responded */
  providerCount: number;
}

/**
 * Default cascading confidence config
 */
export const DEFAULT_CASCADING_CONFIDENCE: Required<CascadingConfidenceConfig> = {
  enabled: true,
  threshold: 0.9,
  minProviders: 2,
};

/**
 * Patterns for extracting explicit confidence from responses
 */
const CONFIDENCE_PATTERNS = [
  // "Confidence: 95%" or "Confidence: 0.95"
  /confidence[:\s]+(\d+(?:\.\d+)?)\s*%?/i,
  // "I am 95% confident" or "95% certain"
  /(?:am|is)\s+(\d+(?:\.\d+)?)\s*%?\s*(?:confident|certain|sure)/i,
  // "[HIGH CONFIDENCE]" markers
  /\[(?:very\s+)?high\s+confidence\]/i,
  /\[medium\s+confidence\]/i,
  /\[low\s+confidence\]/i,
];

/**
 * Heuristic confidence indicators
 */
const HIGH_CONFIDENCE_PHRASES = [
  'definitely',
  'certainly',
  'absolutely',
  'without a doubt',
  'clearly',
  'obviously',
  'undoubtedly',
  'i am confident',
  'i am certain',
  'i strongly believe',
];

const LOW_CONFIDENCE_PHRASES = [
  'perhaps',
  'maybe',
  'might',
  'could be',
  'not sure',
  'uncertain',
  'possibly',
  'it depends',
  'hard to say',
  'difficult to determine',
  'i think',
  'it seems',
];

/**
 * Extract confidence score from a provider response
 */
export function extractConfidence(content: string): ExtractedConfidence {
  if (!content || content.trim().length === 0) {
    return { score: null, method: 'none' };
  }

  const normalizedContent = content.toLowerCase();

  // Try explicit patterns first
  for (const pattern of CONFIDENCE_PATTERNS) {
    const match = pattern.exec(content);
    if (match) {
      // Check for marker-based confidence
      if (match[0].includes('high confidence')) {
        return {
          score: 0.9,
          method: 'explicit',
          explanation: 'Explicit high confidence marker found',
        };
      }
      if (match[0].includes('medium confidence')) {
        return {
          score: 0.6,
          method: 'explicit',
          explanation: 'Explicit medium confidence marker found',
        };
      }
      if (match[0].includes('low confidence')) {
        return {
          score: 0.3,
          method: 'explicit',
          explanation: 'Explicit low confidence marker found',
        };
      }

      // Numeric confidence
      if (match[1]) {
        let score = parseFloat(match[1]);
        // Guard against NaN from invalid input
        if (!Number.isFinite(score)) {
          continue;
        }
        // Normalize percentage to 0-1
        if (score > 1) {
          score = score / 100;
        }
        // Clamp to valid range
        score = Math.max(0, Math.min(1, score));
        return {
          score,
          method: 'explicit',
          explanation: `Explicit confidence: ${(score * 100).toFixed(0)}%`,
        };
      }
    }
  }

  // Fall back to heuristic analysis
  const highCount = HIGH_CONFIDENCE_PHRASES.filter(phrase =>
    normalizedContent.includes(phrase)
  ).length;

  const lowCount = LOW_CONFIDENCE_PHRASES.filter(phrase =>
    normalizedContent.includes(phrase)
  ).length;

  if (highCount > 0 || lowCount > 0) {
    // Calculate heuristic score based on phrase counts
    const netConfidence = highCount - lowCount;
    let score: number;

    if (netConfidence >= 2) {
      score = 0.85;
    } else if (netConfidence === 1) {
      score = 0.75;
    } else if (netConfidence === 0) {
      score = 0.6;
    } else if (netConfidence === -1) {
      score = 0.45;
    } else {
      score = 0.3;
    }

    return {
      score,
      method: 'heuristic',
      explanation: `Heuristic: ${highCount} high-confidence phrases, ${lowCount} low-confidence phrases`,
    };
  }

  // Response length heuristic - longer, more detailed responses often indicate confidence
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 200) {
    return {
      score: 0.7,
      method: 'heuristic',
      explanation: 'Detailed response suggests moderate-high confidence',
    };
  }

  return { score: null, method: 'none' };
}

/**
 * Evaluate whether to exit early based on provider responses
 */
export function evaluateEarlyExit(
  responses: Array<{ provider: string; content: string; confidence: number | undefined }>,
  config: CascadingConfidenceConfig = DEFAULT_CASCADING_CONFIDENCE
): EarlyExitDecision {
  // Early exit disabled
  if (!config.enabled) {
    return {
      shouldExit: false,
      reason: 'Cascading confidence disabled',
      providerCount: responses.length,
    };
  }

  // Not enough providers yet
  if (responses.length < config.minProviders) {
    return {
      shouldExit: false,
      reason: `Need at least ${config.minProviders} providers, have ${responses.length}`,
      providerCount: responses.length,
    };
  }

  // Check if all responses have high confidence
  const confidences: number[] = [];

  for (const response of responses) {
    // Use provided confidence or extract it
    const confidence = response.confidence ?? extractConfidence(response.content).score;
    if (confidence !== null) {
      confidences.push(confidence);
    }
  }

  if (confidences.length === 0) {
    return {
      shouldExit: false,
      reason: 'No confidence scores available',
      providerCount: responses.length,
    };
  }

  // Calculate average confidence
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

  // Check if average exceeds threshold
  if (avgConfidence >= config.threshold) {
    return {
      shouldExit: true,
      reason: `Average confidence ${(avgConfidence * 100).toFixed(0)}% exceeds threshold ${(config.threshold * 100).toFixed(0)}%`,
      confidence: avgConfidence,
      providerCount: responses.length,
    };
  }

  // Check if first provider has high confidence (cascading pattern)
  const firstConfidence = confidences[0];
  if (firstConfidence !== undefined && firstConfidence >= config.threshold && responses.length >= config.minProviders) {
    return {
      shouldExit: true,
      reason: `First provider confidence ${(firstConfidence * 100).toFixed(0)}% exceeds threshold`,
      confidence: firstConfidence,
      providerCount: responses.length,
    };
  }

  return {
    shouldExit: false,
    reason: `Average confidence ${(avgConfidence * 100).toFixed(0)}% below threshold ${(config.threshold * 100).toFixed(0)}%`,
    confidence: avgConfidence,
    providerCount: responses.length,
  };
}

/**
 * Calculate agreement score between provider responses
 * Higher score = more agreement = higher effective confidence
 */
export function calculateAgreementScore(
  responses: Array<{ content: string }>
): number {
  if (responses.length < 2) {
    return 1.0; // Single response has perfect "agreement"
  }

  // Simple heuristic: check for common key phrases/conclusions
  const keywords = new Map<string, number>();

  for (const response of responses) {
    const words = response.content
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4); // Only meaningful words

    for (const word of words) {
      keywords.set(word, (keywords.get(word) || 0) + 1);
    }
  }

  // Count words that appear in multiple responses
  let sharedCount = 0;
  const totalUniqueWords = keywords.size;

  for (const count of keywords.values()) {
    if (count > 1) {
      sharedCount++;
    }
  }

  if (totalUniqueWords === 0) {
    return 0.5; // Default for empty responses
  }

  // Calculate agreement ratio (0-1)
  const agreementRatio = sharedCount / totalUniqueWords;

  // Scale to reasonable range (0.3 - 1.0)
  return 0.3 + agreementRatio * 0.7;
}
