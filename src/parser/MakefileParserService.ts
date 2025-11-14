/**
 * MakefileParserService.ts
 *
 * Makefile language parser using Tree-sitter
 * Extracts targets and variables from Makefiles
 */

import Parser from 'tree-sitter';
import Make from 'tree-sitter-make';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * MakefileParserService - Extracts structure from Makefiles
 */
export class MakefileParserService extends BaseLanguageParser {
  readonly language = 'makefile';
  readonly extensions = ['Makefile', 'makefile', '.mk', 'GNUmakefile'];

  constructor() {
    super(Make as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   * For Makefiles, we extract targets and variables
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'rule':
        return this.extractTarget(node);

      case 'variable_assignment':
        return this.extractVariable(node);

      default:
        return null;
    }
  }

  /**
   * Extract make target
   */
  private extractTarget(node: Parser.SyntaxNode): Symbol | null {
    const targets = node.childForFieldName('targets');
    if (!targets) return null;

    // Get first target name
    const target = targets.descendantsOfType('word')[0] ||
                   targets.descendantsOfType('target')[0];
    if (!target) return null;

    const name = target.text;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract make variable
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    // Check if it's a constant-style variable (all caps)
    const isConst = name === name.toUpperCase();

    return this.createSymbol(node, name, isConst ? 'constant' : 'variable');
  }
}
