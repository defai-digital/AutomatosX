/**
 * CParserService.ts
 *
 * C language parser using Tree-sitter
 * Extracts symbols from C source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * CParserService - Extracts symbols from C code
 */
export declare class CParserService extends BaseLanguageParser {
    readonly language = "c";
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
     * Extract struct definition
     */
    private extractStruct;
    /**
     * Extract enum definition
     */
    private extractEnum;
    /**
     * Extract typedef
     */
    private extractTypedef;
    /**
     * Extract variable/constant declaration
     */
    private extractDeclaration;
}
//# sourceMappingURL=CParserService.d.ts.map