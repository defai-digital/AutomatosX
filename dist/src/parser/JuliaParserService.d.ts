/**
 * JuliaParserService.ts
 *
 * Julia language parser using Tree-sitter
 * Extracts symbols from Julia scientific computing code
 *
 * Julia is a high-performance language for scientific computing,
 * machine learning, and data science.
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * JuliaParserService - Extracts symbols from Julia code
 */
export declare class JuliaParserService extends BaseLanguageParser {
    readonly language = "julia";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function definition
     */
    private extractFunction;
    /**
     * Extract function name from signature
     */
    private extractFunctionName;
    /**
     * Extract macro definition
     */
    private extractMacro;
    /**
     * Extract struct definition
     */
    private extractStruct;
    /**
     * Extract abstract type definition
     */
    private extractAbstract;
    /**
     * Extract module definition
     */
    private extractModule;
    /**
     * Extract assignment (global variables)
     */
    private extractAssignment;
    /**
     * Extract const declaration
     */
    private extractConst;
}
//# sourceMappingURL=JuliaParserService.d.ts.map