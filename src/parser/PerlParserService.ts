/**
 * PerlParserService.ts
 *
 * Perl language parser using Tree-sitter
 * Extracts symbols from Perl scripting code
 */

import Parser from 'tree-sitter';
import Perl from '@ganezdragon/tree-sitter-perl';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * PerlParserService - Extracts symbols from Perl code
 */
export class PerlParserService extends BaseLanguageParser {
  readonly language = 'perl';
  readonly extensions = ['.pl', '.pm', '.t'];

  constructor() {
    super(Perl as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'subroutine_declaration_statement':
      case 'named_subroutine_expression':
        return this.extractSubroutine(node);

      case 'package_statement':
        return this.extractPackage(node);

      case 'variable_declaration':
      case 'our_declaration':
        return this.extractVariable(node);

      case 'use_statement':
        return this.extractUse(node);

      default:
        return null;
    }
  }

  /**
   * Extract subroutine declaration (Perl function)
   */
  private extractSubroutine(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'function');
  }

  /**
   * Extract package declaration (Perl module)
   */
  private extractPackage(node: Parser.SyntaxNode): Symbol | null {
    const packageName = node.childForFieldName('name');

    if (!packageName) return null;

    return this.createSymbol(node, packageName.text, 'module');
  }

  /**
   * Extract variable declaration (my, our, state)
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    const variables = node.descendantsOfType('scalar_variable') ||
                     node.descendantsOfType('array_variable') ||
                     node.descendantsOfType('hash_variable');

    if (!variables || variables.length === 0) return null;

    const name = variables[0].text;

    return this.createSymbol(node, name, 'variable');
  }

  /**
   * Extract use statement (imports/modules)
   */
  private extractUse(node: Parser.SyntaxNode): Symbol | null {
    const moduleNode = node.childForFieldName('module');

    if (!moduleNode) return null;

    return this.createSymbol(node, moduleNode.text, 'module');
  }
}
