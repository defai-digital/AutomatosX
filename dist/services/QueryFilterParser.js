/**
 * QueryFilterParser.ts
 *
 * Parses query filter syntax from search queries.
 * Supports: lang:, kind:, file: with negation prefix (-)
 *
 * Examples:
 *   "find auth lang:python kind:function"
 *   "search error -kind:test -file:*.spec.ts"
 *   "api file:src/services/*.ts lang:typescript"
 */
import { createEmptyFilters } from '../types/QueryFilter.js';
/**
 * Parses filter syntax from search queries
 */
export class QueryFilterParser {
    // Regex patterns for filter extraction
    static LANG_PATTERN = /(-?)lang:([\w]+)/g;
    static KIND_PATTERN = /(-?)kind:([\w]+)/g;
    static FILE_PATTERN = /(-?)file:([\w\/\.\*\-]+)/g;
    // Valid values for validation
    static VALID_LANGUAGES = new Set([
        'typescript',
        'javascript',
        'python',
        'go',
        'rust',
    ]);
    static VALID_KINDS = new Set([
        'function',
        'class',
        'method',
        'interface',
        'type',
        'variable',
        'constant',
        'enum',
        'struct',
        'trait',
        'impl',
        'module',
    ]);
    /**
     * Parse a query string into search terms and filters
     */
    parse(query) {
        const filters = createEmptyFilters();
        let remaining = query;
        // Extract language filters
        remaining = this.extractFilter(remaining, QueryFilterParser.LANG_PATTERN, (value, isNegated) => {
            // For exclusions, allow any value (user might want to exclude non-standard languages)
            // For inclusions, validate against known languages
            if (isNegated) {
                filters.excludeLanguages.push(value);
            }
            else if (this.isValidLanguage(value)) {
                filters.languages.push(value);
            }
        });
        // Extract kind filters
        remaining = this.extractFilter(remaining, QueryFilterParser.KIND_PATTERN, (value, isNegated) => {
            // For exclusions, allow any value (user might want to exclude non-standard kinds)
            // For inclusions, validate against known kinds
            if (isNegated) {
                filters.excludeKinds.push(value);
            }
            else if (this.isValidKind(value)) {
                filters.kinds.push(value);
            }
        });
        // Extract file filters
        remaining = this.extractFilter(remaining, QueryFilterParser.FILE_PATTERN, (value, isNegated) => {
            if (isNegated) {
                filters.excludeFiles.push(value);
            }
            else {
                filters.filePatterns.push(value);
            }
        });
        // Clean up remaining string (remove extra spaces)
        const searchTerms = remaining.replace(/\s+/g, ' ').trim();
        return {
            searchTerms,
            filters,
            originalQuery: query,
        };
    }
    /**
     * Extract filter matches from query string
     */
    extractFilter(query, pattern, handler) {
        let remaining = query;
        // Reset pattern lastIndex (important for global regex)
        pattern.lastIndex = 0;
        const matches = [...query.matchAll(pattern)];
        for (const match of matches) {
            const isNegated = match[1] === '-';
            const value = match[2];
            handler(value, isNegated);
            // Remove the filter from the query string
            remaining = remaining.replace(match[0], '');
        }
        return remaining;
    }
    /**
     * Validate if a string is a valid language
     */
    isValidLanguage(value) {
        return QueryFilterParser.VALID_LANGUAGES.has(value.toLowerCase());
    }
    /**
     * Validate if a string is a valid symbol kind
     */
    isValidKind(value) {
        return QueryFilterParser.VALID_KINDS.has(value.toLowerCase());
    }
    /**
     * Get list of valid languages
     */
    static getValidLanguages() {
        return Array.from(QueryFilterParser.VALID_LANGUAGES);
    }
    /**
     * Get list of valid symbol kinds
     */
    static getValidKinds() {
        return Array.from(QueryFilterParser.VALID_KINDS);
    }
}
//# sourceMappingURL=QueryFilterParser.js.map