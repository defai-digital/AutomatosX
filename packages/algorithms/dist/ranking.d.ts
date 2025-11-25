/**
 * TypeScript bindings for ReScript MemoryRank module
 *
 * @module @ax/algorithms/ranking
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
interface MemoryEntry {
    id: number;
    ftsScore: number;
    createdAt: number;
    accessCount: number;
    importance: number;
    entryType: string;
    tags: string[];
}
interface RankingContext {
    preferredTypes: string[];
    preferredTags: string[];
    recencyWeight: number;
    frequencyWeight: number;
    importanceWeight: number;
    ftsWeight: number;
}
interface ScoreBreakdown {
    fts: number;
    recency: number;
    frequency: number;
    importance: number;
    typeBonus: number;
    tagBonus: number;
}
interface RankedEntry {
    entry: MemoryEntry;
    score: number;
    breakdown: ScoreBreakdown;
}
declare const defaultRankingContext: RankingContext;
/**
 * Calculate recency score (exponential decay)
 */
declare function calculateRecencyScore(createdAt: number, now?: number): number;
/**
 * Calculate frequency score (logarithmic)
 */
declare function calculateFrequencyScore(accessCount: number): number;
/**
 * Calculate type bonus
 */
declare function calculateTypeBonus(entryType: string, preferredTypes: string[]): number;
/**
 * Calculate tag bonus
 */
declare function calculateTagBonus(tags: string[], preferredTags: string[]): number;
/**
 * Normalize FTS score to 0-1 range
 */
declare function normalizeFtsScore(score: number, maxScore: number): number;
/**
 * Rank a single memory entry
 */
declare function rankEntry(entry: MemoryEntry, ctx?: RankingContext, now?: number, maxFtsScore?: number): RankedEntry;
/**
 * Rank multiple memory entries
 */
declare function rankEntries(entries: MemoryEntry[], ctx?: RankingContext): RankedEntry[];
/**
 * Get top N ranked entries
 */
declare function getTopRanked(entries: MemoryEntry[], ctx?: RankingContext, limit?: number): RankedEntry[];
/**
 * Create a custom ranking context
 */
declare function createRankingContext(overrides: Partial<RankingContext>): RankingContext;
/**
 * Validate ranking weights sum to 1.0
 */
declare function validateWeights(ctx: RankingContext): {
    valid: boolean;
    sum: number;
};

export { type MemoryEntry, type RankedEntry, type RankingContext, type ScoreBreakdown, calculateFrequencyScore, calculateRecencyScore, calculateTagBonus, calculateTypeBonus, createRankingContext, defaultRankingContext, getTopRanked, normalizeFtsScore, rankEntries, rankEntry, validateWeights };
