/**
 * Status Bar
 *
 * Shows AutomatosX status in the VS Code status bar.
 *
 * @module @ax/vscode-extension/views/statusBar
 */

import * as vscode from 'vscode';
import type { AxClient } from '../services/axClient';

// =============================================================================
// Status Bar Manager
// =============================================================================

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private isInitialized = false;
  private agentCount = 0;

  constructor(private client: AxClient) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'automatosx.showStatus';
    this.statusBarItem.name = 'AutomatosX';
  }

  async initialize(): Promise<void> {
    const config = vscode.workspace.getConfiguration('automatosx');
    const showStatusBar = config.get<boolean>('showStatusBar', true);

    if (!showStatusBar) {
      this.statusBarItem.hide();
      return;
    }

    await this.refresh();
    this.statusBarItem.show();
  }

  async refresh(): Promise<void> {
    try {
      const status = await this.client.getStatus();
      this.isInitialized = status.initialized;
      this.agentCount = status.agentCount;

      if (this.isInitialized) {
        this.statusBarItem.text = `$(robot) AX: ${this.agentCount} agents`;
        this.statusBarItem.tooltip = new vscode.MarkdownString(
          `**AutomatosX**\n\n` +
            `Agents: ${status.agentCount}\n` +
            `Sessions: ${status.sessionCount}\n` +
            `Memory: ${status.memoryEntries} entries\n\n` +
            `_Click to show status_`
        );
        this.statusBarItem.backgroundColor = undefined;
      } else {
        this.statusBarItem.text = '$(robot) AX: Not initialized';
        this.statusBarItem.tooltip = 'Click to setup AutomatosX';
        this.statusBarItem.command = 'automatosx.setup';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.warningBackground'
        );
      }
    } catch (error) {
      this.statusBarItem.text = '$(robot) AX: Error';
      this.statusBarItem.tooltip = 'Failed to get status';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground'
      );
    }
  }

  setRunning(agent: string): void {
    this.statusBarItem.text = `$(sync~spin) AX: ${agent}...`;
    this.statusBarItem.tooltip = `Running task with ${agent}`;
  }

  setIdle(): void {
    if (this.isInitialized) {
      this.statusBarItem.text = `$(robot) AX: ${this.agentCount} agents`;
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
