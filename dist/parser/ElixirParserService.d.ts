/**
 * ElixirParserService.ts
 *
 * Elixir language parser using Tree-sitter
 * Extracts symbols from Elixir functional programming code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * ElixirParserService - Extracts symbols from Elixir code
 */
export declare class ElixirParserService extends BaseLanguageParser {
    readonly language = "elixir";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract module, function, or macro definition from call nodes
     */
    private extractCall;
    /**
     * Extract module definition
     */
    private extractModule;
}
//# sourceMappingURL=ElixirParserService.d.ts.map