/**
 * AutomatosX v8.0.0 - Fuzzy Matcher
 *
 * Typo-tolerant matching using Levenshtein distance
 * Enables natural language queries with spelling mistakes
 */
import { distance as levenshteinDistance } from 'fastest-levenshtein';
/**
 * Fuzzy Matcher
 *
 * Uses Levenshtein distance algorithm for typo-tolerant matching
 * Optimized for terminal/CLI command matching
 */
export class FuzzyMatcher {
    maxDistance;
    minSimilarity;
    constructor(maxDistance = 3, // Maximum Levenshtein distance
    minSimilarity = 0.6 // Minimum similarity score (0-1)
    ) {
        this.maxDistance = maxDistance;
        this.minSimilarity = minSimilarity;
    }
    /**
     * Find closest match for input among candidates
     * @param input - User input (potentially misspelled)
     * @param candidates - List of valid options
     * @param threshold - Minimum similarity threshold (default 0.6)
     * @returns Best match or null if no match above threshold
     */
    findClosestMatch(input, candidates, threshold = this.minSimilarity) {
        const inputLower = input.toLowerCase().trim();
        let bestMatch = null;
        let bestScore = 0;
        for (const candidate of candidates) {
            const candidateLower = candidate.toLowerCase().trim();
            // Calculate Levenshtein distance
            const dist = levenshteinDistance(inputLower, candidateLower);
            // Skip if distance too large
            if (dist > this.maxDistance) {
                continue;
            }
            // Calculate similarity score (1.0 = exact match, 0.0 = completely different)
            const maxLen = Math.max(inputLower.length, candidateLower.length);
            const score = 1 - (dist / maxLen);
            // Update best match if score is better
            if (score > bestScore && score >= threshold) {
                bestScore = score;
                bestMatch = {
                    match: candidate,
                    score,
                    distance: dist
                };
            }
        }
        return bestMatch;
    }
    /**
     * Find all matches above threshold (sorted by score)
     */
    findAllMatches(input, candidates, threshold = this.minSimilarity) {
        const inputLower = input.toLowerCase().trim();
        const matches = [];
        for (const candidate of candidates) {
            const candidateLower = candidate.toLowerCase().trim();
            const dist = levenshteinDistance(inputLower, candidateLower);
            if (dist > this.maxDistance) {
                continue;
            }
            const maxLen = Math.max(inputLower.length, candidateLower.length);
            const score = 1 - (dist / maxLen);
            if (score >= threshold) {
                matches.push({ match: candidate, score, distance: dist });
            }
        }
        // Sort by score (descending)
        return matches.sort((a, b) => b.score - a.score);
    }
    /**
     * Check if two strings are approximately equal
     */
    areApproximatelyEqual(str1, str2, maxDist = 2) {
        const dist = levenshteinDistance(str1.toLowerCase().trim(), str2.toLowerCase().trim());
        return dist <= maxDist;
    }
    /**
     * Correct typos in a sentence by matching individual words
     * @param input - Input sentence with potential typos
     * @param dictionary - Valid words dictionary
     * @returns Corrected sentence
     */
    correctSentence(input, dictionary) {
        const words = input.split(/\s+/);
        const correctedWords = [];
        for (const word of words) {
            // Skip very short words (likely not typos)
            if (word.length <= 2) {
                correctedWords.push(word);
                continue;
            }
            // Try to find correction
            const match = this.findClosestMatch(word, dictionary, 0.7);
            if (match && match.distance > 0) {
                // Word was corrected
                correctedWords.push(match.match);
            }
            else {
                // No correction needed or found
                correctedWords.push(word);
            }
        }
        return correctedWords.join(' ');
    }
    /**
     * Get similarity score between two strings
     * @returns Similarity score 0-1 (1 = identical)
     */
    getSimilarity(str1, str2) {
        const dist = levenshteinDistance(str1.toLowerCase().trim(), str2.toLowerCase().trim());
        const maxLen = Math.max(str1.length, str2.length);
        return maxLen === 0 ? 1.0 : 1 - (dist / maxLen);
    }
    /**
     * Check if input is likely a typo of target
     */
    isLikelyTypo(input, target) {
        const dist = levenshteinDistance(input.toLowerCase().trim(), target.toLowerCase().trim());
        // Consider it a typo if:
        // 1. Distance is small (1-3 characters)
        // 2. Similarity is high (>70%)
        return dist >= 1 && dist <= 3 && this.getSimilarity(input, target) >= 0.7;
    }
}
//# sourceMappingURL=FuzzyMatcher.js.map