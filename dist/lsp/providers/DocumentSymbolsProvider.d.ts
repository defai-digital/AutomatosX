/**
 * Document Symbols Provider
 *
 * Provides document symbols for outline view and navigation.
 * Extracts all symbols from a document using Tree-sitter AST.
 * Returns hierarchical DocumentSymbol[] with nested children.
 */
import type { DocumentSymbol as LSPDocumentSymbol } from 'vscode-languageserver/node.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
/**
 * Document Symbols Provider
 * Extracts and organizes symbols for outline view
 */
export declare class DocumentSymbolsProvider {
    private documentManager;
    private integrationService;
    constructor(documentManager: DocumentManager, integrationService: IntegrationService);
    /**
     * Provide document symbols for a URI
     */
    provideDocumentSymbols(uri: string): Promise<LSPDocumentSymbol[] | null>;
    /**
     * Extract symbols from AST node recursively
     */
    private extractSymbols;
    /**
     * Extract symbol from a single AST node
     */
    private extractSymbol;
    /**
     * Get symbol information from node
     */
    private getSymbolInfo;
    /**
     * Get function signature for detail
     */
    private getFunctionSignature;
    /**
     * Get Python function signature
     */
    private getPythonFunctionSignature;
    /**
     * Get class detail (extends, implements)
     */
    private getClassDetail;
    /**
     * Get range for symbol name
     */
    private getNameRange;
    /**
     * Check if node represents a symbol
     */
    private isSymbolNode;
}
//# sourceMappingURL=DocumentSymbolsProvider.d.ts.map