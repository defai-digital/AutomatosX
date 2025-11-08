/**
 * KotlinParserService.ts
 *
 * Kotlin language parser using Tree-sitter
 * Extracts symbols from Kotlin source code
 */

import Parser from 'tree-sitter';
import Kotlin from 'tree-sitter-kotlin';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * KotlinParserService - Extracts symbols from Kotlin code
 *
 * Supports:
 * - Functions (top-level and class methods)
 * - Classes (regular, data, sealed, inner, abstract)
 * - Interfaces
 * - Objects (singleton pattern)
 * - Properties (val/var)
 * - Companion objects
 */
export class KotlinParserService extends BaseLanguageParser {
  readonly language = 'kotlin';
  readonly extensions = ['.kt', '.kts'];

  constructor() {
    super(Kotlin);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_declaration':
        return this.extractFunction(node);

      case 'class_declaration':
        return this.extractClass(node);

      case 'object_declaration':
        return this.extractObject(node);

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
   * - fun add(a: Int, b: Int): Int = a + b
   * - fun multiply(a: Int, b: Int): Int { return a * b }
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    // Get function name from simple_identifier child
    const nameNode = node.descendantsOfType('simple_identifier')[0];
    if (!nameNode) return null;

    const name = nameNode.text;

    // Check if function is inside a class
    const classParent = this.findParentClass(node);
    if (classParent) {
      const className = this.getClassName(classParent);
      if (className) {
        return this.createSymbol(node, `${className}.${name}`, 'method');
      }
    }

    // Top-level function
    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract class declaration
   * Handles: class, data class, sealed class, interface, enum class
   *
   * Examples:
   * - class Calculator { ... }
   * - data class Person(val name: String, val age: Int)
   * - interface Logger { fun log(message: String) }
   * - sealed class Result<out T>
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    // Get class name from type_identifier
    const nameNode = node.descendantsOfType('type_identifier')[0];
    if (!nameNode) return null;

    const name = nameNode.text;

    // Determine the kind based on modifiers and structure
    const kind = this.determineClassKind(node);

    return this.createSymbol(node, name, kind);
  }

  /**
   * Extract object declaration
   * Kotlin objects are singleton instances
   *
   * Examples:
   * - object Constants { const val PI = 3.14 }
   * - companion object { fun create() = ... }
   */
  private extractObject(node: Parser.SyntaxNode): Symbol | null {
    // Get object name from type_identifier
    const nameNode = node.descendantsOfType('type_identifier')[0];
    if (!nameNode) return null;

    const name = nameNode.text;

    // Objects are treated as classes (singleton pattern)
    return this.createSymbol(node, name, 'class');
  }

  /**
   * Extract property declaration
   * Handles val (immutable) and var (mutable) properties
   *
   * Examples:
   * - val name: String = "Kotlin"
   * - var count: Int = 0
   * - const val PI = 3.14
   */
  private extractProperty(node: Parser.SyntaxNode): Symbol | null {
    // Get property name from variable_declaration > simple_identifier
    const variableDecl = node.descendantsOfType('variable_declaration')[0];
    if (!variableDecl) return null;

    const nameNode = variableDecl.descendantsOfType('simple_identifier')[0];
    if (!nameNode) return null;

    const name = nameNode.text;

    // Check if property is const (constant)
    const modifiers = node.descendantsOfType('property_modifier');
    const isConst = modifiers.some(m => m.text === 'const');

    return this.createSymbol(node, name, isConst ? 'constant' : 'variable');
  }

  /**
   * Determine class kind based on modifiers and structure
   *
   * Returns:
   * - 'interface' if class_body contains only function declarations
   * - 'enum' if enum_class_body present
   * - 'class' otherwise
   */
  private determineClassKind(node: Parser.SyntaxNode): SymbolKind {
    // Check for class_body or enum_class_body
    const classBody = node.descendantsOfType('class_body')[0];
    const enumBody = node.descendantsOfType('enum_class_body')[0];

    if (enumBody) {
      return 'enum';
    }

    // Check if it's an interface by looking for interface-like structure
    // Interfaces typically have only function declarations without bodies
    if (classBody) {
      const functions = classBody.descendantsOfType('function_declaration');
      const properties = classBody.descendantsOfType('property_declaration');

      // If has functions but no properties, might be an interface
      // This is a heuristic; Kotlin grammar doesn't distinguish interface nodes
      if (functions.length > 0 && properties.length === 0) {
        // Check if functions have no body (abstract)
        const hasNoBodies = functions.every(fn => {
          const body = fn.descendantsOfType('function_body')[0];
          return !body || body.text === '';
        });

        if (hasNoBodies) {
          return 'interface';
        }
      }
    }

    return 'class';
  }

  /**
   * Get class name from class_declaration node
   */
  private getClassName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.descendantsOfType('type_identifier')[0];
    return nameNode ? nameNode.text : null;
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
