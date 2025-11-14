/**
 * ElmParserService.ts
 *
 * Elm language parser using Tree-sitter
 * Extracts symbols from Elm source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * ElmParserService - Extracts symbols from Elm code
 */
export declare class ElmParserService extends BaseLanguageParser {
    readonly language = "elm";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract value declaration (function or constant)
     */
    private extractValue;
    /**
     * Extract type alias declaration
     */
    private extractTypeAlias;
    /**
     * Extract type declaration
     */
    private extractType;
    /**
     * Extract port annotation
     */
    private extractPort;
}
//# sourceMappingURL=ElmParserService.d.ts.map