/**
 * RParserService.ts
 *
 * R language parser using Tree-sitter
 * Extracts symbols from R source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * RParserService - Extracts symbols from R code
 */
export declare class RParserService extends BaseLanguageParser {
    readonly language = "r";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract assignment (variable/function assignment)
     */
    private extractAssignment;
    /**
     * Extract function definition
     */
    private extractFunction;
}
//# sourceMappingURL=RParserService.d.ts.map