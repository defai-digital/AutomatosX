/**
 * Agents TreeView
 *
 * Sidebar view showing available agents grouped by team.
 *
 * @module @ax/vscode-extension/views/agentsView
 */

import * as vscode from 'vscode';
import type { AxClient, Agent } from '../services/axClient';

// =============================================================================
// Types
// =============================================================================

type TreeItem = TeamItem | AgentItem;

class TeamItem extends vscode.TreeItem {
  constructor(
    public readonly team: string,
    public readonly agents: Agent[]
  ) {
    super(team.charAt(0).toUpperCase() + team.slice(1), vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'team';
    this.iconPath = new vscode.ThemeIcon('organization');
    this.description = `${agents.length} agents`;
  }
}

class AgentItem extends vscode.TreeItem {
  constructor(public readonly agent: Agent) {
    super(agent.displayName, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'agent';
    this.description = agent.id;
    this.tooltip = new vscode.MarkdownString(
      `**${agent.displayName}** (\`${agent.id}\`)\n\n` +
        `${agent.role}\n\n` +
        (agent.description ? `_${agent.description}_\n\n` : '') +
        `**Team:** ${agent.team}\n` +
        `**Status:** ${agent.enabled ? 'Enabled' : 'Disabled'}`
    );

    // Set icon based on team/role
    this.iconPath = this.getAgentIcon(agent);

    // Command to run with this agent
    this.command = {
      command: 'automatosx.runWithAgent',
      title: 'Run with Agent',
      arguments: [agent.id],
    };
  }

  private getAgentIcon(agent: Agent): vscode.ThemeIcon {
    const iconMap: Record<string, string> = {
      backend: 'server',
      frontend: 'browser',
      devops: 'server-process',
      security: 'shield',
      quality: 'beaker',
      data: 'database',
      researcher: 'search',
      architect: 'symbol-structure',
      cto: 'account',
      ceo: 'account',
      design: 'symbol-color',
      mobile: 'device-mobile',
      fullstack: 'layers',
      writer: 'edit',
      standard: 'robot',
    };

    const iconName = iconMap[agent.id] || 'robot';
    return new vscode.ThemeIcon(iconName);
  }
}

// =============================================================================
// Tree Data Provider
// =============================================================================

export class AgentsTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private agents: Agent[] = [];
  private agentsByTeam: Map<string, Agent[]> = new Map();

  constructor(private client: AxClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async loadAgents(): Promise<void> {
    this.agents = await this.client.getAgents();

    // Group by team
    this.agentsByTeam.clear();
    for (const agent of this.agents) {
      const team = agent.team || 'default';
      const teamAgents = this.agentsByTeam.get(team) || [];
      teamAgents.push(agent);
      this.agentsByTeam.set(team, teamAgents);
    }

    this.refresh();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Root level - load agents if needed
      if (this.agents.length === 0) {
        await this.loadAgents();
      }

      // Return team items
      const teams: TeamItem[] = [];
      for (const [team, agents] of this.agentsByTeam) {
        teams.push(new TeamItem(team, agents));
      }

      // Sort teams alphabetically, but put 'default' last
      teams.sort((a, b) => {
        if (a.team === 'default') return 1;
        if (b.team === 'default') return -1;
        return a.team.localeCompare(b.team);
      });

      return teams;
    }

    if (element instanceof TeamItem) {
      // Return agents in team
      return element.agents
        .filter((a) => a.enabled)
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((agent) => new AgentItem(agent));
    }

    return [];
  }

  getParent(element: TreeItem): vscode.ProviderResult<TreeItem> {
    if (element instanceof AgentItem) {
      const team = element.agent.team || 'default';
      const agents = this.agentsByTeam.get(team);
      if (agents) {
        return new TeamItem(team, agents);
      }
    }
    return null;
  }
}
