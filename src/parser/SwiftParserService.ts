/**
 * SwiftParserService.ts
 *
 * Swift language parser using Tree-sitter
 * Extracts symbols from Swift source code
 */

import Parser from 'tree-sitter';
import Swift from 'tree-sitter-swift';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * SwiftParserService - Extracts symbols from Swift code
 *
 * Supports:
 * - Functions (top-level and methods)
 * - Classes
 * - Structs
 * - Enums
 * - Protocols (interfaces)
 * - Properties (var/let)
 * - Extensions
 */
export class SwiftParserService extends BaseLanguageParser {
  readonly language = 'swift';
  readonly extensions = ['.swift'];

  constructor() {
    super(Swift);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_declaration':
        return this.extractFunction(node);

      case 'class_declaration':
        return this.extractClassLike(node);

      case 'protocol_declaration':
        return this.extractProtocol(node);

      case 'property_declaration':
        return this.extractProperty(node);

      default:
        return null;
    }
  }

  /**
   * Extract function declaration
   * Handles both top-level functions and class methods
   *
   * Examples:
   * - func add(a: Int, b: Int) -> Int { return a + b }
   * - func calculate() -> Double
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    // Get function name from simple_identifier child
    const nameNode = node.descendantsOfType('simple_identifier')[0];
    if (!nameNode) return null;

    const name = nameNode.text;

    // Check if function is inside a class/struct/enum
    const parent = this.findParentType(node);
    if (parent) {
      const parentName = this.getTypeName(parent);
      if (parentName) {
        return this.createSymbol(node, `${parentName}.${name}`, 'method');
      }
    }

    // Top-level function
    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract class-like declaration (class, struct, enum)
   * Swift uses class_declaration for all three types
   *
   * Examples:
   * - class Calculator { ... }
   * - struct Point { var x: Double, var y: Double }
   * - enum Result { case success, case failure }
   */
  private extractClassLike(node: Parser.SyntaxNode): Symbol | null {
    // Get type name from type_identifier
    const nameNode = node.descendantsOfType('type_identifier')[0];
    if (!nameNode) return null;

    const name = nameNode.text;

    // Determine the kind based on body type
    const kind = this.determineClassKind(node);

    return this.createSymbol(node, name, kind);
  }

  /**
   * Extract protocol declaration (Swift's interface)
   *
   * Examples:
   * - protocol Logger { func log(message: String) }
   * - protocol Drawable { func draw() }
   */
  private extractProtocol(node: Parser.SyntaxNode): Symbol | null {
    // Get protocol name from type_identifier
    const nameNode = node.descendantsOfType('type_identifier')[0];
    if (!nameNode) return null;

    const name = nameNode.text;

    return this.createSymbol(node, name, 'interface');
  }

  /**
   * Extract property declaration
   * Handles both var and let properties
   *
   * Examples:
   * - var count: Int = 0
   * - let name: String = "Swift"
   */
  private extractProperty(node: Parser.SyntaxNode): Symbol | null {
    // Get property name from pattern > simple_identifier
    const patterns = node.descendantsOfType('pattern');
    if (patterns.length === 0) return null;

    const identifiers = patterns[0].descendantsOfType('simple_identifier');
    if (identifiers.length === 0) return null;

    const name = identifiers[0].text;

    // Check if property is constant (let) or variable (var)
    // Look for value_binding_pattern which contains 'let' or 'var'
    const bindingPattern = node.descendantsOfType('value_binding_pattern')[0];
    const isConstant = bindingPattern && bindingPattern.text.trim().startsWith('let');

    return this.createSymbol(node, name, isConstant ? 'constant' : 'variable');
  }

  /**
   * Determine class kind based on body type
   *
   * Returns:
   * - 'enum' if enum_class_body present
   * - 'class' otherwise (includes structs)
   */
  private determineClassKind(node: Parser.SyntaxNode): SymbolKind {
    // Check for enum_class_body
    const enumBody = node.descendantsOfType('enum_class_body')[0];
    if (enumBody) {
      return 'enum';
    }

    // Check for class_body (used by both class and struct)
    // We classify both as 'class' since they're similar in structure
    return 'class';
  }

  /**
   * Get type name from class_declaration or protocol_declaration node
   */
  private getTypeName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.descendantsOfType('type_identifier')[0];
    return nameNode ? nameNode.text : null;
  }

  /**
   * Find parent class/struct/enum/protocol declaration for a node
   */
  private findParentType(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = node.parent;
    while (current) {
      if (current.type === 'class_declaration' || current.type === 'protocol_declaration') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }
}
