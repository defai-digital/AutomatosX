/**
 * JsonParserService.ts
 *
 * JSON language parser using Tree-sitter
 * Extracts keys and structure from JSON files
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * JsonParserService - Extracts structure from JSON files
 */
export declare class JsonParserService extends BaseLanguageParser {
    readonly language = "json";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     * For JSON, we extract top-level keys as constants
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract JSON key as a symbol
     */
    private extractKey;
}
//# sourceMappingURL=JsonParserService.d.ts.map