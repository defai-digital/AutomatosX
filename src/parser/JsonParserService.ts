/**
 * JsonParserService.ts
 *
 * JSON language parser using Tree-sitter
 * Extracts keys and structure from JSON files
 */

import Parser from 'tree-sitter';
import JSON from 'tree-sitter-json';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * JsonParserService - Extracts structure from JSON files
 */
export class JsonParserService extends BaseLanguageParser {
  readonly language = 'json';
  readonly extensions = ['.json', '.jsonc', '.json5'];

  constructor() {
    super(JSON as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   * For JSON, we extract top-level keys as constants
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'pair':
        return this.extractKey(node);

      default:
        return null;
    }
  }

  /**
   * Extract JSON key as a symbol
   */
  private extractKey(node: Parser.SyntaxNode): Symbol | null {
    const key = node.childForFieldName('key');
    if (!key) return null;

    // Only extract top-level keys (not nested)
    const parent = node.parent;
    if (!parent || parent.type !== 'object') return null;

    const grandparent = parent.parent;
    if (grandparent && grandparent.type !== 'document') return null;

    // Remove quotes from key
    const name = key.text.replace(/^["']|["']$/g, '');

    return this.createSymbol(node, name, 'constant');
  }
}
