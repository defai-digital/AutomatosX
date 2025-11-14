/**
 * ElmParserService.ts
 *
 * Elm language parser using Tree-sitter
 * Extracts symbols from Elm source code
 */

import Parser from 'tree-sitter';
import Elm from 'tree-sitter-elm';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * ElmParserService - Extracts symbols from Elm code
 */
export class ElmParserService extends BaseLanguageParser {
  readonly language = 'elm';
  readonly extensions = ['.elm'];

  constructor() {
    // Elm exports the language directly via the native binding
    super(Elm as unknown as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'value_declaration':
        return this.extractValue(node);

      case 'type_alias_declaration':
        return this.extractTypeAlias(node);

      case 'type_declaration':
        return this.extractType(node);

      case 'port_annotation':
        return this.extractPort(node);

      default:
        return null;
    }
  }

  /**
   * Extract value declaration (function or constant)
   */
  private extractValue(node: Parser.SyntaxNode): Symbol | null {
    const functionDeclaration = node.descendantsOfType('function_declaration_left')[0];
    if (!functionDeclaration) return null;

    const name = this.getFieldText(functionDeclaration, 'name') ||
                 functionDeclaration.descendantsOfType('lower_case_identifier')[0]?.text;
    if (!name) return null;

    // Check if it has parameters (is a function)
    const patterns = functionDeclaration.descendantsOfType('pattern');
    const isFunction = patterns.length > 1; // First pattern is the name itself

    return this.createSymbol(node, name, isFunction ? 'function' : 'constant');
  }

  /**
   * Extract type alias declaration
   */
  private extractTypeAlias(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('upper_case_identifier')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'type');
  }

  /**
   * Extract type declaration
   */
  private extractType(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('upper_case_identifier')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'type');
  }

  /**
   * Extract port annotation
   */
  private extractPort(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('lower_case_identifier')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }
}
