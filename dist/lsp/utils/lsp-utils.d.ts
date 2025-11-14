/**
 * LSP Utilities
 *
 * Helper functions for LSP operations:
 * - URI/file path conversion
 * - Position calculations
 * - Range extraction from AST nodes
 */
import type { Position, Range } from '../types/lsp-types.js';
import type { SyntaxNode } from 'web-tree-sitter';
/**
 * Convert file path to URI
 */
export declare function filePathToUri(filePath: string): string;
/**
 * Convert URI to file path
 */
export declare function uriToFilePath(uri: string): string;
/**
 * Normalize file path (resolve relative paths, normalize separators)
 */
export declare function normalizeFilePath(filePath: string): string;
/**
 * Convert byte offset to position (line, character)
 *
 * @param content - Document content
 * @param offset - Byte offset in document
 * @returns Position with line and character
 */
export declare function offsetToPosition(content: string, offset: number): Position;
/**
 * Convert position (line, character) to byte offset
 *
 * @param content - Document content
 * @param position - Position with line and character
 * @returns Byte offset in document
 */
export declare function positionToOffset(content: string, position: Position): number;
/**
 * Extract position from Tree-sitter node
 */
export declare function nodeToPosition(node: SyntaxNode, isEnd?: boolean): Position;
/**
 * Extract range from Tree-sitter node
 */
export declare function nodeToRange(node: SyntaxNode): Range;
/**
 * Get word at position in document
 *
 * @param content - Document content
 * @param position - Position to get word at
 * @returns Word at position or empty string
 */
export declare function getWordAtPosition(content: string, position: Position): string;
/**
 * Get line content at position
 */
export declare function getLineAtPosition(content: string, position: Position): string;
/**
 * Get range for word at position
 */
export declare function getWordRangeAtPosition(content: string, position: Position): Range | null;
/**
 * Find node at position in Tree-sitter tree
 */
export declare function findNodeAtPosition(rootNode: SyntaxNode, position: Position): SyntaxNode | null;
/**
 * Get identifier node at position
 * Traverses up the tree to find the identifier or named node
 */
export declare function getIdentifierAtPosition(rootNode: SyntaxNode, position: Position): SyntaxNode | null;
/**
 * Check if node is an identifier
 */
export declare function isIdentifierNode(node: SyntaxNode): boolean;
/**
 * Get function/method signature from node
 */
export declare function getNodeSignature(node: SyntaxNode): string | null;
/**
 * Extract docstring/comment above node
 */
export declare function getNodeDocstring(node: SyntaxNode, content: string): string | null;
/**
 * Format symbol signature for hover
 */
export declare function formatSignature(symbolInfo: {
    kind: string;
    name: string;
    signature?: string;
}): string;
/**
 * Create markdown hover content
 */
export declare function createHoverMarkdown(parts: {
    signature?: string;
    docstring?: string;
    location?: string;
}): string;
/**
 * Check if file is supported language
 */
export declare function isSupportedLanguage(filePath: string): boolean;
/**
 * Get language ID from file path
 */
export declare function getLanguageId(filePath: string): string;
/**
 * Check if a range contains a position
 */
export declare function rangeContainsPosition(range: Range, position: Position): boolean;
/**
 * Check if two ranges overlap
 */
export declare function rangesOverlap(range1: Range, range2: Range): boolean;
/**
 * Compare two positions
 * Returns: -1 if pos1 < pos2, 0 if equal, 1 if pos1 > pos2
 */
export declare function comparePositions(pos1: Position, pos2: Position): number;
/**
 * Map Tree-sitter symbol kind to LSP SymbolKind
 */
export declare function mapSymbolKind(kind: string): number;
/**
 * Map symbol kind to LSP CompletionItemKind
 */
export declare function mapCompletionItemKind(kind: string): number;
//# sourceMappingURL=lsp-utils.d.ts.map