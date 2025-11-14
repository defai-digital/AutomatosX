/**
 * SystemVerilogParserService.ts
 *
 * SystemVerilog HDL parser using Tree-sitter
 * Extracts symbols from SystemVerilog hardware description language source code
 *
 * SystemVerilog extends Verilog with OOP features, assertions, and testbench constructs.
 * Used for FPGA, ASIC design, and verification.
 */

import Parser from 'tree-sitter';
import SystemVerilog from 'tree-sitter-systemverilog';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * SystemVerilogParserService - Extracts symbols from SystemVerilog code
 */
export class SystemVerilogParserService extends BaseLanguageParser {
  readonly language = 'systemverilog';
  readonly extensions = ['.sv', '.svh'];

  constructor() {
    super(SystemVerilog as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'module_declaration':
        return this.extractModule(node);

      case 'class_declaration':
        return this.extractClass(node);

      case 'interface_declaration':
        return this.extractInterface(node);

      case 'package_declaration':
        return this.extractPackage(node);

      case 'task_declaration':
        return this.extractTask(node);

      case 'function_declaration':
        return this.extractFunction(node);

      case 'data_declaration':
      case 'net_declaration':
        return this.extractVariable(node);

      case 'parameter_declaration':
      case 'local_parameter_declaration':
        return this.extractParameter(node);

      case 'typedef_declaration':
        return this.extractTypedef(node);

      default:
        return null;
    }
  }

  /**
   * Extract module declaration
   */
  private extractModule(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('simple_identifier')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'module');
  }

  /**
   * Extract class declaration
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('class_identifier')[0]?.text ||
                 node.descendantsOfType('simple_identifier')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'class');
  }

  /**
   * Extract interface declaration
   */
  private extractInterface(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('interface_identifier')[0]?.text ||
                 node.descendantsOfType('simple_identifier')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'interface');
  }

  /**
   * Extract package declaration
   */
  private extractPackage(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('package_identifier')[0]?.text ||
                 node.descendantsOfType('simple_identifier')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'module');
  }

  /**
   * Extract task declaration
   */
  private extractTask(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('task_identifier')[0]?.text ||
                 node.descendantsOfType('simple_identifier')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract function declaration
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name') ||
                 node.descendantsOfType('function_identifier')[0]?.text ||
                 node.descendantsOfType('simple_identifier')[0]?.text;
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract variable declaration
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('simple_identifier');
    if (identifiers.length === 0) return null;

    const name = identifiers[0].text;

    return this.createSymbol(node, name, 'variable');
  }

  /**
   * Extract parameter declaration
   */
  private extractParameter(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('simple_identifier');
    if (identifiers.length === 0) return null;

    const name = identifiers[0].text;

    return this.createSymbol(node, name, 'constant');
  }

  /**
   * Extract typedef declaration
   */
  private extractTypedef(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('type_identifier');
    if (identifiers.length === 0) {
      // Fallback to simple_identifier
      const simpleIds = node.descendantsOfType('simple_identifier');
      if (simpleIds.length === 0) return null;
      const name = simpleIds[simpleIds.length - 1].text; // Last identifier is usually the typedef name
      return this.createSymbol(node, name, 'type');
    }

    const name = identifiers[0].text;

    return this.createSymbol(node, name, 'type');
  }
}
