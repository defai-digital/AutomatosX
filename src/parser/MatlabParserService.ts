/**
 * MatlabParserService.ts
 *
 * MATLAB language parser using Tree-sitter
 * Extracts symbols from MATLAB technical computing code
 *
 * MATLAB is used for numerical computing, algorithm development,
 * data analysis, and visualization.
 */

import Parser from 'tree-sitter';
import Matlab from 'tree-sitter-matlab';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * MatlabParserService - Extracts symbols from MATLAB code
 */
export class MatlabParserService extends BaseLanguageParser {
  readonly language = 'matlab';
  readonly extensions = ['.m'];

  constructor() {
    super(Matlab as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_definition':
        return this.extractFunction(node);

      case 'class_definition':
        return this.extractClass(node);

      case 'properties_block':
        return this.extractProperty(node);

      case 'methods_block':
        return this.extractMethod(node);

      case 'assignment':
        return this.extractAssignment(node);

      default:
        return null;
    }
  }

  /**
   * Extract function definition
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    // Get function name from output arguments or identifier
    const functionOutput = node.childForFieldName('function_output');

    if (functionOutput) {
      const identifiers = functionOutput.descendantsOfType('identifier');
      if (identifiers.length > 0) {
        return this.createSymbol(node, identifiers[0].text, 'function');
      }
    }

    // Fallback to looking for any identifier
    const identifiers = node.descendantsOfType('identifier');
    if (identifiers.length > 0) {
      return this.createSymbol(node, identifiers[0].text, 'function');
    }

    return null;
  }

  /**
   * Extract class definition
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    return this.createSymbol(node, identifiers[0].text, 'class');
  }

  /**
   * Extract property from properties block
   */
  private extractProperty(node: Parser.SyntaxNode): Symbol | null {
    const assignments = node.descendantsOfType('assignment');
    if (assignments.length === 0) return null;

    const left = assignments[0].childForFieldName('left');
    if (!left) return null;

    const identifiers = left.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    return this.createSymbol(node, identifiers[0].text, 'variable');
  }

  /**
   * Extract method from methods block
   */
  private extractMethod(node: Parser.SyntaxNode): Symbol | null {
    const functions = node.descendantsOfType('function_definition');
    if (functions.length === 0) return null;

    return this.extractFunction(functions[0]);
  }

  /**
   * Extract assignment (global variables/constants)
   */
  private extractAssignment(node: Parser.SyntaxNode): Symbol | null {
    // Only extract top-level assignments
    const parent = node.parent;
    if (!parent || parent.type !== 'source_file') return null;

    const left = node.childForFieldName('left');
    if (!left) return null;

    const identifiers = left.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    return this.createSymbol(node, identifiers[0].text, 'variable');
  }
}
