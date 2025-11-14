/**
 * RegexParserService.ts
 *
 * Regular Expression parser using Tree-sitter
 * Extracts patterns and structure from regex
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * RegexParserService - Extracts structure from regular expressions
 */
export declare class RegexParserService extends BaseLanguageParser {
    readonly language = "regex";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     * For regex, we extract named groups as symbols
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract named capturing group
     */
    private extractNamedGroup;
    /**
     * Extract group name
     */
    private extractGroupName;
}
//# sourceMappingURL=RegexParserService.d.ts.map