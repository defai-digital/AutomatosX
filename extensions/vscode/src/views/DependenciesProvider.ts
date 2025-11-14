/**
 * Dependencies Tree View Provider
 * Displays file dependencies in a tree view
 */

import * as vscode from 'vscode';
import { LSPClient } from '../lsp/LSPClient.js';

interface Dependency {
  source: string;
  target: string;
  type: 'import' | 'export';
  symbols: string[];
}

export class DependenciesProvider implements vscode.TreeDataProvider<DependencyTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DependencyTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private lspClient: LSPClient;
  private currentDocument: vscode.TextDocument | undefined;
  private dependencies: Map<string, Dependency[]> = new Map();

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
    this.loadDependencies();
  }

  /**
   * Load dependencies for current document
   */
  private async loadDependencies(): Promise<void> {
    if (!this.currentDocument) {
      this._onDidChangeTreeData.fire();
      return;
    }

    try {
      const deps = await this.lspClient.getDependencies(this.currentDocument.uri.fsPath);
      if (deps) {
        this.dependencies.set(this.currentDocument.uri.fsPath, deps);
      }
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error('Failed to load dependencies:', error);
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Get tree item
   */
  getTreeItem(element: DependencyTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for tree item
   */
  async getChildren(element?: DependencyTreeItem): Promise<DependencyTreeItem[]> {
    if (!this.currentDocument) {
      return [];
    }

    const filePath = this.currentDocument.uri.fsPath;
    const deps = this.dependencies.get(filePath);

    if (!deps) {
      return [];
    }

    if (!element) {
      // Root level: show imports and exports
      return this.getRootItems(deps);
    } else if (element.contextValue === 'importsGroup' || element.contextValue === 'exportsGroup') {
      // Group level: show dependencies
      return this.getDependencyItems(deps, element.contextValue === 'importsGroup' ? 'import' : 'export');
    } else if (element.contextValue === 'dependency') {
      // Dependency level: show symbols
      return this.getSymbolItems(element.dependency!);
    }

    return [];
  }

  /**
   * Get root items (Imports/Exports groups)
   */
  private getRootItems(deps: Dependency[]): DependencyTreeItem[] {
    const imports = deps.filter((d) => d.type === 'import');
    const exports = deps.filter((d) => d.type === 'export');

    const items: DependencyTreeItem[] = [];

    if (imports.length > 0) {
      const item = new DependencyTreeItem(
        'Imports',
        `${imports.length} file${imports.length !== 1 ? 's' : ''}`,
        vscode.TreeItemCollapsibleState.Expanded
      );
      item.contextValue = 'importsGroup';
      item.iconPath = new vscode.ThemeIcon('symbol-namespace');
      items.push(item);
    }

    if (exports.length > 0) {
      const item = new DependencyTreeItem(
        'Exports',
        `${exports.length} file${exports.length !== 1 ? 's' : ''}`,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = 'exportsGroup';
      item.iconPath = new vscode.ThemeIcon('export');
      items.push(item);
    }

    return items;
  }

  /**
   * Get dependency items for group
   */
  private getDependencyItems(deps: Dependency[], type: 'import' | 'export'): DependencyTreeItem[] {
    const filtered = deps.filter((d) => d.type === type);
    const items: DependencyTreeItem[] = [];

    for (const dep of filtered) {
      const fileName = this.getFileName(dep.target);
      const item = new DependencyTreeItem(
        fileName,
        `${dep.symbols.length} symbol${dep.symbols.length !== 1 ? 's' : ''}`,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = 'dependency';
      item.resourceUri = vscode.Uri.file(dep.target);
      item.iconPath = vscode.ThemeIcon.File;
      item.dependency = dep;
      item.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(dep.target)],
      };
      items.push(item);
    }

    return items;
  }

  /**
   * Get symbol items for dependency
   */
  private getSymbolItems(dep: Dependency): DependencyTreeItem[] {
    const items: DependencyTreeItem[] = [];

    for (const symbol of dep.symbols) {
      const item = new DependencyTreeItem(
        symbol,
        '',
        vscode.TreeItemCollapsibleState.None
      );
      item.contextValue = 'symbol';
      item.iconPath = new vscode.ThemeIcon('symbol-variable');
      items.push(item);
    }

    return items;
  }

  /**
   * Get file name from path
   */
  private getFileName(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Get parent for tree item (not used)
   */
  getParent(element: DependencyTreeItem): vscode.ProviderResult<DependencyTreeItem> {
    return null;
  }
}

/**
 * Tree item for dependency
 */
class DependencyTreeItem extends vscode.TreeItem {
  public dependency?: Dependency;

  constructor(
    label: string,
    description: string,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.description = description;
  }
}
