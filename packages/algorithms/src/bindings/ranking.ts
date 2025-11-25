/**
 * TypeScript bindings for ReScript MemoryRank module
 *
 * @module @ax/algorithms/ranking
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Algorithm Constants
// =============================================================================

/** Default ranking weights (must sum to 1.0) */
const DEFAULT_RECENCY_WEIGHT = 0.2;
const DEFAULT_FREQUENCY_WEIGHT = 0.15;
const DEFAULT_IMPORTANCE_WEIGHT = 0.25;
const DEFAULT_FTS_WEIGHT = 0.4;

/** Recency decay half-life in days */
const RECENCY_HALF_LIFE_DAYS = 7;

/** Milliseconds per day for time calculations */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Bonus values for type/tag matching */
const TYPE_MATCH_BONUS = 0.2;
const TAG_MATCH_BONUS_MULTIPLIER = 0.15;

/** Frequency score logarithmic scaling divisor */
const FREQUENCY_LOG_SCALE_DIVISOR = 2;

/** Epsilon for floating point comparisons */
const FTS_EPSILON = 1e-10;

/** Weight validation tolerance */
const WEIGHT_VALIDATION_TOLERANCE = 0.01;

/** Exponential decay base (0.5 = half-life decay) */
const EXPONENTIAL_DECAY_BASE = 0.5;

/** Maximum frequency score (normalized ceiling) */
const FREQUENCY_SCORE_MAX = 1;

/** Default limit for top ranked results */
const DEFAULT_RANKING_LIMIT = 10;

/** Default max FTS score for normalization baseline */
const DEFAULT_MAX_FTS_SCORE = -1;

// =============================================================================
// Types
// =============================================================================

// Types that mirror ReScript types
export interface MemoryEntry {
  id: number;
  ftsScore: number; // BM25 score from FTS5
  createdAt: number; // Unix timestamp
  accessCount: number;
  importance: number; // 0.0 - 1.0
  entryType: string;
  tags: string[];
}

export interface RankingContext {
  preferredTypes: string[];
  preferredTags: string[];
  recencyWeight: number; // 0.0 - 1.0
  frequencyWeight: number; // 0.0 - 1.0
  importanceWeight: number; // 0.0 - 1.0
  ftsWeight: number; // 0.0 - 1.0
}

export interface ScoreBreakdown {
  fts: number;
  recency: number;
  frequency: number;
  importance: number;
  typeBonus: number;
  tagBonus: number;
}

export interface RankedEntry {
  entry: MemoryEntry;
  score: number;
  breakdown: ScoreBreakdown;
}

/**
 * Clamp a number between min and max bounds
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Default context
export const defaultRankingContext: RankingContext = {
  preferredTypes: [],
  preferredTags: [],
  recencyWeight: DEFAULT_RECENCY_WEIGHT,
  frequencyWeight: DEFAULT_FREQUENCY_WEIGHT,
  importanceWeight: DEFAULT_IMPORTANCE_WEIGHT,
  ftsWeight: DEFAULT_FTS_WEIGHT,
};

/**
 * Calculate recency score (exponential decay)
 */
export function calculateRecencyScore(createdAt: number, now: number = Date.now()): number {
  // Handle future timestamps (corrupted data or clock skew) - treat as very recent
  if (createdAt > now) {
    return 1;
  }
  const ageMs = now - createdAt;
  const ageDays = ageMs / MS_PER_DAY;

  // Exponential decay with configurable half-life
  return Math.pow(EXPONENTIAL_DECAY_BASE, ageDays / RECENCY_HALF_LIFE_DAYS);
}

/**
 * Calculate frequency score (logarithmic)
 */
export function calculateFrequencyScore(accessCount: number): number {
  if (accessCount <= 0) {
    return 0;
  }
  // Log scale: 0 accesses = 0, 1 access ≈ 0.15, 10 accesses ≈ 0.52, 100 accesses = 1.0
  return Math.min(FREQUENCY_SCORE_MAX, Math.log10(accessCount + 1) / FREQUENCY_LOG_SCALE_DIVISOR);
}

/**
 * Calculate type bonus
 */
export function calculateTypeBonus(entryType: string, preferredTypes: string[]): number {
  if (preferredTypes.length === 0) {
    return 0;
  }
  return preferredTypes.includes(entryType) ? TYPE_MATCH_BONUS : 0;
}

/**
 * Calculate tag bonus
 */
export function calculateTagBonus(tags: string[], preferredTags: string[]): number {
  if (preferredTags.length === 0 || tags.length === 0) {
    return 0;
  }
  const matchCount = tags.filter((t) => preferredTags.includes(t)).length;
  const maxMatches = Math.min(tags.length, preferredTags.length);
  // maxMatches is guaranteed > 0 due to guard above
  return (matchCount / maxMatches) * TAG_MATCH_BONUS_MULTIPLIER;
}

/**
 * Normalize FTS score to 0-1 range
 */
export function normalizeFtsScore(score: number, maxScore: number): number {
  // FTS5 BM25 scores are negative (closer to 0 = better match)
  // maxScore should be the most negative (worst) score for normalization

  // Handle edge case: if maxScore is non-negative, all scores are treated as zero relevance
  // This can happen with corrupted data or certain FTS5 configurations
  if (maxScore >= -FTS_EPSILON) {
    // If score itself is also non-negative, return 0 (no useful FTS data)
    // Otherwise, we have an inconsistent state - return 0 as fallback
    return 0;
  }

  // Handle edge case: positive scores (shouldn't happen but protect against it)
  if (score > 0) {
    return 1; // Treat positive scores as best possible match
  }

  // Normalize: score of maxScore -> 0, score of 0 -> 1
  // Guard against division by zero (including negative zero edge case)
  const absMaxScore = Math.abs(maxScore) || FTS_EPSILON;
  const normalized = 1 + score / absMaxScore;
  return clamp(normalized, 0, 1);
}

/**
 * Rank a single memory entry
 */
export function rankEntry(
  entry: MemoryEntry,
  ctx: RankingContext = defaultRankingContext,
  now: number = Date.now(),
  maxFtsScore: number = DEFAULT_MAX_FTS_SCORE
): RankedEntry {
  // Calculate individual scores
  const ftsNormalized = normalizeFtsScore(entry.ftsScore, maxFtsScore);
  const recencyScore = calculateRecencyScore(entry.createdAt, now);
  const frequencyScore = calculateFrequencyScore(entry.accessCount);
  const typeBonus = calculateTypeBonus(entry.entryType, ctx.preferredTypes);
  const tagBonus = calculateTagBonus(entry.tags, ctx.preferredTags);

  // Weighted combination
  const weightedScore =
    ftsNormalized * ctx.ftsWeight +
    recencyScore * ctx.recencyWeight +
    frequencyScore * ctx.frequencyWeight +
    entry.importance * ctx.importanceWeight +
    typeBonus +
    tagBonus;

  return {
    entry,
    score: weightedScore,
    breakdown: {
      fts: ftsNormalized,
      recency: recencyScore,
      frequency: frequencyScore,
      importance: entry.importance,
      typeBonus,
      tagBonus,
    },
  };
}

/**
 * Rank multiple memory entries
 */
export function rankEntries(
  entries: MemoryEntry[],
  ctx: RankingContext = defaultRankingContext
): RankedEntry[] {
  if (entries.length === 0) {
    return [];
  }

  const now = Date.now();

  // Find the most negative FTS score for normalization baseline
  // FTS5 BM25 scores are negative (closer to 0 = better match)
  // Initialize with first entry's score instead of 0 to handle edge cases
  // Safe to use entries[0] since we already check entries.length === 0 above
  const maxFtsScore = entries.reduce(
    (min, e) => Math.min(min, e.ftsScore),
    entries[0]!.ftsScore
  );

  // Rank all entries
  const ranked = entries.map((e) => rankEntry(e, ctx, now, maxFtsScore));

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);

  return ranked;
}

/**
 * Get top N ranked entries
 */
export function getTopRanked(
  entries: MemoryEntry[],
  ctx: RankingContext = defaultRankingContext,
  limit: number = DEFAULT_RANKING_LIMIT
): RankedEntry[] {
  // Early return for empty array to avoid unnecessary processing
  if (entries.length === 0) {
    return [];
  }
  // Validate limit: must be positive, capped at array length
  const validLimit = clamp(limit, 1, entries.length);
  const ranked = rankEntries(entries, ctx);
  return ranked.slice(0, validLimit);
}

/**
 * Create a custom ranking context
 */
export function createRankingContext(overrides: Partial<RankingContext>): RankingContext {
  return {
    ...defaultRankingContext,
    ...overrides,
  };
}

/**
 * Validate ranking weights sum to 1.0
 */
export function validateWeights(ctx: RankingContext): { valid: boolean; sum: number } {
  const sum = ctx.recencyWeight + ctx.frequencyWeight + ctx.importanceWeight + ctx.ftsWeight;
  return {
    valid: Math.abs(sum - 1.0) < WEIGHT_VALIDATION_TOLERANCE,
    sum,
  };
}
