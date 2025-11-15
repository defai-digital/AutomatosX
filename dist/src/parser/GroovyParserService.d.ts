/**
 * GroovyParserService.ts
 *
 * Groovy language parser using Tree-sitter
 * Extracts symbols from Jenkins pipelines and Gradle build scripts
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * GroovyParserService - Extracts symbols from Groovy code
 */
export declare class GroovyParserService extends BaseLanguageParser {
    readonly language = "groovy";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract method or closure
     */
    private extractMethod;
    /**
     * Extract class declaration
     */
    private extractClass;
    /**
     * Extract interface declaration
     */
    private extractInterface;
    /**
     * Extract enum declaration
     */
    private extractEnum;
    /**
     * Extract trait declaration (Groovy-specific)
     */
    private extractTrait;
    /**
     * Extract variable or field declaration
     */
    private extractVariable;
    /**
     * Extract Jenkins pipeline stages and steps
     */
    private extractExpressionStatement;
    /**
     * Check if node is inside a class declaration
     */
    private isInsideClass;
}
//# sourceMappingURL=GroovyParserService.d.ts.map