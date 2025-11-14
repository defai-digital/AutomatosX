/**
 * Definition Provider
 *
 * Implements textDocument/definition LSP request.
 * Finds symbol definitions across the workspace.
 */

import type { Location, Position, SymbolInfo } from '../types/lsp-types.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
import {
  filePathToUri,
  uriToFilePath,
  getWordAtPosition,
  findNodeAtPosition,
  getIdentifierAtPosition,
} from '../utils/lsp-utils.js';

/**
 * Definition Provider
 */
export class DefinitionProvider {
  constructor(
    private documentManager: DocumentManager,
    private integrationService: IntegrationService
  ) {}

  /**
   * Handle textDocument/definition request
   *
   * @param uri - Document URI
   * @param position - Cursor position
   * @returns Location(s) of symbol definition or null
   */
  async provideDefinition(uri: string, position: Position): Promise<Location | Location[] | null> {
    try {
      const filePath = uriToFilePath(uri);
      const content = this.documentManager.getDocumentText(uri);

      if (!content) {
        return null;
      }

      // Get symbol name at position
      const symbolName = this.getSymbolAtPosition(uri, position, content);
      if (!symbolName) {
        return null;
      }

      // Try to find definition using Tree-sitter first (for local symbols)
      const localDefinition = await this.findLocalDefinition(uri, position, symbolName);
      if (localDefinition) {
        return localDefinition;
      }

      // Fall back to database search (for cross-file symbols)
      const dbDefinition = await this.findDatabaseDefinition(symbolName, filePath);
      if (dbDefinition) {
        return dbDefinition;
      }

      return null;
    } catch (error) {
      console.error('Error in provideDefinition:', error);
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
   * Find definition in local document using AST
   */
  private async findLocalDefinition(
    uri: string,
    position: Position,
    symbolName: string
  ): Promise<Location | null> {
    const symbols = this.documentManager.getDocumentSymbols(uri);

    // Find symbol definition in document symbols
    const symbol = symbols.find(
      (s) =>
        s.name === symbolName &&
        // Exclude the current position (we want the definition, not the usage)
        !(s.startLine === position.line && s.startColumn === position.character)
    );

    if (symbol) {
      return this.symbolToLocation(symbol);
    }

    return null;
  }

  /**
   * Find definition in database (cross-file search)
   */
  private async findDatabaseDefinition(
    symbolName: string,
    currentFile: string
  ): Promise<Location | Location[] | null> {
    const symbol = await this.integrationService.findSymbolDefinition(symbolName, currentFile);

    if (symbol) {
      return this.symbolToLocation(symbol);
    }

    // Try finding all symbols with this name (for overloaded functions)
    const symbols = await this.integrationService.findSymbolReferences(symbolName, true);

    if (symbols.length > 0) {
      // If multiple definitions, return all
      if (symbols.length > 1) {
        return symbols.map((s) => this.symbolToLocation(s));
      }

      return this.symbolToLocation(symbols[0]);
    }

    return null;
  }

  /**
   * Convert SymbolInfo to Location
   */
  private symbolToLocation(symbol: SymbolInfo): Location {
    return {
      uri: filePathToUri(symbol.filePath),
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
   * Provide definition for multiple positions (batch operation)
   */
  async provideDefinitions(
    requests: Array<{ uri: string; position: Position }>
  ): Promise<Array<Location | Location[] | null>> {
    const results = await Promise.all(
      requests.map((req) => this.provideDefinition(req.uri, req.position))
    );
    return results;
  }
}
