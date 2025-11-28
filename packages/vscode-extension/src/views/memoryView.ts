/**
 * Memory TreeView
 *
 * Sidebar view showing memory stats and search.
 *
 * @module @ax/vscode-extension/views/memoryView
 */

import * as vscode from 'vscode';
import type { AxClient } from '../services/axClient';

// =============================================================================
// Types
// =============================================================================

type TreeItem = MemoryStatsItem | MemoryActionItem;

class MemoryStatsItem extends vscode.TreeItem {
  constructor(label: string, value: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = value;
    this.contextValue = 'memoryStat';
    this.iconPath = new vscode.ThemeIcon('database');
  }
}

class MemoryActionItem extends vscode.TreeItem {
  constructor(
    label: string,
    icon: string,
    command: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'memoryAction';
    this.iconPath = new vscode.ThemeIcon(icon);
    this.command = {
      command,
      title: label,
    };
  }
}

// =============================================================================
// Tree Data Provider
// =============================================================================

export class MemoryTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private stats: { totalEntries: number; dbSize: string } | null = null;

  constructor(private client: AxClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async loadStats(): Promise<void> {
    this.stats = await this.client.getMemoryStats();
    this.refresh();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (element) {
      return [];
    }

    // Load stats if needed
    if (!this.stats) {
      await this.loadStats();
    }

    const items: TreeItem[] = [];

    // Stats
    if (this.stats) {
      items.push(new MemoryStatsItem('Total Entries', this.stats.totalEntries.toString()));
      items.push(new MemoryStatsItem('Database Size', this.stats.dbSize));
    }

    // Separator via description
    const separator = new vscode.TreeItem('', vscode.TreeItemCollapsibleState.None);
    separator.description = '─────────────';
    items.push(separator as TreeItem);

    // Actions
    items.push(new MemoryActionItem('Search Memory', 'search', 'automatosx.searchMemory'));

    return items;
  }

  getParent(): vscode.ProviderResult<TreeItem> {
    return null;
  }
}
