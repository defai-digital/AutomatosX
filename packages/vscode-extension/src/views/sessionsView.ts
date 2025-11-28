/**
 * Sessions TreeView
 *
 * Sidebar view showing active and past sessions.
 *
 * @module @ax/vscode-extension/views/sessionsView
 */

import * as vscode from 'vscode';
import type { AxClient, Session } from '../services/axClient';

// =============================================================================
// Types
// =============================================================================

type TreeItem = SessionCategoryItem | SessionItem;

class SessionCategoryItem extends vscode.TreeItem {
  constructor(
    public readonly category: 'active' | 'recent',
    public readonly sessions: Session[]
  ) {
    super(
      category === 'active' ? 'Active Sessions' : 'Recent Sessions',
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.contextValue = 'sessionCategory';
    this.iconPath = new vscode.ThemeIcon(category === 'active' ? 'pulse' : 'history');
    this.description = `${sessions.length}`;
  }
}

class SessionItem extends vscode.TreeItem {
  constructor(public readonly session: Session) {
    super(session.displayId, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'session';
    this.description = session.agentId;

    const createdDate = new Date(session.createdAt);
    const updatedDate = new Date(session.updatedAt);

    this.tooltip = new vscode.MarkdownString(
      `**Session:** \`${session.displayId}\`\n\n` +
        `**Agent:** ${session.agentId}\n` +
        `**Status:** ${session.status}\n` +
        `**Tasks:** ${session.taskCount}\n\n` +
        `**Created:** ${createdDate.toLocaleString()}\n` +
        `**Updated:** ${updatedDate.toLocaleString()}`
    );

    // Icon based on status
    const statusIcons: Record<string, string> = {
      active: 'play-circle',
      completed: 'check',
      failed: 'error',
      pending: 'clock',
    };
    this.iconPath = new vscode.ThemeIcon(statusIcons[session.status] || 'comment-discussion');

    // Command to view session
    this.command = {
      command: 'automatosx.showSessionInfo',
      title: 'Show Session Info',
      arguments: [session.id],
    };
  }
}

// =============================================================================
// Tree Data Provider
// =============================================================================

export class SessionsTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private sessions: Session[] = [];

  constructor(private client: AxClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async loadSessions(): Promise<void> {
    this.sessions = await this.client.getSessions();
    this.refresh();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Root level - load sessions if needed
      if (this.sessions.length === 0) {
        await this.loadSessions();
      }

      // Split into active and recent
      const active = this.sessions.filter((s) => s.status === 'active');
      const recent = this.sessions.filter((s) => s.status !== 'active');

      const categories: SessionCategoryItem[] = [];

      if (active.length > 0) {
        categories.push(new SessionCategoryItem('active', active));
      }

      if (recent.length > 0) {
        categories.push(new SessionCategoryItem('recent', recent.slice(0, 10)));
      }

      return categories;
    }

    if (element instanceof SessionCategoryItem) {
      // Return sessions in category
      return element.sessions
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((session) => new SessionItem(session));
    }

    return [];
  }

  getParent(): vscode.ProviderResult<TreeItem> {
    return null;
  }
}
