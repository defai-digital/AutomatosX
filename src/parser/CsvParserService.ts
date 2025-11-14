/**
 * CsvParserService.ts
 *
 * CSV language parser using Tree-sitter
 * Extracts column headers from CSV files
 */

import Parser from 'tree-sitter';
import CSV from 'tree-sitter-csv';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * CsvParserService - Extracts column headers from CSV files
 */
export class CsvParserService extends BaseLanguageParser {
  readonly language = 'csv';
  readonly extensions = ['.csv', '.tsv'];

  constructor() {
    super(CSV as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   * For CSV, we extract column headers from the first row
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    // Only extract from first row (header row)
    if (node.type === 'row' && node.startPosition.row === 0) {
      return this.extractHeader(node);
    }

    return null;
  }

  /**
   * Extract CSV column headers
   */
  private extractHeader(node: Parser.SyntaxNode): Symbol | null {
    const fields = node.descendantsOfType('field');
    if (fields.length === 0) return null;

    // Create a symbol for the entire header row
    const headers = fields.map(f => f.text.trim()).join(', ');

    return this.createSymbol(node, headers, 'constant');
  }
}
