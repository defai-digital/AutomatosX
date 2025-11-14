/**
 * LuaParserService.ts
 *
 * Lua language parser using Tree-sitter
 * Extracts symbols from Lua source code
 */

import Parser from 'tree-sitter';
import Lua from 'tree-sitter-lua';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * LuaParserService - Extracts symbols from Lua code
 */
export class LuaParserService extends BaseLanguageParser {
  readonly language = 'lua';
  readonly extensions = ['.lua'];

  constructor() {
    super(Lua as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_declaration':
      case 'function_definition':
        return this.extractFunction(node);

      case 'variable_declaration':
      case 'assignment_statement':
        return this.extractVariable(node);

      default:
        return null;
    }
  }

  /**
   * Extract function declaration
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract variable declaration
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    // Get variable list
    const variables = node.descendantsOfType('identifier');
    if (variables.length === 0) return null;

    // Take the first variable
    const name = variables[0].text;

    // Check if local (constant-like) or global
    const isLocal = node.parent?.text.startsWith('local') || false;

    return this.createSymbol(node, name, isLocal ? 'constant' : 'variable');
  }
}
