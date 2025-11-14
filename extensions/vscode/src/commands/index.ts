/**
 * Command Registration
 * Registers all AutomatosX commands
 */

import * as vscode from 'vscode';
import { LSPClient } from '../lsp/LSPClient.js';
import { SymbolExplorerProvider } from '../views/SymbolExplorerProvider.js';
import { QualityMetricsProvider } from '../views/QualityMetricsProvider.js';
import { DependenciesProvider } from '../views/DependenciesProvider.js';
import { QualityDashboardPanel } from '../webviews/QualityDashboardPanel.js';
import { DependencyGraphPanel } from '../webviews/DependencyGraphPanel.js';
import { StatusBarManager } from '../ui/StatusBarManager.js';
import { TelemetryReporter } from '../telemetry/TelemetryReporter.js';

export function registerCommands(
  context: vscode.ExtensionContext,
  lspClient: LSPClient,
  symbolExplorer: SymbolExplorerProvider,
  qualityMetrics: QualityMetricsProvider,
  dependencies: DependenciesProvider,
  statusBar: StatusBarManager,
  telemetry: TelemetryReporter
): void {
  // Index Project
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.indexProject', async () => {
      telemetry.reportCommand('indexProject');

      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'AutomatosX: Indexing project',
            cancellable: false,
          },
          async (progress) => {
            for (const folder of folders) {
              progress.report({ message: `Indexing ${folder.name}...` });
              await lspClient.indexDirectory(folder.uri.fsPath);
            }
          }
        );

        symbolExplorer.refresh();
        qualityMetrics.refresh();
        dependencies.refresh();

        vscode.window.showInformationMessage('Project indexed successfully');
      } catch (error) {
        vscode.window.showErrorMessage(`Indexing failed: ${error}`);
        telemetry.reportError(error as Error);
      }
    })
  );

  // Show Quality Dashboard
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.showQuality', () => {
      telemetry.reportCommand('showQuality');
      QualityDashboardPanel.createOrShow(context.extensionPath, lspClient);
    })
  );

  // Show Dependency Graph
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.showDependencies', () => {
      telemetry.reportCommand('showDependencies');
      DependencyGraphPanel.createOrShow(context.extensionPath, lspClient);
    })
  );

  // Analyze Current File
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.analyzeFile', async () => {
      telemetry.reportCommand('analyzeFile');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file');
        return;
      }

      try {
        const filePath = editor.document.uri.fsPath;
        const metrics = await lspClient.getQualityMetrics(filePath);

        if (metrics) {
          vscode.window.showInformationMessage(
            `Quality: ${metrics.grade} (${metrics.score.toFixed(1)}) | Complexity: ${metrics.complexity}`
          );
        } else {
          vscode.window.showWarningMessage('No metrics available for this file');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Analysis failed: ${error}`);
        telemetry.reportError(error as Error);
      }
    })
  );

  // Find References
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.findReferences', async () => {
      telemetry.reportCommand('findReferences');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file');
        return;
      }

      try {
        const position = editor.selection.active;
        const refs = await lspClient.findReferences(editor.document.uri, position);

        if (refs.length === 0) {
          vscode.window.showInformationMessage('No references found');
        } else {
          vscode.window.showInformationMessage(`Found ${refs.length} reference(s)`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Find references failed: ${error}`);
        telemetry.reportError(error as Error);
      }
    })
  );

  // Rename Symbol
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.renameSymbol', async () => {
      telemetry.reportCommand('renameSymbol');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file');
        return;
      }

      // Trigger built-in rename
      await vscode.commands.executeCommand('editor.action.rename');
    })
  );

  // Refresh All Views
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.refreshViews', () => {
      telemetry.reportCommand('refreshViews');

      symbolExplorer.refresh();
      qualityMetrics.refresh();
      dependencies.refresh();

      vscode.window.showInformationMessage('Views refreshed');
    })
  );

  // Export Metrics
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.exportMetrics', async () => {
      telemetry.reportCommand('exportMetrics');

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('quality-report.json'),
        filters: {
          'JSON': ['json'],
        },
      });

      if (!saveUri) {
        return;
      }

      try {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
          return;
        }

        const files = await vscode.workspace.findFiles(
          '**/*.{ts,js,py,go,rs}',
          '**/node_modules/**'
        );

        const metrics: any[] = [];
        for (const file of files) {
          const fileMetrics = await lspClient.getQualityMetrics(file.fsPath);
          if (fileMetrics) {
            metrics.push(fileMetrics);
          }
        }

        const report = {
          generatedAt: new Date().toISOString(),
          workspace: folders[0].name,
          totalFiles: metrics.length,
          metrics,
        };

        await vscode.workspace.fs.writeFile(
          saveUri,
          Buffer.from(JSON.stringify(report, null, 2))
        );

        vscode.window.showInformationMessage('Report exported successfully');
      } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error}`);
        telemetry.reportError(error as Error);
      }
    })
  );
}
