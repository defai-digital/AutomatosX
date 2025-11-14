/**
 * Completion Provider
 *
 * Implements textDocument/completion LSP request.
 * Provides context-aware code completions.
 */
import type { CompletionItem, Position } from '../types/lsp-types.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
/**
 * Completion context
 */
export interface CompletionContext {
    triggerKind: number;
    triggerCharacter?: string;
}
/**
 * Completion Provider
 */
export declare class CompletionProvider {
    private documentManager;
    private integrationService;
    constructor(documentManager: DocumentManager, integrationService: IntegrationService);
    /**
     * Handle textDocument/completion request
     *
     * @param uri - Document URI
     * @param position - Cursor position
     * @param context - Completion context (trigger info)
     * @returns Array of completion items or null
     */
    provideCompletions(uri: string, position: Position, context?: CompletionContext): Promise<CompletionItem[] | null>;
    /**
     * Get completion prefix (partial word being typed)
     */
    private getCompletionPrefix;
    /**
     * Determine type of completion needed
     */
    private determineCompletionType;
    /**
     * Get symbol completions from workspace
     */
    private getSymbolCompletions;
    /**
     * Get import completions
     */
    private getImportCompletions;
    /**
     * Get member completions (after dot operator)
     */
    private getMemberCompletions;
    /**
     * Get keyword completions
     */
    private getKeywordCompletions;
    /**
     * Convert symbol to completion item
     */
    private symbolToCompletionItem;
    /**
     * Sort completions by relevance
     */
    private sortCompletions;
    /**
     * Get URI from file path
     */
    private getUriFromFilePath;
    /**
     * Provide signature help (parameter hints)
     */
    provideSignatureHelp(uri: string, position: Position): Promise<{
        signatures: string[];
        activeParameter: number;
    } | null>;
}
//# sourceMappingURL=CompletionProvider.d.ts.map