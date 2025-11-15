/**
 * Integration Service
 *
 * Bridge between LSP server and AutomatosX core services.
 * Provides lazy-loaded access to FileService, DAOs, and database.
 * Handles caching, error handling, and telemetry.
 */
import { FileService } from '../../services/FileService.js';
import { SymbolDAO } from '../../database/dao/SymbolDAO.js';
import { ChunkDAO } from '../../database/dao/ChunkDAO.js';
import { getDatabase } from '../../database/connection.js';
const DEFAULT_CONFIG = {
    enableCache: true,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    maxCacheSize: 1000,
};
/**
 * Integration Service
 * Connects LSP server to AutomatosX services
 */
export class IntegrationService {
    fileService;
    symbolDAO;
    chunkDAO;
    database;
    config;
    queryCache = new Map();
    cacheHits = 0;
    cacheMisses = 0;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Get FileService instance (lazy-loaded)
     */
    getFileService() {
        if (!this.fileService) {
            this.fileService = new FileService();
        }
        return this.fileService;
    }
    /**
     * Get SymbolDAO instance (lazy-loaded)
     */
    getSymbolDAO() {
        if (!this.symbolDAO) {
            const db = this.getDatabase();
            this.symbolDAO = new SymbolDAO(db);
        }
        return this.symbolDAO;
    }
    /**
     * Get ChunkDAO instance (lazy-loaded)
     */
    getChunkDAO() {
        if (!this.chunkDAO) {
            const db = this.getDatabase();
            this.chunkDAO = new ChunkDAO(db);
        }
        return this.chunkDAO;
    }
    /**
     * Get Database instance (lazy-loaded)
     */
    getDatabase() {
        if (!this.database) {
            this.database = getDatabase();
        }
        return this.database;
    }
    /**
     * Find symbol definition by name and file
     */
    async findSymbolDefinition(name, filePath) {
        const cacheKey = `def:${name}:${filePath}`;
        const cached = this.getFromCache(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        try {
            const symbolDAO = this.getSymbolDAO();
            const symbols = symbolDAO.findByName(name);
            // Prefer symbol in the same file
            const localSymbol = symbols.find((s) => s.filePath === filePath);
            if (localSymbol) {
                const result = this.mapToSymbolInfo(localSymbol);
                this.setCache(cacheKey, result);
                return result;
            }
            // Otherwise, return first match
            if (symbols.length > 0) {
                const result = this.mapToSymbolInfo(symbols[0]);
                this.setCache(cacheKey, result);
                return result;
            }
            this.setCache(cacheKey, null);
            return null;
        }
        catch (error) {
            console.error(`Error finding symbol definition for ${name}:`, error);
            return null;
        }
    }
    /**
     * Find symbol at specific position
     */
    async findSymbolAtPosition(filePath, line, column) {
        const cacheKey = `pos:${filePath}:${line}:${column}`;
        const cached = this.getFromCache(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        try {
            const symbolDAO = this.getSymbolDAO();
            const symbols = symbolDAO.findByFile(filePath);
            // Find symbol containing the position
            const symbol = symbols.find((s) => {
                return ((line > s.startLine || (line === s.startLine && column >= s.startColumn)) &&
                    (line < s.endLine || (line === s.endLine && column <= s.endColumn)));
            });
            const result = symbol ? this.mapToSymbolInfo(symbol) : null;
            this.setCache(cacheKey, result);
            return result;
        }
        catch (error) {
            console.error(`Error finding symbol at position ${filePath}:${line}:${column}:`, error);
            return null;
        }
    }
    /**
     * Find all references to a symbol
     */
    async findSymbolReferences(name, includeDeclaration = false) {
        const cacheKey = `refs:${name}:${includeDeclaration}`;
        const cached = this.getFromCache(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        try {
            const symbolDAO = this.getSymbolDAO();
            const symbols = symbolDAO.findByName(name);
            const result = symbols.map((s) => this.mapToSymbolInfo(s));
            this.setCache(cacheKey, result);
            return result;
        }
        catch (error) {
            console.error(`Error finding references for ${name}:`, error);
            return [];
        }
    }
    /**
     * Search symbols for completion
     */
    async searchSymbolsForCompletion(query, currentFile, limit = 50) {
        const cacheKey = `complete:${query}:${currentFile}:${limit}`;
        const cached = this.getFromCache(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        try {
            const symbolDAO = this.getSymbolDAO();
            // Get all symbols matching query prefix
            const allSymbols = symbolDAO.findAll();
            const matchingSymbols = allSymbols.filter((s) => s.name.toLowerCase().startsWith(query.toLowerCase()));
            // Sort: local symbols first, then by name
            const sorted = matchingSymbols.sort((a, b) => {
                const aIsLocal = a.filePath === currentFile ? 0 : 1;
                const bIsLocal = b.filePath === currentFile ? 0 : 1;
                if (aIsLocal !== bIsLocal) {
                    return aIsLocal - bIsLocal;
                }
                return a.name.localeCompare(b.name);
            });
            const result = sorted.slice(0, limit).map((s) => this.mapToSymbolInfo(s));
            this.setCache(cacheKey, result);
            return result;
        }
        catch (error) {
            console.error(`Error searching symbols for completion:`, error);
            return [];
        }
    }
    /**
     * Get symbols in file
     */
    async getFileSymbols(filePath) {
        const cacheKey = `file:${filePath}`;
        const cached = this.getFromCache(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        try {
            const symbolDAO = this.getSymbolDAO();
            const symbols = symbolDAO.findByFile(filePath);
            const result = symbols.map((s) => this.mapToSymbolInfo(s));
            this.setCache(cacheKey, result);
            return result;
        }
        catch (error) {
            console.error(`Error getting file symbols for ${filePath}:`, error);
            return [];
        }
    }
    /**
     * Map database symbol to SymbolInfo
     */
    mapToSymbolInfo(symbol) {
        return {
            id: symbol.id,
            name: symbol.name,
            kind: symbol.kind,
            filePath: symbol.filePath,
            startLine: symbol.startLine,
            startColumn: symbol.startColumn,
            endLine: symbol.endLine,
            endColumn: symbol.endColumn,
            signature: symbol.signature,
            docstring: symbol.docstring,
            scope: symbol.scope,
        };
    }
    /**
     * Get from cache
     */
    getFromCache(key) {
        if (!this.config.enableCache) {
            return undefined;
        }
        const entry = this.queryCache.get(key);
        if (!entry) {
            this.cacheMisses++;
            return undefined;
        }
        const age = Date.now() - entry.timestamp;
        if (age > this.config.cacheTTL) {
            this.queryCache.delete(key);
            this.cacheMisses++;
            return undefined;
        }
        this.cacheHits++;
        return entry.data;
    }
    /**
     * Set cache entry
     */
    setCache(key, data) {
        if (!this.config.enableCache) {
            return;
        }
        // Evict oldest entries if cache is full
        if (this.queryCache.size >= this.config.maxCacheSize) {
            const oldestKey = this.queryCache.keys().next().value;
            if (oldestKey) {
                this.queryCache.delete(oldestKey);
            }
        }
        this.queryCache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.queryCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const total = this.cacheHits + this.cacheMisses;
        return {
            size: this.queryCache.size,
            hits: this.cacheHits,
            misses: this.cacheMisses,
            hitRate: total > 0 ? this.cacheHits / total : 0,
        };
    }
    /**
     * Dispose resources
     */
    dispose() {
        this.queryCache.clear();
        // Note: Don't close database as it's shared
    }
}
//# sourceMappingURL=IntegrationService.js.map