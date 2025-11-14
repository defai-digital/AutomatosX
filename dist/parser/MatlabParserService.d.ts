/**
 * MatlabParserService.ts
 *
 * MATLAB language parser using Tree-sitter
 * Extracts symbols from MATLAB technical computing code
 *
 * MATLAB is used for numerical computing, algorithm development,
 * data analysis, and visualization.
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * MatlabParserService - Extracts symbols from MATLAB code
 */
export declare class MatlabParserService extends BaseLanguageParser {
    readonly language = "matlab";
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
     * Extract class definition
     */
    private extractClass;
    /**
     * Extract property from properties block
     */
    private extractProperty;
    /**
     * Extract method from methods block
     */
    private extractMethod;
    /**
     * Extract assignment (global variables/constants)
     */
    private extractAssignment;
}
//# sourceMappingURL=MatlabParserService.d.ts.map