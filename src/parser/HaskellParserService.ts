/**
 * HaskellParserService.ts
 *
 * Haskell language parser using Tree-sitter
 * Extracts symbols from Haskell functional programming code
 */

import Parser from 'tree-sitter';
import Haskell from 'tree-sitter-haskell';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * HaskellParserService - Extracts symbols from Haskell code
 */
export class HaskellParserService extends BaseLanguageParser {
  readonly language = 'haskell';
  readonly extensions = ['.hs', '.lhs'];

  constructor() {
    super(Haskell as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function':
      case 'signature':
        return this.extractFunction(node);

      case 'data':
      case 'newtype':
        return this.extractDataType(node);

      case 'type_synonym':
        return this.extractTypeSynonym(node);

      case 'class':
        return this.extractTypeClass(node);

      case 'instance':
        return this.extractInstance(node);

      default:
        return null;
    }
  }

  /**
   * Extract function definition or signature
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const variable = node.childForFieldName('name') ||
                     node.descendantsOfType('variable')[0] ||
                     node.descendantsOfType('identifier')[0];

    if (!variable) return null;

    const name = variable.text;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract data type or newtype
   */
  private extractDataType(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('type')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'type');
  }

  /**
   * Extract type synonym
   */
  private extractTypeSynonym(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('type')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'type');
  }

  /**
   * Extract type class
   */
  private extractTypeClass(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('type')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'interface');
  }

  /**
   * Extract type class instance
   */
  private extractInstance(node: Parser.SyntaxNode): Symbol | null {
    const typeNode = node.descendantsOfType('type')[0];
    if (!typeNode) return null;

    return this.createSymbol(node, typeNode.text, 'class');
  }
}
