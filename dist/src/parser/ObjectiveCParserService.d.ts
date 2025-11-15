/**
 * ObjectiveCParserService.ts
 *
 * Objective-C language parser using Tree-sitter
 * Extracts symbols from Objective-C source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * ObjectiveCParserService - Extracts symbols from Objective-C code
 */
export declare class ObjectiveCParserService extends BaseLanguageParser {
    readonly language = "objectivec";
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
     * Extract class declaration/implementation
     */
    private extractClass;
    /**
     * Extract protocol declaration
     */
    private extractProtocol;
    /**
     * Extract method declaration/definition
     */
    private extractMethod;
    /**
     * Extract property declaration
     */
    private extractProperty;
    /**
     * Extract struct definition
     */
    private extractStruct;
    /**
     * Extract enum definition
     */
    private extractEnum;
}
//# sourceMappingURL=ObjectiveCParserService.d.ts.map