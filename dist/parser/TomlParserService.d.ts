/**
 * TomlParserService.ts
 *
 * TOML language parser using Tree-sitter
 * Extracts keys and structure from TOML files
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * TomlParserService - Extracts structure from TOML files
 */
export declare class TomlParserService extends BaseLanguageParser {
    readonly language = "toml";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     * For TOML, we extract sections and top-level keys
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract TOML table (section) as a symbol
     */
    private extractTable;
    /**
     * Extract TOML key as a symbol
     */
    private extractKey;
}
//# sourceMappingURL=TomlParserService.d.ts.map