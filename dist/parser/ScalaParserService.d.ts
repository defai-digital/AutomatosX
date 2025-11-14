/**
 * ScalaParserService.ts
 *
 * Scala language parser using Tree-sitter
 * Extracts symbols from Scala source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * ScalaParserService - Extracts symbols from Scala code
 */
export declare class ScalaParserService extends BaseLanguageParser {
    readonly language = "scala";
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
     * Extract object definition (Scala singleton)
     */
    private extractObject;
    /**
     * Extract trait definition
     */
    private extractTrait;
    /**
     * Extract type definition
     */
    private extractType;
    /**
     * Extract val definition (immutable)
     */
    private extractVal;
    /**
     * Extract var definition (mutable)
     */
    private extractVar;
}
//# sourceMappingURL=ScalaParserService.d.ts.map