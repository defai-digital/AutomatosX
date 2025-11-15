/**
 * FileService.ts
 *
 * High-level service for indexing code files
 * Orchestrates FileDAO, ParserService, and SymbolDAO
 */
import { ChunkSearchResult } from '../database/dao/ChunkDAO.js';
import { QueryIntent, QueryAnalysis } from './QueryRouter.js';
import { type CacheStats } from '../cache/SimpleQueryCache.js';
/**
 * Index result
 */
export interface IndexResult {
    fileId: number;
    symbolCount: number;
    chunkCount: number;
    parseTime: number;
    totalTime: number;
}
/**
 * File with symbols
 */
export interface FileWithSymbols {
    id: number;
    path: string;
    content: string;
    hash: string;
    size: number;
    language: string | null;
    indexed_at: string;
    updated_at: string;
    symbols: Array<{
        id: number;
        name: string;
        kind: string;
        line: number;
        column: number;
    }>;
}
/**
 * Result type discriminator
 */
export declare enum SearchResultType {
    SYMBOL = "symbol",
    CHUNK = "chunk"
}
/**
 * Unified search result (symbol or chunk)
 */
export interface UnifiedSearchResult {
    type: SearchResultType;
    file_path: string;
    line: number;
    score: number;
    name?: string;
    kind?: string;
    column?: number;
    content?: string;
    start_line?: number;
    end_line?: number;
    chunk_type?: string;
    rank?: number;
}
/**
 * Search response with metadata
 */
export interface SearchResponse {
    results: UnifiedSearchResult[];
    query: string;
    intent: QueryIntent;
    analysis: QueryAnalysis;
    totalResults: number;
    searchTime: number;
}
/**
 * FileService - High-level API for file indexing
 */
export declare class FileService {
    private fileDAO;
    private symbolDAO;
    private chunkDAO;
    private parserRegistry;
    private chunkingService;
    private queryRouter;
    private filterParser;
    private queryCache;
    constructor();
    /**
     * Index a code file (parse + store symbols)
     *
     * @param path - File path
     * @param content - File content
     * @returns Index result with file ID and symbol count
     */
    indexFile(path: string, content: string): IndexResult;
    /**
     * Re-index an existing file (update content + symbols)
     *
     * @param path - File path
     * @param content - New content
     * @returns Index result
     */
    reindexFile(path: string, content: string): IndexResult;
    /**
     * Get file with all its symbols
     *
     * @param path - File path
     * @returns File with symbols or null
     */
    getFileWithSymbols(path: string): FileWithSymbols | null;
    /**
     * Search symbols by name
     *
     * @param name - Symbol name
     * @returns Array of symbols with file paths
     */
    searchSymbols(name: string): Array<{
        id: number;
        name: string;
        kind: string;
        line: number;
        column: number;
        file_path: string;
    }>;
    /**
     * Delete file and all its symbols
     *
     * @param path - File path
     * @returns True if deleted
     */
    deleteFile(path: string): boolean;
    /**
     * Unified search with automatic intent detection and routing
     *
     * @param query - Search query (symbol name or natural language, with optional filters)
     * @param limit - Maximum results (default: 10)
     * @param forceIntent - Optional: force specific search strategy
     * @returns Search response with unified results
     */
    search(query: string, limit?: number, forceIntent?: QueryIntent): SearchResponse;
    /**
     * Execute symbol search (exact name matching)
     */
    private executeSymbolSearch;
    /**
     * Execute natural language search (FTS5 + BM25)
     */
    private executeNaturalSearch;
    /**
     * Execute hybrid search (combine symbol + natural language)
     */
    private executeHybridSearch;
    /**
     * Deduplicate results by file path and line number
     */
    private deduplicateResults;
    /**
     * Search code using natural language (full-text search)
     *
     * @param query - Natural language query
     * @param limit - Maximum results (default: 10)
     * @returns Array of chunk search results with ranking
     */
    searchNaturalLanguage(query: string, limit?: number): ChunkSearchResult[];
    /**
     * Search code by chunk type
     *
     * @param query - Search query
     * @param chunkType - Filter by chunk type (function, class, method, etc.)
     * @param limit - Maximum results
     * @returns Array of chunk search results
     */
    searchByType(query: string, chunkType: string, limit?: number): ChunkSearchResult[];
    /**
     * Get statistics about indexed files
     */
    getStats(): {
        totalFiles: number;
        totalSymbols: number;
        totalChunks: number;
        symbolsByKind: Record<string, number>;
        chunksByType: Record<string, number>;
    };
    /**
     * Get query cache statistics
     */
    getCacheStats(): CacheStats;
    /**
     * Clear the query cache
     * Useful after indexing new files to ensure fresh results
     */
    clearCache(): void;
    /**
     * Invalidate cache after indexing
     * Automatically called when files are indexed
     */
    private invalidateCache;
    /**
     * Find symbol by name - simplified interface for agent system
     * Delegates to searchSymbols
     */
    findSymbol(name: string): Promise<any[]>;
    /**
     * Get call graph for a function
     * Returns callers and callees of a given function
     */
    getCallGraph(functionName: string): Promise<any>;
    /**
     * Analyze code quality for a file
     * Returns quality metrics and issues
     */
    analyzeQuality(filePath: string): Promise<any>;
}
//# sourceMappingURL=FileService.d.ts.map