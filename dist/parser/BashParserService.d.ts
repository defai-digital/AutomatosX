/**
 * BashParserService.ts
 *
 * Bash language parser using Tree-sitter
 * Extracts symbols from Bash/shell scripts
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * BashParserService - Extracts symbols from Bash code
 */
export declare class BashParserService extends BaseLanguageParser {
    readonly language = "bash";
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
     * Extract variable assignment
     */
    private extractVariable;
}
//# sourceMappingURL=BashParserService.d.ts.map