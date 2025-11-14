/**
 * ScalaParserService.ts
 *
 * Scala language parser using Tree-sitter
 * Extracts symbols from Scala source code
 */

import Parser from 'tree-sitter';
import Scala from 'tree-sitter-scala';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * ScalaParserService - Extracts symbols from Scala code
 */
export class ScalaParserService extends BaseLanguageParser {
  readonly language = 'scala';
  readonly extensions = ['.scala', '.sc'];

  constructor() {
    super(Scala as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_definition':
      case 'function_declaration':
        return this.extractFunction(node);

      case 'class_definition':
        return this.extractClass(node);

      case 'object_definition':
        return this.extractObject(node);

      case 'trait_definition':
        return this.extractTrait(node);

      case 'type_definition':
        return this.extractType(node);

      case 'val_definition':
      case 'val_declaration':
        return this.extractVal(node);

      case 'var_definition':
      case 'var_declaration':
        return this.extractVar(node);

      default:
        return null;
    }
  }

  /**
   * Extract function definition
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract class definition
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'class');
  }

  /**
   * Extract object definition (Scala singleton)
   */
  private extractObject(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'module');
  }

  /**
   * Extract trait definition
   */
  private extractTrait(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'trait');
  }

  /**
   * Extract type definition
   */
  private extractType(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'type');
  }

  /**
   * Extract val definition (immutable)
   */
  private extractVal(node: Parser.SyntaxNode): Symbol | null {
    const pattern = node.childForFieldName('pattern');
    if (!pattern) return null;

    const identifier = pattern.descendantsOfType('identifier')[0];
    if (!identifier) return null;

    return this.createSymbol(node, identifier.text, 'constant');
  }

  /**
   * Extract var definition (mutable)
   */
  private extractVar(node: Parser.SyntaxNode): Symbol | null {
    const pattern = node.childForFieldName('pattern');
    if (!pattern) return null;

    const identifier = pattern.descendantsOfType('identifier')[0];
    if (!identifier) return null;

    return this.createSymbol(node, identifier.text, 'variable');
  }
}
