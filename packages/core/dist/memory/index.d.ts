import { MemoryCleanupConfig, MemoryAddInput, MemorySearchOptions, MemorySearchResult, MemoryEntry, MemoryStats, CleanupStrategy, MemoryCleanupResult } from '@ax/schemas';

/**
 * Memory Manager - FTS5-based persistent memory system
 *
 * Provides fast full-text search using SQLite FTS5 for agent memory.
 * All data is stored locally for privacy.
 *
 * @module @ax/core/memory
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

interface MemoryManagerOptions {
    /** Path to SQLite database file */
    databasePath: string;
    /** Maximum entries before triggering cleanup */
    maxEntries?: number;
    /** Cleanup configuration */
    cleanupConfig?: Partial<MemoryCleanupConfig>;
}
declare class MemoryManager {
    private readonly db;
    private readonly maxEntries;
    private readonly cleanupConfig;
    private cleanupInProgress;
    private readonly stmtInsert;
    private readonly stmtSearch;
    private readonly stmtGetById;
    private readonly stmtUpdateAccess;
    private readonly stmtDelete;
    private readonly stmtCount;
    constructor(options: MemoryManagerOptions);
    /**
     * Initialize database schema
     */
    private initialize;
    /** Maximum allowed metadata size in bytes (1MB) */
    private static readonly MAX_METADATA_SIZE;
    /** SQL expression for extracting importance from metadata JSON */
    private static readonly IMPORTANCE_SQL;
    /**
     * Validate metadata size to prevent database issues
     */
    private validateMetadataSize;
    /**
     * Safely convert SQLite rowid (number | bigint) to number
     * Warns if precision could be lost for very large IDs
     */
    private safeRowId;
    /**
     * Add a new memory entry
     */
    add(input: MemoryAddInput): number;
    /**
     * Add multiple memory entries in a transaction
     */
    addBatch(inputs: MemoryAddInput[]): number[];
    /**
     * Search memories using FTS5
     */
    search(options: MemorySearchOptions): MemorySearchResult;
    /**
     * Get a memory entry by ID
     */
    getById(id: number): MemoryEntry | null;
    /**
     * Delete a memory entry
     */
    delete(id: number): boolean;
    /**
     * Delete multiple entries
     */
    deleteBatch(ids: number[]): number;
    /**
     * Get entry count
     */
    getCount(): number;
    /**
     * Get memory statistics
     */
    getStats(): MemoryStats;
    /**
     * Cleanup old entries based on strategy
     */
    cleanup(strategy?: CleanupStrategy): MemoryCleanupResult;
    /**
     * Check if cleanup is needed and perform it
     * Protected against concurrent cleanup operations.
     *
     * Note: This is intentionally synchronous because SQLite uses a single-writer model.
     * The `cleanupInProgress` flag prevents re-entrant calls which could occur if
     * add() is called during cleanup (e.g., in a batch operation).
     * Async cleanup would not provide benefits with SQLite's locking model.
     */
    private maybeCleanup;
    /**
     * Update access tracking for entries
     */
    private updateAccessTracking;
    /**
     * Sanitize query string for FTS5
     * Escapes special characters rather than removing them to preserve query intent
     */
    private sanitizeQuery;
    /**
     * Convert database row to MemoryEntry
     */
    private rowToEntry;
    /**
     * Clear memories based on criteria
     *
     * @param options - Clear options
     * @returns Number of deleted entries
     */
    clear(options?: {
        /** Clear memories before this date */
        before?: Date;
        /** Clear memories for specific agent */
        agent?: string;
        /** Clear all memories (required if no other option provided) */
        all?: boolean;
    }): {
        deleted: number;
    };
    /**
     * Run VACUUM to reclaim space (use sparingly)
     */
    vacuum(): void;
    /**
     * Close database connection
     * Safe to call multiple times - subsequent calls are no-ops.
     */
    close(): void;
}

export { MemoryManager, type MemoryManagerOptions };
