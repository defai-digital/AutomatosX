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
      await this.generateSkills();
      await this.generateCommands();
      await this.generateSubAgent();

      logger.info('[ManifestGenerator] Manifest generation complete');
    } catch (error) {
      logger.error('[ManifestGenerator] Manifest generation failed', { error });
      throw error;
    }
  }

  /**
   * Load all agent profiles
   */
  private async loadAllAgentProfiles(): Promise<AgentProfile[]> {
    const agentNames = await this.profileLoader.listProfiles();
    const profiles: AgentProfile[] = [];

    for (const name of agentNames) {
      try {
        const profile = await this.profileLoader.loadProfile(name);
        profiles.push(profile);
      } catch (error) {
        logger.warn('[ManifestGenerator] Failed to load profile', { name, error });
        // Continue with other profiles
      }
    }

    return profiles;
  }

  /**
   * Generate Skills for auto-discovery in Claude Code
   */
  async generateSkills(): Promise<void> {
    logger.info('[ManifestGenerator] Generating skills...');

    const agents = await this.loadAllAgentProfiles();
    const skillsDir = join(this.projectDir, '.claude', 'skills', 'automatosx');

    await mkdir(skillsDir, { recursive: true });

    // Generate master orchestration skill
    const orchestrationSkill = this.generateOrchestrationSkill(agents);
    await writeFile(
      join(skillsDir, 'SKILL.md'),
      orchestrationSkill
    );

    logger.info('[ManifestGenerator] Skills generated', {
      count: 1,
      path: skillsDir
    });
  }

  /**
   * Generate slash commands for each agent
   */
  async generateCommands(): Promise<void> {
    logger.info('[ManifestGenerator] Generating commands...');

    const agents = await this.loadAllAgentProfiles();
    const commandsDir = join(this.projectDir, '.claude', 'commands');

    await mkdir(commandsDir, { recursive: true });

    let commandCount = 0;
    for (const agent of agents) {
      const command = this.generateAgentCommand(agent);
      await writeFile(
        join(commandsDir, `agent-${agent.name}.md`),
        command
      );
      commandCount++;
    }

    logger.info('[ManifestGenerator] Commands generated', {
      count: commandCount,
      path: commandsDir
    });
  }

  /**
   * Generate Sub-Agent for specialized coordination
   */
  async generateSubAgent(): Promise<void> {
    logger.info('[ManifestGenerator] Generating sub-agent...');

    const agents = await this.loadAllAgentProfiles();
    const agentDir = join(this.projectDir, '.claude', 'agents', 'automatosx-coordinator');

    await mkdir(agentDir, { recursive: true });

    const subAgent = this.generateCoordinatorAgent(agents);
    await writeFile(
      join(agentDir, 'AGENT.md'),
      subAgent
    );

    logger.info('[ManifestGenerator] Sub-agent generated', {
      path: agentDir
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
