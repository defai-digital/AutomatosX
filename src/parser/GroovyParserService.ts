/**
 * GroovyParserService.ts
 *
 * Groovy language parser using Tree-sitter
 * Extracts symbols from Jenkins pipelines and Gradle build scripts
 */

import Parser from 'tree-sitter';
import Groovy from 'tree-sitter-groovy';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * GroovyParserService - Extracts symbols from Groovy code
 */
export class GroovyParserService extends BaseLanguageParser {
  readonly language = 'groovy';
  readonly extensions = ['.groovy', '.gradle', '.jenkinsfile'];

  constructor() {
    super(Groovy as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'method_declaration':
      case 'closure':
        return this.extractMethod(node);

      case 'class_declaration':
        return this.extractClass(node);

      case 'interface_declaration':
        return this.extractInterface(node);

      case 'enum_declaration':
        return this.extractEnum(node);

      case 'trait_declaration':
        return this.extractTrait(node);

      case 'variable_declaration':
      case 'field_declaration':
        return this.extractVariable(node);

      case 'expression_statement':
        return this.extractExpressionStatement(node);

      default:
        return null;
    }
  }

  /**
   * Extract method or closure
   */
  private extractMethod(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) {
      // Anonymous closure
      return this.createSymbol(node, '<anonymous>', 'function');
    }

    const name = nameNode.text;

    // Check if it's inside a class (would be a method)
    const kind: SymbolKind = this.isInsideClass(node) ? 'method' : 'function';

    return this.createSymbol(node, name, kind);
  }

  /**
   * Extract class declaration
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'class');
  }

  /**
   * Extract interface declaration
   */
  private extractInterface(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'interface');
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
   * Extract trait declaration (Groovy-specific)
   */
  private extractTrait(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'interface');
  }

  /**
   * Extract variable or field declaration
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    const name = identifiers[0].text;

    // Determine if it's a constant (final/static final)
    const text = node.text;
    const isFinal = text.includes('final');
    const kind: SymbolKind = isFinal ? 'constant' : 'variable';

    return this.createSymbol(node, name, kind);
  }

  /**
   * Extract Jenkins pipeline stages and steps
   */
  private extractExpressionStatement(node: Parser.SyntaxNode): Symbol | null {
    const text = node.text;

    // Look for Jenkins pipeline keywords
    if (text.includes('pipeline') || text.includes('stage') || text.includes('steps')) {
      const identifiers = node.descendantsOfType('identifier');
      if (identifiers.length > 0) {
        return this.createSymbol(node, identifiers[0].text, 'function');
      }
    }

    return null;
  }

  /**
   * Check if node is inside a class declaration
   */
  private isInsideClass(node: Parser.SyntaxNode): boolean {
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'class_declaration' ||
          parent.type === 'trait_declaration') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }
}
