/**
 * Hover Provider
 *
 * Implements textDocument/hover LSP request.
 * Provides hover information (signature, docs, type) for symbols.
 */

import type { Hover, Position, SymbolInfo } from '../types/lsp-types.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
import {
  uriToFilePath,
  getWordAtPosition,
  getIdentifierAtPosition,
  getNodeSignature,
  getNodeDocstring,
  createHoverMarkdown,
  formatSignature,
} from '../utils/lsp-utils.js';

/**
 * Hover Provider
 */
export class HoverProvider {
  constructor(
    private documentManager: DocumentManager,
    private integrationService: IntegrationService
  ) {}

  /**
   * Handle textDocument/hover request
   *
   * @param uri - Document URI
   * @param position - Cursor position
   * @returns Hover information or null
   */
  async provideHover(uri: string, position: Position): Promise<Hover | null> {
    try {
      const filePath = uriToFilePath(uri);
      const content = this.documentManager.getDocumentText(uri);

      if (!content) {
        return null;
      }

      // Get symbol at position
      const symbolName = this.getSymbolAtPosition(uri, position, content);
      if (!symbolName) {
        return null;
      }

      // Try to find symbol info from AST first
      const astHover = this.getHoverFromAST(uri, position, symbolName, content);
      if (astHover) {
        return astHover;
      }

      // Fall back to database lookup
      const dbHover = await this.getHoverFromDatabase(symbolName, filePath);
      if (dbHover) {
        return dbHover;
      }

      // Return basic hover with just the symbol name
      return {
        contents: `\`${symbolName}\``,
      };
    } catch (error) {
      console.error('Error in provideHover:', error);
      return null;
    }
  }

  /**
   * Get symbol name at position
   */
  private getSymbolAtPosition(uri: string, position: Position, content: string): string | null {
    // Try using Tree-sitter AST
    const tree = this.documentManager.getDocumentTree(uri);
    if (tree) {
      const identifierNode = getIdentifierAtPosition(tree.rootNode, position);
      if (identifierNode) {
        return identifierNode.text;
      }
    }

    // Fallback to text-based word extraction
    const word = getWordAtPosition(content, position);
    return word || null;
  }

  /**
   * Get hover information from AST
   */
  private getHoverFromAST(
    uri: string,
    position: Position,
    symbolName: string,
    content: string
  ): Hover | null {
    const tree = this.documentManager.getDocumentTree(uri);
    if (!tree) {
      return null;
    }

    // Find node at position
    const identifierNode = getIdentifierAtPosition(tree.rootNode, position);
    if (!identifierNode) {
      return null;
    }

    // Get signature from parent node
    const signature = getNodeSignature(identifierNode);

    // Get docstring
    const docstring = identifierNode.parent
      ? getNodeDocstring(identifierNode.parent, content)
      : null;

    if (!signature && !docstring) {
      return null;
    }

    // Format hover content
    const markdown = createHoverMarkdown({
      signature: signature || undefined,
      docstring: docstring || undefined,
      location: uriToFilePath(uri),
    });

    return {
      contents: markdown,
      range: {
        start: {
          line: identifierNode.startPosition.row,
          character: identifierNode.startPosition.column,
        },
        end: {
          line: identifierNode.endPosition.row,
          character: identifierNode.endPosition.column,
        },
      },
    };
  }

  /**
   * Get hover information from database
   */
  private async getHoverFromDatabase(
    symbolName: string,
    filePath: string
  ): Promise<Hover | null> {
    // Try to find symbol definition
    const symbol = await this.integrationService.findSymbolDefinition(symbolName, filePath);

    if (symbol) {
      return this.createHoverFromSymbol(symbol);
    }

    // Try finding any reference
    const symbols = await this.integrationService.findSymbolReferences(symbolName, true);
    if (symbols.length > 0) {
      return this.createHoverFromSymbol(symbols[0]);
    }

    return null;
  }

  /**
   * Create hover from symbol info
   */
  private createHoverFromSymbol(symbol: SymbolInfo): Hover {
    // Format signature
    const signature = symbol.signature || formatSignature(symbol);

    // Create location string
    const location = `${symbol.filePath}:${symbol.startLine + 1}:${symbol.startColumn + 1}`;

    // Format hover content
    const markdown = createHoverMarkdown({
      signature,
      docstring: symbol.docstring || undefined,
      location,
    });

    return {
      contents: markdown,
      range: {
        start: {
          line: symbol.startLine,
          character: symbol.startColumn,
        },
        end: {
          line: symbol.endLine,
          character: symbol.endColumn,
        },
      },
    };
  }

  /**
   * Provide hover for built-in symbols (keywords, standard library)
   */
  provideBuiltInHover(symbolName: string): Hover | null {
    const builtInDocs = this.getBuiltInDocs(symbolName);
    if (!builtInDocs) {
      return null;
    }

    return {
      contents: builtInDocs,
    };
  }

  /**
   * Get documentation for built-in symbols
   */
  private getBuiltInDocs(symbolName: string): string | null {
    // TypeScript/JavaScript keywords
    const tsKeywords: Record<string, string> = {
      const: '```typescript\nconst\n```\n\nDeclares a constant (read-only) variable.',
      let: '```typescript\nlet\n```\n\nDeclares a block-scoped variable.',
      var: '```typescript\nvar\n```\n\nDeclares a function-scoped or globally-scoped variable.',
      function: '```typescript\nfunction\n```\n\nDeclares a function.',
      class: '```typescript\nclass\n```\n\nDeclares a class.',
      interface:
        '```typescript\ninterface\n```\n\nDeclares an interface (TypeScript structural type).',
      type: '```typescript\ntype\n```\n\nDeclares a type alias.',
      async: '```typescript\nasync\n```\n\nDeclares an asynchronous function.',
      await: '```typescript\nawait\n```\n\nWaits for a Promise to resolve.',
      return: '```typescript\nreturn\n```\n\nReturns a value from a function.',
      if: '```typescript\nif\n```\n\nConditional statement.',
      else: '```typescript\nelse\n```\n\nAlternative branch for if statement.',
      for: '```typescript\nfor\n```\n\nLoop statement.',
      while: '```typescript\nwhile\n```\n\nLoop statement with condition.',
      try: '```typescript\ntry\n```\n\nBegins a try-catch block.',
      catch: '```typescript\ncatch\n```\n\nHandles exceptions in try-catch block.',
      throw: '```typescript\nthrow\n```\n\nThrows an exception.',
      import: '```typescript\nimport\n```\n\nImports modules.',
      export: '```typescript\nexport\n```\n\nExports values from a module.',
      default: '```typescript\ndefault\n```\n\nDefault export or switch case.',
    };

    // Python keywords
    const pyKeywords: Record<string, string> = {
      def: '```python\ndef\n```\n\nDefines a function.',
      class: '```python\nclass\n```\n\nDefines a class.',
      return: '```python\nreturn\n```\n\nReturns a value from a function.',
      if: '```python\nif\n```\n\nConditional statement.',
      elif: '```python\nelif\n```\n\nElse-if conditional branch.',
      else: '```python\nelse\n```\n\nElse branch for conditional.',
      for: '```python\nfor\n```\n\nFor loop.',
      while: '```python\nwhile\n```\n\nWhile loop.',
      try: '```python\ntry\n```\n\nBegins a try-except block.',
      except: '```python\nexcept\n```\n\nHandles exceptions.',
      import: '```python\nimport\n```\n\nImports a module.',
      from: '```python\nfrom\n```\n\nImports specific items from a module.',
      lambda: '```python\nlambda\n```\n\nDefines an anonymous function.',
      with: '```python\nwith\n```\n\nContext manager statement.',
      async: '```python\nasync\n```\n\nDefines an asynchronous function.',
      await: '```python\nawait\n```\n\nWaits for an awaitable.',
    };

    return tsKeywords[symbolName] || pyKeywords[symbolName] || null;
  }

  /**
   * Provide hover with type information
   */
  async provideHoverWithType(uri: string, position: Position): Promise<Hover | null> {
    const hover = await this.provideHover(uri, position);
    if (!hover) {
      return null;
    }

    // TODO: Add type inference here when type system is implemented
    return hover;
  }
}
