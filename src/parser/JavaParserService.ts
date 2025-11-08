/**
 * JavaParserService.ts
 *
 * Java language parser using Tree-sitter
 * Extracts symbols from Java source code
 */

import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * JavaParserService - Extracts symbols from Java code
 */
export class JavaParserService extends BaseLanguageParser {
  readonly language = 'java';
  readonly extensions = ['.java'];

  constructor() {
    super(Java);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'class_declaration':
        return this.extractClass(node);

      case 'interface_declaration':
        return this.extractInterface(node);

      case 'enum_declaration':
        return this.extractEnum(node);

      case 'method_declaration':
        return this.extractMethod(node);

      case 'constructor_declaration':
        return this.extractConstructor(node);

      case 'field_declaration':
        return this.extractField(node);

      default:
        return null;
    }
  }

  /**
   * Extract class declaration
   * Example: public class BasicCalculator { ... }
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'class');
  }

  /**
   * Extract interface declaration
   * Example: public interface Calculator { ... }
   */
  private extractInterface(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'interface');
  }

  /**
   * Extract enum declaration
   * Example: enum CalculatorMode { STANDARD, SCIENTIFIC }
   */
  private extractEnum(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'enum');
  }

  /**
   * Extract method declaration
   * Example: public double add(double a, double b) { ... }
   */
  private extractMethod(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    // Check if method is static
    const modifiers = node.descendantsOfType('modifiers');
    const isStatic = modifiers.some(m => m.text.includes('static'));

    // For non-static methods, try to include class name
    if (!isStatic) {
      const classNode = this.findParentClass(node);
      if (classNode) {
        const className = this.getFieldText(classNode, 'name');
        if (className) {
          return this.createSymbol(node, `${className}.${name}`, 'method');
        }
      }
    }

    return this.createSymbol(node, name, 'method');
  }

  /**
   * Extract constructor declaration
   * Example: public BasicCalculator() { ... }
   */
  private extractConstructor(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'method');
  }

  /**
   * Extract field declaration (class member variables)
   * Example: private double memory;
   */
  private extractField(node: Parser.SyntaxNode): Symbol | null {
    // Get the variable declarator
    const declarator = node.descendantsOfType('variable_declarator')[0];
    if (!declarator) return null;

    const nameNode = declarator.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;

    // Check if field is static final (constant)
    const modifiers = node.descendantsOfType('modifiers');
    const isConstant = modifiers.some(m =>
      m.text.includes('static') && m.text.includes('final')
    );

    return {
      name,
      kind: isConstant ? 'constant' : 'variable',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    };
  }

  /**
   * Find parent class declaration for a node
   */
  private findParentClass(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = node.parent;
    while (current) {
      if (current.type === 'class_declaration') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }
}
