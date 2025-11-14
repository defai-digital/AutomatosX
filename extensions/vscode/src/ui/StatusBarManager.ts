/**
 * Status Bar Manager
 * Manages VS Code status bar items for AutomatosX
 */

import * as vscode from 'vscode';
import { LSPClient } from '../lsp/LSPClient.js';
import { ConfigurationProvider } from '../config/ConfigurationProvider.js';

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private lspClient: LSPClient;
  private configProvider: ConfigurationProvider;

  constructor(lspClient: LSPClient, configProvider: ConfigurationProvider) {
    this.lspClient = lspClient;
    this.configProvider = configProvider;

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.statusBarItem.command = 'automatosx.showQuality';
    this.statusBarItem.show();

    // Update for current document
    if (vscode.window.activeTextEditor) {
      this.updateForDocument(vscode.window.activeTextEditor.document);
    } else {
      this.updateDefault();
    }
  }

  /**
   * Update status bar for document
   */
  async updateForDocument(document: vscode.TextDocument): Promise<void> {
    if (!this.shouldShowForDocument(document)) {
      this.updateDefault();
      return;
    }

    try {
      const metrics = await this.lspClient.getQualityMetrics(document.uri.fsPath);

      if (metrics) {
        const color = this.getColorForGrade(metrics.grade);
        const icon = this.getIconForGrade(metrics.grade);

        this.statusBarItem.text = `$(${icon}) ${metrics.grade} (${metrics.score.toFixed(1)})`;
        this.statusBarItem.tooltip = this.getTooltip(metrics);
        this.statusBarItem.backgroundColor = color;
      } else {
        this.updateDefault();
      }
    } catch (error) {
      console.error('Failed to update status bar:', error);
      this.updateDefault();
    }
  }

  /**
   * Update with default text
   */
  private updateDefault(): void {
    this.statusBarItem.text = '$(beaker) AutomatosX';
    this.statusBarItem.tooltip = 'Click to open Quality Dashboard';
    this.statusBarItem.backgroundColor = undefined;
  }

  /**
   * Check if we should show metrics for document
   */
  private shouldShowForDocument(document: vscode.TextDocument): boolean {
    const supportedLanguages = ['typescript', 'javascript', 'python', 'go', 'rust'];
    return supportedLanguages.includes(document.languageId);
  }

  /**
   * Get color for grade
   */
  private getColorForGrade(grade: string): vscode.ThemeColor | undefined {
    switch (grade) {
      case 'A':
      case 'B':
        return undefined; // Green/neutral
      case 'C':
        return new vscode.ThemeColor('statusBarItem.warningBackground');
      case 'D':
      case 'F':
        return new vscode.ThemeColor('statusBarItem.errorBackground');
      default:
        return undefined;
    }
  }

  /**
   * Get icon for grade
   */
  private getIconForGrade(grade: string): string {
    switch (grade) {
      case 'A':
        return 'pass';
      case 'B':
        return 'info';
      case 'C':
        return 'warning';
      case 'D':
      case 'F':
        return 'error';
      default:
        return 'question';
    }
  }

  /**
   * Get tooltip for metrics
   */
  private getTooltip(metrics: any): string {
    return [
      `Quality Grade: ${metrics.grade}`,
      `Score: ${metrics.score.toFixed(1)}`,
      `Complexity: ${metrics.complexity}`,
      `Maintainability: ${metrics.maintainability.toFixed(1)}`,
      '',
      'Click to open Quality Dashboard',
    ].join('\n');
  }

  /**
   * Dispose status bar item
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
