/**
 * MarkdownParserService.ts
 *
 * Markdown language parser using Tree-sitter
 * Extracts headings and structure from Markdown files
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * MarkdownParserService - Extracts structure from Markdown files
 */
export declare class MarkdownParserService extends BaseLanguageParser {
    readonly language = "markdown";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     * For Markdown, we extract headings as sections
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract heading as a symbol
     */
    private extractHeading;
}
//# sourceMappingURL=MarkdownParserService.d.ts.map