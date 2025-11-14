/**
 * GoParserService.ts
 *
 * Go language parser using Tree-sitter
 * Extracts symbols from Go source code
 */

import Parser from 'tree-sitter';
import Go from 'tree-sitter-go';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * GoParserService - Extracts symbols from Go code
 */
export class GoParserService extends BaseLanguageParser {
  readonly language = 'go';
  readonly extensions = ['.go'];

  constructor() {
    super(Go as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_declaration':
        return this.extractFunction(node);

      case 'method_declaration':
        return this.extractMethod(node);

      case 'type_declaration':
        return this.extractTypeDeclaration(node);

      case 'const_declaration':
        return this.extractConstant(node);

      case 'var_declaration':
        return this.extractVariable(node);

      default:
        return null;
    }
  }

  /**
   * Extract function declaration (package-level functions)
   * Example: func NewCalculator() *Calculator { ... }
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract method declaration (methods with receivers)
   * Example: func (c *Calculator) Add(a, b float64) float64 { ... }
   */
  private extractMethod(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    // Get receiver to include in symbol name (optional enhancement)
    const receiver = node.childForFieldName('receiver');
    let fullName = name;

    if (receiver) {
      // Extract receiver type (e.g., "*Calculator" or "Calculator")
      const receiverType = receiver.descendantsOfType('type_identifier')[0] ||
                          receiver.descendantsOfType('pointer_type')[0]?.descendantsOfType('type_identifier')[0];

      if (receiverType) {
        fullName = `(${receiverType.text}).${name}`;
      }
    }

    return this.createSymbol(node, fullName, 'method');
  }

  /**
   * Extract type declaration (struct, interface, type alias)
   * Go uses type_declaration which contains type_spec children
   * Example: type Calculator struct { ... }
   * Example: type Adder interface { ... }
   * Example: type String string
   */
  private extractTypeDeclaration(node: Parser.SyntaxNode): Symbol | null {
    // type_declaration contains one or more type_spec
    const typeSpecs = node.descendantsOfType('type_spec');

    const symbols: Symbol[] = [];

    for (const spec of typeSpecs) {
      // Get name - it's the first type_identifier child
      const nameNode = spec.childForFieldName('name') ||
                       spec.descendantsOfType('type_identifier')[0];
      if (!nameNode) continue;

      const name = nameNode.text;

      // Determine the kind based on the type
      const typeNode = spec.childForFieldName('type') ||
                       spec.namedChild(1); // type is usually second child after name
      let kind: SymbolKind = 'type';

      if (typeNode) {
        switch (typeNode.type) {
          case 'struct_type':
            kind = 'struct';
            break;
          case 'interface_type':
            kind = 'interface';
            break;
          default:
            kind = 'type'; // Type alias
        }
      }

      symbols.push(this.createSymbol(spec, name, kind));
    }

    // Return the first symbol (most common case is single type per declaration)
    return symbols[0] || null;
  }

  /**
   * Extract constant declaration
   * Example: const StatusOK StatusCode = 200
   * Example: const ( ... )
   */
  private extractConstant(node: Parser.SyntaxNode): Symbol | null {
    // const_declaration can have multiple const_spec children
    const constSpecs = node.descendantsOfType('const_spec');

    const symbols: Symbol[] = [];

    for (const spec of constSpecs) {
      // Get name - it's an identifier node
      const nameNode = spec.childForFieldName('name') ||
                       spec.descendantsOfType('identifier')[0];
      if (!nameNode) continue;

      const name = nameNode.text;
      symbols.push(this.createSymbol(spec, name, 'constant'));
    }

    // Return first symbol (handle multiple constants separately in tree walk)
    return symbols[0] || null;
  }

  /**
   * Extract variable declaration
   * Example: var timeout time.Duration
   * Example: var ( ... )
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    // var_declaration can have multiple var_spec children
    const varSpecs = node.descendantsOfType('var_spec');

    const symbols: Symbol[] = [];

    for (const spec of varSpecs) {
      // Get name - it's an identifier node
      const nameNode = spec.childForFieldName('name') ||
                       spec.descendantsOfType('identifier')[0];
      if (!nameNode) continue;

      const name = nameNode.text;
      symbols.push(this.createSymbol(spec, name, 'variable'));
    }

    // Return first symbol
    return symbols[0] || null;
  }
}
