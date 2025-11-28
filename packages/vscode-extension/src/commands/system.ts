/**
 * System Commands
 *
 * Commands for system operations like setup, status, etc.
 *
 * @module @ax/vscode-extension/commands/system
 */

import * as vscode from 'vscode';
import type { AxClient } from '../services/axClient';
import * as output from '../utils/output';

// =============================================================================
// Setup Command
// =============================================================================

/**
 * Setup AutomatosX in the workspace
 */
export async function setup(client: AxClient): Promise<void> {
  const isInitialized = await client.isInitialized();

  if (isInitialized) {
    const force = await vscode.window.showWarningMessage(
      'AutomatosX is already initialized. Reinitialize?',
      'Yes',
      'No'
    );

    if (force !== 'Yes') {
      return;
    }
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Setting up AutomatosX...',
    },
    async () => {
      const result = await client.setup(isInitialized);

      if (result.success) {
        vscode.window.showInformationMessage('AutomatosX initialized successfully!');

        // Refresh views
        await vscode.commands.executeCommand('automatosx.refreshAgents');
        await vscode.commands.executeCommand('automatosx.refreshSessions');
      } else {
        vscode.window.showErrorMessage(`Setup failed: ${result.message}`);
      }
    }
  );
}

// =============================================================================
// Status Command
// =============================================================================

/**
 * Show system status
 */
export async function showStatus(client: AxClient): Promise<void> {
  output.show();
  output.clear();
  output.header('AutomatosX Status');

  try {
    const status = await client.getStatus();

    if (!status.initialized) {
      output.warning('AutomatosX is not initialized in this workspace');
      output.appendLine('');
      output.info('Run "AutomatosX: Setup" to initialize');
      return;
    }

    output.keyValue('Initialized', 'Yes');
    output.keyValue('Base Path', status.basePath);
    output.appendLine('');

    output.subheader('Statistics');
    output.keyValue('Agents', status.agentCount);
    output.keyValue('Sessions', status.sessionCount);
    output.keyValue('Memory Entries', status.memoryEntries);
    output.appendLine('');

    output.subheader('Providers');
    if (status.providers.length === 0) {
      output.info('No providers configured');
    } else {
      for (const provider of status.providers) {
        const statusIcon =
          provider.status === 'healthy' ? '✓' : provider.status === 'degraded' ? '⚠' : '✗';
        output.appendLine(`${statusIcon} **${provider.name}**: ${provider.status}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    output.error(`Failed to get status: ${message}`);
  }
}

// =============================================================================
// List Agents Command
// =============================================================================

/**
 * List all available agents
 */
export async function listAgents(client: AxClient): Promise<void> {
  output.show();
  output.clear();
  output.header('Available Agents');

  try {
    const agents = await client.getAgents();

    if (agents.length === 0) {
      output.warning('No agents found');
      output.appendLine('');
      output.info('Run "AutomatosX: Setup" to initialize agents');
      return;
    }

    // Group by team
    const byTeam = agents.reduce<Record<string, typeof agents>>((acc, agent) => {
      const team = agent.team || 'default';
      if (!acc[team]) {
        acc[team] = [];
      }
      acc[team]!.push(agent);
      return acc;
    }, {});

    for (const [team, teamAgents] of Object.entries(byTeam)) {
      output.subheader(team.charAt(0).toUpperCase() + team.slice(1));

      for (const agent of teamAgents) {
        const status = agent.enabled ? '✓' : '✗';
        output.appendLine(`${status} **${agent.displayName}** (\`${agent.id}\`)`);
        output.appendLine(`   ${agent.role}`);
        if (agent.description) {
          output.appendLine(`   _${agent.description}_`);
        }
        output.appendLine('');
      }
    }

    output.divider();
    output.info(`Total: ${agents.length} agents`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    output.error(`Failed to list agents: ${message}`);
  }
}

// =============================================================================
// Agent Info Command
// =============================================================================

/**
 * Show detailed info about an agent
 */
export async function agentInfo(client: AxClient, agentId?: string): Promise<void> {
  let id = agentId;

  if (!id) {
    // Ask user to select an agent
    const agents = await client.getAgents();

    if (agents.length === 0) {
      vscode.window.showWarningMessage('No agents found');
      return;
    }

    const selected = await vscode.window.showQuickPick(
      agents.map((a) => ({
        label: a.displayName,
        description: a.id,
        detail: a.role,
      })),
      { placeHolder: 'Select an agent' }
    );

    if (!selected) {
      return;
    }

    id = selected.description;
  }

  if (!id) {
    return;
  }

  output.show();
  output.clear();

  try {
    const agent = await client.getAgentInfo(id);

    if (!agent) {
      output.error(`Agent "${id}" not found`);
      return;
    }

    output.header(`Agent: ${agent.displayName}`);

    output.subheader('Details');
    output.keyValue('ID', agent.id);
    output.keyValue('Display Name', agent.displayName);
    output.keyValue('Role', agent.role);
    output.keyValue('Team', agent.team);
    output.keyValue('Status', agent.enabled ? 'Enabled' : 'Disabled');

    if (agent.description) {
      output.appendLine('');
      output.keyValue('Description', agent.description);
    }

    if (agent.abilities && agent.abilities.length > 0) {
      output.subheader('Abilities');
      output.list(agent.abilities);
    }

    if (agent.orchestration) {
      output.subheader('Orchestration');
      output.keyValue('Max Delegation Depth', agent.orchestration.maxDelegationDepth);
      output.keyValue('Priority', agent.orchestration.priority);
      if (agent.orchestration.canDelegateTo.length > 0) {
        output.keyValue('Can Delegate To', agent.orchestration.canDelegateTo.join(', '));
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    output.error(`Failed to get agent info: ${message}`);
  }
}

// =============================================================================
// Search Memory Command
// =============================================================================

/**
 * Search conversation memory
 */
export async function searchMemory(client: AxClient): Promise<void> {
  const query = await vscode.window.showInputBox({
    prompt: 'Search memory',
    placeHolder: 'Enter search query...',
    ignoreFocusOut: true,
  });

  if (!query) {
    return;
  }

  output.show();
  output.clear();
  output.header(`Memory Search: "${query}"`);

  try {
    const results = await client.searchMemory(query);

    if (results.length === 0) {
      output.info('No results found');
      return;
    }

    output.info(`Found ${results.length} results`);
    output.appendLine('');

    for (const entry of results) {
      output.divider();
      output.appendLine('');
      if (entry.agentId) {
        output.keyValue('Agent', entry.agentId);
      }
      output.keyValue('Date', output.formatDate(entry.createdAt));
      if (entry.relevance !== undefined) {
        output.keyValue('Relevance', `${(entry.relevance * 100).toFixed(0)}%`);
      }
      if (entry.tags.length > 0) {
        output.keyValue('Tags', entry.tags.join(', '));
      }
      output.appendLine('');
      output.appendLine(entry.content);
      output.appendLine('');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    output.error(`Search failed: ${message}`);
  }
}

// =============================================================================
// Clear Output Command
// =============================================================================

/**
 * Clear the output channel
 */
export function clearOutput(): void {
  output.clear();
}
