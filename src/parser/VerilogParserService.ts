/**
 * VerilogParserService.ts
 *
 * Verilog HDL parser using Tree-sitter
 * Extracts symbols from Verilog hardware description language source code
 *
 * Verilog is used for FPGA and ASIC design.
 */

import Parser from 'tree-sitter';
import Verilog from 'tree-sitter-verilog';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * VerilogParserService - Extracts symbols from Verilog code
 */
export class VerilogParserService extends BaseLanguageParser {
  readonly language = 'verilog';
  readonly extensions = ['.v', '.vh'];

  constructor() {
    super(Verilog as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'module_declaration':
        return this.extractModule(node);

      case 'task_declaration':
        return this.extractTask(node);

      case 'function_declaration':
        return this.extractFunction(node);

      case 'net_declaration':
      case 'reg_declaration':
        return this.extractVariable(node);

      case 'parameter_declaration':
      case 'localparam_declaration':
        return this.extractParameter(node);

      default:
        return null;
    }
  }

  /**
   * Extract module declaration
   */
  private extractModule(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'module');
  }

  /**
   * Extract task declaration
   */
  private extractTask(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract function declaration
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract variable declaration (net or reg)
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    // Get list of identifiers
    const identifiers = node.descendantsOfType('simple_identifier');
    if (identifiers.length === 0) return null;

    // Take the first identifier
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
}
