/**
 * QueryRouter.ts
 *
 * Intelligent query router that detects user intent and routes to appropriate search backend
 * - Exact symbol search for identifier names
 * - Natural language search for descriptive queries
 * - Hybrid search combining both strategies
 */
/**
 * Query intent classification
 */
export declare enum QueryIntent {
    SYMBOL = "symbol",// Exact symbol name lookup (e.g., "Calculator", "login")
    NATURAL = "natural",// Natural language query (e.g., "user authentication logic")
    HYBRID = "hybrid"
}
/**
 * Query analysis result
 */
export interface QueryAnalysis {
    intent: QueryIntent;
    confidence: number;
    query: string;
    normalizedQuery: string;
    features: {
        isSingleWord: boolean;
        hasOperators: boolean;
        isIdentifier: boolean;
        wordCount: number;
        hasCommonWords: boolean;
        hasSpecialChars: boolean;
    };
}
/**
 * QueryRouter - Intelligent query intent detection and routing
 */
export declare class QueryRouter {
    private static readonly COMMON_WORDS;
    private static readonly FTS5_OPERATORS;
    /**
     * Analyze query and determine intent
     *
     * @param query - User search query
     * @returns Query analysis with intent and features
     */
    analyze(query: string): QueryAnalysis;
    /**
     * Determine query intent from features
     */
    private determineIntent;
    /**
     * Calculate confidence score for intent classification
     */
    private calculateConfidence;
    /**
     * Check if query has FTS5 boolean operators
     */
    private hasOperators;
    /**
     * Check if query looks like an identifier (PascalCase, camelCase, snake_case)
     * For multi-word queries, checks if ANY word is an identifier
     */
    private isIdentifier;
    /**
     * Check if a single word is an identifier
     */
    private isIdentifierWord;
    /**
     * Check if query contains common English words
     */
    private hasCommonWords;
    /**
     * Check if query has special characters (indicating code search)
     */
    private hasSpecialChars;
    /**
     * Format analysis for display
     */
    formatAnalysis(analysis: QueryAnalysis): string;
    /**
     * Get search strategy explanation for user
     */
    getStrategyExplanation(intent: QueryIntent): string;
}
//# sourceMappingURL=QueryRouter.d.ts.map