/**
 * QueryFilter.ts
 *
 * Type definitions for query filtering system.
 * Supports filter syntax: lang:, kind:, file: with negation (-kind:test)
 */
/**
 * Creates an empty QueryFilters object
 */
export function createEmptyFilters() {
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
export function isEmptyFilters(filters) {
    return (filters.languages.length === 0 &&
        filters.kinds.length === 0 &&
        filters.filePatterns.length === 0 &&
        filters.excludeLanguages.length === 0 &&
        filters.excludeKinds.length === 0 &&
        filters.excludeFiles.length === 0);
}
//# sourceMappingURL=QueryFilter.js.map