/**
 * DartParserService.ts
 *
 * Dart language parser using Tree-sitter
 * Extracts symbols from Dart code (Flutter/mobile development)
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * DartParserService - Extracts symbols from Dart code
 */
export declare class DartParserService extends BaseLanguageParser {
    readonly language = "dart";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function or method declaration
     */
    private extractFunction;
    /**
     * Extract class definition
     */
    private extractClass;
    /**
     * Extract enum declaration
     */
    private extractEnum;
    /**
     * Extract mixin declaration
     */
    private extractMixin;
    /**
     * Extract extension declaration
     */
    private extractExtension;
    /**
     * Extract constructor
     */
    private extractConstructor;
}
//# sourceMappingURL=DartParserService.d.ts.map