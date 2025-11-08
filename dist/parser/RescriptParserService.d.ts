/**
 * RescriptParserService.ts
 *
 * ReScript language parser using Tree-sitter OCaml grammar
 * Extracts symbols from ReScript source code
 *
 * Note: ReScript is based on OCaml syntax, so we use the OCaml tree-sitter grammar
 * which is compatible with ReScript's syntax.
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * RescriptParserService - Extracts symbols from ReScript code
 */
export declare class RescriptParserService extends BaseLanguageParser {
    readonly language = "rescript";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract module definition
     * Example: module Math = { let add = (a, b) => a + b }
     * Example: module type Comparable = { type t; let compare: (t, t) => int }
     */
    private extractModule;
    /**
     * Extract type definition
     * Example: type point = {x: float, y: float}
     * Example: type shape = Circle(float) | Rectangle(float, float)
     * Example: type t<'a> = option<'a>
     */
    private extractType;
    /**
     * Extract value definition (functions, constants)
     * Example: let add = (a, b) => a + b
     * Example: let pi = 3.14159
     * Example: let rec factorial = n => n <= 1 ? 1 : n * factorial(n - 1)
     */
    private extractValueDefinition;
    /**
     * Extract value name from pattern node
     */
    private extractValueName;
    /**
     * Check if a value definition is a function
     * Functions typically have function expressions, fun expressions, or arrow syntax
     */
    private isFunction;
    /**
     * Recursively check if node contains function-like constructs
     */
    private containsFunction;
    /**
     * Extract external declaration
     * Example: external setTimeout: (unit => unit, int) => int = "setTimeout"
     * Example: @module("path") external join: (string, string) => string = "join"
     */
    private extractExternal;
}
//# sourceMappingURL=RescriptParserService.d.ts.map