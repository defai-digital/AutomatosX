/**
 * YamlParserService.ts
 *
 * YAML language parser using Tree-sitter
 * Extracts keys and structure from YAML files
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * YamlParserService - Extracts structure from YAML files
 */
export declare class YamlParserService extends BaseLanguageParser {
    readonly language = "yaml";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     * For YAML, we extract top-level keys as constants
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract YAML key as a symbol
     */
    private extractKey;
}
//# sourceMappingURL=YamlParserService.d.ts.map