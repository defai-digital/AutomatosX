/**
 * SymbolDAO.ts
 *
 * Data Access Object for symbols table
 * Provides CRUD operations for code symbols extracted from files
 */
import type { QueryFilters } from '../../types/QueryFilter.js';
/**
 * Symbol record from database
 */
export interface SymbolRecord {
    id: number;
    file_id: number;
    name: string;
    kind: string;
    line: number;
    column: number;
    end_line: number | null;
    end_column: number | null;
}
/**
 * Symbol input for insertion
 */
export interface SymbolInput {
    file_id: number;
    name: string;
    kind: string;
    line: number;
    column: number;
    end_line?: number;
    end_column?: number;
}
/**
 * SymbolDAO - Data Access Object for symbols table
 */
export declare class SymbolDAO {
    private db;
    constructor();
    /**
     * Insert a new symbol
     *
     * @param symbol - Symbol input data
     * @returns Inserted symbol ID
     */
    insert(symbol: SymbolInput): number;
    /**
     * Insert multiple symbols in a batch
     *
     * @param symbols - Array of symbol inputs
     * @returns Array of inserted IDs
     */
    insertBatch(symbols: SymbolInput[]): number[];
    /**
     * Find symbol by ID
     *
     * @param id - Symbol ID
     * @returns Symbol record or null
     */
    findById(id: number): SymbolRecord | null;
    /**
     * Find all symbols in a file
     *
     * @param fileId - File ID
     * @returns Array of symbol records
     */
    findByFileId(fileId: number): SymbolRecord[];
    /**
     * Find symbols by name
     *
     * @param name - Symbol name
     * @returns Array of symbol records
     */
    findByName(name: string): SymbolRecord[];
    /**
     * Find symbols by kind
     *
     * @param kind - Symbol kind (function, class, etc.)
     * @returns Array of symbol records
     */
    findByKind(kind: string): SymbolRecord[];
    /**
     * Find symbols by name and kind
     *
     * @param name - Symbol name
     * @param kind - Symbol kind
     * @returns Array of symbol records
     */
    findByNameAndKind(name: string, kind: string): SymbolRecord[];
    /**
     * Search symbols by name pattern (LIKE query)
     *
     * @param pattern - Name pattern (e.g., "get%")
     * @returns Array of symbol records
     */
    searchByName(pattern: string): SymbolRecord[];
    /**
     * Delete symbol by ID
     *
     * @param id - Symbol ID
     * @returns True if deleted, false if not found
     */
    delete(id: number): boolean;
    /**
     * Delete all symbols for a file
     *
     * @param fileId - File ID
     * @returns Number of deleted symbols
     */
    deleteByFileId(fileId: number): number;
    /**
     * Count total symbols
     *
     * @returns Total number of symbols
     */
    count(): number;
    /**
     * Count symbols by kind
     *
     * @returns Object with counts per kind
     */
    countByKind(): Record<string, number>;
    /**
     * Get symbols with file information (JOIN query)
     *
     * @param name - Symbol name
     * @param filters - Optional query filters for language, kind, and file patterns
     * @returns Symbols with file path and language
     */
    findWithFile(name: string, filters?: QueryFilters): Array<SymbolRecord & {
        file_path: string;
        language: string | null;
    }>;
    /**
     * Clear all symbols (for testing)
     *
     * @returns Number of deleted symbols
     */
    clear(): number;
}
//# sourceMappingURL=SymbolDAO.d.ts.map