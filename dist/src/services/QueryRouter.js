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
export var QueryIntent;
(function (QueryIntent) {
    QueryIntent["SYMBOL"] = "symbol";
    QueryIntent["NATURAL"] = "natural";
    QueryIntent["HYBRID"] = "hybrid";
})(QueryIntent || (QueryIntent = {}));
/**
 * QueryRouter - Intelligent query intent detection and routing
 */
export class QueryRouter {
    // Common English words that indicate natural language queries
    static COMMON_WORDS = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
        'could', 'can', 'may', 'might', 'must', 'shall',
        'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where',
        'how', 'why', 'with', 'for', 'from', 'to', 'in', 'on', 'at', 'by',
        'all', 'any', 'some', 'few', 'many', 'much', 'more', 'most',
        'get', 'set', 'find', 'search', 'show', 'display', 'list',
        'code', 'function', 'method', 'class', 'logic', 'implementation',
    ]);
    // FTS5 boolean operators
    static FTS5_OPERATORS = ['AND', 'OR', 'NOT'];
    /**
     * Analyze query and determine intent
     *
     * @param query - User search query
     * @returns Query analysis with intent and features
     */
    analyze(query) {
        const trimmed = query.trim();
        const normalized = trimmed.toLowerCase();
        const words = trimmed.split(/\s+/);
        const wordCount = words.length;
        // Extract features
        const features = {
            isSingleWord: wordCount === 1,
            hasOperators: this.hasOperators(trimmed),
            isIdentifier: this.isIdentifier(trimmed),
            wordCount,
            hasCommonWords: this.hasCommonWords(normalized),
            hasSpecialChars: this.hasSpecialChars(trimmed),
        };
        // Determine intent based on features
        const intent = this.determineIntent(features);
        const confidence = this.calculateConfidence(features, intent);
        return {
            intent,
            confidence,
            query: trimmed,
            normalizedQuery: normalized,
            features,
        };
    }
    /**
     * Determine query intent from features
     */
    determineIntent(features) {
        // Rule 1: Has FTS5 operators → Natural language search
        if (features.hasOperators) {
            return QueryIntent.NATURAL;
        }
        // Rule 2: Single word identifier (PascalCase, camelCase) → Symbol search
        if (features.isSingleWord && features.isIdentifier && !features.hasCommonWords) {
            return QueryIntent.SYMBOL;
        }
        // Rule 3: Multiple words with common words → Natural language search
        if (features.wordCount > 1 && features.hasCommonWords) {
            return QueryIntent.NATURAL;
        }
        // Rule 4: Multiple words with identifiers (no common words) → Hybrid search
        if (features.wordCount > 1 && features.isIdentifier && !features.hasCommonWords) {
            return QueryIntent.HYBRID;
        }
        // Rule 5: Single common word → Hybrid search
        if (features.isSingleWord && features.hasCommonWords) {
            return QueryIntent.HYBRID;
        }
        // Rule 6: Multiple words without operators → Natural language search
        if (features.wordCount > 1) {
            return QueryIntent.NATURAL;
        }
        // Default: Single word → Try symbol first, fallback to natural
        return QueryIntent.SYMBOL;
    }
    /**
     * Calculate confidence score for intent classification
     */
    calculateConfidence(features, intent) {
        let confidence = 0.5; // Base confidence
        if (intent === QueryIntent.SYMBOL) {
            if (features.isSingleWord)
                confidence += 0.1;
            if (features.isIdentifier)
                confidence += 0.1;
            if (!features.hasCommonWords)
                confidence += 0.2;
            // Lower confidence for ambiguous single words
            if (features.isSingleWord && features.wordCount === 1) {
                const word = features.isIdentifier;
                // Common identifier names that are also English words
                confidence = Math.min(confidence, 0.7);
            }
        }
        else if (intent === QueryIntent.NATURAL) {
            if (features.hasOperators)
                confidence += 0.3;
            if (features.hasCommonWords)
                confidence += 0.2;
            if (features.wordCount > 2)
                confidence += 0.1;
        }
        else if (intent === QueryIntent.HYBRID) {
            // Hybrid has lower confidence by nature
            confidence = 0.6;
        }
        return Math.min(1.0, confidence);
    }
    /**
     * Check if query has FTS5 boolean operators
     */
    hasOperators(query) {
        const upperQuery = query.toUpperCase();
        return QueryRouter.FTS5_OPERATORS.some((op) => upperQuery.includes(` ${op} `));
    }
    /**
     * Check if query looks like an identifier (PascalCase, camelCase, snake_case)
     * For multi-word queries, checks if ANY word is an identifier
     */
    isIdentifier(query) {
        // If multi-word, check if any word is an identifier
        if (/\s/.test(query)) {
            const words = query.split(/\s+/);
            return words.some(word => this.isIdentifierWord(word));
        }
        return this.isIdentifierWord(query);
    }
    /**
     * Check if a single word is an identifier
     */
    isIdentifierWord(word) {
        // PascalCase: Calculator, UserManager
        if (/^[A-Z][a-zA-Z0-9]*$/.test(word))
            return true;
        // camelCase: getUserById, validateEmail
        if (/^[a-z][a-zA-Z0-9]*$/.test(word))
            return true;
        // snake_case: get_user_by_id, validate_email
        if (/^[a-z][a-z0-9_]*$/.test(word))
            return true;
        // CONSTANT_CASE: MAX_SIZE, API_KEY
        if (/^[A-Z][A-Z0-9_]*$/.test(word))
            return true;
        return false;
    }
    /**
     * Check if query contains common English words
     */
    hasCommonWords(normalizedQuery) {
        const words = normalizedQuery.split(/\s+/);
        return words.some((word) => QueryRouter.COMMON_WORDS.has(word));
    }
    /**
     * Check if query has special characters (indicating code search)
     */
    hasSpecialChars(query) {
        // Common code characters: . : :: -> => < >
        return /[.:<>]/.test(query);
    }
    /**
     * Format analysis for display
     */
    formatAnalysis(analysis) {
        const lines = [];
        lines.push(`Query: "${analysis.query}"`);
        lines.push(`Intent: ${analysis.intent.toUpperCase()} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`);
        lines.push('Features:');
        lines.push(`  - Single word: ${analysis.features.isSingleWord}`);
        lines.push(`  - Identifier: ${analysis.features.isIdentifier}`);
        lines.push(`  - Has operators: ${analysis.features.hasOperators}`);
        lines.push(`  - Word count: ${analysis.features.wordCount}`);
        lines.push(`  - Common words: ${analysis.features.hasCommonWords}`);
        return lines.join('\n');
    }
    /**
     * Get search strategy explanation for user
     */
    getStrategyExplanation(intent) {
        switch (intent) {
            case QueryIntent.SYMBOL:
                return 'Exact symbol name search';
            case QueryIntent.NATURAL:
                return 'Natural language search (FTS5 + BM25)';
            case QueryIntent.HYBRID:
                return 'Hybrid search (symbols + natural language)';
        }
    }
}
//# sourceMappingURL=QueryRouter.js.map