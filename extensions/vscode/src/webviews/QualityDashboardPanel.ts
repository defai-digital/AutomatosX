/**
 * Quality Dashboard Webview Panel
 * Displays quality metrics dashboard in a webview
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LSPClient } from '../lsp/LSPClient.js';

export class QualityDashboardPanel {
  private static currentPanel: QualityDashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionPath: string;
  private readonly lspClient: LSPClient;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionPath: string, lspClient: LSPClient) {
    this.panel = panel;
    this.extensionPath = extensionPath;
    this.lspClient = lspClient;

    // Set webview content
    this.panel.webview.html = this.getWebviewContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'loadMetrics':
            await this.loadMetrics();
            break;
          case 'exportPNG':
            await this.exportPNG();
            break;
          case 'exportPDF':
            await this.exportPDF();
            break;
        }
      },
      null,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Load initial metrics
    this.loadMetrics();
  }

  /**
   * Create or show quality dashboard panel
   */
  public static createOrShow(extensionPath: string, lspClient: LSPClient): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel already exists, show it
    if (QualityDashboardPanel.currentPanel) {
      QualityDashboardPanel.currentPanel.panel.reveal(column);
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'automatosxQualityDashboard',
      'Quality Dashboard - AutomatosX',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionPath, 'out', 'webview')),
        ],
      }
    );

    QualityDashboardPanel.currentPanel = new QualityDashboardPanel(
      panel,
      extensionPath,
      lspClient
    );
  }

  /**
   * Load quality metrics from LSP
   */
  private async loadMetrics(): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return;
      }

      // Get all files in workspace
      const files = await vscode.workspace.findFiles(
        '**/*.{ts,js,py,go,rs}',
        '**/node_modules/**'
      );

      const metrics: any[] = [];
      for (const file of files) {
        const fileMetrics = await this.lspClient.getQualityMetrics(file.fsPath);
        if (fileMetrics) {
          metrics.push(fileMetrics);
        }
      }

      // Send metrics to webview
      this.panel.webview.postMessage({
        command: 'updateMetrics',
        data: {
          files: metrics,
          summary: this.calculateSummary(metrics),
        },
      });
    } catch (error) {
      console.error('Failed to load metrics:', error);
      vscode.window.showErrorMessage(`Failed to load metrics: ${error}`);
    }
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(metrics: any[]): any {
    if (metrics.length === 0) {
      return {
        totalFiles: 0,
        averageScore: 0,
        averageComplexity: 0,
        gradeDistribution: {},
      };
    }

    const totalScore = metrics.reduce((sum, m) => sum + m.score, 0);
    const totalComplexity = metrics.reduce((sum, m) => sum + m.complexity, 0);

    const gradeDistribution: Record<string, number> = {};
    for (const m of metrics) {
      gradeDistribution[m.grade] = (gradeDistribution[m.grade] || 0) + 1;
    }

    return {
      totalFiles: metrics.length,
      averageScore: totalScore / metrics.length,
      averageComplexity: totalComplexity / metrics.length,
      gradeDistribution,
    };
  }

  /**
   * Export dashboard to PNG
   */
  private async exportPNG(): Promise<void> {
    vscode.window.showInformationMessage('Export to PNG not yet implemented');
  }

  /**
   * Export dashboard to PDF
   */
  private async exportPDF(): Promise<void> {
    vscode.window.showInformationMessage('Export to PDF not yet implemented');
  }

  /**
   * Get webview HTML content
   */
  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quality Dashboard</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
    }
    h1 {
      color: var(--vscode-editor-foreground);
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      padding: 15px;
    }
    .summary-card h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
    }
    .summary-card .value {
      font-size: 24px;
      font-weight: bold;
    }
    .grade-distribution {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    .grade-badge {
      padding: 5px 10px;
      border-radius: 3px;
      font-weight: bold;
    }
    .grade-A { background: #28a745; color: white; }
    .grade-B { background: #17a2b8; color: white; }
    .grade-C { background: #ffc107; color: black; }
    .grade-D { background: #fd7e14; color: white; }
    .grade-F { background: #dc3545; color: white; }
    .loading {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }
    .actions {
      margin-bottom: 20px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 2px;
      margin-right: 10px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <h1>Quality Dashboard</h1>

  <div class="actions">
    <button onclick="refreshData()">Refresh</button>
    <button onclick="exportPNG()">Export PNG</button>
    <button onclick="exportPDF()">Export PDF</button>
  </div>

  <div id="content">
    <div class="loading">Loading metrics...</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'updateMetrics':
          renderMetrics(message.data);
          break;
      }
    });

    function renderMetrics(data) {
      const { files, summary } = data;

      const html = \`
        <div class="summary">
          <div class="summary-card">
            <h3>Total Files</h3>
            <div class="value">\${summary.totalFiles}</div>
          </div>
          <div class="summary-card">
            <h3>Average Score</h3>
            <div class="value">\${summary.averageScore.toFixed(1)}</div>
          </div>
          <div class="summary-card">
            <h3>Average Complexity</h3>
            <div class="value">\${summary.averageComplexity.toFixed(1)}</div>
          </div>
          <div class="summary-card">
            <h3>Grade Distribution</h3>
            <div class="grade-distribution">
              \${Object.entries(summary.gradeDistribution)
                .map(([grade, count]) => \`<span class="grade-badge grade-\${grade}">\${grade}: \${count}</span>\`)
                .join('')}
            </div>
          </div>
        </div>
      \`;

      document.getElementById('content').innerHTML = html;
    }

    function refreshData() {
      vscode.postMessage({ command: 'loadMetrics' });
    }

    function exportPNG() {
      vscode.postMessage({ command: 'exportPNG' });
    }

    function exportPDF() {
      vscode.postMessage({ command: 'exportPDF' });
    }

    // Request initial data
    refreshData();
  </script>
</body>
</html>`;
  }

  /**
   * Dispose panel and cleanup
   */
  public dispose(): void {
    QualityDashboardPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
