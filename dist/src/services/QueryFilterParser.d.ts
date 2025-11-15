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
import type { ParsedQuery, Language, SymbolKind } from '../types/QueryFilter.js';
/**
 * Parses filter syntax from search queries
 */
export declare class QueryFilterParser {
    private static readonly LANG_PATTERN;
    private static readonly KIND_PATTERN;
    private static readonly FILE_PATTERN;
    private static readonly VALID_LANGUAGES;
    private static readonly VALID_KINDS;
    /**
     * Parse a query string into search terms and filters
     */
    parse(query: string): ParsedQuery;
    /**
     * Extract filter matches from query string
     */
    private extractFilter;
    /**
     * Validate if a string is a valid language
     */
    private isValidLanguage;
    /**
     * Validate if a string is a valid symbol kind
     */
    private isValidKind;
    /**
     * Get list of valid languages
     */
    static getValidLanguages(): Language[];
    /**
     * Get list of valid symbol kinds
     */
    static getValidKinds(): SymbolKind[];
}
//# sourceMappingURL=QueryFilterParser.d.ts.map