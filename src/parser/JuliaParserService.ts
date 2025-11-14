/**
 * JuliaParserService.ts
 *
 * Julia language parser using Tree-sitter
 * Extracts symbols from Julia scientific computing code
 *
 * Julia is a high-performance language for scientific computing,
 * machine learning, and data science.
 */

import Parser from 'tree-sitter';
import Julia from 'tree-sitter-julia';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * JuliaParserService - Extracts symbols from Julia code
 */
export class JuliaParserService extends BaseLanguageParser {
  readonly language = 'julia';
  readonly extensions = ['.jl'];

  constructor() {
    super(Julia as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_definition':
      case 'short_function_definition':
        return this.extractFunction(node);

      case 'macro_definition':
        return this.extractMacro(node);

      case 'struct_definition':
        return this.extractStruct(node);

      case 'abstract_definition':
        return this.extractAbstract(node);

      case 'module_definition':
        return this.extractModule(node);

      case 'assignment':
        return this.extractAssignment(node);

      case 'const_statement':
        return this.extractConst(node);

      default:
        return null;
    }
  }

  /**
   * Extract function definition
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    // Get function signature
    const signature = node.childForFieldName('signature');
    if (!signature) return null;

    // Extract function name
    const name = this.extractFunctionName(signature);
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract function name from signature
   */
  private extractFunctionName(signature: Parser.SyntaxNode): string | null {
    // Handle call_expression (for parametric functions)
    if (signature.type === 'call_expression') {
      const func = signature.descendantsOfType('identifier')[0];
      return func ? func.text : null;
    }

    // Handle typed_expression (for typed signatures)
    if (signature.type === 'typed_expression') {
      const identifiers = signature.descendantsOfType('identifier');
      return identifiers.length > 0 ? identifiers[0].text : null;
    }

    // Handle direct identifier
    const identifiers = signature.descendantsOfType('identifier');
    if (identifiers.length > 0) {
      return identifiers[0].text;
    }

    return signature.text;
  }

  /**
   * Extract macro definition
   */
  private extractMacro(node: Parser.SyntaxNode): Symbol | null {
    const signature = node.childForFieldName('signature');
    if (!signature) return null;

    // Get macro name (starts with @)
    const identifiers = signature.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    const name = identifiers[0].text;

    return this.createSymbol(node, name, 'function', { isMacro: true });
  }

  /**
   * Extract struct definition
   */
  private extractStruct(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'struct');
  }

  /**
   * Extract abstract type definition
   */
  private extractAbstract(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'type');
  }

  /**
   * Extract module definition
   */
  private extractModule(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'module');
  }

  /**
   * Extract assignment (global variables)
   */
  private extractAssignment(node: Parser.SyntaxNode): Symbol | null {
    const left = node.childForFieldName('left');
    if (!left) return null;

    // Only extract top-level assignments
    const parent = node.parent;
    if (!parent || parent.type !== 'source_file') return null;

    // Get variable name
    const identifiers = left.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    const name = identifiers[0].text;

    return this.createSymbol(node, name, 'variable');
  }

  /**
   * Extract const declaration
   */
  private extractConst(node: Parser.SyntaxNode): Symbol | null {
    const assignment = node.descendantsOfType('assignment')[0];
    if (!assignment) return null;

    const left = assignment.childForFieldName('left');
    if (!left) return null;

    const identifiers = left.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    const name = identifiers[0].text;

    return this.createSymbol(node, name, 'constant');
  }
}
