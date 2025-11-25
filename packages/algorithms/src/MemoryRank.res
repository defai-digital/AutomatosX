/**
 * Memory Ranking Algorithm
 *
 * Ranks memory entries by relevance using multiple factors:
 * - FTS5 search score (BM25)
 * - Recency
 * - Access frequency
 * - Importance
 * - Type relevance
 *
 * @module MemoryRank
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Types
// =============================================================================

type memoryEntry = {
  id: int,
  ftsScore: float,      // BM25 score from FTS5
  createdAt: float,     // Unix timestamp
  accessCount: int,
  importance: float,    // 0.0 - 1.0
  entryType: string,
  tags: array<string>,
}

type rankingContext = {
  preferredTypes: array<string>,
  preferredTags: array<string>,
  recencyWeight: float,     // 0.0 - 1.0
  frequencyWeight: float,   // 0.0 - 1.0
  importanceWeight: float,  // 0.0 - 1.0
  ftsWeight: float,         // 0.0 - 1.0
}

type scoreBreakdown = {
  fts: float,
  recency: float,
  frequency: float,
  importance: float,
  typeBonus: float,
  tagBonus: float,
}

type rankedEntry = {
  entry: memoryEntry,
  score: float,
  breakdown: scoreBreakdown,
}

// =============================================================================
// Default Context
// =============================================================================

let defaultContext: rankingContext = {
  preferredTypes: [],
  preferredTags: [],
  recencyWeight: 0.2,
  frequencyWeight: 0.15,
  importanceWeight: 0.25,
  ftsWeight: 0.4,
}

// =============================================================================
// Score Calculation
// =============================================================================

/**
 * Calculate recency score (exponential decay)
 */
let calculateRecencyScore = (createdAt: float, now: float): float => {
  // Handle future timestamps (corrupted data or clock skew) - treat as very recent
  if createdAt > now {
    1.0
  } else {
    let ageMs = now -. createdAt
    let ageDays = ageMs /. (1000.0 *. 60.0 *. 60.0 *. 24.0)

    // Exponential decay: half-life of 7 days
    let halfLife = 7.0
    Math.pow(0.5, ~exp=ageDays /. halfLife)
  }
}

/**
 * Calculate frequency score (logarithmic)
 */
let calculateFrequencyScore = (accessCount: int): float => {
  // Log scale: 0 accesses = 0, 1 access ≈ 0.15, 10 accesses ≈ 0.52, 100 accesses = 1.0
  if accessCount <= 0 {
    0.0
  } else {
    Math.min(1.0, Math.log10(Int.toFloat(accessCount) +. 1.0) /. 2.0)
  }
}

/**
 * Calculate type bonus
 */
let calculateTypeBonus = (entryType: string, preferredTypes: array<string>): float => {
  if Array.length(preferredTypes) == 0 {
    0.0
  } else if preferredTypes->Array.includes(entryType) {
    0.2
  } else {
    0.0
  }
}

/**
 * Calculate tag bonus
 */
let calculateTagBonus = (tags: array<string>, preferredTags: array<string>): float => {
  if Array.length(preferredTags) == 0 || Array.length(tags) == 0 {
    0.0
  } else {
    let matchCount = tags->Array.filter(t => preferredTags->Array.includes(t))->Array.length
    let maxMatches = Math.Int.min(Array.length(tags), Array.length(preferredTags))
    if maxMatches > 0 {
      Int.toFloat(matchCount) /. Int.toFloat(maxMatches) *. 0.15
    } else {
      0.0
    }
  }
}

/**
 * Normalize FTS score to 0-1 range
 */
let normalizeFtsScore = (score: float, maxScore: float): float => {
  // FTS5 BM25 scores are negative (closer to 0 = better match)
  // maxScore should be the most negative (worst) score for normalization
  // Use epsilon for floating point comparison to handle precision errors
  let epsilon = 1e-10

  // Handle edge case: if maxScore is non-negative, all scores are treated as zero relevance
  // This can happen with corrupted data or certain FTS5 configurations
  if maxScore >= -.epsilon {
    0.0
  } else if score > 0.0 {
    // Handle edge case: positive scores (shouldn't happen but protect against it)
    1.0
  } else {
    // Normalize: score of maxScore -> 0, score of 0 -> 1
    // Guard against division by zero (including negative zero edge case)
    let absMaxScore = Math.abs(maxScore)
    let safeAbsMaxScore = if absMaxScore == 0.0 { 1e-10 } else { absMaxScore }
    let normalized = 1.0 +. score /. safeAbsMaxScore
    Math.min(1.0, Math.max(0.0, normalized))
  }
}

// =============================================================================
// Ranking
// =============================================================================

/**
 * Rank a single memory entry
 */
let rankEntry = (entry: memoryEntry, ctx: rankingContext, now: float, maxFtsScore: float): rankedEntry => {
  // Calculate individual scores
  let ftsNormalized = normalizeFtsScore(entry.ftsScore, maxFtsScore)
  let recencyScore = calculateRecencyScore(entry.createdAt, now)
  let frequencyScore = calculateFrequencyScore(entry.accessCount)
  let typeBonus = calculateTypeBonus(entry.entryType, ctx.preferredTypes)
  let tagBonus = calculateTagBonus(entry.tags, ctx.preferredTags)

  // Weighted combination
  let weightedScore =
    ftsNormalized *. ctx.ftsWeight +.
    recencyScore *. ctx.recencyWeight +.
    frequencyScore *. ctx.frequencyWeight +.
    entry.importance *. ctx.importanceWeight +.
    typeBonus +.
    tagBonus

  {
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
  }
}

/**
 * Rank multiple memory entries
 */
let rankEntries = (entries: array<memoryEntry>, ctx: rankingContext): array<rankedEntry> => {
  if Array.length(entries) == 0 {
    []
  } else {
    let now = Date.now()

    // Find the most negative FTS score for normalization baseline
    // FTS5 BM25 scores are negative (closer to 0 = better match)
    // Initialize with first entry's score instead of 0 to handle edge cases
    // Safe access: we already checked entries.length != 0 above
    let firstFtsScore = switch Array.get(entries, 0) {
    | Some(e) => e.ftsScore
    | None => 0.0 // Fallback, should not happen due to length check
    }
    let maxFtsScore = entries->Array.reduce(firstFtsScore, (min, e) => {
      Math.min(min, e.ftsScore)
    })

    // Rank all entries
    let ranked = entries->Array.map(e => rankEntry(e, ctx, now, maxFtsScore))

    // Sort by score descending
    ranked->Array.toSorted((a, b) => {
      if a.score > b.score { -1.0 }
      else if a.score < b.score { 1.0 }
      else { 0.0 }
    })
  }
}

/**
 * Get top N ranked entries
 */
let getTopRanked = (entries: array<memoryEntry>, ctx: rankingContext, limit: int): array<rankedEntry> => {
  // Validate limit: must be positive, capped at array length
  let arrayLen = Array.length(entries)
  let maxLen = if arrayLen > 0 { arrayLen } else { 1 }
  let validLimit = Math.Int.max(1, Math.Int.min(limit, maxLen))
  let ranked = rankEntries(entries, ctx)
  ranked->Array.slice(~start=0, ~end=validLimit)
}
