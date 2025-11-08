/**
 * FileService.ts
 *
 * High-level service for indexing code files
 * Orchestrates FileDAO, ParserService, and SymbolDAO
 */
import { FileDAO } from '../database/dao/FileDAO.js';
import { SymbolDAO } from '../database/dao/SymbolDAO.js';
import { ChunkDAO } from '../database/dao/ChunkDAO.js';
import { getParserRegistry } from '../parser/ParserRegistry.js';
import { ChunkingService } from './ChunkingService.js';
import { QueryRouter, QueryIntent } from './QueryRouter.js';
import { QueryFilterParser } from './QueryFilterParser.js';
import { transaction } from '../database/connection.js';
import { SimpleQueryCache } from '../cache/SimpleQueryCache.js';
/**
 * Result type discriminator
 */
export var SearchResultType;
(function (SearchResultType) {
    SearchResultType["SYMBOL"] = "symbol";
    SearchResultType["CHUNK"] = "chunk";
})(SearchResultType || (SearchResultType = {}));
/**
 * FileService - High-level API for file indexing
 */
export class FileService {
    fileDAO;
    symbolDAO;
    chunkDAO;
    parserRegistry;
    chunkingService;
    queryRouter;
    filterParser;
    queryCache;
    constructor() {
        this.fileDAO = new FileDAO();
        this.symbolDAO = new SymbolDAO();
        this.chunkDAO = new ChunkDAO();
        this.parserRegistry = getParserRegistry();
        this.chunkingService = new ChunkingService();
        this.queryRouter = new QueryRouter();
        this.filterParser = new QueryFilterParser();
        this.queryCache = new SimpleQueryCache({
            maxSize: 1000,
            ttl: 300000, // 5 minutes
        });
    }
    /**
     * Index a code file (parse + store symbols)
     *
     * @param path - File path
     * @param content - File content
     * @returns Index result with file ID and symbol count
     */
    indexFile(path, content) {
        const startTime = performance.now();
        // Detect language from file extension and parse to extract symbols
        const parseResult = this.parserRegistry.parse(content, path);
        // Create chunks from parsed symbols
        const chunkingResult = this.chunkingService.chunkFile(content, parseResult.symbols);
        // Store file + symbols + chunks in transaction (atomic operation)
        const result = transaction(() => {
            // 1. Insert file record
            const fileId = this.fileDAO.insert({
                path,
                content,
                language: this.parserRegistry.getLanguageForPath(path),
            });
            // 2. Insert symbols (batch insert for performance)
            const symbolInputs = parseResult.symbols.map((symbol) => ({
                file_id: fileId,
                name: symbol.name,
                kind: symbol.kind,
                line: symbol.line,
                column: symbol.column,
                end_line: symbol.endLine,
                end_column: symbol.endColumn,
            }));
            const symbolIds = this.symbolDAO.insertBatch(symbolInputs);
            // 3. Insert chunks (batch insert for performance)
            // Map symbol line numbers to symbol IDs for linking
            const symbolIdMap = new Map();
            parseResult.symbols.forEach((symbol, index) => {
                symbolIdMap.set(symbol.line, symbolIds[index]);
            });
            const chunkInputs = chunkingResult.chunks.map((chunk) => ({
                file_id: fileId,
                content: chunk.content,
                start_line: chunk.start_line,
                end_line: chunk.end_line,
                chunk_type: chunk.chunk_type,
                symbol_id: symbolIdMap.get(chunk.start_line),
            }));
            this.chunkDAO.insertBatch(chunkInputs);
            return {
                fileId,
                symbolCount: parseResult.symbols.length,
                chunkCount: chunkingResult.chunks.length,
                parseTime: parseResult.parseTime,
            };
        });
        const endTime = performance.now();
        // Invalidate cache after indexing new file
        this.invalidateCache();
        return {
            ...result,
            totalTime: endTime - startTime,
        };
    }
    /**
     * Re-index an existing file (update content + symbols)
     *
     * @param path - File path
     * @param content - New content
     * @returns Index result
     */
    reindexFile(path, content) {
        const startTime = performance.now();
        // Detect language from file extension and parse new content
        const parseResult = this.parserRegistry.parse(content, path);
        // Create chunks from parsed symbols
        const chunkingResult = this.chunkingService.chunkFile(content, parseResult.symbols);
        // Update file + replace symbols + replace chunks in transaction
        const result = transaction(() => {
            // 1. Find existing file
            const existingFile = this.fileDAO.findByPath(path);
            if (!existingFile) {
                throw new Error(`File not found: ${path}`);
            }
            // 2. Update file content
            this.fileDAO.update(existingFile.id, { content });
            // 3. Delete old symbols and chunks
            this.symbolDAO.deleteByFileId(existingFile.id);
            this.chunkDAO.deleteByFileId(existingFile.id);
            // 4. Insert new symbols
            const symbolInputs = parseResult.symbols.map((symbol) => ({
                file_id: existingFile.id,
                name: symbol.name,
                kind: symbol.kind,
                line: symbol.line,
                column: symbol.column,
                end_line: symbol.endLine,
                end_column: symbol.endColumn,
            }));
            const symbolIds = this.symbolDAO.insertBatch(symbolInputs);
            // 5. Insert new chunks
            const symbolIdMap = new Map();
            parseResult.symbols.forEach((symbol, index) => {
                symbolIdMap.set(symbol.line, symbolIds[index]);
            });
            const chunkInputs = chunkingResult.chunks.map((chunk) => ({
                file_id: existingFile.id,
                content: chunk.content,
                start_line: chunk.start_line,
                end_line: chunk.end_line,
                chunk_type: chunk.chunk_type,
                symbol_id: symbolIdMap.get(chunk.start_line),
            }));
            this.chunkDAO.insertBatch(chunkInputs);
            return {
                fileId: existingFile.id,
                symbolCount: parseResult.symbols.length,
                chunkCount: chunkingResult.chunks.length,
                parseTime: parseResult.parseTime,
            };
        });
        const endTime = performance.now();
        // Invalidate cache after reindexing
        this.invalidateCache();
        return {
            ...result,
            totalTime: endTime - startTime,
        };
    }
    /**
     * Get file with all its symbols
     *
     * @param path - File path
     * @returns File with symbols or null
     */
    getFileWithSymbols(path) {
        const file = this.fileDAO.findByPath(path);
        if (!file)
            return null;
        const symbols = this.symbolDAO.findByFileId(file.id);
        return {
            ...file,
            symbols: symbols.map((s) => ({
                id: s.id,
                name: s.name,
                kind: s.kind,
                line: s.line,
                column: s.column,
            })),
        };
    }
    /**
     * Search symbols by name
     *
     * @param name - Symbol name
     * @returns Array of symbols with file paths
     */
    searchSymbols(name) {
        return this.symbolDAO.findWithFile(name);
    }
    /**
     * Delete file and all its symbols
     *
     * @param path - File path
     * @returns True if deleted
     */
    deleteFile(path) {
        return transaction(() => {
            const file = this.fileDAO.findByPath(path);
            if (!file)
                return false;
            // Delete file (symbols will be cascade deleted via foreign key)
            this.fileDAO.delete(file.id);
            return true;
        });
    }
    /**
     * Unified search with automatic intent detection and routing
     *
     * @param query - Search query (symbol name or natural language, with optional filters)
     * @param limit - Maximum results (default: 10)
     * @param forceIntent - Optional: force specific search strategy
     * @returns Search response with unified results
     */
    search(query, limit = 10, forceIntent) {
        const startTime = performance.now();
        // Create cache key from query parameters
        const cacheKey = JSON.stringify({ query, limit, forceIntent });
        // Check cache first
        const cached = this.queryCache.get(cacheKey);
        if (cached) {
            // Update search time to reflect cache hit (much faster)
            return {
                ...cached,
                searchTime: performance.now() - startTime,
            };
        }
        // Parse filters from query
        const parsed = this.filterParser.parse(query);
        const searchTerms = parsed.searchTerms.trim();
        const filters = parsed.filters;
        // If no search terms but has filters, return empty results
        // (filter-only queries not yet supported - would require scanning all files)
        if (!searchTerms) {
            return {
                results: [],
                query,
                intent: QueryIntent.NATURAL,
                analysis: {
                    query: '',
                    normalizedQuery: '',
                    intent: QueryIntent.NATURAL,
                    confidence: 0,
                    features: {
                        isSingleWord: false,
                        isIdentifier: false,
                        hasOperators: false,
                        wordCount: 0,
                        hasCommonWords: false,
                        hasSpecialChars: false
                    }
                },
                totalResults: 0,
                searchTime: performance.now() - startTime,
            };
        }
        // Analyze query to determine intent (using search terms without filters)
        const analysis = this.queryRouter.analyze(searchTerms);
        const intent = forceIntent || analysis.intent;
        // Execute search based on intent
        let results;
        switch (intent) {
            case QueryIntent.SYMBOL:
                results = this.executeSymbolSearch(searchTerms, limit, filters);
                break;
            case QueryIntent.NATURAL:
                results = this.executeNaturalSearch(searchTerms, limit, filters);
                break;
            case QueryIntent.HYBRID:
                results = this.executeHybridSearch(searchTerms, limit, filters);
                break;
        }
        const endTime = performance.now();
        const response = {
            results,
            query,
            intent,
            analysis,
            totalResults: results.length,
            searchTime: endTime - startTime,
        };
        // Cache the result
        this.queryCache.set(cacheKey, response);
        return response;
    }
    /**
     * Execute symbol search (exact name matching)
     */
    executeSymbolSearch(query, limit, filters) {
        const symbolResults = this.symbolDAO.findWithFile(query, filters);
        return symbolResults.slice(0, limit).map((result) => ({
            type: SearchResultType.SYMBOL,
            file_path: result.file_path,
            line: result.line,
            column: result.column,
            name: result.name,
            kind: result.kind,
            score: 1.0, // Exact match = perfect score
        }));
    }
    /**
     * Execute natural language search (FTS5 + BM25)
     */
    executeNaturalSearch(query, limit, filters) {
        const chunkResults = this.chunkDAO.search(query, limit, filters);
        // Normalize BM25 rank to 0-1 score (higher is better)
        const maxRank = Math.max(...chunkResults.map((r) => Math.abs(r.rank)));
        const minRank = Math.min(...chunkResults.map((r) => Math.abs(r.rank)));
        const rankRange = maxRank - minRank || 1;
        return chunkResults.map((result) => ({
            type: SearchResultType.CHUNK,
            file_path: result.file_path,
            line: result.start_line,
            start_line: result.start_line,
            end_line: result.end_line,
            content: result.content,
            chunk_type: result.chunk_type,
            rank: result.rank,
            // Normalize rank: lower (more negative) rank = higher score
            score: 1.0 - (Math.abs(result.rank) - minRank) / rankRange,
        }));
    }
    /**
     * Execute hybrid search (combine symbol + natural language)
     */
    executeHybridSearch(query, limit, filters) {
        // Execute both searches
        const symbolResults = this.executeSymbolSearch(query, limit, filters);
        const naturalResults = this.executeNaturalSearch(query, limit, filters);
        // Combine and deduplicate results
        const combined = [...symbolResults, ...naturalResults];
        const deduped = this.deduplicateResults(combined);
        // Sort by score (descending)
        deduped.sort((a, b) => b.score - a.score);
        // Return top N results
        return deduped.slice(0, limit);
    }
    /**
     * Deduplicate results by file path and line number
     */
    deduplicateResults(results) {
        const seen = new Set();
        const unique = [];
        for (const result of results) {
            const key = `${result.file_path}:${result.line}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(result);
            }
        }
        return unique;
    }
    /**
     * Search code using natural language (full-text search)
     *
     * @param query - Natural language query
     * @param limit - Maximum results (default: 10)
     * @returns Array of chunk search results with ranking
     */
    searchNaturalLanguage(query, limit = 10) {
        return this.chunkDAO.search(query, limit);
    }
    /**
     * Search code by chunk type
     *
     * @param query - Search query
     * @param chunkType - Filter by chunk type (function, class, method, etc.)
     * @param limit - Maximum results
     * @returns Array of chunk search results
     */
    searchByType(query, chunkType, limit = 10) {
        return this.chunkDAO.searchByType(query, chunkType, limit);
    }
    /**
     * Get statistics about indexed files
     */
    getStats() {
        return {
            totalFiles: this.fileDAO.count(),
            totalSymbols: this.symbolDAO.count(),
            totalChunks: this.chunkDAO.count(),
            symbolsByKind: this.symbolDAO.countByKind(),
            chunksByType: this.chunkDAO.countByType(),
        };
    }
    /**
     * Get query cache statistics
     */
    getCacheStats() {
        return this.queryCache.stats();
    }
    /**
     * Clear the query cache
     * Useful after indexing new files to ensure fresh results
     */
    clearCache() {
        this.queryCache.clear();
    }
    /**
     * Invalidate cache after indexing
     * Automatically called when files are indexed
     */
    invalidateCache() {
        // For now, just clear the entire cache
        // In future, could implement smarter invalidation based on file paths
        this.queryCache.clear();
    }
}
//# sourceMappingURL=FileService.js.map