/**
 * HclParserService.ts
 *
 * HCL (HashiCorp Configuration Language) parser using Tree-sitter
 * Extracts symbols from Terraform, Vault, Waypoint, and Nomad configurations
 */

import Parser from 'tree-sitter';
import Hcl from '@tree-sitter-grammars/tree-sitter-hcl';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * HclParserService - Extracts symbols from HCL/Terraform code
 */
export class HclParserService extends BaseLanguageParser {
  readonly language = 'hcl';
  readonly extensions = ['.tf', '.hcl', '.nomad'];

  constructor() {
    super(Hcl as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'block':
        return this.extractBlock(node);

      case 'attribute':
        return this.extractAttribute(node);

      case 'variable_declaration':
        return this.extractVariable(node);

      case 'output_declaration':
        return this.extractOutput(node);

      case 'resource_declaration':
        return this.extractResource(node);

      case 'data_declaration':
        return this.extractData(node);

      case 'module_declaration':
        return this.extractModule(node);

      case 'locals_declaration':
        return this.extractLocals(node);

      default:
        return null;
    }
  }

  /**
   * Extract generic block (terraform, provider, etc.)
   */
  private extractBlock(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    const blockType = identifiers[0].text;
    const name = identifiers.length > 1 ? identifiers[1].text : blockType;

    // Determine symbol kind based on block type
    let kind: SymbolKind = 'module';
    if (blockType === 'resource') kind = 'class';
    else if (blockType === 'data') kind = 'constant';
    else if (blockType === 'module') kind = 'module';
    else if (blockType === 'provider') kind = 'module';

    return this.createSymbol(node, name, kind);
  }

  /**
   * Extract attribute/variable assignment
   */
  private extractAttribute(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    return this.createSymbol(node, identifiers[0].text, 'variable');
  }

  /**
   * Extract variable declaration
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    return this.createSymbol(node, identifiers[0].text, 'variable');
  }

  /**
   * Extract output declaration
   */
  private extractOutput(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    return this.createSymbol(node, identifiers[0].text, 'constant');
  }

  /**
   * Extract resource declaration
   */
  private extractResource(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('identifier');
    if (identifiers.length < 2) return null;

    // resource "aws_instance" "web" { ... }
    // identifiers[0] = resource type, identifiers[1] = resource name
    const resourceType = identifiers[0].text;
    const resourceName = identifiers[1].text;

    return this.createSymbol(node, `${resourceType}.${resourceName}`, 'class');
  }

  /**
   * Extract data source declaration
   */
  private extractData(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('identifier');
    if (identifiers.length < 2) return null;

    const dataType = identifiers[0].text;
    const dataName = identifiers[1].text;

    return this.createSymbol(node, `${dataType}.${dataName}`, 'constant');
  }

  /**
   * Extract module declaration
   */
  private extractModule(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    return this.createSymbol(node, identifiers[0].text, 'module');
  }

  /**
   * Extract locals block
   */
  private extractLocals(node: Parser.SyntaxNode): Symbol | null {
    const identifiers = node.descendantsOfType('identifier');
    if (identifiers.length === 0) return null;

    return this.createSymbol(node, 'locals', 'constant');
  }
}
