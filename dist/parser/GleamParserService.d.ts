/**
 * GleamParserService.ts
 *
 * Gleam language parser using Tree-sitter
 * Extracts symbols from Gleam functional programming code (BEAM VM)
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * GleamParserService - Extracts symbols from Gleam code
 */
export declare class GleamParserService extends BaseLanguageParser {
    readonly language = "gleam";
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
     * Extract type alias
     */
    private extractTypeAlias;
    /**
     * Extract custom type (algebraic data type)
     */
    private extractCustomType;
    /**
     * Extract external function (FFI)
     */
    private extractExternalFunction;
    /**
     * Extract import statement
     */
    private extractImport;
    /**
     * Extract constant declaration
     */
    private extractConstant;
}
//# sourceMappingURL=GleamParserService.d.ts.map