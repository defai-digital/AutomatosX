/**
 * Dependency Graph Webview Panel
 * Displays dependency graph visualization in a webview
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LSPClient } from '../lsp/LSPClient.js';

export class DependencyGraphPanel {
  private static currentPanel: DependencyGraphPanel | undefined;
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
          case 'loadGraph':
            await this.loadGraph();
            break;
          case 'openFile':
            await this.openFile(message.filePath);
            break;
        }
      },
      null,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Load initial graph
    this.loadGraph();
  }

  /**
   * Create or show dependency graph panel
   */
  public static createOrShow(extensionPath: string, lspClient: LSPClient): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel already exists, show it
    if (DependencyGraphPanel.currentPanel) {
      DependencyGraphPanel.currentPanel.panel.reveal(column);
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'automatosxDependencyGraph',
      'Dependency Graph - AutomatosX',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionPath, 'out', 'webview')),
        ],
      }
    );

    DependencyGraphPanel.currentPanel = new DependencyGraphPanel(
      panel,
      extensionPath,
      lspClient
    );
  }

  /**
   * Load dependency graph from LSP
   */
  private async loadGraph(): Promise<void> {
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

      const nodes: any[] = [];
      const links: any[] = [];
      const dependencies = new Map<string, any>();

      // Load dependencies for each file
      for (const file of files) {
        const deps = await this.lspClient.getDependencies(file.fsPath);
        if (deps) {
          dependencies.set(file.fsPath, deps);

          // Add node
          nodes.push({
            id: file.fsPath,
            label: this.getFileName(file.fsPath),
            path: file.fsPath,
          });

          // Add links
          for (const dep of deps) {
            if (dep.type === 'import') {
              links.push({
                source: file.fsPath,
                target: dep.target,
                type: 'import',
              });
            }
          }
        }
      }

      // Detect circular dependencies
      const circular = this.detectCircularDependencies(dependencies);

      // Send graph data to webview
      this.panel.webview.postMessage({
        command: 'updateGraph',
        data: {
          nodes,
          links,
          circular,
        },
      });
    } catch (error) {
      console.error('Failed to load dependency graph:', error);
      vscode.window.showErrorMessage(`Failed to load dependency graph: ${error}`);
    }
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(dependencies: Map<string, any>): string[][] {
    const circular: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (stack.has(node)) {
        // Found cycle
        const cycleStart = path.indexOf(node);
        circular.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      stack.add(node);

      const deps = dependencies.get(node) || [];
      for (const dep of deps) {
        if (dep.type === 'import') {
          dfs(dep.target, [...path, dep.target]);
        }
      }

      stack.delete(node);
    };

    for (const [node, _] of dependencies) {
      if (!visited.has(node)) {
        dfs(node, [node]);
      }
    }

    return circular;
  }

  /**
   * Open file in editor
   */
  private async openFile(filePath: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      console.error('Failed to open file:', error);
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }

  /**
   * Get file name from path
   */
  private getFileName(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
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
  <title>Dependency Graph</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    #header {
      padding: 20px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    h1 {
      margin: 0 0 10px 0;
      color: var(--vscode-editor-foreground);
    }
    .actions {
      margin-bottom: 10px;
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
    #graph {
      width: 100%;
      height: calc(100vh - 120px);
      background: var(--vscode-editor-background);
    }
    .warning {
      background: var(--vscode-inputValidation-warningBackground);
      border: 1px solid var(--vscode-inputValidation-warningBorder);
      color: var(--vscode-inputValidation-warningForeground);
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }
    svg {
      width: 100%;
      height: 100%;
    }
    .node circle {
      fill: var(--vscode-button-background);
      stroke: var(--vscode-button-foreground);
      stroke-width: 2px;
      cursor: pointer;
    }
    .node circle:hover {
      fill: var(--vscode-button-hoverBackground);
    }
    .node text {
      fill: var(--vscode-foreground);
      font-size: 12px;
      pointer-events: none;
    }
    .link {
      stroke: var(--vscode-descriptionForeground);
      stroke-opacity: 0.6;
      stroke-width: 2px;
      fill: none;
      marker-end: url(#arrowhead);
    }
    .link.circular {
      stroke: var(--vscode-errorForeground);
      stroke-width: 3px;
    }
  </style>
</head>
<body>
  <div id="header">
    <h1>Dependency Graph</h1>
    <div class="actions">
      <button onclick="refreshGraph()">Refresh</button>
      <button onclick="resetZoom()">Reset Zoom</button>
    </div>
    <div id="warnings"></div>
  </div>

  <div id="graph">
    <div class="loading">Loading dependency graph...</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let graphData = null;

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'updateGraph':
          graphData = message.data;
          renderGraph(graphData);
          break;
      }
    });

    function renderGraph(data) {
      const { nodes, links, circular } = data;

      // Show circular dependency warnings
      const warningsDiv = document.getElementById('warnings');
      if (circular.length > 0) {
        warningsDiv.innerHTML = \`
          <div class="warning">
            <strong>Warning:</strong> \${circular.length} circular dependenc\${circular.length === 1 ? 'y' : 'ies'} detected
          </div>
        \`;
      } else {
        warningsDiv.innerHTML = '';
      }

      // Simple text-based visualization for now
      // TODO: Integrate D3.js for proper graph visualization
      const graphDiv = document.getElementById('graph');
      graphDiv.innerHTML = \`
        <div style="padding: 20px;">
          <h2>Graph Nodes (\${nodes.length})</h2>
          <ul>
            \${nodes.map(n => \`<li onclick="openFile('\${n.path}')" style="cursor: pointer;">\${n.label}</li>\`).join('')}
          </ul>
          <h2>Dependencies (\${links.length})</h2>
          <ul>
            \${links.map(l => \`<li>\${getFileName(l.source)} → \${getFileName(l.target)}</li>\`).join('')}
          </ul>
        </div>
      \`;
    }

    function getFileName(path) {
      const parts = path.split('/');
      return parts[parts.length - 1];
    }

    function refreshGraph() {
      vscode.postMessage({ command: 'loadGraph' });
    }

    function resetZoom() {
      // TODO: Implement zoom reset with D3.js
    }

    function openFile(filePath) {
      vscode.postMessage({ command: 'openFile', filePath });
    }

    // Request initial data
    refreshGraph();
  </script>
</body>
</html>`;
  }

  /**
   * Dispose panel and cleanup
   */
  public dispose(): void {
    DependencyGraphPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
