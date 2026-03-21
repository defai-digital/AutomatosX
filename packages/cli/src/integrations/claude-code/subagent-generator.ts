/**
 * Claude Code Subagent File Generator
 *
 * Generates .claude/agents/<name>.md files with Claude Code 2026 YAML
 * frontmatter for each agent, plus the automatosx-coordinator.md.
 *
 * These files enable Claude Code to invoke AutomatosX agents as
 * native subagents with appropriate permissions and MCP access.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SubagentFrontmatter, AgentClaudeCodeConfig } from './types.js';
import { fileExists } from './utils/file-utils.js';

/** Minimal agent shape we need from agent-domain */
interface AgentLike {
  name: string;
  displayName?: string;
  description?: string;
  role?: string;
  systemPrompt?: string;
  claude_code?: AgentClaudeCodeConfig;
}

const COORDINATOR_NAME = 'automatosx-coordinator';

export interface SubagentGenerateResult {
  agentsDir: string;
  filesWritten: string[];
  filesSkipped: string[];
}

export interface SubagentGeneratorOptions {
  projectDir: string;
  force?: boolean;
}

export class SubagentGenerator {
  private projectDir: string;
  private force: boolean;

  constructor(options: SubagentGeneratorOptions) {
    this.projectDir = options.projectDir;
    this.force = options.force ?? false;
  }

  /**
   * Generate per-agent subagent files plus the coordinator.
   * Can be called independently (e.g. via `ax init --claude-agents-only`).
   */
  async generate(agents: AgentLike[]): Promise<SubagentGenerateResult> {
    const agentsDir = join(this.projectDir, '.claude', 'agents');
    await mkdir(agentsDir, { recursive: true });

    const filesWritten: string[] = [];
    const filesSkipped: string[] = [];

    // Write coordinator first
    const coordinatorPath = join(agentsDir, `${COORDINATOR_NAME}.md`);
    if ((await fileExists(coordinatorPath)) && !this.force) {
      filesSkipped.push(`${COORDINATOR_NAME}.md`);
    } else {
      await writeFile(coordinatorPath, this.buildCoordinatorFile(agents));
      filesWritten.push(`${COORDINATOR_NAME}.md`);
    }

    // Write per-agent files
    for (const agent of agents) {
      if (agent.name === COORDINATOR_NAME) continue;

      const filename = `${agent.name}.md`;
      const filePath = join(agentsDir, filename);

      if ((await fileExists(filePath)) && !this.force) {
        filesSkipped.push(filename);
        continue;
      }

      await writeFile(filePath, this.buildAgentFile(agent));
      filesWritten.push(filename);
    }

    return { agentsDir, filesWritten, filesSkipped };
  }

  /** Returns true if coordinator file exists */
  async areSubagentFilesGenerated(): Promise<boolean> {
    const coordinatorPath = join(this.projectDir, '.claude', 'agents', `${COORDINATOR_NAME}.md`);
    return fileExists(coordinatorPath);
  }

  // ─── Private builders ────────────────────────────────────────────────────────

  private buildFrontmatter(agent: AgentLike): SubagentFrontmatter {
    const cc: AgentClaudeCodeConfig = agent.claude_code ?? {};
    return {
      name: agent.name,
      description: this.getDescription(agent),
      tools: cc.tools?.allow ?? ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
      disallowedTools: cc.tools?.deny ?? ['WebSearch'],
      model: cc.model ?? 'sonnet',
      permissionMode: cc.permissionMode ?? 'acceptEdits',
      maxTurns: cc.maxTurns ?? 50,
      memory: cc.memory ?? 'project',
      background: cc.background ?? false,
      mcpServers: cc.mcpServers ?? ['automatosx'],
      skills: cc.skills ?? [],
      ...(cc.isolation !== undefined && { isolation: cc.isolation }),
      ...(cc.effort !== undefined && { effort: cc.effort }),
    };
  }

  private renderFrontmatter(fm: SubagentFrontmatter): string {
    const lines: string[] = ['---'];
    lines.push(`name: ${fm.name}`);
    lines.push(`description: ${JSON.stringify(fm.description)}`);
    if (fm.tools?.length) lines.push(`tools: ${fm.tools.join(', ')}`);
    if (fm.disallowedTools?.length) lines.push(`disallowedTools: ${fm.disallowedTools.join(', ')}`);
    if (fm.model) lines.push(`model: ${fm.model}`);
    if (fm.permissionMode) lines.push(`permissionMode: ${fm.permissionMode}`);
    if (fm.maxTurns !== undefined) lines.push(`maxTurns: ${fm.maxTurns}`);
    if (fm.memory) lines.push(`memory: ${fm.memory}`);
    if (fm.background !== undefined) lines.push(`background: ${fm.background}`);
    if (fm.isolation !== undefined) lines.push(`isolation: ${fm.isolation}`);
    if (fm.effort) lines.push(`effort: ${fm.effort}`);
    if (fm.mcpServers?.length) {
      lines.push('mcpServers:');
      for (const s of fm.mcpServers) lines.push(`  - ${s}`);
    }
    if (fm.skills?.length) {
      lines.push('skills:');
      for (const s of fm.skills) lines.push(`  - ${s}`);
    }
    lines.push(`generated: ${new Date().toISOString()}`);
    lines.push('---');
    return lines.join('\n');
  }

  private buildAgentFile(agent: AgentLike): string {
    const fm = this.buildFrontmatter(agent);
    const displayName = agent.displayName ?? agent.name;
    const frontmatter = this.renderFrontmatter(fm);
    const body = agent.systemPrompt?.trim()
      ?? `You are ${displayName}, a specialized AI agent. ${this.getDescription(agent)}`;
    const ts = new Date().toISOString();

    return `${frontmatter}

# ${displayName}

${body}

## AutomatosX Integration

You have access to AutomatosX memory and agent orchestration via MCP:

- \`mcp__automatosx__search_memory\` — Search past decisions and context
- \`mcp__automatosx__run_agent\` — Delegate to another specialist agent
- \`mcp__automatosx__session_create\` — Start a multi-agent session

Always search memory before starting a task to leverage past decisions.

---

**Generated:** ${ts}
**Generator:** AutomatosX SubagentGenerator
`;
  }

  private buildCoordinatorFile(agents: AgentLike[]): string {
    const agentList = agents
      .filter(a => a.name !== COORDINATOR_NAME)
      .map(a => `- **${a.displayName ?? a.name}** (\`${a.name}\`): ${this.getDescription(a)}`)
      .join('\n');
    const ts = new Date().toISOString();

    return `---
name: ${COORDINATOR_NAME}
description: "Orchestrates AutomatosX multi-agent workflows. Automatically invoked for complex tasks requiring multiple specialists."
tools: Bash, mcp__automatosx__run_agent, mcp__automatosx__search_memory, mcp__automatosx__session_create
model: sonnet
permissionMode: acceptEdits
maxTurns: 100
memory: project
mcpServers:
  - automatosx
generated: ${ts}
---

# AutomatosX Coordinator

You orchestrate multi-agent workflows using AutomatosX.

## Available Agents

${agentList}

## Core Rules

1. Always search memory first: \`mcp__automatosx__search_memory\`
2. Decompose complex tasks into agent-specific subtasks
3. Run agents in dependency order
4. Save decisions to memory for future leverage

## MCP Tools

- \`mcp__automatosx__run_agent({ agent, task })\` — Execute an agent
- \`mcp__automatosx__search_memory({ query, limit? })\` — Search past decisions
- \`mcp__automatosx__session_create({ name, agent })\` — Start multi-agent session
- \`mcp__automatosx__list_agents()\` — List available agents

---

**Generated:** ${ts}
**Generator:** AutomatosX SubagentGenerator
**Agent Count:** ${agents.length}
`;
  }

  private getDescription(agent: AgentLike): string {
    if (agent.description?.trim()) return agent.description.trim();
    if (agent.role?.trim()) return agent.role.trim();
    if (agent.systemPrompt) {
      const first = agent.systemPrompt.split('\n')[0]?.trim();
      if (first && first.length < 200) return first;
    }
    return `Specialized agent for ${agent.name}`;
  }
}
