/**
 * Workspace Symbols Provider
 *
 * Provides workspace-wide symbol search.
 * Uses SymbolDAO for database queries with fuzzy matching.
 * Returns SymbolInformation[] sorted by relevance.
 */
import type { SymbolInformation as LSPSymbolInformation } from 'vscode-languageserver/node.js';
import type { IntegrationService } from '../server/IntegrationService.js';
/**
 * Workspace Symbols Provider
 * Searches symbols across entire workspace
 */
export declare class WorkspaceSymbolsProvider {
    private integrationService;
    private readonly MAX_RESULTS;
    constructor(integrationService: IntegrationService);
    /**
     * Provide workspace symbols matching query
     */
    provideWorkspaceSymbols(query: string): Promise<LSPSymbolInformation[]>;
    /**
     * Filter and rank symbols by query
     */
    private filterAndRankSymbols;
    /**
     * Calculate match score for fuzzy matching
     */
    private calculateMatchScore;
    /**
     * Fuzzy match scoring
     * Returns score based on how well query matches name
     */
    private fuzzyMatch;
    /**
     * Convert SymbolInfo to LSP SymbolInformation
     */
    private convertToSymbolInformation;
    /**
     * Get container name for symbol
     */
    private getContainerName;
    /**
     * Search symbols by kind
     */
    searchSymbolsByKind(kind: string): Promise<LSPSymbolInformation[]>;
    /**
     * Get all symbols in a file
     */
    getFileSymbols(filePath: string): Promise<LSPSymbolInformation[]>;
}
//# sourceMappingURL=WorkspaceSymbolsProvider.d.ts.map