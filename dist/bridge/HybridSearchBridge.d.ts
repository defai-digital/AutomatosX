/**
 * TypeScript message type (from existing DAO)
 */
export interface TSMessage {
    id: string;
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tokens?: number;
    metadata?: any;
    createdAt: number;
    updatedAt: number;
}
/**
 * TypeScript vector result type (from existing DAO)
 */
export interface TSVectorResult {
    messageId: string;
    distance: number;
    score?: number;
}
/**
 * TypeScript search result type (existing)
 */
export interface TSSearchResult {
    message: TSMessage;
    source: 'fts' | 'vector' | 'hybrid';
    combinedScore: number;
    vectorResult?: TSVectorResult;
}
/**
 * Search options (TypeScript-side)
 */
export interface TSSearchOptions {
    limit?: number;
    minScore?: number;
    weights?: {
        fts?: number;
        vector?: number;
        recency?: number;
    };
}
/**
 * Performance metrics
 */
export interface PerformanceMetrics {
    rescriptTimeMs?: number;
    typescriptTimeMs?: number;
    speedup?: number;
    implementation: 'rescript' | 'typescript';
}
/**
 * Combine search results with automatic ReScript/TypeScript selection
 *
 * Uses feature flags to determine whether to use ReScript or TypeScript
 * Falls back to TypeScript if ReScript throws and fallbackOnError is enabled
 */
export declare function combineSearchResults(ftsResults: TSMessage[], vectorResults: TSVectorResult[], options?: TSSearchOptions, userId?: string): {
    results: TSSearchResult[];
    metrics?: PerformanceMetrics;
};
/**
 * Get search result statistics (always uses ReScript for accuracy)
 */
export declare function getSearchResultStats(results: TSSearchResult[]): {
    total: number;
    hybrid: number;
    ftsOnly: number;
    vectorOnly: number;
    avgScore: number;
};
declare const _default: {
    combineSearchResults: typeof combineSearchResults;
    getSearchResultStats: typeof getSearchResultStats;
};
export default _default;
//# sourceMappingURL=HybridSearchBridge.d.ts.map