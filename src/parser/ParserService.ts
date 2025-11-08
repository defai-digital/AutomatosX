/**
 * ParserService.ts
 *
 * Code parsing service using Tree-sitter
 * Extracts symbols from source code files
 */

import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

/**
 * Symbol extracted from source code
 */
export interface Symbol {
  name: string;
  kind: SymbolKind;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/**
 * Symbol types we extract
 */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'variable'
  | 'constant'
  | 'method';

/**
 * Parse result
 */
export interface ParseResult {
  symbols: Symbol[];
  parseTime: number; // milliseconds
  nodeCount: number;
}

/**
 * ParserService - Extracts symbols from source code
 */
export class ParserService {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    // Use TypeScript grammar (handles both .ts and .tsx)
    this.parser.setLanguage(TypeScript.typescript);
  }

  /**
   * Parse TypeScript/JavaScript code and extract symbols
   *
   * @param content - Source code content
   * @returns Parse result with extracted symbols
   */
  parseTypeScript(content: string): ParseResult {
    const startTime = performance.now();

    const tree = this.parser.parse(content);
    const symbols: Symbol[] = [];

    // Walk the AST and extract symbols
    this.walkTree(tree.rootNode, symbols);

    const endTime = performance.now();

    return {
      symbols,
      parseTime: endTime - startTime,
      nodeCount: tree.rootNode.descendantCount,
    };
  }

  /**
   * Walk AST tree and extract symbols
   */
  private walkTree(node: Parser.SyntaxNode, symbols: Symbol[]): void {
    // Extract symbol based on node type
    const symbol = this.extractSymbol(node);
    if (symbol) {
      symbols.push(symbol);
    }

    // Recursively walk children
    for (const child of node.children) {
      this.walkTree(child, symbols);
    }
  }

  /**
   * Extract symbol from AST node
   */
  private extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_declaration':
        return this.extractFunction(node);

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

      default:
        return null;
    }
  }

  /**
   * Extract function declaration
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    return {
      name: nameNode.text,
      kind: 'function',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    };
  }

  /**
   * Extract class declaration
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    return {
      name: nameNode.text,
      kind: 'class',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    };
  }

  /**
   * Extract interface declaration
   */
  private extractInterface(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    return {
      name: nameNode.text,
      kind: 'interface',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    };
  }

  /**
   * Extract type alias declaration
   */
  private extractTypeAlias(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    return {
      name: nameNode.text,
      kind: 'type',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    };
  }

  /**
   * Extract variable/constant declaration
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    // Get the declarator (the actual variable name + value)
    const declarator = node.descendantsOfType('variable_declarator')[0];
    if (!declarator) return null;

    const nameNode = declarator.childForFieldName('name');
    if (!nameNode) return null;

    // Determine if const or let/var
    const parent = node.parent;
    const isConst = parent?.text.startsWith('const') || node.text.startsWith('const');

    return {
      name: nameNode.text,
      kind: isConst ? 'constant' : 'variable',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    };
  }

  /**
   * Extract method definition (class method)
   */
  private extractMethod(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    return {
      name: nameNode.text,
      kind: 'method',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    };
  }
}
