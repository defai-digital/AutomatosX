// ============================================================================
// HybridSearchBridge.ts - TypeScript bridge to ReScript HybridSearch
// ============================================================================
//
// Provides seamless integration between TypeScript DAOs and ReScript search logic
// Includes feature flags, performance tracking, and automatic fallback
//
// ============================================================================
import * as HybridSearchCore from '../../packages/rescript-core/src/memory/HybridSearchCore.gen.js';
import { shouldUseReScript, logFeatureFlagDecision, getFeatureFlags, } from './ReScriptFeatureFlags.js';
// ============================================================================
// CONVERSION FUNCTIONS (TypeScript ↔ ReScript)
// ============================================================================
/**
 * Convert TypeScript message to ReScript message
 */
function tsMessageToReScript(msg) {
    return {
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.role, // Type-checked by ReScript
        content: msg.content,
        tokens: msg.tokens,
        metadata: msg.metadata,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
    };
}
/**
 * Convert ReScript message to TypeScript message
 */
function rescriptMessageToTS(msg) {
    return {
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.role,
        content: msg.content,
        tokens: msg.tokens,
        metadata: msg.metadata,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
    };
}
/**
 * Convert TypeScript vector result to ReScript
 */
function tsVectorToReScript(vr) {
    return {
        messageId: vr.messageId,
        distance: vr.distance,
        score: vr.score ?? 1.0 - vr.distance / 2.0,
    };
}
/**
 * Convert TypeScript search options to ReScript
 */
function tsOptionsToReScript(opts) {
    return {
        limit: opts?.limit ?? 10,
        minScore: opts?.minScore ?? 0.0,
        weights: {
            fts: opts?.weights?.fts ?? 0.4,
            vector: opts?.weights?.vector ?? 0.4,
            recency: opts?.weights?.recency ?? 0.2,
        },
    };
}
/**
 * Convert ReScript search result to TypeScript
 */
function rescriptResultToTS(result) {
    // Extract message from result
    const msg = result.message
        ? rescriptMessageToTS(result.message)
        : null;
    if (!msg) {
        throw new Error('Search result missing message');
    }
    // Determine source type
    let source;
    if (result.vectorResult && result.message) {
        source = 'hybrid';
    }
    else if (result.vectorResult) {
        source = 'vector';
    }
    else {
        source = 'fts';
    }
    return {
        message: msg,
        source,
        combinedScore: result.combinedScore,
        vectorResult: result.vectorResult
            ? {
                messageId: result.vectorResult.messageId,
                distance: result.vectorResult.distance,
                score: result.vectorResult.score,
            }
            : undefined,
    };
}
// ============================================================================
// RESCRIPT IMPLEMENTATION
// ============================================================================
/**
 * Combine search results using ReScript (prevents BUG #1!)
 */
function combineResultsReScript(ftsResults, vectorResults, options) {
    const startTime = performance.now();
    try {
        // Convert to ReScript types
        const rsFtsResults = ftsResults.map(tsMessageToReScript);
        const rsVectorResults = vectorResults.map(tsVectorToReScript);
        const rsOptions = tsOptionsToReScript(options);
        // Call ReScript (exhaustive pattern matching prevents BUG #1!)
        const rsResults = HybridSearchCore.processResults(rsFtsResults, rsVectorResults, rsOptions);
        // Convert back to TypeScript
        const tsResults = rsResults.map(rescriptResultToTS);
        const endTime = performance.now();
        const elapsed = endTime - startTime;
        if (getFeatureFlags().global.enablePerformanceTracking) {
            console.log(`[ReScript] HybridSearch took ${elapsed.toFixed(2)}ms`);
        }
        return tsResults;
    }
    catch (error) {
        console.error('[ReScript] HybridSearch error:', error);
        throw error;
    }
}
// ============================================================================
// TYPESCRIPT FALLBACK IMPLEMENTATION
// ============================================================================
/**
 * Combine search results using TypeScript (original buggy version for comparison)
 */
function combineResultsTypeScript(ftsResults, vectorResults, options) {
    const startTime = performance.now();
    const combined = new Map();
    const opts = {
        limit: options?.limit ?? 10,
        minScore: options?.minScore ?? 0.0,
        weights: {
            fts: options?.weights?.fts ?? 0.4,
            vector: options?.weights?.vector ?? 0.4,
            recency: options?.weights?.recency ?? 0.2,
        },
    };
    // Add FTS results
    for (const msg of ftsResults) {
        combined.set(msg.id, {
            message: msg,
            source: 'fts',
            combinedScore: opts.weights.fts,
        });
    }
    // Add vector results
    for (const vr of vectorResults) {
        if (combined.has(vr.messageId)) {
            // Update to hybrid
            const existing = combined.get(vr.messageId);
            combined.set(vr.messageId, {
                ...existing,
                source: 'hybrid',
                combinedScore: opts.weights.fts + opts.weights.vector * vr.score,
                vectorResult: vr,
            });
        }
        // ❌ BUG #1: Missing else case! Drops vector-only results!
        // Should have:
        // else {
        //   combined.set(vr.messageId, {
        //     message: null, // Need to fetch message
        //     source: 'vector',
        //     combinedScore: opts.weights.vector * vr.score,
        //     vectorResult: vr,
        //   });
        // }
    }
    // Convert to array and sort
    const results = Array.from(combined.values())
        .filter(r => r.combinedScore >= opts.minScore)
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, opts.limit);
    const endTime = performance.now();
    const elapsed = endTime - startTime;
    if (getFeatureFlags().global.enablePerformanceTracking) {
        console.log(`[TypeScript] HybridSearch took ${elapsed.toFixed(2)}ms`);
    }
    return results;
}
// ============================================================================
// BRIDGE FUNCTION (with feature flags and fallback)
// ============================================================================
/**
 * Combine search results with automatic ReScript/TypeScript selection
 *
 * Uses feature flags to determine whether to use ReScript or TypeScript
 * Falls back to TypeScript if ReScript throws and fallbackOnError is enabled
 */
export function combineSearchResults(ftsResults, vectorResults, options, userId) {
    const useReScript = shouldUseReScript('hybridSearch', userId);
    logFeatureFlagDecision('hybridSearch', useReScript, userId);
    if (!useReScript) {
        // Use TypeScript implementation
        const startTime = performance.now();
        const results = combineResultsTypeScript(ftsResults, vectorResults, options);
        const endTime = performance.now();
        return {
            results,
            metrics: getFeatureFlags().global.enablePerformanceTracking
                ? {
                    typescriptTimeMs: endTime - startTime,
                    implementation: 'typescript',
                }
                : undefined,
        };
    }
    // Try ReScript implementation
    const startTime = performance.now();
    try {
        const results = combineResultsReScript(ftsResults, vectorResults, options);
        const endTime = performance.now();
        return {
            results,
            metrics: getFeatureFlags().global.enablePerformanceTracking
                ? {
                    rescriptTimeMs: endTime - startTime,
                    implementation: 'rescript',
                }
                : undefined,
        };
    }
    catch (error) {
        const flags = getFeatureFlags();
        // Check if fallback is enabled
        if (flags.global.fallbackOnError) {
            console.warn('[ReScript] Falling back to TypeScript due to error:', error);
            // Fall back to TypeScript
            const fallbackStart = performance.now();
            const results = combineResultsTypeScript(ftsResults, vectorResults, options);
            const fallbackEnd = performance.now();
            return {
                results,
                metrics: flags.global.enablePerformanceTracking
                    ? {
                        typescriptTimeMs: fallbackEnd - fallbackStart,
                        implementation: 'typescript',
                    }
                    : undefined,
            };
        }
        else {
            // Fail fast
            throw error;
        }
    }
}
/**
 * Get search result statistics (always uses ReScript for accuracy)
 */
export function getSearchResultStats(results) {
    // Convert to ReScript format
    const rsResults = results.map(r => {
        const rsMsg = tsMessageToReScript(r.message);
        const rsVectorResult = r.vectorResult
            ? tsVectorToReScript(r.vectorResult)
            : undefined;
        let source;
        if (r.source === 'hybrid' && rsVectorResult) {
            source = { TAG: 'Hybrid', _0: rsMsg, _1: rsVectorResult };
        }
        else if (r.source === 'vector' && rsVectorResult) {
            source = { TAG: 'VectorOnly', _0: rsVectorResult };
        }
        else {
            source = { TAG: 'FtsOnly', _0: rsMsg };
        }
        return {
            source,
            combinedScore: r.combinedScore,
            message: rsMsg,
            vectorResult: rsVectorResult,
        };
    });
    // Get stats from ReScript
    return HybridSearchCore.getResultStats(rsResults);
}
// ============================================================================
// EXPORTS
// ============================================================================
export default {
    combineSearchResults,
    getSearchResultStats,
};
//# sourceMappingURL=HybridSearchBridge.js.map