/**
 * References Provider
 *
 * Implements textDocument/references LSP request.
 * Finds all references to a symbol across the workspace.
 */
import type { Location, Position } from '../types/lsp-types.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
/**
 * Reference context
 */
export interface ReferenceContext {
    includeDeclaration: boolean;
}
/**
 * References Provider
 */
export declare class ReferencesProvider {
    private documentManager;
    private integrationService;
    constructor(documentManager: DocumentManager, integrationService: IntegrationService);
    /**
     * Handle textDocument/references request
     *
     * @param uri - Document URI
     * @param position - Cursor position
     * @param context - Reference context (include declaration?)
     * @returns Array of reference locations or null
     */
    provideReferences(uri: string, position: Position, context: ReferenceContext): Promise<Location[] | null>;
    /**
     * Get symbol name at position
     */
    private getSymbolAtPosition;
    /**
     * Find all references to symbol
     */
    private findAllReferences;
    /**
     * Find references in open documents
     */
    private findReferencesInOpenDocuments;
    /**
     * Find references in document text (simple text search)
     */
    private findTextReferences;
    /**
     * Check if symbol is a declaration
     */
    private isDeclaration;
    /**
     * Convert SymbolInfo to Location
     */
    private symbolToLocation;
    /**
     * Deduplicate locations by URI and position
     */
    private deduplicateLocations;
    /**
     * Escape regex special characters
     */
    private escapeRegex;
    /**
     * Count references to a symbol
     */
    countReferences(uri: string, position: Position): Promise<number>;
    /**
     * Group references by file
     */
    groupReferencesByFile(uri: string, position: Position, context: ReferenceContext): Promise<Map<string, Location[]>>;
}
//# sourceMappingURL=ReferencesProvider.d.ts.map