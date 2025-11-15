/**
 * Formatting Provider
 *
 * Provides document formatting using Prettier (for TS/JS) and other formatters.
 * Returns TextEdit[] to format entire document.
 * Supports format-on-save integration.
 */
import type { TextEdit as LSPTextEdit } from 'vscode-languageserver/node.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { Range } from '../types/lsp-types.js';
/**
 * Formatting options
 */
export interface FormattingOptions {
    tabSize: number;
    insertSpaces: boolean;
    trimTrailingWhitespace?: boolean;
    insertFinalNewline?: boolean;
    trimFinalNewlines?: boolean;
}
/**
 * Formatting Provider
 * Formats documents using language-specific formatters
 */
export declare class FormattingProvider {
    private documentManager;
    private prettierAvailable;
    constructor(documentManager: DocumentManager);
    /**
     * Check if Prettier is available
     */
    private checkPrettierAvailability;
    /**
     * Provide formatting for entire document
     */
    provideFormatting(uri: string, options?: FormattingOptions): Promise<LSPTextEdit[]>;
    /**
     * Format with Prettier (TypeScript/JavaScript)
     */
    private formatWithPrettier;
    /**
     * Format Python code
     * Note: Requires Black to be installed. Falls back to basic formatting.
     */
    private formatPython;
    /**
     * Basic formatting (fallback)
     */
    private formatBasic;
    /**
     * Apply basic formatting options
     */
    private applyBasicFormatting;
    /**
     * Provide range formatting
     */
    provideRangeFormatting(uri: string, range: Range, options?: FormattingOptions): Promise<LSPTextEdit[]>;
    /**
     * Check if file is TypeScript or JavaScript
     */
    private isTypeScriptOrJavaScript;
    /**
     * Check if file is Python
     */
    private isPython;
    /**
     * Get Prettier availability
     */
    isPrettierAvailable(): boolean;
}
//# sourceMappingURL=FormattingProvider.d.ts.map