/**
 * ZigParserService.ts
 *
 * Zig language parser using Tree-sitter
 * Extracts symbols from Zig systems programming code
 */

import Parser from 'tree-sitter';
import Zig from 'tree-sitter-zig';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * ZigParserService - Extracts symbols from Zig code
 */
export class ZigParserService extends BaseLanguageParser {
  readonly language = 'zig';
  readonly extensions = ['.zig'];

  constructor() {
    super(Zig as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'FnProto':
      case 'FnDecl':
        return this.extractFunction(node);

      case 'VarDecl':
        return this.extractVariable(node);

      case 'ContainerDecl':
        return this.extractContainer(node);

      case 'TestDecl':
        return this.extractTest(node);

      default:
        return null;
    }
  }

  /**
   * Extract function declaration
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('IDENTIFIER');
    if (identifiers.length === 0) return null;

    const name = identifiers[0].text;

    // Check if it's a method inside a struct/union/enum
    const kind: SymbolKind = this.isInsideContainer(node) ? 'method' : 'function';

    return this.createSymbol(node, name, kind);
  }

  /**
   * Extract variable declaration (const, var)
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('IDENTIFIER');
    if (identifiers.length === 0) return null;

    const name = identifiers[0].text;

    // Check if it's inside a container (would be a field/property)
    if (this.isInsideContainer(node)) {
      return this.createSymbol(node, name, 'variable');
    }

    // Top-level constants and variables
    const text = node.text;
    const kind: SymbolKind = text.startsWith('const') ? 'constant' : 'variable';

    return this.createSymbol(node, name, kind);
  }

  /**
   * Extract container declaration (struct, union, enum, opaque)
   */
  private extractContainer(node: Parser.SyntaxNode): Symbol | null {
    // Look for the container keyword
    const text = node.text;

    let kind: SymbolKind = 'struct';
    if (text.includes('enum')) {
      kind = 'enum';
    } else if (text.includes('union')) {
      kind = 'struct';
    } else if (text.includes('struct')) {
      kind = 'struct';
    }

    // Get the name from parent VarDecl if exists
    const parent = node.parent;
    if (parent?.type === 'VarDecl') {
      const identifiers = parent.descendantsOfType('IDENTIFIER');
      if (identifiers.length > 0) {
        return this.createSymbol(node, identifiers[0].text, kind);
      }
    }

    return null;
  }

  /**
   * Extract test declaration
   */
  private extractTest(node: Parser.SyntaxNode): Symbol | null {
    const stringLiterals = node.descendantsOfType('STRINGLITERALSINGLE');
    if (stringLiterals.length === 0) return null;

    // Test name is the string literal
    const name = stringLiterals[0].text.replace(/"/g, '');

    return this.createSymbol(node, `test: ${name}`, 'function');
  }

  /**
   * Check if node is inside a container (struct/union/enum)
   */
  private isInsideContainer(node: Parser.SyntaxNode): boolean {
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'ContainerDecl') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }
}
