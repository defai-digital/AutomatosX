/**
 * Document Manager
 *
 * Manages open text documents in the LSP server.
 * Handles document lifecycle: open, change, close, save.
 * Maintains document cache and parsed AST.
 */
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { Tree } from 'web-tree-sitter';
import type { SymbolInfo } from '../types/lsp-types.js';
/**
 * Document data with parsed content
 */
export interface DocumentData {
    document: TextDocument;
    tree?: Tree;
    symbols: SymbolInfo[];
    version: number;
    lastModified: number;
}
/**
 * Document change event
 */
export interface DocumentChangeEvent {
    uri: string;
    version: number;
    text: string;
}
/**
 * Document Manager
 * Tracks open documents and their parsed state
 */
export declare class DocumentManager {
    private documents;
    private parserRegistry;
    constructor();
    /**
     * Handle document open event
     */
    onDocumentOpened(uri: string, languageId: string, version: number, text: string): Promise<void>;
    /**
     * Handle document change event
     */
    onDocumentChanged(uri: string, version: number, text: string): Promise<void>;
    /**
     * Handle document close event
     */
    onDocumentClosed(uri: string): void;
    /**
     * Handle document save event
     */
    onDocumentSaved(uri: string, text?: string): Promise<void>;
    /**
     * Get document by URI
     */
    getDocument(uri: string): TextDocument | undefined;
    /**
     * Get document data by URI
     */
    getDocumentData(uri: string): DocumentData | undefined;
    /**
     * Get document content
     */
    getDocumentText(uri: string): string | undefined;
    /**
     * Get parsed tree for document
     */
    getDocumentTree(uri: string): Tree | undefined;
    /**
     * Get symbols for document
     */
    getDocumentSymbols(uri: string): SymbolInfo[];
    /**
     * Check if document is open
     */
    hasDocument(uri: string): boolean;
    /**
     * Get all open document URIs
     */
    getAllDocumentUris(): string[];
    /**
     * Get document count
     */
    getDocumentCount(): number;
    /**
     * Parse document and extract symbols
     */
    private parseDocument;
    /**
     * Clear all documents
     */
    clear(): void;
    /**
     * Get statistics
     */
    getStats(): {
        documentCount: number;
        parsedCount: number;
        totalSymbols: number;
    };
}
//# sourceMappingURL=DocumentManager.d.ts.map