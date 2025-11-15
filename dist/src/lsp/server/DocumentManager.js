/**
 * Document Manager
 *
 * Manages open text documents in the LSP server.
 * Handles document lifecycle: open, change, close, save.
 * Maintains document cache and parsed AST.
 */
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getParserRegistry } from '../../parser/ParserRegistry.js';
import { getLanguageId, uriToFilePath } from '../utils/lsp-utils.js';
/**
 * Document Manager
 * Tracks open documents and their parsed state
 */
export class DocumentManager {
    documents = new Map();
    parserRegistry;
    constructor() {
        this.parserRegistry = getParserRegistry();
    }
    /**
     * Handle document open event
     */
    async onDocumentOpened(uri, languageId, version, text) {
        const document = TextDocument.create(uri, languageId, version, text);
        const data = {
            document,
            symbols: [],
            version,
            lastModified: Date.now(),
        };
        this.documents.set(uri, data);
        // Parse document asynchronously
        await this.parseDocument(uri, text);
    }
    /**
     * Handle document change event
     */
    async onDocumentChanged(uri, version, text) {
        const data = this.documents.get(uri);
        if (!data) {
            console.warn(`Document not found for change: ${uri}`);
            return;
        }
        // Update document
        const document = TextDocument.create(uri, data.document.languageId, version, text);
        data.document = document;
        data.version = version;
        data.lastModified = Date.now();
        // Re-parse document
        await this.parseDocument(uri, text);
    }
    /**
     * Handle document close event
     */
    onDocumentClosed(uri) {
        this.documents.delete(uri);
    }
    /**
     * Handle document save event
     */
    async onDocumentSaved(uri, text) {
        const data = this.documents.get(uri);
        if (!data) {
            console.warn(`Document not found for save: ${uri}`);
            return;
        }
        data.lastModified = Date.now();
        // Re-parse if text provided
        if (text) {
            await this.parseDocument(uri, text);
        }
    }
    /**
     * Get document by URI
     */
    getDocument(uri) {
        return this.documents.get(uri)?.document;
    }
    /**
     * Get document data by URI
     */
    getDocumentData(uri) {
        return this.documents.get(uri);
    }
    /**
     * Get document content
     */
    getDocumentText(uri) {
        return this.documents.get(uri)?.document.getText();
    }
    /**
     * Get parsed tree for document
     */
    getDocumentTree(uri) {
        return this.documents.get(uri)?.tree;
    }
    /**
     * Get symbols for document
     */
    getDocumentSymbols(uri) {
        return this.documents.get(uri)?.symbols ?? [];
    }
    /**
     * Check if document is open
     */
    hasDocument(uri) {
        return this.documents.has(uri);
    }
    /**
     * Get all open document URIs
     */
    getAllDocumentUris() {
        return Array.from(this.documents.keys());
    }
    /**
     * Get document count
     */
    getDocumentCount() {
        return this.documents.size;
    }
    /**
     * Parse document and extract symbols
     */
    async parseDocument(uri, text) {
        const data = this.documents.get(uri);
        if (!data) {
            return;
        }
        try {
            const filePath = uriToFilePath(uri);
            const languageId = getLanguageId(filePath);
            // Get parser for language
            const parser = this.parserRegistry.getParser(languageId);
            if (!parser) {
                console.warn(`No parser available for language: ${languageId}`);
                return;
            }
            // Parse file
            const parseResult = await parser.parse(filePath, text);
            // Store tree and symbols
            data.tree = parseResult.tree;
            data.symbols = parseResult.symbols.map((symbol) => ({
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
            }));
        }
        catch (error) {
            console.error(`Error parsing document ${uri}:`, error);
            data.tree = undefined;
            data.symbols = [];
        }
    }
    /**
     * Clear all documents
     */
    clear() {
        this.documents.clear();
    }
    /**
     * Get statistics
     */
    getStats() {
        let parsedCount = 0;
        let totalSymbols = 0;
        for (const data of this.documents.values()) {
            if (data.tree) {
                parsedCount++;
            }
            totalSymbols += data.symbols.length;
        }
        return {
            documentCount: this.documents.size,
            parsedCount,
            totalSymbols,
        };
    }
}
//# sourceMappingURL=DocumentManager.js.map