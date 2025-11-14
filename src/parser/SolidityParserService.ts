/**
 * SolidityParserService.ts
 *
 * Solidity language parser using Tree-sitter
 * Extracts symbols from Ethereum smart contract code
 */

import Parser from 'tree-sitter';
import Solidity from 'tree-sitter-solidity';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * SolidityParserService - Extracts symbols from Solidity smart contracts
 */
export class SolidityParserService extends BaseLanguageParser {
  readonly language = 'solidity';
  readonly extensions = ['.sol'];

  constructor() {
    super(Solidity as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'contract_declaration':
        return this.extractContract(node);

      case 'interface_declaration':
        return this.extractInterface(node);

      case 'library_declaration':
        return this.extractLibrary(node);

      case 'function_definition':
      case 'constructor_definition':
      case 'fallback_receive_definition':
        return this.extractFunction(node);

      case 'modifier_definition':
        return this.extractModifier(node);

      case 'event_definition':
        return this.extractEvent(node);

      case 'struct_declaration':
        return this.extractStruct(node);

      case 'enum_declaration':
        return this.extractEnum(node);

      case 'state_variable_declaration':
        return this.extractStateVariable(node);

      default:
        return null;
    }
  }

  /**
   * Extract contract declaration
   */
  private extractContract(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'class');
  }

  /**
   * Extract interface declaration
   */
  private extractInterface(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'interface');
  }

  /**
   * Extract library declaration
   */
  private extractLibrary(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'module');
  }

  /**
   * Extract function, constructor, or fallback/receive
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) {
      // Constructor, fallback, or receive
      if (node.type === 'constructor_definition') {
        return this.createSymbol(node, 'constructor', 'method');
      } else if (node.type === 'fallback_receive_definition') {
        const text = node.text;
        const name = text.includes('fallback') ? 'fallback' : 'receive';
        return this.createSymbol(node, name, 'method');
      }
      return null;
    }

    return this.createSymbol(node, nameNode.text, 'function');
  }

  /**
   * Extract modifier definition
   */
  private extractModifier(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'function');
  }

  /**
   * Extract event definition
   */
  private extractEvent(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'constant');
  }

  /**
   * Extract struct declaration
   */
  private extractStruct(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'struct');
  }

  /**
   * Extract enum declaration
   */
  private extractEnum(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name') ||
                     node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    return this.createSymbol(node, nameNode.text, 'enum');
  }

  /**
   * Extract state variable declaration
   */
  private extractStateVariable(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.descendantsOfType('identifier')[0];

    if (!nameNode) return null;

    // Check if it's a constant
    const text = node.text;
    const kind: SymbolKind = text.includes('constant') ? 'constant' : 'variable';

    return this.createSymbol(node, nameNode.text, kind);
  }
}
