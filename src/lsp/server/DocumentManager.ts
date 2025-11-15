/**
 * Document Manager
 *
 * Manages open text documents in the LSP server.
 * Handles document lifecycle: open, change, close, save.
 * Maintains document cache and parsed AST.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import type { Tree, SyntaxNode } from 'web-tree-sitter';
import { getParserRegistry } from '../../parser/ParserRegistry.js';
import type { ParserRegistry } from '../../parser/ParserRegistry.js';
import type { SymbolInfo } from '../types/lsp-types.js';
import { getLanguageId, uriToFilePath } from '../utils/lsp-utils.js';

/**
 * Document data with parsed content
 */
export interface DocumentData {
  document: TextDocument;
  tree?: Tree;
  symbols: SymbolInfo[];
  version: number;
  lastModified: number;
}

/**
 * Document change event
 */
export interface DocumentChangeEvent {
  uri: string;
  version: number;
  text: string;
}

/**
 * Document Manager
 * Tracks open documents and their parsed state
 */
export class DocumentManager {
  private documents: Map<string, DocumentData> = new Map();
  private parserRegistry: ParserRegistry;

  constructor() {
    this.parserRegistry = getParserRegistry();
  }

  /**
   * Handle document open event
   */
  async onDocumentOpened(uri: string, languageId: string, version: number, text: string): Promise<void> {
    const document = TextDocument.create(uri, languageId, version, text);
    const data: DocumentData = {
      document,
      symbols: [],
      version,
      lastModified: Date.now(),
    };

    this.documents.set(uri, data);

    // Parse document asynchronously
    await this.parseDocument(uri, text);
  }

  /**
   * Handle document change event
   */
  async onDocumentChanged(uri: string, version: number, text: string): Promise<void> {
    const data = this.documents.get(uri);
    if (!data) {
      console.warn(`Document not found for change: ${uri}`);
      return;
    }

    // Update document
    const document = TextDocument.create(uri, data.document.languageId, version, text);
    data.document = document;
    data.version = version;
    data.lastModified = Date.now();

    // Re-parse document
    await this.parseDocument(uri, text);
  }

  /**
   * Handle document close event
   */
  onDocumentClosed(uri: string): void {
    this.documents.delete(uri);
  }

  /**
   * Handle document save event
   */
  async onDocumentSaved(uri: string, text?: string): Promise<void> {
    const data = this.documents.get(uri);
    if (!data) {
      console.warn(`Document not found for save: ${uri}`);
      return;
    }

    data.lastModified = Date.now();

    // Re-parse if text provided
    if (text) {
      await this.parseDocument(uri, text);
    }
  }

  /**
   * Get document by URI
   */
  getDocument(uri: string): TextDocument | undefined {
    return this.documents.get(uri)?.document;
  }

  /**
   * Get document data by URI
   */
  getDocumentData(uri: string): DocumentData | undefined {
    return this.documents.get(uri);
  }

  /**
   * Get document content
   */
  getDocumentText(uri: string): string | undefined {
    return this.documents.get(uri)?.document.getText();
  }

  /**
   * Get parsed tree for document
   */
  getDocumentTree(uri: string): Tree | undefined {
    return this.documents.get(uri)?.tree;
  }

  /**
   * Get symbols for document
   */
  getDocumentSymbols(uri: string): SymbolInfo[] {
    return this.documents.get(uri)?.symbols ?? [];
  }

  /**
   * Check if document is open
   */
  hasDocument(uri: string): boolean {
    return this.documents.has(uri);
  }

  /**
   * Get all open document URIs
   */
  getAllDocumentUris(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Get document count
   */
  getDocumentCount(): number {
    return this.documents.size;
  }

  /**
   * Parse document and extract symbols
   */
  private async parseDocument(uri: string, text: string): Promise<void> {
    const data = this.documents.get(uri);
    if (!data) {
      return;
    }

    try {
      const filePath = uriToFilePath(uri);
      const languageId = getLanguageId(filePath);

      // Get parser for language
      const parser = this.parserRegistry.getParser(languageId);
      if (!parser) {
        console.warn(`No parser available for language: ${languageId}`);
        return;
      }

      // Parse file
      const parseResult = await parser.parse(filePath);

      // Store tree and symbols (ParseResult doesn't have tree property)
      data.tree = undefined;  // Tree not available from ParseResult
      data.symbols = parseResult.symbols.map((symbol) => ({
        name: symbol.name,
        kind: symbol.kind,
        filePath: filePath,  // Use filePath from function parameter
        startLine: symbol.line,
        startColumn: symbol.column,
        endLine: symbol.endLine || 0,  // Ensure number type
        endColumn: symbol.endColumn || 0,
        signature: symbol.signature,
        docstring: symbol.metadata?.docstring,  // Get from metadata
        scope: symbol.metadata?.scope,  // Get from metadata
      }));
    } catch (error) {
      console.error(`Error parsing document ${uri}:`, error);
      data.tree = undefined;
      data.symbols = [];
    }
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    documentCount: number;
    parsedCount: number;
    totalSymbols: number;
  } {
    let parsedCount = 0;
    let totalSymbols = 0;

    for (const data of this.documents.values()) {
      if (data.tree) {
        parsedCount++;
      }
      totalSymbols += data.symbols.length;
    }

    return {
      documentCount: this.documents.size,
      parsedCount,
      totalSymbols,
    };
  }
}
