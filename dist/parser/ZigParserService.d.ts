/**
 * ZigParserService.ts
 *
 * Zig language parser using Tree-sitter
 * Extracts symbols from Zig systems programming code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * ZigParserService - Extracts symbols from Zig code
 */
export declare class ZigParserService extends BaseLanguageParser {
    readonly language = "zig";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function declaration
     */
    private extractFunction;
    /**
     * Extract variable declaration (const, var)
     */
    private extractVariable;
    /**
     * Extract container declaration (struct, union, enum, opaque)
     */
    private extractContainer;
    /**
     * Extract test declaration
     */
    private extractTest;
    /**
     * Check if node is inside a container (struct/union/enum)
     */
    private isInsideContainer;
}
//# sourceMappingURL=ZigParserService.d.ts.map