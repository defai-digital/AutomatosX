/**
 * Document Symbols Provider
 *
 * Provides document symbols for outline view and navigation.
 * Extracts all symbols from a document using Tree-sitter AST.
 * Returns hierarchical DocumentSymbol[] with nested children.
 */

import type { DocumentSymbol as LSPDocumentSymbol } from 'vscode-languageserver/node.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
import type { SyntaxNode } from 'web-tree-sitter';
import { nodeToRange, uriToFilePath } from '../utils/lsp-utils.js';
import { mapSymbolKind } from '../types/lsp-types.js';
import type { Range } from '../types/lsp-types.js';

/**
 * Document Symbols Provider
 * Extracts and organizes symbols for outline view
 */
export class DocumentSymbolsProvider {
  constructor(
    private documentManager: DocumentManager,
    private integrationService: IntegrationService
  ) {}

  /**
   * Provide document symbols for a URI
   */
  async provideDocumentSymbols(uri: string): Promise<LSPDocumentSymbol[] | null> {
    try {
      const tree = this.documentManager.getDocumentTree(uri);
      const content = this.documentManager.getDocumentText(uri);

      if (!tree || !content) {
        return null;
      }

      const filePath = uriToFilePath(uri);
      const symbols = this.extractSymbols(tree.rootNode, content, filePath);

      return symbols;
    } catch (error) {
      console.error(`Error providing document symbols for ${uri}:`, error);
      return null;
    }
  }

  /**
   * Extract symbols from AST node recursively
   */
  private extractSymbols(
    node: SyntaxNode,
    content: string,
    filePath: string,
    parent?: LSPDocumentSymbol
  ): LSPDocumentSymbol[] {
    const symbols: LSPDocumentSymbol[] = [];

    // Extract symbol from current node
    const symbol = this.extractSymbol(node, content, filePath);

    if (symbol) {
      // Extract children recursively
      const children: LSPDocumentSymbol[] = [];

      for (const child of node.children) {
        if (this.isSymbolNode(child)) {
          const childSymbols = this.extractSymbols(child, content, filePath, symbol);
          children.push(...childSymbols);
        }
      }

      // Set children
      if (children.length > 0) {
        symbol.children = children;
      }

      symbols.push(symbol);
    } else {
      // No symbol at this level, check children
      for (const child of node.children) {
        const childSymbols = this.extractSymbols(child, content, filePath, parent);
        symbols.push(...childSymbols);
      }
    }

    return symbols;
  }

  /**
   * Extract symbol from a single AST node
   */
  private extractSymbol(
    node: SyntaxNode,
    content: string,
    filePath: string
  ): LSPDocumentSymbol | null {
    const symbolInfo = this.getSymbolInfo(node, content);

    if (!symbolInfo) {
      return null;
    }

    const { name, kind, detail } = symbolInfo;

    // Get range (entire symbol)
    const range = nodeToRange(node);

    // Get selection range (name only)
    const selectionRange = this.getNameRange(node, name) || range;

    return {
      name,
      kind: mapSymbolKind(kind),
      range,
      selectionRange,
      detail,
    };
  }

  /**
   * Get symbol information from node
   */
  private getSymbolInfo(
    node: SyntaxNode,
    content: string
  ): { name: string; kind: string; detail?: string } | null {
    const nodeType = node.type;

    // TypeScript/JavaScript symbols
    if (nodeType === 'function_declaration') {
      const nameNode = node.childForFieldName('name');
      if (!nameNode) return null;

      return {
        name: nameNode.text,
        kind: 'function',
        detail: this.getFunctionSignature(node),
      };
    }

    if (nodeType === 'class_declaration') {
      const nameNode = node.childForFieldName('name');
      if (!nameNode) return null;

      return {
        name: nameNode.text,
        kind: 'class',
        detail: this.getClassDetail(node),
      };
    }

    if (nodeType === 'interface_declaration') {
      const nameNode = node.childForFieldName('name');
      if (!nameNode) return null;

      return {
        name: nameNode.text,
        kind: 'interface',
      };
    }

    if (nodeType === 'type_alias_declaration') {
      const nameNode = node.childForFieldName('name');
      if (!nameNode) return null;

      return {
        name: nameNode.text,
        kind: 'interface', // Use interface kind for type aliases
      };
    }

    if (nodeType === 'enum_declaration') {
      const nameNode = node.childForFieldName('name');
      if (!nameNode) return null;

      return {
        name: nameNode.text,
        kind: 'enum',
      };
    }

    if (nodeType === 'method_definition') {
      const nameNode = node.childForFieldName('name');
      if (!nameNode) return null;

      return {
        name: nameNode.text,
        kind: 'method',
        detail: this.getFunctionSignature(node),
      };
    }

    if (nodeType === 'lexical_declaration' || nodeType === 'variable_declaration') {
      // Extract variable names from declarators
      const declarators = node.descendantsOfType('variable_declarator');
      if (declarators.length > 0) {
        const nameNode = declarators[0].childForFieldName('name');
        if (nameNode) {
          const isConst = node.text.startsWith('const');
          return {
            name: nameNode.text,
            kind: isConst ? 'constant' : 'variable',
          };
        }
      }
    }

    if (nodeType === 'import_statement') {
      const importClause = node.childForFieldName('import_clause');
      if (importClause) {
        return {
          name: importClause.text,
          kind: 'module',
        };
      }
    }

    // Python symbols
    if (nodeType === 'function_definition') {
      const nameNode = node.childForFieldName('name');
      if (!nameNode) return null;

      return {
        name: nameNode.text,
        kind: 'function',
        detail: this.getPythonFunctionSignature(node),
      };
    }

    if (nodeType === 'class_definition') {
      const nameNode = node.childForFieldName('name');
      if (!nameNode) return null;

      return {
        name: nameNode.text,
        kind: 'class',
      };
    }

    return null;
  }

  /**
   * Get function signature for detail
   */
  private getFunctionSignature(node: SyntaxNode): string {
    const params = node.childForFieldName('parameters');
    const returnType = node.childForFieldName('return_type');

    let signature = '';

    if (params) {
      signature += params.text;
    }

    if (returnType) {
      signature += ': ' + returnType.text;
    }

    return signature;
  }

  /**
   * Get Python function signature
   */
  private getPythonFunctionSignature(node: SyntaxNode): string {
    const params = node.childForFieldName('parameters');
    const returnType = node.childForFieldName('return_type');

    let signature = '';

    if (params) {
      signature += params.text;
    }

    if (returnType) {
      signature += ' -> ' + returnType.text;
    }

    return signature;
  }

  /**
   * Get class detail (extends, implements)
   */
  private getClassDetail(node: SyntaxNode): string | undefined {
    const heritage = node.childForFieldName('heritage');
    if (heritage) {
      return heritage.text;
    }
    return undefined;
  }

  /**
   * Get range for symbol name
   */
  private getNameRange(node: SyntaxNode, name: string): Range | null {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return nodeToRange(nameNode);
    }

    // Fallback: search for name in node text
    const nameIndex = node.text.indexOf(name);
    if (nameIndex >= 0) {
      const range = nodeToRange(node);
      return {
        start: {
          line: range.start.line,
          character: range.start.character + nameIndex,
        },
        end: {
          line: range.start.line,
          character: range.start.character + nameIndex + name.length,
        },
      };
    }

    return null;
  }

  /**
   * Check if node represents a symbol
   */
  private isSymbolNode(node: SyntaxNode): boolean {
    const symbolNodeTypes = [
      'function_declaration',
      'class_declaration',
      'interface_declaration',
      'type_alias_declaration',
      'enum_declaration',
      'method_definition',
      'lexical_declaration',
      'variable_declaration',
      'import_statement',
      // Python
      'function_definition',
      'class_definition',
    ];

    return symbolNodeTypes.includes(node.type);
  }
}
