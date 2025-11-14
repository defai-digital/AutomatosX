/**
 * OcamlParserService.ts
 *
 * OCaml/ReScript language parser using Tree-sitter
 * Extracts symbols from OCaml and ReScript source code
 */

import Parser from 'tree-sitter';
import OCaml from 'tree-sitter-ocaml';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * OcamlParserService - Extracts symbols from OCaml/ReScript code
 */
export class OcamlParserService extends BaseLanguageParser {
  readonly language = 'ocaml';
  readonly extensions = ['.ml', '.mli', '.res', '.resi'];

  constructor() {
    // Use OCaml grammar which also supports ReScript syntax
    super(OCaml.ocaml as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'value_definition':
      case 'let_binding':
        return this.extractValue(node);

      case 'type_definition':
        return this.extractType(node);

      case 'module_definition':
        return this.extractModule(node);

      case 'external_declaration':
        return this.extractExternal(node);

      default:
        return null;
    }
  }

  /**
   * Extract value definition (let binding)
   */
  private extractValue(node: Parser.SyntaxNode): Symbol | null {
    const pattern = node.childForFieldName('pattern') ||
                    node.descendantsOfType('value_pattern')[0];
    if (!pattern) return null;

    const identifier = pattern.descendantsOfType('value_name')[0] ||
                       pattern.descendantsOfType('identifier')[0];
    if (!identifier) return null;

    const name = identifier.text;

    // Check if it's a function (has parameters)
    const parameters = node.descendantsOfType('parameter');
    const isFunction = parameters.length > 0;

    return this.createSymbol(node, name, isFunction ? 'function' : 'constant');
  }

  /**
   * Extract type definition
   */
  private extractType(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('type_constructor')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'type');
  }

  /**
   * Extract module definition
   */
  private extractModule(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('module_name')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'module');
  }

  /**
   * Extract external declaration
   */
  private extractExternal(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('value_name')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }
}
