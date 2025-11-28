/**
 * System TreeView
 *
 * Sidebar view showing system status and provider health.
 *
 * @module @ax/vscode-extension/views/systemView
 */

import * as vscode from 'vscode';
import type { AxClient, SystemStatus, ProviderStatus } from '../services/axClient';

// =============================================================================
// Types
// =============================================================================

type TreeItem = SystemCategoryItem | SystemInfoItem | ProviderItem;

class SystemCategoryItem extends vscode.TreeItem {
  constructor(
    public readonly category: 'status' | 'providers',
    public readonly itemCount: number
  ) {
    super(
      category === 'status' ? 'System Status' : 'Providers',
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.contextValue = 'systemCategory';
    this.iconPath = new vscode.ThemeIcon(category === 'status' ? 'info' : 'server');
  }
}

class SystemInfoItem extends vscode.TreeItem {
  constructor(label: string, value: string | number | boolean, icon?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = String(value);
    this.contextValue = 'systemInfo';
    this.iconPath = new vscode.ThemeIcon(icon || 'symbol-property');
  }
}

class ProviderItem extends vscode.TreeItem {
  constructor(public readonly provider: ProviderStatus) {
    super(provider.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'provider';

    const statusIcons: Record<string, string> = {
      healthy: 'pass',
      degraded: 'warning',
      unhealthy: 'error',
    };

    this.iconPath = new vscode.ThemeIcon(statusIcons[provider.status] || 'question');
    this.description = provider.status;

    this.tooltip = new vscode.MarkdownString(
      `**${provider.name}**\n\n` +
        `**Status:** ${provider.status}\n` +
        `**Success Rate:** ${(provider.successRate * 100).toFixed(1)}%\n` +
        `**Avg Latency:** ${provider.avgLatency.toFixed(0)}ms\n` +
        `**Last Check:** ${new Date(provider.lastCheck).toLocaleString()}`
    );
  }
}

// =============================================================================
// Tree Data Provider
// =============================================================================

export class SystemTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private status: SystemStatus | null = null;
  private providers: ProviderStatus[] = [];

  constructor(private client: AxClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async loadData(): Promise<void> {
    [this.status, this.providers] = await Promise.all([
      this.client.getStatus(),
      this.client.getProviderStatus(),
    ]);
    this.refresh();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Root level - load data if needed
      if (!this.status) {
        await this.loadData();
      }

      return [
        new SystemCategoryItem('status', 4),
        new SystemCategoryItem('providers', this.providers.length),
      ];
    }

    if (element instanceof SystemCategoryItem) {
      if (element.category === 'status' && this.status) {
        return [
          new SystemInfoItem(
            'Initialized',
            this.status.initialized ? 'Yes' : 'No',
            this.status.initialized ? 'pass' : 'error'
          ),
          new SystemInfoItem('Agents', this.status.agentCount, 'robot'),
          new SystemInfoItem('Sessions', this.status.sessionCount, 'comment-discussion'),
          new SystemInfoItem('Memory Entries', this.status.memoryEntries, 'database'),
        ];
      }

      if (element.category === 'providers') {
        if (this.providers.length === 0) {
          return [new SystemInfoItem('No providers', 'configured', 'warning')];
        }
        return this.providers.map((p) => new ProviderItem(p));
      }
    }

    return [];
  }

  getParent(): vscode.ProviderResult<TreeItem> {
    return null;
  }
}
