// src/bindings/ranking.ts
var DEFAULT_RECENCY_WEIGHT = 0.2;
var DEFAULT_FREQUENCY_WEIGHT = 0.15;
var DEFAULT_IMPORTANCE_WEIGHT = 0.25;
var DEFAULT_FTS_WEIGHT = 0.4;
var RECENCY_HALF_LIFE_DAYS = 7;
var MS_PER_DAY = 1e3 * 60 * 60 * 24;
var TYPE_MATCH_BONUS = 0.2;
var TAG_MATCH_BONUS_MULTIPLIER = 0.15;
var FREQUENCY_LOG_SCALE_DIVISOR = 2;
var FTS_EPSILON = 1e-10;
var WEIGHT_VALIDATION_TOLERANCE = 0.01;
var EXPONENTIAL_DECAY_BASE = 0.5;
var FREQUENCY_SCORE_MAX = 1;
var DEFAULT_RANKING_LIMIT = 10;
var DEFAULT_MAX_FTS_SCORE = -1;
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
var defaultRankingContext = {
  preferredTypes: [],
  preferredTags: [],
  recencyWeight: DEFAULT_RECENCY_WEIGHT,
  frequencyWeight: DEFAULT_FREQUENCY_WEIGHT,
  importanceWeight: DEFAULT_IMPORTANCE_WEIGHT,
  ftsWeight: DEFAULT_FTS_WEIGHT
};
function calculateRecencyScore(createdAt, now = Date.now()) {
  if (createdAt > now) {
    return 1;
  }
  const ageMs = now - createdAt;
  const ageDays = ageMs / MS_PER_DAY;
  return Math.pow(EXPONENTIAL_DECAY_BASE, ageDays / RECENCY_HALF_LIFE_DAYS);
}
function calculateFrequencyScore(accessCount) {
  if (accessCount <= 0) {
    return 0;
  }
  return Math.min(FREQUENCY_SCORE_MAX, Math.log10(accessCount + 1) / FREQUENCY_LOG_SCALE_DIVISOR);
}
function calculateTypeBonus(entryType, preferredTypes) {
  if (preferredTypes.length === 0) {
    return 0;
  }
  return preferredTypes.includes(entryType) ? TYPE_MATCH_BONUS : 0;
}
function calculateTagBonus(tags, preferredTags) {
  if (preferredTags.length === 0 || tags.length === 0) {
    return 0;
  }
  const matchCount = tags.filter((t) => preferredTags.includes(t)).length;
  const maxMatches = Math.min(tags.length, preferredTags.length);
  return matchCount / maxMatches * TAG_MATCH_BONUS_MULTIPLIER;
}
function normalizeFtsScore(score, maxScore) {
  if (maxScore >= -FTS_EPSILON) {
    return 0;
  }
  if (score > 0) {
    return 1;
  }
  const absMaxScore = Math.abs(maxScore) || FTS_EPSILON;
  const normalized = 1 + score / absMaxScore;
  return clamp(normalized, 0, 1);
}
function rankEntry(entry, ctx = defaultRankingContext, now = Date.now(), maxFtsScore = DEFAULT_MAX_FTS_SCORE) {
  const ftsNormalized = normalizeFtsScore(entry.ftsScore, maxFtsScore);
  const recencyScore = calculateRecencyScore(entry.createdAt, now);
  const frequencyScore = calculateFrequencyScore(entry.accessCount);
  const typeBonus = calculateTypeBonus(entry.entryType, ctx.preferredTypes);
  const tagBonus = calculateTagBonus(entry.tags, ctx.preferredTags);
  const weightedScore = ftsNormalized * ctx.ftsWeight + recencyScore * ctx.recencyWeight + frequencyScore * ctx.frequencyWeight + entry.importance * ctx.importanceWeight + typeBonus + tagBonus;
  return {
    entry,
    score: weightedScore,
    breakdown: {
      fts: ftsNormalized,
      recency: recencyScore,
      frequency: frequencyScore,
      importance: entry.importance,
      typeBonus,
      tagBonus
    }
  };
}
function rankEntries(entries, ctx = defaultRankingContext) {
  if (entries.length === 0) {
    return [];
  }
  const now = Date.now();
  const maxFtsScore = entries.reduce(
    (min, e) => Math.min(min, e.ftsScore),
    entries[0].ftsScore
  );
  const ranked = entries.map((e) => rankEntry(e, ctx, now, maxFtsScore));
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
function getTopRanked(entries, ctx = defaultRankingContext, limit = DEFAULT_RANKING_LIMIT) {
  if (entries.length === 0) {
    return [];
  }
  const validLimit = clamp(limit, 1, entries.length);
  const ranked = rankEntries(entries, ctx);
  return ranked.slice(0, validLimit);
}
function createRankingContext(overrides) {
  return {
    ...defaultRankingContext,
    ...overrides
  };
}
function validateWeights(ctx) {
  const sum = ctx.recencyWeight + ctx.frequencyWeight + ctx.importanceWeight + ctx.ftsWeight;
  return {
    valid: Math.abs(sum - 1) < WEIGHT_VALIDATION_TOLERANCE,
    sum
  };
}
export {
  calculateFrequencyScore,
  calculateRecencyScore,
  calculateTagBonus,
  calculateTypeBonus,
  createRankingContext,
  defaultRankingContext,
  getTopRanked,
  normalizeFtsScore,
  rankEntries,
  rankEntry,
  validateWeights
};
/**
 * TypeScript bindings for ReScript MemoryRank module
 *
 * @module @ax/algorithms/ranking
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=ranking.js.map