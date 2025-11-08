/**
 * RubyParserService.ts
 *
 * Ruby language parser using Tree-sitter
 * Extracts symbols from Ruby source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * RubyParserService - Extracts symbols from Ruby code
 */
export declare class RubyParserService extends BaseLanguageParser {
    readonly language = "ruby";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract class declaration
     * Example: class Calculator
     * Example: class ScientificCalculator < Calculator
     */
    private extractClass;
    /**
     * Extract module declaration
     * Example: module Calculable
     * Example: module Math::Advanced
     */
    private extractModule;
    /**
     * Extract method declaration
     * Example: def calculate(x, y)
     * Example: def self.max(a, b)
     */
    private extractMethod;
    /**
     * Extract constant assignment
     * Example: MAX_SIZE = 100
     * Example: VERSION = "1.0.0"
     */
    private extractAssignment;
}
//# sourceMappingURL=RubyParserService.d.ts.map