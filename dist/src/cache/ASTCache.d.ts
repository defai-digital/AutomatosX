/**
 * AST Cache
 *
 * LRU cache for parsed Abstract Syntax Trees
 * Keyed by file path + content hash to ensure correctness
 */
import type { ParseResult } from '../parser/LanguageParser.js';
export interface CacheEntry {
    ast: ParseResult;
    hash: string;
    filePath: string;
    timestamp: number;
    hits: number;
}
export interface ASTCacheOptions {
    maxSize?: number;
    ttl?: number;
}
export interface ASTCacheStats {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    totalEntries: number;
}
/**
 * LRU Cache for parsed ASTs
 */
export declare class ASTCache {
    private cache;
    private lruOrder;
    private maxSize;
    private ttl;
    private hits;
    private misses;
    private evictions;
    constructor(options?: ASTCacheOptions);
    /**
     * Compute SHA-256 hash of content
     */
    private computeHash;
    /**
     * Generate cache key
     */
    private getCacheKey;
    /**
     * Get cached AST
     */
    get(filePath: string, content: string): ParseResult | null;
    /**
     * Store AST in cache
     */
    set(filePath: string, content: string, ast: ParseResult): void;
    /**
     * Invalidate all entries for a file path
     */
    invalidate(filePath: string): void;
    /**
     * Clear entire cache
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    stats(): ASTCacheStats;
    /**
     * Get top N most accessed files
     */
    getTopFiles(n?: number): Array<{
        filePath: string;
        hits: number;
    }>;
    /**
     * Get cache memory usage estimate (MB)
     */
    getMemoryUsage(): number;
}
//# sourceMappingURL=ASTCache.d.ts.map