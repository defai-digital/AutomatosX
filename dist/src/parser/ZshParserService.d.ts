/**
 * ZshParserService.ts
 *
 * Zsh language parser using Tree-sitter
 * Extracts symbols from Zsh scripts
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * ZshParserService - Extracts symbols from Zsh code
 */
export declare class ZshParserService extends BaseLanguageParser {
    readonly language = "zsh";
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
//# sourceMappingURL=ZshParserService.d.ts.map