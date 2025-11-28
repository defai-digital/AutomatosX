/**
 * Run Commands
 *
 * Commands for executing tasks with agents.
 *
 * @module @ax/vscode-extension/commands/run
 */

import * as vscode from 'vscode';
import type { AxClient, Agent } from '../services/axClient';
import * as output from '../utils/output';

// =============================================================================
// Run Task Command
// =============================================================================

/**
 * Run a task with auto-selected agent
 */
export async function runTask(client: AxClient): Promise<void> {
  const task = await vscode.window.showInputBox({
    prompt: 'What do you need help with?',
    placeHolder: 'Describe your task...',
    ignoreFocusOut: true,
  });

  if (!task) {
    return;
  }

  await executeTask(client, 'auto', task);
}

// =============================================================================
// Run With Agent Command
// =============================================================================

/**
 * Run a task with a specific agent
 */
export async function runWithAgent(client: AxClient, preselectedAgent?: string): Promise<void> {
  let agentId = preselectedAgent;

  if (!agentId) {
    // Get available agents
    const agents = await client.getAgents();

    if (agents.length === 0) {
      const setup = await vscode.window.showWarningMessage(
        'No agents found. Would you like to setup AutomatosX?',
        'Setup',
        'Cancel'
      );

      if (setup === 'Setup') {
        await vscode.commands.executeCommand('automatosx.setup');
      }
      return;
    }

    // Group agents by team
    const agentsByTeam = agents.reduce<Record<string, Agent[]>>((acc, agent) => {
      const team = agent.team || 'default';
      if (!acc[team]) {
        acc[team] = [];
      }
      acc[team]!.push(agent);
      return acc;
    }, {});

    // Create quick pick items
    const items: vscode.QuickPickItem[] = [];

    for (const [team, teamAgents] of Object.entries(agentsByTeam)) {
      // Add team separator
      items.push({
        label: team.charAt(0).toUpperCase() + team.slice(1),
        kind: vscode.QuickPickItemKind.Separator,
      });

      // Add agents in team
      for (const agent of teamAgents) {
        items.push({
          label: agent.displayName,
          description: agent.id,
          detail: agent.role,
        });
      }
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select an agent',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!selected || selected.kind === vscode.QuickPickItemKind.Separator) {
      return;
    }

    agentId = selected.description;
  }

  if (!agentId) {
    return;
  }

  // Get task description
  const task = await vscode.window.showInputBox({
    prompt: `What should ${agentId} agent do?`,
    placeHolder: 'Describe the task...',
    ignoreFocusOut: true,
  });

  if (!task) {
    return;
  }

  await executeTask(client, agentId, task);
}

// =============================================================================
// Analyze Selection Command
// =============================================================================

/**
 * Analyze selected code
 */
export async function analyzeSelection(client: AxClient): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  // Get available agents and filter for analysis-capable ones
  const agents = await client.getAgents();
  const analysisAgents = agents.filter(
    (a) =>
      a.id === 'backend' ||
      a.id === 'frontend' ||
      a.id === 'security' ||
      a.id === 'quality' ||
      a.id === 'standard'
  );

  const items = analysisAgents.map((agent) => ({
    label: agent.displayName,
    description: agent.id,
    detail: agent.role,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select an agent to analyze the code',
  });

  if (!selected) {
    return;
  }

  const fileName = editor.document.fileName.split('/').pop();
  const languageId = editor.document.languageId;

  const task = `Analyze this ${languageId} code from ${fileName}:

\`\`\`${languageId}
${selection}
\`\`\`

Provide:
1. A brief explanation of what this code does
2. Any potential issues or improvements
3. Best practices recommendations`;

  await executeTask(client, selected.description!, task);
}

// =============================================================================
// Code Action Commands
// =============================================================================

/**
 * Explain selected code
 */
export async function explainCode(client: AxClient): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  const languageId = editor.document.languageId;
  const task = `Explain this ${languageId} code in detail:

\`\`\`${languageId}
${selection}
\`\`\`

Provide:
1. What this code does (high-level overview)
2. Step-by-step explanation of how it works
3. Any important concepts or patterns used`;

  await executeTask(client, 'standard', task);
}

/**
 * Generate tests for selected code
 */
export async function generateTests(client: AxClient): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  const languageId = editor.document.languageId;
  const fileName = editor.document.fileName.split('/').pop();

  const task = `Generate comprehensive unit tests for this ${languageId} code from ${fileName}:

\`\`\`${languageId}
${selection}
\`\`\`

Requirements:
1. Cover all main functionality
2. Include edge cases
3. Use appropriate testing framework for this language
4. Include setup/teardown if needed
5. Add descriptive test names`;

  await executeTask(client, 'quality', task);
}

/**
 * Security review of selected code
 */
export async function securityReview(client: AxClient): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  const languageId = editor.document.languageId;

  const task = `Perform a security review of this ${languageId} code:

\`\`\`${languageId}
${selection}
\`\`\`

Check for:
1. Input validation issues
2. Injection vulnerabilities (SQL, XSS, command injection, etc.)
3. Authentication/authorization issues
4. Sensitive data exposure
5. Cryptographic weaknesses
6. OWASP Top 10 vulnerabilities
7. Language-specific security issues

Provide severity ratings and remediation suggestions.`;

  await executeTask(client, 'security', task);
}

/**
 * Optimize selected code
 */
export async function optimizeCode(client: AxClient): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  const languageId = editor.document.languageId;

  const task = `Optimize this ${languageId} code for better performance:

\`\`\`${languageId}
${selection}
\`\`\`

Consider:
1. Time complexity improvements
2. Space complexity improvements
3. Memory efficiency
4. Caching opportunities
5. Algorithm optimization
6. Language-specific optimizations

Provide the optimized code with explanations of changes.`;

  await executeTask(client, 'backend', task);
}

/**
 * Refactor selected code
 */
export async function refactorCode(client: AxClient): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  const languageId = editor.document.languageId;

  // Ask for refactoring focus
  const refactorType = await vscode.window.showQuickPick(
    [
      { label: 'Clean Code', description: 'Improve readability and maintainability' },
      { label: 'Design Patterns', description: 'Apply appropriate design patterns' },
      { label: 'SOLID Principles', description: 'Apply SOLID principles' },
      { label: 'Extract Functions', description: 'Break down into smaller functions' },
      { label: 'Type Safety', description: 'Improve type safety and contracts' },
    ],
    { placeHolder: 'Select refactoring focus' }
  );

  if (!refactorType) {
    return;
  }

  const task = `Refactor this ${languageId} code with focus on ${refactorType.label}:

\`\`\`${languageId}
${selection}
\`\`\`

Goal: ${refactorType.description}

Requirements:
1. Maintain existing functionality
2. Improve code quality
3. Follow ${languageId} best practices
4. Add comments explaining significant changes

Provide the refactored code with explanations.`;

  await executeTask(client, 'standard', task);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Execute a task and show output
 */
async function executeTask(client: AxClient, agent: string, task: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('automatosx');
  const timeout = config.get<number>('timeout', 300000);
  const streamOutput = config.get<boolean>('streamOutput', true);

  output.show();
  output.taskStart(agent, task);

  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Running task with ${agent}...`,
        cancellable: true,
      },
      async (progress, token) => {
        return client.executeTask(agent, task, {
          timeout,
          stream: streamOutput,
          token,
          onOutput: (text) => {
            output.append(text);
          },
        });
      }
    );

    if (result.success) {
      // If not streaming, output the result now
      if (!streamOutput) {
        output.appendLine(result.output);
      }
      output.taskComplete(result.duration, result.provider);

      vscode.window.showInformationMessage(
        `Task completed by ${result.agent} in ${output.formatDuration(result.duration)}`
      );
    } else {
      output.taskError(result.error || 'Unknown error');
      vscode.window.showErrorMessage(`Task failed: ${result.error}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    output.taskError(message);
    vscode.window.showErrorMessage(`Execution failed: ${message}`);
  }
}
