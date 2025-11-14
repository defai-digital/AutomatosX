/**
 * LuaParserService.ts
 *
 * Lua language parser using Tree-sitter
 * Extracts symbols from Lua source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * LuaParserService - Extracts symbols from Lua code
 */
export declare class LuaParserService extends BaseLanguageParser {
    readonly language = "lua";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function declaration
     */
    private extractFunction;
    /**
     * Extract variable declaration
     */
    private extractVariable;
}
//# sourceMappingURL=LuaParserService.d.ts.map