/**
 * PythonParserService.ts
 *
 * Python language parser using Tree-sitter
 * Extracts symbols from Python source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * PythonParserService - Extracts symbols from Python code
 */
export declare class PythonParserService extends BaseLanguageParser {
    readonly language = "python";
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
     * Extract decorated definition (e.g., @property, @staticmethod)
     */
    private extractDecoratedDefinition;
    /**
     * Check if a node is inside a class definition
     */
    private isInsideClass;
    /**
     * Override walkTree to handle Python-specific patterns
     */
    protected walkTree(node: Parser.SyntaxNode, symbols: Symbol[]): void;
}
//# sourceMappingURL=PythonParserService.d.ts.map