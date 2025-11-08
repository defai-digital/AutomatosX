/**
 * QueryFilter.ts
 *
 * Type definitions for query filtering system.
 * Supports filter syntax: lang:, kind:, file: with negation (-kind:test)
 */

/**
 * Supported symbol kinds for filtering
 */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'interface'
  | 'type'
  | 'variable'
  | 'constant'
  | 'enum'
  | 'struct'
  | 'trait'
  | 'impl'
  | 'module';

/**
 * Supported languages for filtering
 */
export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust';

/**
 * Query filters extracted from search query
 */
export interface QueryFilters {
  /** Languages to include (e.g., lang:python) */
  languages: Language[];

  /** Symbol kinds to include (e.g., kind:function) */
  kinds: SymbolKind[];

  /** File patterns to include (e.g., file:src/parser/*.ts) */
  filePatterns: string[];

  /** Languages to exclude (e.g., -lang:test) */
  excludeLanguages: Language[];

  /** Symbol kinds to exclude (e.g., -kind:test) */
  excludeKinds: SymbolKind[];

  /** File patterns to exclude (e.g., -file:*.test.ts) */
  excludeFiles: string[];
}

/**
 * Parsed query with filters separated from search terms
 */
export interface ParsedQuery {
  /** The search terms after extracting filters */
  searchTerms: string;

  /** Extracted filters */
  filters: QueryFilters;

  /** Original query string */
  originalQuery: string;
}

/**
 * Filter match result
 */
export interface FilterMatch {
  /** Whether the item matches all filters */
  matches: boolean;

  /** Reasons for exclusion (if any) */
  exclusionReasons?: string[];
}

/**
 * Creates an empty QueryFilters object
 */
export function createEmptyFilters(): QueryFilters {
  return {
    languages: [],
    kinds: [],
    filePatterns: [],
    excludeLanguages: [],
    excludeKinds: [],
    excludeFiles: [],
  };
}

/**
 * Checks if filters are empty (no filters applied)
 */
export function isEmptyFilters(filters: QueryFilters): boolean {
  return (
    filters.languages.length === 0 &&
    filters.kinds.length === 0 &&
    filters.filePatterns.length === 0 &&
    filters.excludeLanguages.length === 0 &&
    filters.excludeKinds.length === 0 &&
    filters.excludeFiles.length === 0
  );
}
