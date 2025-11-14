/**
 * BashParserService.ts
 *
 * Bash language parser using Tree-sitter
 * Extracts symbols from Bash/shell scripts
 */

import Parser from 'tree-sitter';
import Bash from 'tree-sitter-bash';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * BashParserService - Extracts symbols from Bash code
 */
export class BashParserService extends BaseLanguageParser {
  readonly language = 'bash';
  readonly extensions = ['.sh', '.bash', '.zsh'];

  constructor() {
    super(Bash as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_definition':
        return this.extractFunction(node);

      case 'variable_assignment':
        return this.extractVariable(node);

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
   * Extract variable assignment
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    // Check if readonly/declare -r (constant)
    const parent = node.parent;
    const isConst = parent?.text.includes('readonly') ||
                   parent?.text.includes('declare -r') ||
                   false;

    return this.createSymbol(node, name, isConst ? 'constant' : 'variable');
  }
}
