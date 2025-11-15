/**
 * Formatting Provider
 *
 * Provides document formatting using Prettier (for TS/JS) and other formatters.
 * Returns TextEdit[] to format entire document.
 * Supports format-on-save integration.
 */
import { uriToFilePath } from '../utils/lsp-utils.js';
const DEFAULT_FORMATTING_OPTIONS = {
    tabSize: 2,
    insertSpaces: true,
    trimTrailingWhitespace: true,
    insertFinalNewline: true,
    trimFinalNewlines: true,
};
/**
 * Formatting Provider
 * Formats documents using language-specific formatters
 */
export class FormattingProvider {
    documentManager;
    prettierAvailable = false;
    constructor(documentManager) {
        this.documentManager = documentManager;
        this.checkPrettierAvailability();
    }
    /**
     * Check if Prettier is available
     */
    async checkPrettierAvailability() {
        try {
            await import('prettier');
            this.prettierAvailable = true;
        }
        catch {
            this.prettierAvailable = false;
            console.warn('Prettier not available. Install with: npm install prettier');
        }
    }
    /**
     * Provide formatting for entire document
     */
    async provideFormatting(uri, options = DEFAULT_FORMATTING_OPTIONS) {
        try {
            const content = this.documentManager.getDocumentText(uri);
            if (!content) {
                return [];
            }
            const filePath = uriToFilePath(uri);
            // Format based on file type
            let formattedContent;
            if (this.isTypeScriptOrJavaScript(filePath)) {
                formattedContent = await this.formatWithPrettier(content, filePath, options);
            }
            else if (this.isPython(filePath)) {
                formattedContent = await this.formatPython(content, options);
            }
            else {
                // Fallback to basic formatting
                formattedContent = this.formatBasic(content, options);
            }
            // If no changes, return empty array
            if (formattedContent === content) {
                return [];
            }
            // Return single edit replacing entire document
            const lines = content.split('\n');
            const lastLine = lines.length - 1;
            const lastChar = lines[lastLine].length;
            return [
                {
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: lastLine, character: lastChar },
                    },
                    newText: formattedContent,
                },
            ];
        }
        catch (error) {
            console.error(`Error formatting document ${uri}:`, error);
            return [];
        }
    }
    /**
     * Format with Prettier (TypeScript/JavaScript)
     */
    async formatWithPrettier(content, filePath, options) {
        if (!this.prettierAvailable) {
            return this.formatBasic(content, options);
        }
        try {
            const prettier = await import('prettier');
            const formatted = await prettier.format(content, {
                filepath: filePath,
                tabWidth: options.tabSize,
                useTabs: !options.insertSpaces,
                semi: true,
                singleQuote: true,
                trailingComma: 'es5',
                arrowParens: 'always',
                printWidth: 100,
            });
            return this.applyBasicFormatting(formatted, options);
        }
        catch (error) {
            console.error('Prettier formatting error:', error);
            return this.formatBasic(content, options);
        }
    }
    /**
     * Format Python code
     * Note: Requires Black to be installed. Falls back to basic formatting.
     */
    async formatPython(content, options) {
        // For now, use basic formatting
        // In a real implementation, we would call Black via subprocess
        return this.formatBasic(content, options);
    }
    /**
     * Basic formatting (fallback)
     */
    formatBasic(content, options) {
        let formatted = content;
        // Normalize line endings
        formatted = formatted.replace(/\r\n/g, '\n');
        // Apply basic formatting options
        formatted = this.applyBasicFormatting(formatted, options);
        return formatted;
    }
    /**
     * Apply basic formatting options
     */
    applyBasicFormatting(content, options) {
        let formatted = content;
        // Trim trailing whitespace
        if (options.trimTrailingWhitespace) {
            formatted = formatted
                .split('\n')
                .map((line) => line.trimEnd())
                .join('\n');
        }
        // Insert final newline
        if (options.insertFinalNewline && !formatted.endsWith('\n')) {
            formatted += '\n';
        }
        // Trim final newlines (keep only one)
        if (options.trimFinalNewlines) {
            formatted = formatted.replace(/\n+$/, '\n');
        }
        // Convert tabs to spaces (or vice versa)
        if (options.insertSpaces) {
            const spaces = ' '.repeat(options.tabSize);
            formatted = formatted.replace(/\t/g, spaces);
        }
        else {
            const spaces = ' '.repeat(options.tabSize);
            const regex = new RegExp(spaces, 'g');
            formatted = formatted.replace(regex, '\t');
        }
        return formatted;
    }
    /**
     * Provide range formatting
     */
    async provideRangeFormatting(uri, range, options = DEFAULT_FORMATTING_OPTIONS) {
        try {
            const content = this.documentManager.getDocumentText(uri);
            if (!content) {
                return [];
            }
            // Extract range content
            const lines = content.split('\n');
            const rangeLines = lines.slice(range.start.line, range.end.line + 1);
            const rangeContent = rangeLines.join('\n');
            // Format range content
            const filePath = uriToFilePath(uri);
            let formattedContent;
            if (this.isTypeScriptOrJavaScript(filePath)) {
                formattedContent = await this.formatWithPrettier(rangeContent, filePath, options);
            }
            else {
                formattedContent = this.formatBasic(rangeContent, options);
            }
            // If no changes, return empty array
            if (formattedContent === rangeContent) {
                return [];
            }
            return [
                {
                    range,
                    newText: formattedContent,
                },
            ];
        }
        catch (error) {
            console.error(`Error formatting range in ${uri}:`, error);
            return [];
        }
    }
    /**
     * Check if file is TypeScript or JavaScript
     */
    isTypeScriptOrJavaScript(filePath) {
        return /\.(ts|tsx|js|jsx|mjs)$/.test(filePath);
    }
    /**
     * Check if file is Python
     */
    isPython(filePath) {
        return /\.py$/.test(filePath);
    }
    /**
     * Get Prettier availability
     */
    isPrettierAvailable() {
        return this.prettierAvailable;
    }
}
//# sourceMappingURL=FormattingProvider.js.map