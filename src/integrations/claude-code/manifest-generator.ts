/**
 * Manifest Generator for Claude Code Integration
 *
 * Auto-generates Claude Code integration files from actual agent profiles:
 * - Skills: Auto-discovery for multi-agent orchestration
 * - Commands: Quick slash commands for each agent
 * - Sub-Agents: Specialized coordinator for complex workflows
 *
 * This ensures integration always matches actual capabilities,
 * eliminating documentation dependency and manual maintenance.
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { ProfileLoader } from '../../agents/profile-loader.js';
import type { AgentProfile } from '../../types/agent.js';
import { logger } from '../../shared/logging/logger.js';
import type { AgentClaudeCodeConfig } from '../../types/agent-claude-code.js';
import type { SubagentFrontmatter } from './types.js';

export interface ManifestGeneratorOptions {
  profileLoader: ProfileLoader;
  projectDir: string;
}

export class ManifestGenerator {
  private profileLoader: ProfileLoader;
  private projectDir: string;

  constructor(options: ManifestGeneratorOptions) {
    this.profileLoader = options.profileLoader;
    this.projectDir = options.projectDir;
  }

  /**
   * Generate all Claude Code integration manifests
   */
  async generateAll(): Promise<void> {
    logger.info('[ManifestGenerator] Starting manifest generation...');

    try {
      // Load profiles once and reuse across all sub-generators
      const agents = await this.loadAllAgentProfiles();
      await this.generateSkillsFromProfiles(agents);
      await this.generateCommandsFromProfiles(agents);
      await this.generateSubAgentFromProfiles(agents);
      await this.generatePerAgentSubAgentsFromProfiles(agents);

      logger.info('[ManifestGenerator] Manifest generation complete');
    } catch (error) {
      logger.error('[ManifestGenerator] Manifest generation failed', { error });
      throw error;
    }
  }

  /**
   * Load all agent profiles. Throws if no profiles could be loaded at all.
   */
  private async loadAllAgentProfiles(): Promise<AgentProfile[]> {
    const agentNames = await this.profileLoader.listProfiles();
    const profiles: AgentProfile[] = [];
    const failed: string[] = [];

    for (const name of agentNames) {
      try {
        const profile = await this.profileLoader.loadProfile(name);
        profiles.push(profile);
      } catch (error) {
        logger.warn('[ManifestGenerator] Failed to load profile', { name, error });
        failed.push(name);
      }
    }

    if (profiles.length === 0) {
      throw new Error(
        `No agent profiles could be loaded. Failed: ${failed.join(', ') || '(none found)'}`
      );
    }

    return profiles;
  }

  /**
   * Generate Skills for auto-discovery in Claude Code
   */
  async generateSkills(): Promise<void> {
    const agents = await this.loadAllAgentProfiles();
    await this.generateSkillsFromProfiles(agents);
  }

  private async generateSkillsFromProfiles(agents: AgentProfile[]): Promise<void> {
    logger.info('[ManifestGenerator] Generating skills...');

    const skillsDir = join(this.projectDir, '.claude', 'skills', 'automatosx');

    await mkdir(skillsDir, { recursive: true });

    // Generate master orchestration skill
    const orchestrationSkill = this.generateOrchestrationSkill(agents);
    await writeFile(join(skillsDir, 'SKILL.md'), orchestrationSkill);

    logger.info('[ManifestGenerator] Skills generated', {
      count: 1,
      path: skillsDir
    });
  }

  /**
   * Generate slash commands for each agent
   */
  async generateCommands(): Promise<void> {
    const agents = await this.loadAllAgentProfiles();
    await this.generateCommandsFromProfiles(agents);
  }

  private async generateCommandsFromProfiles(agents: AgentProfile[]): Promise<void> {
    logger.info('[ManifestGenerator] Generating commands...');

    const commandsDir = join(this.projectDir, '.claude', 'commands');

    await mkdir(commandsDir, { recursive: true });

    let commandCount = 0;
    for (const agent of agents) {
      const command = this.generateAgentCommand(agent);
      await writeFile(join(commandsDir, `agent-${agent.name}.md`), command);
      commandCount++;
    }

    logger.info('[ManifestGenerator] Commands generated', {
      count: commandCount,
      path: commandsDir
    });
  }

  /**
   * Generate coordinator sub-agent as .claude/agents/automatosx-coordinator.md
   * (flat file, consistent with per-agent subagent files)
   */
  async generateSubAgent(): Promise<void> {
    const agents = await this.loadAllAgentProfiles();
    await this.generateSubAgentFromProfiles(agents);
  }

  private async generateSubAgentFromProfiles(agents: AgentProfile[]): Promise<void> {
    logger.info('[ManifestGenerator] Generating coordinator sub-agent...');

    const agentsDir = join(this.projectDir, '.claude', 'agents');

    await mkdir(agentsDir, { recursive: true });

    const subAgent = this.generateCoordinatorAgent(agents);
    const filePath = join(agentsDir, 'automatosx-coordinator.md');
    await writeFile(filePath, subAgent);

    logger.info('[ManifestGenerator] Coordinator sub-agent generated', {
      path: filePath,
    });
  }

  // =========================================================================
  // Private: Template Generation Methods
  // =========================================================================

  /**
   * Generate master orchestration skill
   */
  private generateOrchestrationSkill(agents: AgentProfile[]): string {
    const agentsList = agents
      .map((a) => {
        const displayName = a.displayName || a.name;
        return `- **${displayName}** (\`${a.name}\`): ${this.getAgentDescription(a)}`;
      })
      .join('\n');

    const timestamp = new Date().toISOString();

    return `---
name: automatosx-orchestration
description: |
  Coordinate multi-agent workflows using AutomatosX. Automatically invoked when:
  - User asks "work with ax agents to..."
  - Complex tasks requiring multiple specialists
  - Searching for past decisions and context
generated: ${timestamp}
generator: manifest-generator
---

# AutomatosX Multi-Agent Orchestration

This skill coordinates specialized AI agents for complex development tasks.

**IMPORTANT:** This file is auto-generated from agent profiles. Do not edit manually.
Regenerate with: \`npm run generate:claude-manifests\`

## Available Agents (Auto-Discovered)

${agentsList}

## How to Use

Simply ask Claude Code to work with AutomatosX:

- "Work with ax to design and implement authentication"
- "Ask ax agents to audit this code for security and quality"
- "Have ax search past decisions about database schema"

Claude Code will automatically:
1. Search memory for relevant context
2. Select appropriate agents for the task
3. Coordinate execution and aggregate results
4. Present findings with memory references

## Memory Leverage

AutomatosX maintains persistent memory of all past decisions. Always search first:

\`\`\`
I'll search our memory for past decisions about this topic.
\`\`\`

Then reference memory indices in responses:
\`\`\`
Based on our past decision [#8721], we should use PostgreSQL with JSONB.
\`\`\`

## MCP Tools Available

- \`mcp__automatosx__run_agent\` - Execute agent with memory context
- \`mcp__automatosx__list_agents\` - Discover available agents
- \`mcp__automatosx__search_memory\` - Query persistent memory
- \`mcp__automatosx__session_create\` - Create multi-agent session
- \`mcp__automatosx__session_list\` - List active sessions
- \`mcp__automatosx__session_status\` - Get session details

## Example Workflows

### Complete Feature Implementation
1. Run product agent for design
2. Search memory for similar past designs
3. Run backend agent for implementation
4. Run security agent for audit
5. Run quality agent for tests

### Leverage Existing Decisions
1. Search memory for "authentication design"
2. Retrieve design from past conversation
3. Use as context for new implementation

---

**Generated:** ${timestamp}
**Generator:** AutomatosX ManifestGenerator v1.0.0
**Agent Count:** ${agents.length}
`;
  }

  /**
   * Generate slash command for a specific agent
   */
  private generateAgentCommand(agent: AgentProfile): string {
    const description = this.getAgentDescription(agent);
    const displayName = agent.displayName || agent.name;

    return `---
description: Run the ${displayName} agent (${agent.name})
argument-hint: "task description"
allowed-tools: Bash(ax:*)
generated: ${new Date().toISOString()}
generator: manifest-generator
---

# ${displayName} Agent

${description}

Execute the **${displayName}** agent to: $ARGUMENTS

\`\`\`bash
ax run ${agent.name} "$ARGUMENTS"
\`\`\`

**Note:** This command is auto-generated from agent profiles.
`;
  }

  /**
   * Generate coordinator sub-agent
   */
  private generateCoordinatorAgent(agents: AgentProfile[]): string {
    const agentsList = agents
      .map((a) => {
        const displayName = a.displayName || a.name;
        return `- **${displayName}** (\`${a.name}\`): ${this.getAgentDescription(a)}`;
      })
      .join('\n');

    const timestamp = new Date().toISOString();

    return `---
name: automatosx-coordinator
description: |
  Specialized agent for orchestrating AutomatosX workflows and multi-agent coordination.
  Automatically invoked for complex development tasks requiring multiple specialists.
tools: Bash(ax:*), mcp__automatosx__run_agent, mcp__automatosx__search_memory, mcp__automatosx__session_create
model: sonnet
generated: ${timestamp}
generator: manifest-generator
---

# AutomatosX Coordinator Agent

You are specialized in orchestrating multi-agent workflows using AutomatosX.

**IMPORTANT:** This file is auto-generated. Do not edit manually.

Your core responsibilities:
1. **Decompose Complex Tasks**: Break into agent-specific subtasks
2. **Leverage Memory**: Search past decisions using mcp__automatosx__search_memory
3. **Execute Sequentially**: Run agents in optimal dependency order
4. **Monitor & Coordinate**: Track progress and handle failures
5. **Summarize Results**: Present findings to user with memory indices

## Available Agents

${agentsList}

## Workflow Examples

### Scenario: Implement User Authentication
1. Search memory for past auth designs
2. Run product agent for design refinement
3. Run backend agent for API implementation
4. Run security agent for threat review
5. Run quality agent for test coverage
6. Save decisions to memory for future reference

### Scenario: Refactor Large Module
1. Run architecture agent for analysis
2. Run backend/frontend (depending on context)
3. Run quality agent for test impact
4. Run security agent for security implications

## Critical Rules

- Always search memory FIRST for past decisions
- Mention memory indices in your responses (users may want to reference them)
- Run security agent for any auth/encryption/sensitive data work
- Run quality agent before marking work complete
- Save complex decisions to memory for future leverage

## MCP Tools Available

- \`mcp__automatosx__run_agent({ agent: string, task: string })\` - Execute agent
- \`mcp__automatosx__search_memory({ query: string, limit?: number })\` - Search memory
- \`mcp__automatosx__session_create({ name: string, agent: string })\` - Create session
- \`mcp__automatosx__list_agents()\` - List all available agents

---

**Generated:** ${timestamp}
**Generator:** AutomatosX ManifestGenerator v1.0.0
**Agent Count:** ${agents.length}
`;
  }

  /**
   * Generate one .claude/agents/<name>.md per agent profile with full
   * Claude Code 2026 YAML frontmatter. These complement the coordinator.
   *
   * Can be called independently (e.g. via `ax setup --agents-only`) to
   * regenerate only the per-agent subagent files without re-running the
   * full setup flow.
   */
  async generatePerAgentSubAgents(): Promise<void> {
    const agents = await this.loadAllAgentProfiles();
    await this.generatePerAgentSubAgentsFromProfiles(agents);
  }

  private async generatePerAgentSubAgentsFromProfiles(agents: AgentProfile[]): Promise<void> {
    logger.info('[ManifestGenerator] Generating per-agent subagent files...');

    const agentsDir = join(this.projectDir, '.claude', 'agents');
    await mkdir(agentsDir, { recursive: true });

    // Reserved name — the coordinator is generated separately by generateSubAgent()
    const RESERVED = 'automatosx-coordinator';

    let count = 0;
    for (const agent of agents) {
      if (agent.name === RESERVED) {
        logger.warn('[ManifestGenerator] Skipping reserved agent name in per-agent generation', {
          name: agent.name,
        });
        continue;
      }
      const content = this.generateAgentSubAgentFile(agent);
      const filePath = join(agentsDir, `${agent.name}.md`);
      await writeFile(filePath, content);
      count++;
    }

    logger.info('[ManifestGenerator] Per-agent subagent files generated', {
      count,
      path: agentsDir,
    });
  }

  /**
   * Build the full subagent frontmatter for a given agent profile,
   * honouring any claude_code: section in the profile YAML if present.
   */
  private buildSubagentFrontmatter(agent: AgentProfile): SubagentFrontmatter {
    // Use the typed claude_code field from AgentProfile (added in v11.5.0)
    const cc: AgentClaudeCodeConfig = agent.claude_code ?? {};

    const allowedTools = cc.tools?.allow ?? [
      'Read',
      'Edit',
      'Write',
      'Bash',
      'Glob',
      'Grep',
    ];
    const disallowedTools = cc.tools?.deny ?? ['WebSearch'];

    return {
      name: agent.name,
      description: this.getAgentDescription(agent),
      tools: allowedTools,
      disallowedTools,
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

  /**
   * Render a .claude/agents/<name>.md file for a single agent.
   */
  private generateAgentSubAgentFile(agent: AgentProfile): string {
    const fm = this.buildSubagentFrontmatter(agent);
    const displayName = agent.displayName || agent.name;
    const timestamp = new Date().toISOString();

    // Build YAML frontmatter lines
    const lines: string[] = ['---'];
    lines.push(`name: ${fm.name}`);
    lines.push(`description: ${JSON.stringify(fm.description)}`);

    if (fm.tools && fm.tools.length > 0) {
      lines.push(`tools: ${fm.tools.join(', ')}`);
    }
    if (fm.disallowedTools && fm.disallowedTools.length > 0) {
      lines.push(`disallowedTools: ${fm.disallowedTools.join(', ')}`);
    }
    if (fm.model) lines.push(`model: ${fm.model}`);
    if (fm.permissionMode) lines.push(`permissionMode: ${fm.permissionMode}`);
    if (fm.maxTurns !== undefined) lines.push(`maxTurns: ${fm.maxTurns}`);
    if (fm.memory) lines.push(`memory: ${fm.memory}`);
    if (fm.background !== undefined) lines.push(`background: ${fm.background}`);
    if (fm.isolation !== undefined) lines.push(`isolation: ${fm.isolation}`);
    if (fm.effort) lines.push(`effort: ${fm.effort}`);
    if (fm.mcpServers && fm.mcpServers.length > 0) {
      lines.push('mcpServers:');
      for (const s of fm.mcpServers) lines.push(`  - ${s}`);
    }
    if (fm.skills && fm.skills.length > 0) {
      lines.push('skills:');
      for (const s of fm.skills) lines.push(`  - ${s}`);
    }
    lines.push(`generated: ${timestamp}`);
    lines.push(`generator: manifest-generator`);
    lines.push('---');

    const systemPrompt = agent.systemPrompt
      ? `\n${agent.systemPrompt.trim()}\n`
      : `\nYou are ${displayName}, a specialized AI agent. ${this.getAgentDescription(agent)}\n`;

    return `${lines.join('\n')}

# ${displayName}

${systemPrompt}

## AutomatosX Integration

You have access to AutomatosX memory and agent orchestration via MCP:

- \`mcp__automatosx__search_memory\` — Search past decisions and context
- \`mcp__automatosx__run_agent\` — Delegate to another specialist agent
- \`mcp__automatosx__session_create\` — Start a multi-agent session

Always search memory before starting a task to leverage past decisions.

---

**Generated:** ${timestamp}
**Generator:** AutomatosX ManifestGenerator
`;
  }

  /**
   * Get agent description from profile
   */
  private getAgentDescription(agent: AgentProfile): string {
    // Try description field first
    if (agent.description && agent.description.trim().length > 0) {
      return agent.description.trim();
    }

    // Try role field
    if (agent.role && agent.role.trim().length > 0) {
      return agent.role.trim();
    }

    // Try to extract description from systemPrompt
    if (agent.systemPrompt) {
      const lines = agent.systemPrompt.split('\n');
      const firstLine = lines[0]?.trim();
      if (firstLine && firstLine.length > 0 && firstLine.length < 200) {
        return firstLine;
      }
    }

    // Try displayName as fallback
    if (agent.displayName) {
      return `${agent.displayName} - specialized agent`;
    }

    // Final fallback
    return `Specialized agent for ${agent.name}`;
  }
}
