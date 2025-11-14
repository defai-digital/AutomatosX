/**
 * DartParserService.ts
 *
 * Dart language parser using Tree-sitter
 * Extracts symbols from Dart code (Flutter/mobile development)
 */

import Parser from 'tree-sitter';
import Dart from 'tree-sitter-dart';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * DartParserService - Extracts symbols from Dart code
 */
export class DartParserService extends BaseLanguageParser {
  readonly language = 'dart';
  readonly extensions = ['.dart'];

  constructor() {
    super(Dart as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_signature':
      case 'function_declaration':
      case 'method_signature':
        return this.extractFunction(node);

      case 'class_definition':
        return this.extractClass(node);

      case 'enum_declaration':
        return this.extractEnum(node);

      case 'mixin_declaration':
        return this.extractMixin(node);

      case 'extension_declaration':
        return this.extractExtension(node);

      case 'constant_constructor_signature':
      case 'constructor_signature':
        return this.extractConstructor(node);

      default:
        return null;
    }
  }

  /**
   * Extract function or method declaration
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    const name = nameNode.text;
    const kind: SymbolKind = node.parent?.type === 'class_definition' ? 'method' : 'function';

    return this.createSymbol(node, name, kind);
  }

  /**
   * Extract class definition
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'class');
  }

  /**
   * Extract enum declaration
   */
  private extractEnum(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'enum');
  }

  /**
   * Extract mixin declaration
   */
  private extractMixin(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'interface');
  }

  /**
   * Extract extension declaration
   */
  private extractExtension(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'interface');
  }

  /**
   * Extract constructor
   */
  private extractConstructor(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'method');
  }
}
