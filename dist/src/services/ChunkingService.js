/**
 * ChunkingService.ts
 *
 * Service for splitting code files into searchable chunks
 * Strategy: Symbol-based chunking (functions, classes, methods)
 */
/**
 * ChunkingService - Splits code into searchable chunks
 */
export class ChunkingService {
    /**
     * Split file content into chunks based on symbols
     *
     * @param content - File content
     * @param symbols - Parsed symbols from ParserService
     * @returns Chunking result with chunks array
     */
    chunkFile(content, symbols) {
        const lines = content.split('\n');
        const chunks = [];
        // Sort symbols by line number
        const sortedSymbols = [...symbols].sort((a, b) => a.line - b.line);
        // Create chunks for each symbol
        for (const symbol of sortedSymbols) {
            // Skip symbols without end positions
            if (!symbol.endLine)
                continue;
            const startLine = symbol.line;
            const endLine = symbol.endLine;
            // Extract chunk content (include context: 1 line before and after if available)
            const contextStartLine = Math.max(1, startLine - 1);
            const contextEndLine = Math.min(lines.length, endLine + 1);
            const chunkLines = lines.slice(contextStartLine - 1, contextEndLine);
            const chunkContent = chunkLines.join('\n').trim();
            if (chunkContent.length === 0)
                continue;
            // Determine chunk type based on symbol kind
            const chunkType = this.mapSymbolKindToChunkType(symbol.kind);
            chunks.push({
                content: chunkContent,
                start_line: startLine,
                end_line: endLine,
                chunk_type: chunkType,
            });
        }
        // If no symbol-based chunks were created, create a file-level chunk
        if (chunks.length === 0) {
            chunks.push({
                content: content.trim(),
                start_line: 1,
                end_line: lines.length,
                chunk_type: 'file',
            });
        }
        return {
            chunks,
            chunkCount: chunks.length,
            totalLines: lines.length,
        };
    }
    /**
     * Map symbol kind to chunk type
     *
     * @param kind - Symbol kind
     * @returns Chunk type
     */
    mapSymbolKindToChunkType(kind) {
        switch (kind) {
            case 'function':
                return 'function';
            case 'class':
                return 'class';
            case 'method':
                return 'method';
            case 'interface':
                return 'interface';
            case 'type':
                return 'type';
            case 'variable':
            case 'constant':
                return 'declaration';
            default:
                return 'block';
        }
    }
    /**
     * Create a single file-level chunk (fallback for unparseable files)
     *
     * @param content - File content
     * @returns Single chunk spanning entire file
     */
    createFileChunk(content) {
        const lines = content.split('\n');
        return {
            content: content.trim(),
            start_line: 1,
            end_line: lines.length,
            chunk_type: 'file',
        };
    }
    /**
     * Create chunks with sliding window strategy
     * Useful for files with many small declarations or no clear structure
     *
     * @param content - File content
     * @param windowSize - Number of lines per chunk (default: 50)
     * @param overlap - Number of overlapping lines between chunks (default: 10)
     * @returns Array of chunks
     */
    chunkByWindow(content, windowSize = 50, overlap = 10) {
        const lines = content.split('\n');
        const chunks = [];
        let currentLine = 1;
        while (currentLine <= lines.length) {
            const startLine = currentLine;
            const endLine = Math.min(currentLine + windowSize - 1, lines.length);
            const chunkLines = lines.slice(startLine - 1, endLine);
            const chunkContent = chunkLines.join('\n').trim();
            if (chunkContent.length > 0) {
                chunks.push({
                    content: chunkContent,
                    start_line: startLine,
                    end_line: endLine,
                    chunk_type: 'window',
                });
            }
            // Move window forward (with overlap)
            currentLine += windowSize - overlap;
        }
        return chunks;
    }
    /**
     * Enhance chunks with additional context
     * Adds imports, type definitions, and related code
     *
     * @param content - File content
     * @param chunks - Existing chunks
     * @returns Enhanced chunks with added context
     */
    enhanceChunksWithContext(content, chunks) {
        const lines = content.split('\n');
        // Extract imports from top of file
        const imports = [];
        for (let i = 0; i < Math.min(50, lines.length); i++) {
            const line = lines[i].trim();
            if (line.startsWith('import ') || line.startsWith('from ')) {
                imports.push(line);
            }
        }
        const importContext = imports.length > 0 ? imports.join('\n') + '\n\n' : '';
        // Add import context to each chunk
        return chunks.map((chunk) => ({
            ...chunk,
            content: importContext + chunk.content,
        }));
    }
    /**
     * Get chunking statistics
     *
     * @param chunks - Array of chunks
     * @returns Statistics about chunks
     */
    getChunkStats(chunks) {
        const chunksByType = {};
        let totalCharacters = 0;
        for (const chunk of chunks) {
            chunksByType[chunk.chunk_type] = (chunksByType[chunk.chunk_type] || 0) + 1;
            totalCharacters += chunk.content.length;
        }
        return {
            totalChunks: chunks.length,
            avgChunkSize: chunks.length > 0 ? Math.round(totalCharacters / chunks.length) : 0,
            chunksByType,
            totalCharacters,
        };
    }
}
//# sourceMappingURL=ChunkingService.js.map