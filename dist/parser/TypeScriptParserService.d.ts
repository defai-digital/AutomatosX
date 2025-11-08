/**
 * TypeScriptParserService.ts
 *
 * TypeScript/JavaScript language parser using Tree-sitter
 * Extracts symbols from TypeScript and JavaScript source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * TypeScriptParserService - Extracts symbols from TypeScript/JavaScript code
 */
export declare class TypeScriptParserService extends BaseLanguageParser {
    readonly language = "typescript";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function declaration
     * Enhanced to detect React components (functions returning JSX)
     */
    private extractFunction;
    /**
     * Extract class declaration
     * Enhanced to detect React class components
     */
    private extractClass;
    /**
     * Extract interface declaration
     */
    private extractInterface;
    /**
     * Extract type alias declaration
     */
    private extractTypeAlias;
    /**
     * Extract enum declaration
     */
    private extractEnum;
    /**
     * Extract variable/constant declaration
     * Enhanced to detect React arrow function components
     */
    private extractVariable;
    /**
     * Extract method definition (class method)
     */
    private extractMethod;
    /**
     * Check if a function returns JSX
     */
    private returnsJSX;
    /**
     * Check if a class extends React.Component or Component
     */
    private extendsReactComponent;
    /**
     * Check if an arrow function returns JSX
     */
    private isArrowFunctionReturningJSX;
    /**
     * Check if a node contains JSX elements
     */
    private containsJSX;
}
//# sourceMappingURL=TypeScriptParserService.d.ts.map