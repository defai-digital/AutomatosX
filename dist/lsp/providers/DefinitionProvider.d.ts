/**
 * Definition Provider
 *
 * Implements textDocument/definition LSP request.
 * Finds symbol definitions across the workspace.
 */
import type { Location, Position } from '../types/lsp-types.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
/**
 * Definition Provider
 */
export declare class DefinitionProvider {
    private documentManager;
    private integrationService;
    constructor(documentManager: DocumentManager, integrationService: IntegrationService);
    /**
     * Handle textDocument/definition request
     *
     * @param uri - Document URI
     * @param position - Cursor position
     * @returns Location(s) of symbol definition or null
     */
    provideDefinition(uri: string, position: Position): Promise<Location | Location[] | null>;
    /**
     * Get symbol name at position
     */
    private getSymbolAtPosition;
    /**
     * Find definition in local document using AST
     */
    private findLocalDefinition;
    /**
     * Find definition in database (cross-file search)
     */
    private findDatabaseDefinition;
    /**
     * Convert SymbolInfo to Location
     */
    private symbolToLocation;
    /**
     * Provide definition for multiple positions (batch operation)
     */
    provideDefinitions(requests: Array<{
        uri: string;
        position: Position;
    }>): Promise<Array<Location | Location[] | null>>;
}
//# sourceMappingURL=DefinitionProvider.d.ts.map