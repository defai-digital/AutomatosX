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
import type { Database } from 'better-sqlite3';
import type { SymbolInfo } from '../types/lsp-types.js';
/**
 * Integration Service Configuration
 */
export interface IntegrationConfig {
    enableCache: boolean;
    cacheTTL: number;
    maxCacheSize: number;
}
/**
 * Integration Service
 * Connects LSP server to AutomatosX services
 */
export declare class IntegrationService {
    private fileService?;
    private symbolDAO?;
    private chunkDAO?;
    private database?;
    private config;
    private queryCache;
    private cacheHits;
    private cacheMisses;
    constructor(config?: Partial<IntegrationConfig>);
    /**
     * Get FileService instance (lazy-loaded)
     */
    getFileService(): FileService;
    /**
     * Get SymbolDAO instance (lazy-loaded)
     */
    getSymbolDAO(): SymbolDAO;
    /**
     * Get ChunkDAO instance (lazy-loaded)
     */
    getChunkDAO(): ChunkDAO;
    /**
     * Get Database instance (lazy-loaded)
     */
    getDatabase(): Database;
    /**
     * Find symbol definition by name and file
     */
    findSymbolDefinition(name: string, filePath: string): Promise<SymbolInfo | null>;
    /**
     * Find symbol at specific position
     */
    findSymbolAtPosition(filePath: string, line: number, column: number): Promise<SymbolInfo | null>;
    /**
     * Find all references to a symbol
     */
    findSymbolReferences(name: string, includeDeclaration?: boolean): Promise<SymbolInfo[]>;
    /**
     * Search symbols for completion
     */
    searchSymbolsForCompletion(query: string, currentFile: string, limit?: number): Promise<SymbolInfo[]>;
    /**
     * Get symbols in file
     */
    getFileSymbols(filePath: string): Promise<SymbolInfo[]>;
    /**
     * Map database symbol to SymbolInfo
     */
    private mapToSymbolInfo;
    /**
     * Get from cache
     */
    private getFromCache;
    /**
     * Set cache entry
     */
    private setCache;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        hits: number;
        misses: number;
        hitRate: number;
    };
    /**
     * Dispose resources
     */
    dispose(): void;
}
//# sourceMappingURL=IntegrationService.d.ts.map