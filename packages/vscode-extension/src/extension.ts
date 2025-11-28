/**
 * AutomatosX VS Code Extension
 *
 * Main entry point for the VS Code extension.
 * Provides AI agent orchestration capabilities directly in VS Code.
 *
 * @module @ax/vscode-extension
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import * as vscode from 'vscode';

// Services
import { getAxClient, disposeAxClient } from './services/axClient';

// Utils
import { getOutputChannel, disposeOutputChannel, show as showOutput, clear as clearOutput } from './utils/output';

// Commands
import {
  runTask,
  runWithAgent,
  analyzeSelection,
  explainCode,
  generateTests,
  securityReview,
  optimizeCode,
  refactorCode,
} from './commands/run';
import {
  setup,
  showStatus,
  listAgents,
  agentInfo,
  searchMemory,
  clearOutput as clearOutputCommand,
} from './commands/system';

// Views
import { AgentsTreeProvider } from './views/agentsView';
import { SessionsTreeProvider } from './views/sessionsView';
import { MemoryTreeProvider } from './views/memoryView';
import { SystemTreeProvider } from './views/systemView';
import { StatusBarManager } from './views/statusBar';

// Providers
import { AgentCodeLensProvider } from './providers/codeLens';
import { AgentHoverProvider } from './providers/hover';

// =============================================================================
// Extension Activation
// =============================================================================

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('AutomatosX extension activating...');

  // Initialize services
  const outputChannel = getOutputChannel();
  const client = getAxClient(outputChannel);

  // Initialize status bar
  const statusBar = new StatusBarManager(client);
  await statusBar.initialize();
  context.subscriptions.push({ dispose: () => statusBar.dispose() });

  // Initialize tree views
  const agentsProvider = new AgentsTreeProvider(client);
  const sessionsProvider = new SessionsTreeProvider(client);
  const memoryProvider = new MemoryTreeProvider(client);
  const systemProvider = new SystemTreeProvider(client);

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('automatosx.agentsView', agentsProvider),
    vscode.window.registerTreeDataProvider('automatosx.sessionsView', sessionsProvider),
    vscode.window.registerTreeDataProvider('automatosx.memoryView', memoryProvider),
    vscode.window.registerTreeDataProvider('automatosx.systemView', systemProvider)
  );

  // Register Code Lens provider
  const codeLensProvider = new AgentCodeLensProvider();
  const codeLensLanguages = [
    'typescript',
    'typescriptreact',
    'javascript',
    'javascriptreact',
    'python',
    'go',
    'rust',
    'java',
    'kotlin',
    'csharp',
    'ruby',
    'php',
  ];

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      codeLensLanguages.map((lang) => ({ language: lang })),
      codeLensProvider
    )
  );

  // Register Hover provider
  const hoverProvider = new AgentHoverProvider();
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      codeLensLanguages.map((lang) => ({ language: lang })),
      hoverProvider
    )
  );

  // =============================================================================
  // Register Commands
  // =============================================================================

  // Run commands
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.run', () => runTask(client)),
    vscode.commands.registerCommand('automatosx.runWithAgent', (agentId?: string) =>
      runWithAgent(client, agentId)
    ),
    vscode.commands.registerCommand('automatosx.analyzeSelection', () => analyzeSelection(client)),
    vscode.commands.registerCommand('automatosx.explainCode', () => explainCode(client)),
    vscode.commands.registerCommand('automatosx.generateTests', () => generateTests(client)),
    vscode.commands.registerCommand('automatosx.securityReview', () => securityReview(client)),
    vscode.commands.registerCommand('automatosx.optimizeCode', () => optimizeCode(client)),
    vscode.commands.registerCommand('automatosx.refactorCode', () => refactorCode(client))
  );

  // System commands
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.setup', () => setup(client)),
    vscode.commands.registerCommand('automatosx.showStatus', () => showStatus(client)),
    vscode.commands.registerCommand('automatosx.listAgents', () => listAgents(client)),
    vscode.commands.registerCommand('automatosx.agentInfo', (agentId?: string) =>
      agentInfo(client, agentId)
    ),
    vscode.commands.registerCommand('automatosx.searchMemory', () => searchMemory(client)),
    vscode.commands.registerCommand('automatosx.clearOutput', () => clearOutputCommand())
  );

  // View refresh commands
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.refreshAgents', async () => {
      await agentsProvider.loadAgents();
      await statusBar.refresh();
    }),
    vscode.commands.registerCommand('automatosx.refreshSessions', async () => {
      await sessionsProvider.loadSessions();
    }),
    vscode.commands.registerCommand('automatosx.refreshMemory', async () => {
      await memoryProvider.loadStats();
    }),
    vscode.commands.registerCommand('automatosx.refreshSystem', async () => {
      await systemProvider.loadData();
      await statusBar.refresh();
    })
  );

  // Session commands
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.newSession', async () => {
      vscode.window.showInformationMessage('New sessions are created automatically when running tasks');
    }),
    vscode.commands.registerCommand('automatosx.showSessionInfo', async (sessionId: string) => {
      const session = await client.getSessionInfo(sessionId);
      if (session) {
        showOutput();
        clearOutput();
        outputChannel.appendLine(`## Session: ${session.displayId}`);
        outputChannel.appendLine('');
        outputChannel.appendLine(`**Agent:** ${session.agentId}`);
        outputChannel.appendLine(`**Status:** ${session.status}`);
        outputChannel.appendLine(`**Tasks:** ${session.taskCount}`);
        outputChannel.appendLine(`**Created:** ${new Date(session.createdAt).toLocaleString()}`);
        outputChannel.appendLine(`**Updated:** ${new Date(session.updatedAt).toLocaleString()}`);
      }
    })
  );

  // Code Lens specific commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'automatosx.askAboutSymbol',
      async (uri: vscode.Uri, symbol: { name: string; kind: string; range: vscode.Range }) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const startLine = symbol.range.start.line;
        const endLine = Math.min(startLine + 50, document.lineCount - 1);
        const code = document.getText(new vscode.Range(startLine, 0, endLine, 0));

        const languageId = document.languageId;
        const task = `Explain this ${symbol.kind} "${symbol.name}" in ${languageId}:

\`\`\`${languageId}
${code}
\`\`\`

Provide:
1. What this ${symbol.kind} does
2. Parameters/properties and their purposes
3. Return value (if applicable)
4. Usage examples`;

        await vscode.commands.executeCommand('automatosx.run');
      }
    ),
    vscode.commands.registerCommand(
      'automatosx.generateTestsForSymbol',
      async (uri: vscode.Uri, symbol: { name: string; kind: string; range: vscode.Range }) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const startLine = symbol.range.start.line;
        const endLine = Math.min(startLine + 50, document.lineCount - 1);

        // Select the code
        const editor = await vscode.window.showTextDocument(document);
        editor.selection = new vscode.Selection(
          new vscode.Position(startLine, 0),
          new vscode.Position(endLine, 0)
        );

        await vscode.commands.executeCommand('automatosx.generateTests');
      }
    ),
    vscode.commands.registerCommand(
      'automatosx.securityReviewSymbol',
      async (uri: vscode.Uri, symbol: { name: string; kind: string; range: vscode.Range }) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const startLine = symbol.range.start.line;
        const endLine = Math.min(startLine + 50, document.lineCount - 1);

        const editor = await vscode.window.showTextDocument(document);
        editor.selection = new vscode.Selection(
          new vscode.Position(startLine, 0),
          new vscode.Position(endLine, 0)
        );

        await vscode.commands.executeCommand('automatosx.securityReview');
      }
    )
  );

  // =============================================================================
  // Watch for Configuration Changes
  // =============================================================================

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('automatosx.showStatusBar')) {
        const show = vscode.workspace
          .getConfiguration('automatosx')
          .get<boolean>('showStatusBar', true);
        if (show) {
          await statusBar.initialize();
        } else {
          statusBar.dispose();
        }
      }
    })
  );

  // =============================================================================
  // Watch for Workspace Changes
  // =============================================================================

  // Refresh views when .automatosx directory changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/.automatosx/**');

  context.subscriptions.push(
    watcher.onDidCreate(async () => {
      await vscode.commands.executeCommand('automatosx.refreshAgents');
      await vscode.commands.executeCommand('automatosx.refreshSessions');
    }),
    watcher.onDidChange(async () => {
      await vscode.commands.executeCommand('automatosx.refreshAgents');
    }),
    watcher.onDidDelete(async () => {
      await vscode.commands.executeCommand('automatosx.refreshAgents');
    }),
    watcher
  );

  // =============================================================================
  // Initial Load
  // =============================================================================

  // Load data initially
  await Promise.all([
    agentsProvider.loadAgents(),
    sessionsProvider.loadSessions(),
    memoryProvider.loadStats(),
    systemProvider.loadData(),
  ]);

  console.log('AutomatosX extension activated successfully');
}

// =============================================================================
// Extension Deactivation
// =============================================================================

export function deactivate(): void {
  disposeAxClient();
  disposeOutputChannel();
  console.log('AutomatosX extension deactivated');
}
