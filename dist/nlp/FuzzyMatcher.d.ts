/**
 * AutomatosX v8.0.0 - Fuzzy Matcher
 *
 * Typo-tolerant matching using Levenshtein distance
 * Enables natural language queries with spelling mistakes
 */
/**
 * Fuzzy match result
 */
export interface FuzzyMatchResult {
    match: string;
    score: number;
    distance: number;
}
/**
 * Fuzzy Matcher
 *
 * Uses Levenshtein distance algorithm for typo-tolerant matching
 * Optimized for terminal/CLI command matching
 */
export declare class FuzzyMatcher {
    private readonly maxDistance;
    private readonly minSimilarity;
    constructor(maxDistance?: number, // Maximum Levenshtein distance
    minSimilarity?: number);
    /**
     * Find closest match for input among candidates
     * @param input - User input (potentially misspelled)
     * @param candidates - List of valid options
     * @param threshold - Minimum similarity threshold (default 0.6)
     * @returns Best match or null if no match above threshold
     */
    findClosestMatch(input: string, candidates: string[], threshold?: number): FuzzyMatchResult | null;
    /**
     * Find all matches above threshold (sorted by score)
     */
    findAllMatches(input: string, candidates: string[], threshold?: number): FuzzyMatchResult[];
    /**
     * Check if two strings are approximately equal
     */
    areApproximatelyEqual(str1: string, str2: string, maxDist?: number): boolean;
    /**
     * Correct typos in a sentence by matching individual words
     * @param input - Input sentence with potential typos
     * @param dictionary - Valid words dictionary
     * @returns Corrected sentence
     */
    correctSentence(input: string, dictionary: string[]): string;
    /**
     * Get similarity score between two strings
     * @returns Similarity score 0-1 (1 = identical)
     */
    getSimilarity(str1: string, str2: string): number;
    /**
     * Check if input is likely a typo of target
     */
    isLikelyTypo(input: string, target: string): boolean;
}
//# sourceMappingURL=FuzzyMatcher.d.ts.map