/**
 * ElixirParserService.ts
 *
 * Elixir language parser using Tree-sitter
 * Extracts symbols from Elixir functional programming code
 */

import Parser from 'tree-sitter';
import Elixir from 'tree-sitter-elixir';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * ElixirParserService - Extracts symbols from Elixir code
 */
export class ElixirParserService extends BaseLanguageParser {
  readonly language = 'elixir';
  readonly extensions = ['.ex', '.exs'];

  constructor() {
    super(Elixir as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'call':
        return this.extractCall(node);

      case 'module':
        return this.extractModule(node);

      default:
        return null;
    }
  }

  /**
   * Extract module, function, or macro definition from call nodes
   */
  private extractCall(node: Parser.SyntaxNode): Symbol | null {
    const target = node.childForFieldName('target');
    if (!target) return null;

    const targetText = target.text;

    // Module definition: defmodule MyModule do ... end
    if (targetText === 'defmodule') {
      const args = node.childForFieldName('arguments');
      if (!args) return null;

      const aliases = args.descendantsOfType('alias');
      if (aliases.length === 0) return null;

      return this.createSymbol(node, aliases[0].text, 'module');
    }

    // Function definition: def my_function(args) do ... end
    if (targetText === 'def' || targetText === 'defp') {
      const args = node.childForFieldName('arguments');
      if (!args) return null;

      const calls = args.descendantsOfType('call');
      if (calls.length === 0) return null;

      const nameNode = calls[0].childForFieldName('target');
      if (!nameNode) return null;

      return this.createSymbol(node, nameNode.text, 'function');
    }

    // Macro definition: defmacro my_macro(args) do ... end
    if (targetText === 'defmacro' || targetText === 'defmacrop') {
      const args = node.childForFieldName('arguments');
      if (!args) return null;

      const calls = args.descendantsOfType('call');
      if (calls.length === 0) return null;

      const nameNode = calls[0].childForFieldName('target');
      if (!nameNode) return null;

      return this.createSymbol(node, nameNode.text, 'function');
    }

    // Struct definition: defstruct [:field1, :field2]
    if (targetText === 'defstruct') {
      // Get parent module name
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'call') {
          const parentTarget = parent.childForFieldName('target');
          if (parentTarget?.text === 'defmodule') {
            const args = parent.childForFieldName('arguments');
            const aliases = args?.descendantsOfType('alias');
            if (aliases && aliases.length > 0) {
              return this.createSymbol(node, aliases[0].text, 'struct');
            }
          }
        }
        parent = parent.parent;
      }
      return null;
    }

    // Protocol definition: defprotocol MyProtocol do ... end
    if (targetText === 'defprotocol') {
      const args = node.childForFieldName('arguments');
      if (!args) return null;

      const aliases = args.descendantsOfType('alias');
      if (aliases.length === 0) return null;

      return this.createSymbol(node, aliases[0].text, 'interface');
    }

    return null;
  }

  /**
   * Extract module definition
   */
  private extractModule(node: Parser.SyntaxNode): Symbol | null {
    const aliases = node.descendantsOfType('alias');
    if (aliases.length === 0) return null;

    return this.createSymbol(node, aliases[0].text, 'module');
  }
}
