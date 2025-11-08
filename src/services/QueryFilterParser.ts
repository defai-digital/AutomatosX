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

import type {
  QueryFilters,
  ParsedQuery,
  Language,
  SymbolKind,
} from '../types/QueryFilter.js';
import { createEmptyFilters } from '../types/QueryFilter.js';

/**
 * Parses filter syntax from search queries
 */
export class QueryFilterParser {
  // Regex patterns for filter extraction
  private static readonly LANG_PATTERN = /(-?)lang:([\w]+)/g;
  private static readonly KIND_PATTERN = /(-?)kind:([\w]+)/g;
  private static readonly FILE_PATTERN = /(-?)file:([\w\/\.\*\-]+)/g;

  // Valid values for validation
  private static readonly VALID_LANGUAGES: Set<string> = new Set([
    'typescript',
    'javascript',
    'python',
    'go',
    'rust',
  ]);

  private static readonly VALID_KINDS: Set<string> = new Set([
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
  parse(query: string): ParsedQuery {
    const filters = createEmptyFilters();
    let remaining = query;

    // Extract language filters
    remaining = this.extractFilter(
      remaining,
      QueryFilterParser.LANG_PATTERN,
      (value, isNegated) => {
        // For exclusions, allow any value (user might want to exclude non-standard languages)
        // For inclusions, validate against known languages
        if (isNegated) {
          filters.excludeLanguages.push(value as Language);
        } else if (this.isValidLanguage(value)) {
          filters.languages.push(value as Language);
        }
      }
    );

    // Extract kind filters
    remaining = this.extractFilter(
      remaining,
      QueryFilterParser.KIND_PATTERN,
      (value, isNegated) => {
        // For exclusions, allow any value (user might want to exclude non-standard kinds)
        // For inclusions, validate against known kinds
        if (isNegated) {
          filters.excludeKinds.push(value as SymbolKind);
        } else if (this.isValidKind(value)) {
          filters.kinds.push(value as SymbolKind);
        }
      }
    );

    // Extract file filters
    remaining = this.extractFilter(
      remaining,
      QueryFilterParser.FILE_PATTERN,
      (value, isNegated) => {
        if (isNegated) {
          filters.excludeFiles.push(value);
        } else {
          filters.filePatterns.push(value);
        }
      }
    );

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
  private extractFilter(
    query: string,
    pattern: RegExp,
    handler: (value: string, isNegated: boolean) => void
  ): string {
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
  private isValidLanguage(value: string): boolean {
    return QueryFilterParser.VALID_LANGUAGES.has(value.toLowerCase());
  }

  /**
   * Validate if a string is a valid symbol kind
   */
  private isValidKind(value: string): boolean {
    return QueryFilterParser.VALID_KINDS.has(value.toLowerCase());
  }

  /**
   * Get list of valid languages
   */
  static getValidLanguages(): Language[] {
    return Array.from(QueryFilterParser.VALID_LANGUAGES) as Language[];
  }

  /**
   * Get list of valid symbol kinds
   */
  static getValidKinds(): SymbolKind[] {
    return Array.from(QueryFilterParser.VALID_KINDS) as SymbolKind[];
  }
}
