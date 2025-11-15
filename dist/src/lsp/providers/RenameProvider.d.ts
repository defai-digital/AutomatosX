/**
 * Rename Provider
 *
 * Provides rename refactoring functionality.
 * Finds all references to a symbol and creates a WorkspaceEdit.
 * Supports cross-file renames with validation.
 */
import type { WorkspaceEdit as LSPWorkspaceEdit } from 'vscode-languageserver/node.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
import type { Position, Range } from '../types/lsp-types.js';
/**
 * Rename Provider
 * Handles symbol renaming across workspace
 */
export declare class RenameProvider {
    private documentManager;
    private integrationService;
    constructor(documentManager: DocumentManager, integrationService: IntegrationService);
    /**
     * Provide rename edits for a symbol
     */
    provideRename(uri: string, position: Position, newName: string): Promise<LSPWorkspaceEdit | null>;
    /**
     * Prepare rename (validate that rename is possible at position)
     */
    prepareRename(uri: string, position: Position): Promise<{
        range: Range;
        placeholder: string;
    } | null>;
    /**
     * Validate new name for symbol
     */
    private validateNewName;
    /**
     * Check if string is a valid identifier
     */
    private isValidIdentifier;
    /**
     * Check if string is a reserved keyword
     */
    private isReservedKeyword;
}
//# sourceMappingURL=RenameProvider.d.ts.map