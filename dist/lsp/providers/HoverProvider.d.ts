/**
 * Hover Provider
 *
 * Implements textDocument/hover LSP request.
 * Provides hover information (signature, docs, type) for symbols.
 */
import type { Hover, Position } from '../types/lsp-types.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
/**
 * Hover Provider
 */
export declare class HoverProvider {
    private documentManager;
    private integrationService;
    constructor(documentManager: DocumentManager, integrationService: IntegrationService);
    /**
     * Handle textDocument/hover request
     *
     * @param uri - Document URI
     * @param position - Cursor position
     * @returns Hover information or null
     */
    provideHover(uri: string, position: Position): Promise<Hover | null>;
    /**
     * Get symbol name at position
     */
    private getSymbolAtPosition;
    /**
     * Get hover information from AST
     */
    private getHoverFromAST;
    /**
     * Get hover information from database
     */
    private getHoverFromDatabase;
    /**
     * Create hover from symbol info
     */
    private createHoverFromSymbol;
    /**
     * Provide hover for built-in symbols (keywords, standard library)
     */
    provideBuiltInHover(symbolName: string): Hover | null;
    /**
     * Get documentation for built-in symbols
     */
    private getBuiltInDocs;
    /**
     * Provide hover with type information
     */
    provideHoverWithType(uri: string, position: Position): Promise<Hover | null>;
}
//# sourceMappingURL=HoverProvider.d.ts.map