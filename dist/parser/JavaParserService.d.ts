/**
 * JavaParserService.ts
 *
 * Java language parser using Tree-sitter
 * Extracts symbols from Java source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * JavaParserService - Extracts symbols from Java code
 */
export declare class JavaParserService extends BaseLanguageParser {
    readonly language = "java";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract class declaration
     * Example: public class BasicCalculator { ... }
     */
    private extractClass;
    /**
     * Extract interface declaration
     * Example: public interface Calculator { ... }
     */
    private extractInterface;
    /**
     * Extract enum declaration
     * Example: enum CalculatorMode { STANDARD, SCIENTIFIC }
     */
    private extractEnum;
    /**
     * Extract method declaration
     * Example: public double add(double a, double b) { ... }
     */
    private extractMethod;
    /**
     * Extract constructor declaration
     * Example: public BasicCalculator() { ... }
     */
    private extractConstructor;
    /**
     * Extract field declaration (class member variables)
     * Example: private double memory;
     */
    private extractField;
    /**
     * Find parent class declaration for a node
     */
    private findParentClass;
}
//# sourceMappingURL=JavaParserService.d.ts.map