/**
 * AssemblyScriptParserService.ts
 *
 * AssemblyScript language parser using TypeScript Tree-sitter grammar
 * Extracts symbols from AssemblyScript source code
 *
 * AssemblyScript is a TypeScript-like language that compiles to WebAssembly.
 * It uses TypeScript syntax but with WebAssembly-specific features:
 * - WebAssembly primitive types (i32, i64, f32, f64, u32, u64, etc.)
 * - @inline, @external, @unsafe decorators
 * - Memory management operations
 * - Strict typing for WASM compatibility
 */

import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * AssemblyScriptParserService - Extracts symbols from AssemblyScript code
 *
 * Uses TypeScript Tree-sitter grammar since AssemblyScript is TypeScript syntax.
 *
 * Supported Features:
 * - Functions (with WASM types: i32, i64, f32, f64, etc.)
 * - Classes (compiled to WebAssembly linear memory)
 * - Exports (compiled to WASM exports)
 * - Decorators (@inline, @external, @unsafe)
 * - WebAssembly-specific APIs (memory operations)
 * - Namespaces/modules
 * - Type declarations
 *
 * File Extensions:
 * - .as.ts (AssemblyScript-specific convention to distinguish from regular TypeScript)
 *
 * Note: AssemblyScript is a strict subset of TypeScript optimized for WebAssembly.
 * All TypeScript syntax works, but with restrictions:
 * - No dynamic typing (everything must be statically typed)
 * - Limited standard library (WebAssembly-compatible only)
 * - Manual memory management for advanced use cases
 *
 * Note: Regular .ts files are handled by TypeScriptParserService.
 * Use .as.ts extension to explicitly mark AssemblyScript files.
 */
export class AssemblyScriptParserService extends BaseLanguageParser {
  readonly language = 'assemblyscript';
  readonly extensions = ['.as.ts'];

  constructor() {
    // Use TypeScript TSX grammar (same as TypeScriptParserService)
    // AssemblyScript uses TypeScript syntax
    super(TypeScript.tsx);
  }

  /**
   * Extract symbol from AST node
   * Reuses TypeScript patterns since AssemblyScript IS TypeScript syntax
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_declaration':
        return this.extractFunction(node);

      case 'ambient_declaration':
        return this.extractAmbientDeclaration(node);

      case 'class_declaration':
        return this.extractClass(node);

      case 'interface_declaration':
        return this.extractInterface(node);

      case 'type_alias_declaration':
        return this.extractTypeAlias(node);

      case 'lexical_declaration': // const, let
        return this.extractVariable(node);

      case 'variable_declaration': // var
        return this.extractVariable(node);

      case 'method_definition':
        return this.extractMethod(node);

      case 'enum_declaration':
        return this.extractEnum(node);

      default:
        return null;
    }
  }

  /**
   * Extract function declaration
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.descendantsOfType('identifier')[0];
    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'function');
  }

  /**
   * Extract ambient declaration (declare function, declare class, etc.)
   * Used for @external declarations in AssemblyScript
   */
  private extractAmbientDeclaration(node: Parser.SyntaxNode): Symbol | null {
    // Check for function_signature (declare function)
    const functionSig = node.descendantsOfType('function_signature')[0];
    if (functionSig) {
      const nameNode = functionSig.descendantsOfType('identifier')[0];
      if (nameNode) {
        return this.createSymbol(functionSig, nameNode.text, 'function');
      }
    }

    // Check for class declaration
    const classDecl = node.descendantsOfType('class_declaration')[0];
    if (classDecl) {
      return this.extractClass(classDecl);
    }

    return null;
  }

  /**
   * Extract class declaration
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.descendantsOfType('type_identifier')[0];
    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'class');
  }

  /**
   * Extract interface declaration
   */
  private extractInterface(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.descendantsOfType('type_identifier')[0];
    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'interface');
  }

  /**
   * Extract type alias declaration
   */
  private extractTypeAlias(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.descendantsOfType('type_identifier')[0];
    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'interface');
  }

  /**
   * Extract variable/constant declaration
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    const declarators = node.descendantsOfType('variable_declarator');
    if (declarators.length === 0) return null;

    const nameNode = declarators[0].descendantsOfType('identifier')[0];
    if (!nameNode) return null;

    // Check if const or let/var
    const isConstant = node.text.trim().startsWith('const');
    const kind: SymbolKind = isConstant ? 'constant' : 'variable';

    return this.createSymbol(node, nameNode.text, kind);
  }

  /**
   * Extract method definition
   */
  private extractMethod(node: Parser.SyntaxNode): Symbol | null {
    // Find the class this method belongs to
    const classNode = this.findParentClass(node);
    if (!classNode) return null;

    const className = this.getClassName(classNode);
    if (!className) return null;

    const methodName = this.getMethodName(node);
    if (!methodName) return null;

    return this.createSymbol(node, `${className}.${methodName}`, 'method');
  }

  /**
   * Extract enum declaration
   */
  private extractEnum(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.descendantsOfType('identifier')[0];
    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'enum');
  }

  /**
   * Find parent class of a node
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

  /**
   * Get class name from class declaration
   */
  private getClassName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.descendantsOfType('type_identifier')[0];
    return nameNode ? nameNode.text : null;
  }

  /**
   * Get method name from method definition
   */
  private getMethodName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.descendantsOfType('property_identifier')[0];
    return nameNode ? nameNode.text : null;
  }
}
