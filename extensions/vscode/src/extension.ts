/**
 * AutomatosX VS Code Extension Entry Point
 * Day 76: VS Code Extension for AutomatosX
 */

import * as vscode from 'vscode';
import { LSPClient } from './lsp/LSPClient.js';
import { SymbolExplorerProvider } from './views/SymbolExplorerProvider.js';
import { QualityMetricsProvider } from './views/QualityMetricsProvider.js';
import { DependenciesProvider } from './views/DependenciesProvider.js';
import { QualityDashboardPanel } from './webviews/QualityDashboardPanel.js';
import { DependencyGraphPanel } from './webviews/DependencyGraphPanel.js';
import { registerCommands } from './commands/index.js';
import { StatusBarManager } from './ui/StatusBarManager.js';
import { ConfigurationProvider } from './config/ConfigurationProvider.js';
import { TelemetryReporter } from './telemetry/TelemetryReporter.js';

let lspClient: LSPClient | undefined;
let statusBarManager: StatusBarManager | undefined;
let symbolExplorer: SymbolExplorerProvider | undefined;
let qualityMetrics: QualityMetricsProvider | undefined;
let dependencies: DependenciesProvider | undefined;
let telemetryReporter: TelemetryReporter | undefined;
let configProvider: ConfigurationProvider | undefined;

/**
 * Extension activation entry point
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('AutomatosX extension activating...');

  try {
    // Initialize configuration provider
    configProvider = new ConfigurationProvider();
    context.subscriptions.push(configProvider);

    // Initialize telemetry reporter
    telemetryReporter = new TelemetryReporter(configProvider);
    context.subscriptions.push(telemetryReporter);
    telemetryReporter.reportActivation();

    // Initialize LSP client
    lspClient = new LSPClient(context, configProvider);
    await lspClient.start();
    context.subscriptions.push(lspClient);

    // Initialize status bar manager
    statusBarManager = new StatusBarManager(lspClient, configProvider);
    context.subscriptions.push(statusBarManager);

    // Initialize tree view providers
    symbolExplorer = new SymbolExplorerProvider(lspClient);
    const symbolTreeView = vscode.window.createTreeView('automatosxSymbols', {
      treeDataProvider: symbolExplorer,
      showCollapseAll: true,
    });
    context.subscriptions.push(symbolTreeView);

    qualityMetrics = new QualityMetricsProvider(lspClient);
    const qualityTreeView = vscode.window.createTreeView('automatosxQuality', {
      treeDataProvider: qualityMetrics,
      showCollapseAll: true,
    });
    context.subscriptions.push(qualityTreeView);

    dependencies = new DependenciesProvider(lspClient);
    const depsTreeView = vscode.window.createTreeView('automatosxDependencies', {
      treeDataProvider: dependencies,
      showCollapseAll: true,
    });
    context.subscriptions.push(depsTreeView);

    // Register commands
    registerCommands(
      context,
      lspClient,
      symbolExplorer,
      qualityMetrics,
      dependencies,
      statusBarManager,
      telemetryReporter
    );

    // Setup event listeners
    setupEventListeners(context);

    // Auto-index workspace on activation
    if (configProvider.getConfig().autoIndex && vscode.workspace.workspaceFolders) {
      await indexWorkspace();
    }

    console.log('AutomatosX extension activated successfully');
    vscode.window.showInformationMessage('AutomatosX: Extension activated');
  } catch (error) {
    console.error('Failed to activate AutomatosX extension:', error);
    vscode.window.showErrorMessage(`AutomatosX activation failed: ${error}`);
    telemetryReporter?.reportError(error as Error);
  }
}

/**
 * Extension deactivation cleanup
 */
export async function deactivate(): Promise<void> {
  console.log('AutomatosX extension deactivating...');

  try {
    // Report deactivation
    telemetryReporter?.reportDeactivation();

    // Stop LSP client
    if (lspClient) {
      await lspClient.stop();
      lspClient = undefined;
    }

    // Cleanup resources
    statusBarManager = undefined;
    symbolExplorer = undefined;
    qualityMetrics = undefined;
    dependencies = undefined;
    telemetryReporter = undefined;
    configProvider = undefined;

    console.log('AutomatosX extension deactivated successfully');
  } catch (error) {
    console.error('Error during deactivation:', error);
  }
}

/**
 * Setup event listeners for document changes
 */
function setupEventListeners(context: vscode.ExtensionContext): void {
  // Listen for document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (!configProvider?.getConfig().autoIndex) {
        return;
      }

      // Update status bar for current file
      if (event.document === vscode.window.activeTextEditor?.document) {
        await statusBarManager?.updateForDocument(event.document);
      }
    })
  );

  // Listen for document saves
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (!configProvider?.getConfig().autoIndex) {
        return;
      }

      // Re-index saved file
      try {
        const filePath = document.uri.fsPath;
        await lspClient?.indexFile(filePath);

        // Refresh views
        symbolExplorer?.refresh();
        qualityMetrics?.refresh();
        dependencies?.refresh();

        telemetryReporter?.reportIndexing(1, 0);
      } catch (error) {
        console.error('Failed to index file on save:', error);
      }
    })
  );

  // Listen for active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor) {
        await statusBarManager?.updateForDocument(editor.document);
        symbolExplorer?.refresh();
      }
    })
  );

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('automatosx')) {
        configProvider?.reload();
        vscode.window.showInformationMessage('AutomatosX configuration reloaded');
      }
    })
  );
}

/**
 * Index entire workspace
 */
async function indexWorkspace(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return;
  }

  try {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AutomatosX: Indexing workspace',
        cancellable: false,
      },
      async (progress) => {
        for (const folder of folders) {
          progress.report({ message: `Indexing ${folder.name}...` });
          await lspClient?.indexDirectory(folder.uri.fsPath);
        }
      }
    );

    // Refresh all views
    symbolExplorer?.refresh();
    qualityMetrics?.refresh();
    dependencies?.refresh();
  } catch (error) {
    console.error('Failed to index workspace:', error);
    vscode.window.showErrorMessage(`Failed to index workspace: ${error}`);
  }
}

// Export for testing
export { lspClient, statusBarManager, symbolExplorer, qualityMetrics, dependencies };
