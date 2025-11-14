/**
 * GleamParserService.ts
 *
 * Gleam language parser using Tree-sitter
 * Extracts symbols from Gleam functional programming code (BEAM VM)
 */

import Parser from 'tree-sitter';
import Gleam from 'tree-sitter-gleam';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * GleamParserService - Extracts symbols from Gleam code
 */
export class GleamParserService extends BaseLanguageParser {
  readonly language = 'gleam';
  readonly extensions = ['.gleam'];

  constructor() {
    super(Gleam as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function':
      case 'function_declaration':
        return this.extractFunction(node);

      case 'type_alias':
        return this.extractTypeAlias(node);

      case 'custom_type':
        return this.extractCustomType(node);

      case 'external_function':
        return this.extractExternalFunction(node);

      case 'import':
        return this.extractImport(node);

      case 'constant':
        return this.extractConstant(node);

      default:
        return null;
    }
  }

  /**
   * Extract function declaration
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'function');
  }

  /**
   * Extract type alias
   */
  private extractTypeAlias(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('type_identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'type');
  }

  /**
   * Extract custom type (algebraic data type)
   */
  private extractCustomType(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('type_identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'struct');
  }

  /**
   * Extract external function (FFI)
   */
  private extractExternalFunction(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'function');
  }

  /**
   * Extract import statement
   */
  private extractImport(node: Parser.SyntaxNode): Symbol | null {
    const moduleNode = node.childForFieldName('module') ||
                      node.descendantsOfType('module_path')[0];

    if (!moduleNode) return null;

    return this.createSymbol(node, moduleNode.text, 'module');
  }

  /**
   * Extract constant declaration
   */
  private extractConstant(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'constant');
  }
}
