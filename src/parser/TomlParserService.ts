/**
 * TomlParserService.ts
 *
 * TOML language parser using Tree-sitter
 * Extracts keys and structure from TOML files
 */

import Parser from 'tree-sitter';
import TOML from 'tree-sitter-toml';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * TomlParserService - Extracts structure from TOML files
 */
export class TomlParserService extends BaseLanguageParser {
  readonly language = 'toml';
  readonly extensions = ['.toml'];

  constructor() {
    super(TOML as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   * For TOML, we extract sections and top-level keys
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'table':
        return this.extractTable(node);

      case 'pair':
        return this.extractKey(node);

      default:
        return null;
    }
  }

  /**
   * Extract TOML table (section) as a symbol
   */
  private extractTable(node: Parser.SyntaxNode): Symbol | null {
    // Get table name from header
    const header = node.descendantsOfType('bare_key')[0] ||
                   node.descendantsOfType('quoted_key')[0];
    if (!header) return null;

    const name = header.text.replace(/^["']|["']$/g, '');

    return this.createSymbol(node, name, 'module');
  }

  /**
   * Extract TOML key as a symbol
   */
  private extractKey(node: Parser.SyntaxNode): Symbol | null {
    const key = node.childForFieldName('key') ||
                node.descendantsOfType('bare_key')[0] ||
                node.descendantsOfType('quoted_key')[0];
    if (!key) return null;

    const name = key.text.replace(/^["']|["']$/g, '');

    return this.createSymbol(node, name, 'constant');
  }
}
