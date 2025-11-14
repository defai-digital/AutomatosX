/**
 * Completion Provider
 *
 * Implements textDocument/completion LSP request.
 * Provides context-aware code completions.
 */

import type { CompletionItem, Position, SymbolInfo } from '../types/lsp-types.js';
import { CompletionItemKind, mapCompletionItemKind } from '../types/lsp-types.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
import {
  uriToFilePath,
  getLineAtPosition,
  positionToOffset,
  getWordAtPosition,
} from '../utils/lsp-utils.js';

/**
 * Completion context
 */
export interface CompletionContext {
  triggerKind: number;
  triggerCharacter?: string;
}

/**
 * Completion Provider
 */
export class CompletionProvider {
  constructor(
    private documentManager: DocumentManager,
    private integrationService: IntegrationService
  ) {}

  /**
   * Handle textDocument/completion request
   *
   * @param uri - Document URI
   * @param position - Cursor position
   * @param context - Completion context (trigger info)
   * @returns Array of completion items or null
   */
  async provideCompletions(
    uri: string,
    position: Position,
    context?: CompletionContext
  ): Promise<CompletionItem[] | null> {
    try {
      const filePath = uriToFilePath(uri);
      const content = this.documentManager.getDocumentText(uri);

      if (!content) {
        return null;
      }

      // Get completion prefix (partial word being typed)
      const prefix = this.getCompletionPrefix(content, position);

      // Determine completion type based on context
      const line = getLineAtPosition(content, position);
      const completionType = this.determineCompletionType(line, position, context);

      // Get completions based on type
      const completions: CompletionItem[] = [];

      switch (completionType) {
        case 'import':
          completions.push(...(await this.getImportCompletions(prefix, filePath)));
          break;
        case 'member':
          completions.push(...(await this.getMemberCompletions(prefix, line)));
          break;
        case 'keyword':
          completions.push(...this.getKeywordCompletions(prefix, filePath));
          break;
        default:
          // General symbol completions
          completions.push(...(await this.getSymbolCompletions(prefix, filePath)));
          completions.push(...this.getKeywordCompletions(prefix, filePath));
          break;
      }

      // Sort by relevance
      return this.sortCompletions(completions, prefix);
    } catch (error) {
      console.error('Error in provideCompletions:', error);
      return null;
    }
  }

  /**
   * Get completion prefix (partial word being typed)
   */
  private getCompletionPrefix(content: string, position: Position): string {
    const offset = positionToOffset(content, position);
    const before = content.substring(0, offset);

    // Match word characters before cursor
    const match = before.match(/[\w$]*$/);
    return match ? match[0] : '';
  }

  /**
   * Determine type of completion needed
   */
  private determineCompletionType(
    line: string,
    position: Position,
    context?: CompletionContext
  ): 'import' | 'member' | 'keyword' | 'general' {
    // Check for member access (after dot)
    if (context?.triggerCharacter === '.') {
      return 'member';
    }

    // Check for import statement
    if (line.trim().startsWith('import ') || line.trim().startsWith('from ')) {
      return 'import';
    }

    // Check if we're at the start of a statement (likely keyword)
    const beforeCursor = line.substring(0, position.character).trim();
    if (beforeCursor === '' || beforeCursor.endsWith('{') || beforeCursor.endsWith(';')) {
      return 'keyword';
    }

    return 'general';
  }

  /**
   * Get symbol completions from workspace
   */
  private async getSymbolCompletions(prefix: string, currentFile: string): Promise<CompletionItem[]> {
    // Search for symbols matching prefix
    const symbols = await this.integrationService.searchSymbolsForCompletion(
      prefix,
      currentFile,
      50
    );

    // Also get symbols from current document
    const docSymbols = this.documentManager.getDocumentSymbols(
      this.getUriFromFilePath(currentFile)
    );

    const allSymbols = [...symbols, ...docSymbols];

    // Convert to completion items
    return allSymbols
      .filter((s) => s.name.toLowerCase().startsWith(prefix.toLowerCase()))
      .map((symbol) => this.symbolToCompletionItem(symbol, currentFile));
  }

  /**
   * Get import completions
   */
  private async getImportCompletions(prefix: string, currentFile: string): Promise<CompletionItem[]> {
    // Get all symbols that could be imported
    const symbols = await this.integrationService.searchSymbolsForCompletion(prefix, currentFile, 30);

    return symbols
      .filter((s) => s.filePath !== currentFile) // Don't import from same file
      .map((symbol) => ({
        label: symbol.name,
        kind: mapCompletionItemKind(symbol.kind),
        detail: `from ${symbol.filePath}`,
        documentation: symbol.docstring,
        sortText: `1${symbol.name}`, // Higher priority
        insertText: symbol.name,
      }));
  }

  /**
   * Get member completions (after dot operator)
   */
  private async getMemberCompletions(prefix: string, line: string): Promise<CompletionItem[]> {
    // Extract object name before dot
    const match = line.match(/(\w+)\.\w*$/);
    if (!match) {
      return [];
    }

    const objectName = match[1];

    // TODO: Implement type-aware member completion
    // For now, return empty array
    return [];
  }

  /**
   * Get keyword completions
   */
  private getKeywordCompletions(prefix: string, filePath: string): CompletionItem[] {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    let keywords: string[] = [];

    // TypeScript/JavaScript keywords
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      keywords = [
        'const',
        'let',
        'var',
        'function',
        'class',
        'interface',
        'type',
        'enum',
        'namespace',
        'import',
        'export',
        'default',
        'return',
        'if',
        'else',
        'for',
        'while',
        'do',
        'switch',
        'case',
        'break',
        'continue',
        'try',
        'catch',
        'finally',
        'throw',
        'async',
        'await',
        'new',
        'this',
        'super',
        'extends',
        'implements',
        'public',
        'private',
        'protected',
        'static',
        'readonly',
        'abstract',
      ];
    }

    // Python keywords
    if (ext === '.py') {
      keywords = [
        'def',
        'class',
        'return',
        'if',
        'elif',
        'else',
        'for',
        'while',
        'break',
        'continue',
        'try',
        'except',
        'finally',
        'raise',
        'import',
        'from',
        'as',
        'with',
        'lambda',
        'yield',
        'async',
        'await',
        'pass',
        'None',
        'True',
        'False',
        'and',
        'or',
        'not',
        'in',
        'is',
      ];
    }

    return keywords
      .filter((kw) => kw.startsWith(prefix.toLowerCase()))
      .map((keyword) => ({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        detail: 'keyword',
        sortText: `2${keyword}`, // Lower priority than symbols
        insertText: keyword,
      }));
  }

  /**
   * Convert symbol to completion item
   */
  private symbolToCompletionItem(symbol: SymbolInfo, currentFile: string): CompletionItem {
    const isLocal = symbol.filePath === currentFile;

    // Create detailed label for functions
    let detail = symbol.kind;
    if (symbol.signature) {
      detail = symbol.signature;
    } else if (symbol.kind === 'function' || symbol.kind === 'method') {
      detail = `${symbol.kind} ${symbol.name}()`;
    }

    // Determine insert text (with snippets for functions)
    let insertText = symbol.name;
    let insertTextFormat = 1; // PlainText

    if (symbol.kind === 'function' || symbol.kind === 'method') {
      // Snippet with parameter placeholders
      insertText = `${symbol.name}($1)$0`;
      insertTextFormat = 2; // Snippet
    }

    return {
      label: symbol.name,
      kind: mapCompletionItemKind(symbol.kind),
      detail,
      documentation: symbol.docstring,
      sortText: isLocal ? `0${symbol.name}` : `1${symbol.name}`, // Local symbols first
      filterText: symbol.name,
      insertText,
      insertTextFormat,
    };
  }

  /**
   * Sort completions by relevance
   */
  private sortCompletions(items: CompletionItem[], prefix: string): CompletionItem[] {
    return items.sort((a, b) => {
      // Use sortText if available
      if (a.sortText && b.sortText) {
        return a.sortText.localeCompare(b.sortText);
      }

      // Prefer exact prefix match
      const aExact = a.label.startsWith(prefix) ? 0 : 1;
      const bExact = b.label.startsWith(prefix) ? 0 : 1;
      if (aExact !== bExact) {
        return aExact - bExact;
      }

      // Sort alphabetically
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Get URI from file path
   */
  private getUriFromFilePath(filePath: string): string {
    // Try to find open document with this file path
    for (const uri of this.documentManager.getAllDocumentUris()) {
      if (uriToFilePath(uri) === filePath) {
        return uri;
      }
    }
    // Fallback to constructing URI
    return `file://${filePath}`;
  }

  /**
   * Provide signature help (parameter hints)
   */
  async provideSignatureHelp(
    uri: string,
    position: Position
  ): Promise<{ signatures: string[]; activeParameter: number } | null> {
    // TODO: Implement signature help
    return null;
  }
}
