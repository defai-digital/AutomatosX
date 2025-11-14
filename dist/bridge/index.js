// ============================================================================
// bridge/index.ts - ReScript/TypeScript Bridge Exports
// ============================================================================
//
// Central export point for all ReScript bridge functionality
// Includes feature flags, search, stats, and transformations
//
// ============================================================================
// Feature Flags
export { getFeatureFlags, updateFeatureFlags, resetFeatureFlags, shouldUseReScript, logFeatureFlagDecision, applyRolloutPreset, getCurrentPhase, getFeatureFlagStats, ROLLOUT_PRESETS, } from './ReScriptFeatureFlags.js';
// HybridSearch Bridge
export { combineSearchResults, getSearchResultStats, } from './HybridSearchBridge.js';
// StatsAggregation Bridge
export { getConversationStats, getGlobalStats, getTimeRangeStats, selectAggregationStrategy, explainAggregationStrategy, } from './StatsAggregationBridge.js';
// ============================================================================
// USAGE EXAMPLES
// ============================================================================
/**
 * Example 1: Enable ReScript for 10% of users
 *
 * ```typescript
 * import { applyRolloutPreset } from './bridge';
 *
 * // Enable 10% rollout
 * applyRolloutPreset('phase1_10percent');
 * ```
 */
/**
 * Example 2: Use hybrid search with automatic ReScript/TypeScript selection
 *
 * ```typescript
 * import { combineSearchResults } from './bridge';
 *
 * const ftsResults = await ftsDAO.search('calculator');
 * const vectorResults = await vectorDAO.search(embedding);
 *
 * const { results, metrics } = combineSearchResults(
 *   ftsResults,
 *   vectorResults,
 *   { limit: 10, minScore: 0.5 },
 *   userId // For deterministic A/B assignment
 * );
 *
 * console.log(`Found ${results.length} results`);
 * if (metrics) {
 *   console.log(`Implementation: ${metrics.implementation}`);
 *   console.log(`Time: ${metrics.rescriptTimeMs || metrics.typescriptTimeMs}ms`);
 * }
 * ```
 */
/**
 * Example 3: Get conversation stats with 100x speedup
 *
 * ```typescript
 * import { getConversationStats } from './bridge';
 *
 * const stats = await getConversationStats(db, 'conv-123', userId);
 *
 * console.log(`Messages: ${stats.messageCount}`);
 * console.log(`Tokens: ${stats.totalTokens}`);
 * console.log(`Avg tokens/msg: ${stats.avgTokensPerMessage.toFixed(2)}`);
 * ```
 */
/**
 * Example 4: Check feature flag status
 *
 * ```typescript
 * import { getFeatureFlagStats, getCurrentPhase } from './bridge';
 *
 * const phase = getCurrentPhase();
 * const stats = getFeatureFlagStats();
 *
 * console.log(`Current phase: ${phase}`);
 * console.log(`Global enabled: ${stats.globalEnabled}`);
 * console.log('Features:', stats.features);
 * ```
 */
/**
 * Example 5: Gradual rollout workflow
 *
 * ```typescript
 * import { applyRolloutPreset, getCurrentPhase } from './bridge';
 *
 * // Week 1: 10% rollout
 * applyRolloutPreset('phase1_10percent');
 * // Monitor for 1 week
 *
 * // Week 2: 50% rollout
 * applyRolloutPreset('phase2_50percent');
 * // Monitor for 1 week
 *
 * // Week 3: 100% rollout
 * applyRolloutPreset('phase3_100percent');
 * // Monitor for 1 week
 *
 * // Week 4: Production (no fallback)
 * applyRolloutPreset('production');
 * ```
 */
//# sourceMappingURL=index.js.map