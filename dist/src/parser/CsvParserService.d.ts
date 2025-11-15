/**
 * CsvParserService.ts
 *
 * CSV language parser using Tree-sitter
 * Extracts column headers from CSV files
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * CsvParserService - Extracts column headers from CSV files
 */
export declare class CsvParserService extends BaseLanguageParser {
    readonly language = "csv";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     * For CSV, we extract column headers from the first row
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract CSV column headers
     */
    private extractHeader;
}
//# sourceMappingURL=CsvParserService.d.ts.map