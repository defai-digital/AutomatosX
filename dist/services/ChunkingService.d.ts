/**
 * ChunkingService.ts
 *
 * Service for splitting code files into searchable chunks
 * Strategy: Symbol-based chunking (functions, classes, methods)
 */
import { Symbol } from '../parser/LanguageParser.js';
/**
 * Code chunk with metadata
 */
export interface CodeChunk {
    content: string;
    start_line: number;
    end_line: number;
    chunk_type: string;
    symbol_id?: number;
}
/**
 * Chunking result
 */
export interface ChunkingResult {
    chunks: CodeChunk[];
    chunkCount: number;
    totalLines: number;
}
/**
 * ChunkingService - Splits code into searchable chunks
 */
export declare class ChunkingService {
    /**
     * Split file content into chunks based on symbols
     *
     * @param content - File content
     * @param symbols - Parsed symbols from ParserService
     * @returns Chunking result with chunks array
     */
    chunkFile(content: string, symbols: Symbol[]): ChunkingResult;
    /**
     * Map symbol kind to chunk type
     *
     * @param kind - Symbol kind
     * @returns Chunk type
     */
    private mapSymbolKindToChunkType;
    /**
     * Create a single file-level chunk (fallback for unparseable files)
     *
     * @param content - File content
     * @returns Single chunk spanning entire file
     */
    createFileChunk(content: string): CodeChunk;
    /**
     * Create chunks with sliding window strategy
     * Useful for files with many small declarations or no clear structure
     *
     * @param content - File content
     * @param windowSize - Number of lines per chunk (default: 50)
     * @param overlap - Number of overlapping lines between chunks (default: 10)
     * @returns Array of chunks
     */
    chunkByWindow(content: string, windowSize?: number, overlap?: number): CodeChunk[];
    /**
     * Enhance chunks with additional context
     * Adds imports, type definitions, and related code
     *
     * @param content - File content
     * @param chunks - Existing chunks
     * @returns Enhanced chunks with added context
     */
    enhanceChunksWithContext(content: string, chunks: CodeChunk[]): CodeChunk[];
    /**
     * Get chunking statistics
     *
     * @param chunks - Array of chunks
     * @returns Statistics about chunks
     */
    getChunkStats(chunks: CodeChunk[]): {
        totalChunks: number;
        avgChunkSize: number;
        chunksByType: Record<string, number>;
        totalCharacters: number;
    };
}
//# sourceMappingURL=ChunkingService.d.ts.map