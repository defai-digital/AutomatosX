/**
 * Code Actions Provider
 *
 * Provides code actions (quick fixes) for diagnostics.
 * Suggests refactorings and fixes for quality issues.
 * Supports "organize imports" and "extract function" actions.
 */
import type { CodeAction as LSPCodeAction, Diagnostic as LSPDiagnostic, TextEdit as LSPTextEdit } from 'vscode-languageserver/node.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
import type { Range } from '../types/lsp-types.js';
/**
 * Code action kind
 */
export declare enum CodeActionKind {
    QuickFix = "quickfix",
    Refactor = "refactor",
    RefactorExtract = "refactor.extract",
    RefactorInline = "refactor.inline",
    RefactorRewrite = "refactor.rewrite",
    Source = "source",
    SourceOrganizeImports = "source.organizeImports",
    SourceFixAll = "source.fixAll"
}
/**
 * Code Actions Provider
 * Provides quick fixes and refactoring actions
 */
export declare class CodeActionsProvider {
    private documentManager;
    private integrationService;
    constructor(documentManager: DocumentManager, integrationService: IntegrationService);
    /**
     * Provide code actions for a range
     */
    provideCodeActions(uri: string, range: Range, diagnostics: LSPDiagnostic[]): Promise<LSPCodeAction[]>;
    /**
     * Get quick fixes for a diagnostic
     */
    private getQuickFixesForDiagnostic;
    /**
     * Get refactoring actions for a range
     */
    private getRefactoringActions;
    /**
     * Get source actions
     */
    private getSourceActions;
    /**
     * Create text edit to remove lines
     */
    private createRemoveLinesEdit;
    /**
     * Create text edit to replace text
     */
    private createReplaceEdit;
    /**
     * Organize imports in document
     */
    organizeImports(uri: string): Promise<LSPTextEdit[]>;
    /**
     * Extract function from selected code
     */
    extractFunction(uri: string, range: Range): Promise<LSPTextEdit[]>;
}
//# sourceMappingURL=CodeActionsProvider.d.ts.map