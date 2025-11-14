/**
 * CppParserService.ts
 *
 * C++/Metal language parser using Tree-sitter
 * Extracts symbols from C++ and Apple Metal shader source code
 *
 * Supports:
 * - C++ (.cpp, .cc, .cxx, .h, .hpp, .hxx)
 * - Apple Metal Shading Language (.metal)
 *
 * Metal Shading Language is based on C++14 with GPU-specific extensions.
 * Since Metal uses C++ syntax with additional qualifiers, we can use
 * the same tree-sitter grammar for both.
 */

import Parser from 'tree-sitter';
import Cpp from 'tree-sitter-cpp';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * CppParserService - Extracts symbols from C++ and Metal code
 */
export class CppParserService extends BaseLanguageParser {
  readonly language = 'cpp';
  readonly extensions = [
    // C++
    '.cpp',
    '.cc',
    '.cxx',
    '.h',
    '.hpp',
    '.hxx',
    // Apple Metal Shading Language
    '.metal',
  ];

  constructor() {
    super(Cpp as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'class_specifier':
        return this.extractClass(node);

      case 'struct_specifier':
        return this.extractStruct(node);

      case 'enum_specifier':
        return this.extractEnum(node);

      case 'function_definition':
        return this.extractFunction(node);

      case 'declaration':
        return this.extractDeclaration(node);

      case 'template_declaration':
        return this.extractTemplate(node);

      case 'namespace_definition':
        return this.extractNamespace(node);

      default:
        return null;
    }
  }

  /**
   * Extract class declaration
   * Example: class Calculator { };
   * Example: template<typename T> class Container { };
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    return this.createSymbol(node, name, 'class');
  }

  /**
   * Extract struct declaration
   * Example: struct Point { double x, y; };
   * Example: template<typename T> struct Pair { };
   */
  private extractStruct(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    return this.createSymbol(node, name, 'struct');
  }

  /**
   * Extract enum declaration
   * Example: enum Status { Active, Inactive };
   * Example: enum class Color { Red, Green, Blue };
   */
  private extractEnum(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    return this.createSymbol(node, name, 'enum');
  }

  /**
   * Extract function definition
   * Example: void calculate(int x, int y) { }
   * Example: double Calculator::add(double a, double b) { }
   * Example (Metal): kernel void computeShader(...) { }
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const declarator = node.childForFieldName('declarator');
    if (!declarator) return null;

    // Handle different types of declarators
    let name = this.extractFunctionName(declarator);
    if (!name) return null;

    // Check for Metal shader qualifiers
    const text = node.text;
    const isKernel = text.includes('kernel ');    // Metal compute shader
    const isVertex = text.includes('vertex ');    // Metal vertex shader
    const isFragment = text.includes('fragment '); // Metal fragment shader

    const metadata: Record<string, any> = {};
    if (isKernel) metadata.metalKernel = true;
    if (isVertex) metadata.metalVertex = true;
    if (isFragment) metadata.metalFragment = true;

    // Check if it's a member function (contains ::)
    if (name.includes('::')) {
      return this.createSymbol(node, name, 'method', Object.keys(metadata).length > 0 ? metadata : undefined);
    }

    return this.createSymbol(node, name, 'function', Object.keys(metadata).length > 0 ? metadata : undefined);
  }

  /**
   * Extract function name from declarator node
   */
  private extractFunctionName(declarator: Parser.SyntaxNode): string | null {
    // Handle function_declarator
    if (declarator.type === 'function_declarator') {
      const nameNode = declarator.childForFieldName('declarator');
      if (nameNode) {
        return this.extractIdentifier(nameNode);
      }
    }

    // Handle qualified_identifier (for member functions)
    if (declarator.type === 'qualified_identifier') {
      return declarator.text;
    }

    // Handle identifier
    if (declarator.type === 'identifier') {
      return declarator.text;
    }

    // Recursively search for the function name
    for (let i = 0; i < declarator.childCount; i++) {
      const child = declarator.child(i);
      if (child) {
        const result = this.extractFunctionName(child);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Extract identifier from node
   */
  private extractIdentifier(node: Parser.SyntaxNode): string | null {
    if (node.type === 'identifier') {
      return node.text;
    }

    if (node.type === 'qualified_identifier') {
      return node.text;
    }

    if (node.type === 'field_identifier') {
      return node.text;
    }

    // Search children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const result = this.extractIdentifier(child);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Extract declaration (variables, constants, function declarations)
   * Example: const int MAX_SIZE = 100;
   * Example: extern void calculate(int x);
   */
  private extractDeclaration(node: Parser.SyntaxNode): Symbol | null {
    // Look for variable declarations with const modifier
    // In C++, const can be in the type specifier or as a storage class specifier
    const hasConst = this.hasConstQualifier(node);

    // Get declarator
    const declarator = node.childForFieldName('declarator');
    if (!declarator) return null;

    const name = this.extractVariableName(declarator);
    if (!name) return null;

    if (hasConst) {
      return this.createSymbol(node, name, 'constant');
    }

    return null; // Skip non-const declarations for now
  }

  /**
   * Extract variable name from declarator
   */
  private extractVariableName(declarator: Parser.SyntaxNode): string | null {
    if (declarator.type === 'identifier') {
      return declarator.text;
    }

    if (declarator.type === 'init_declarator') {
      const nameNode = declarator.childForFieldName('declarator');
      if (nameNode) {
        return this.extractVariableName(nameNode);
      }
    }

    // Search children
    for (let i = 0; i < declarator.childCount; i++) {
      const child = declarator.child(i);
      if (child && child.type === 'identifier') {
        return child.text;
      }
    }

    return null;
  }

  /**
   * Check if declaration has const qualifier
   * Recursively searches type specifiers for const
   */
  private hasConstQualifier(node: Parser.SyntaxNode): boolean {
    // Check direct children for const
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;

      // Found const directly
      if (child.type === 'const' || child.type === 'type_qualifier') {
        if (child.text === 'const' || child.text.includes('const')) {
          return true;
        }
      }

      // Check within type specifier nodes
      if (child.type === 'type_specifier' || child.type === 'qualified_type') {
        if (this.hasConstInNode(child)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Recursively check if node contains const
   */
  private hasConstInNode(node: Parser.SyntaxNode): boolean {
    if (node.type === 'type_qualifier' && node.text === 'const') {
      return true;
    }

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && this.hasConstInNode(child)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if node has a specific modifier
   */
  private hasModifier(node: Parser.SyntaxNode, modifier: string): boolean {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === modifier) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract template declaration
   * Example: template<typename T> class Container { };
   * Example: template<typename T> T max(T a, T b) { }
   */
  private extractTemplate(node: Parser.SyntaxNode): Symbol | null {
    // Find the actual declaration inside the template
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;

      // Recursively extract the templated declaration
      if (child.type === 'class_specifier') {
        return this.extractClass(child);
      }
      if (child.type === 'struct_specifier') {
        return this.extractStruct(child);
      }
      if (child.type === 'function_definition') {
        return this.extractFunction(child);
      }
    }

    return null;
  }

  /**
   * Extract namespace definition
   * Example: namespace math { }
   * Example: namespace std::chrono { }
   */
  private extractNamespace(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    return this.createSymbol(node, name, 'module');
  }
}
