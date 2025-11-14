/**
 * Symbol Explorer Tree View Provider
 * Displays document symbols in a tree view
 */

import * as vscode from 'vscode';
import { LSPClient } from '../lsp/LSPClient.js';

export class SymbolExplorerProvider implements vscode.TreeDataProvider<SymbolTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SymbolTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private lspClient: LSPClient;
  private currentDocument: vscode.TextDocument | undefined;
  private filterKind: vscode.SymbolKind | undefined;

  constructor(lspClient: LSPClient) {
    this.lspClient = lspClient;

    // Listen for active editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        this.currentDocument = editor.document;
        this.refresh();
      }
    });

    if (vscode.window.activeTextEditor) {
      this.currentDocument = vscode.window.activeTextEditor.document;
    }
  }

  /**
   * Refresh tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Set symbol kind filter
   */
  setFilter(kind?: vscode.SymbolKind): void {
    this.filterKind = kind;
    this.refresh();
  }

  /**
   * Get tree item
   */
  getTreeItem(element: SymbolTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for tree item
   */
  async getChildren(element?: SymbolTreeItem): Promise<SymbolTreeItem[]> {
    if (!this.currentDocument) {
      return [];
    }

    try {
      if (!element) {
        // Root level: get top-level symbols
        const symbols = await this.lspClient.getDocumentSymbols(this.currentDocument.uri);
        return this.symbolsToTreeItems(symbols, this.currentDocument.uri);
      } else {
        // Child level: get nested symbols
        if (element.children) {
          return this.symbolsToTreeItems(element.children, this.currentDocument.uri);
        }
        return [];
      }
    } catch (error) {
      console.error('Failed to get symbols:', error);
      return [];
    }
  }

  /**
   * Convert LSP symbols to tree items
   */
  private symbolsToTreeItems(symbols: any[], uri: vscode.Uri): SymbolTreeItem[] {
    const items: SymbolTreeItem[] = [];

    for (const symbol of symbols) {
      // Apply filter if set
      if (this.filterKind !== undefined && symbol.kind !== this.filterKind) {
        continue;
      }

      const item = new SymbolTreeItem(
        symbol.name,
        symbol.kind,
        symbol.range,
        uri,
        symbol.children
      );

      items.push(item);
    }

    // Sort by kind, then name
    items.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind - b.kind;
      }
      return a.label.toString().localeCompare(b.label.toString());
    });

    return items;
  }

  /**
   * Get parent for tree item (not used)
   */
  getParent(element: SymbolTreeItem): vscode.ProviderResult<SymbolTreeItem> {
    return null;
  }
}

/**
 * Tree item for symbol
 */
class SymbolTreeItem extends vscode.TreeItem {
  public kind: vscode.SymbolKind;
  public range: any;
  public uri: vscode.Uri;
  public children?: any[];

  constructor(
    label: string,
    kind: vscode.SymbolKind,
    range: any,
    uri: vscode.Uri,
    children?: any[]
  ) {
    super(
      label,
      children && children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.kind = kind;
    this.range = range;
    this.uri = uri;
    this.children = children;

    // Set icon based on symbol kind
    this.iconPath = new vscode.ThemeIcon(this.getIconForKind(kind));

    // Set description (symbol kind name)
    this.description = this.getKindName(kind);

    // Set command to navigate to symbol
    this.command = {
      command: 'vscode.open',
      title: 'Go to Symbol',
      arguments: [
        uri,
        {
          selection: new vscode.Range(
            new vscode.Position(range.start.line, range.start.character),
            new vscode.Position(range.end.line, range.end.character)
          ),
        },
      ],
    };
  }

  /**
   * Get icon for symbol kind
   */
  private getIconForKind(kind: vscode.SymbolKind): string {
    switch (kind) {
      case vscode.SymbolKind.File:
        return 'file';
      case vscode.SymbolKind.Module:
        return 'package';
      case vscode.SymbolKind.Namespace:
        return 'namespace';
      case vscode.SymbolKind.Package:
        return 'package';
      case vscode.SymbolKind.Class:
        return 'symbol-class';
      case vscode.SymbolKind.Method:
        return 'symbol-method';
      case vscode.SymbolKind.Property:
        return 'symbol-property';
      case vscode.SymbolKind.Field:
        return 'symbol-field';
      case vscode.SymbolKind.Constructor:
        return 'symbol-constructor';
      case vscode.SymbolKind.Enum:
        return 'symbol-enum';
      case vscode.SymbolKind.Interface:
        return 'symbol-interface';
      case vscode.SymbolKind.Function:
        return 'symbol-function';
      case vscode.SymbolKind.Variable:
        return 'symbol-variable';
      case vscode.SymbolKind.Constant:
        return 'symbol-constant';
      case vscode.SymbolKind.String:
        return 'symbol-string';
      case vscode.SymbolKind.Number:
        return 'symbol-number';
      case vscode.SymbolKind.Boolean:
        return 'symbol-boolean';
      case vscode.SymbolKind.Array:
        return 'symbol-array';
      default:
        return 'symbol-misc';
    }
  }

  /**
   * Get human-readable name for kind
   */
  private getKindName(kind: vscode.SymbolKind): string {
    return vscode.SymbolKind[kind] || 'Unknown';
  }
}
