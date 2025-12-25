/**
 * Agent Command
 *
 * CLI command for managing agents.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommandResult, CLIOptions } from '../types.js';
import {
  createPersistentAgentRegistry,
  createAgentExecutor,
  createAgentLoader,
  DEFAULT_AGENT_DOMAIN_CONFIG,
  type AgentRegistry,
} from '@defai.digital/agent-domain';
import type { AgentProfile } from '@defai.digital/contracts';
import { DATA_DIR_NAME, AGENTS_FILENAME } from '@defai.digital/contracts';

// Storage path for persistent agents (matches MCP server)
const AGENT_STORAGE_PATH = path.join(process.cwd(), DATA_DIR_NAME, AGENTS_FILENAME);

// Path to example agents (relative to workspace root)
const EXAMPLE_AGENTS_DIR = path.join(process.cwd(), 'examples', 'agents');

// Singleton registry - initialized lazily
let _registry: AgentRegistry | null = null;
let _initPromise: Promise<AgentRegistry> | null = null;

/**
 * Get or create the shared agent registry
 * Loads example agents on first access
 */
async function getRegistry(): Promise<AgentRegistry> {
  if (_registry !== null) {
    return _registry;
  }

  if (_initPromise !== null) {
    return _initPromise;
  }

  _initPromise = initializeRegistry();
  _registry = await _initPromise;
  return _registry;
}

/**
 * Initialize registry and load example agents
 */
async function initializeRegistry(): Promise<AgentRegistry> {
  // Create persistent registry (same as MCP server)
  const registry = createPersistentAgentRegistry({
    storagePath: AGENT_STORAGE_PATH,
    createDir: true,
    loadOnInit: true,
  });

  // Load example agents if directory exists
  if (fs.existsSync(EXAMPLE_AGENTS_DIR)) {
    try {
      const loader = createAgentLoader({
        agentsDir: EXAMPLE_AGENTS_DIR,
        extensions: ['.json', '.yaml', '.yml'],
      });

      const exampleAgents = await loader.loadAll();

      for (const agent of exampleAgents) {
        // Only load if not already registered
        const exists = await registry.exists(agent.agentId);
        if (!exists) {
          try {
            await registry.register(agent);
          } catch {
            // Ignore duplicate registration errors
          }
        }
      }
    } catch (error) {
      // Log but don't fail - example agents are optional
      console.warn('Failed to load example agents:', error instanceof Error ? error.message : error);
    }
  }

  return registry;
}

/**
 * Handles the 'agent' command - manage agents
 *
 * Subcommands:
 *   agent list           - List registered agents
 *   agent get <id>       - Get agent details
 *   agent register       - Register a new agent (from JSON input)
 *   agent run <id>       - Execute an agent
 *   agent status <exec>  - Get execution status
 */
export async function agentCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const subcommand = args[0] ?? 'list';
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'list':
      return listAgents(options);
    case 'get':
      return getAgent(subArgs, options);
    case 'register':
      return registerAgent(options);
    case 'run':
      return runAgent(subArgs, options);
    case 'remove':
      return removeAgent(subArgs, options);
    default:
      return {
        success: false,
        message: `Unknown agent subcommand: ${subcommand}\nAvailable: list, get, register, run, remove`,
        data: undefined,
        exitCode: 1,
      };
  }
}

/**
 * List all registered agents
 */
async function listAgents(options: CLIOptions): Promise<CommandResult> {
  try {
    const registry = await getRegistry();
    const agents = await registry.list();

    if (agents.length === 0) {
      return {
        success: true,
        message: 'No agents registered.',
        data: [],
        exitCode: 0,
      };
    }

    // Apply limit if specified
    const limited = options.limit !== undefined
      ? agents.slice(0, options.limit)
      : agents;

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: limited,
        exitCode: 0,
      };
    }

    // Format as text table
    const header = 'Agent ID             | Description                      | Team       | Enabled';
    const separator = '-'.repeat(header.length);
    const rows = limited.map((a) =>
      `${(a.agentId ?? '').padEnd(20)} | ${(a.description ?? '').slice(0, 32).padEnd(32)} | ${(a.team ?? '-').padEnd(10)} | ${a.enabled ? 'Yes' : 'No'}`
    );

    return {
      success: true,
      message: [header, separator, ...rows].join('\n'),
      data: limited,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Get agent details by ID
 */
async function getAgent(args: string[], options: CLIOptions): Promise<CommandResult> {
  const agentId = args[0];

  if (agentId === undefined) {
    return {
      success: false,
      message: 'Usage: ax agent get <agent-id>',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    const registry = await getRegistry();
    const agent = await registry.get(agentId);

    if (agent === undefined) {
      return {
        success: false,
        message: `Agent not found: ${agentId}`,
        data: undefined,
        exitCode: 1,
      };
    }

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: agent,
        exitCode: 0,
      };
    }

    // Format as text
    const lines = [
      `Agent: ${agent.agentId}`,
      `Description: ${agent.description}`,
      `Version: ${agent.version ?? 'N/A'}`,
      `Team: ${agent.team ?? 'N/A'}`,
      `Enabled: ${agent.enabled ? 'Yes' : 'No'}`,
      `Capabilities: ${agent.capabilities?.join(', ') ?? 'N/A'}`,
      `Tags: ${agent.tags?.join(', ') ?? 'N/A'}`,
    ];

    if (agent.workflow !== undefined && agent.workflow.length > 0) {
      lines.push(`Workflow Steps: ${agent.workflow.length}`);
      for (const step of agent.workflow) {
        lines.push(`  - ${step.stepId}: ${step.name} (${step.type})`);
      }
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: agent,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Register a new agent from JSON input
 */
async function registerAgent(options: CLIOptions): Promise<CommandResult> {
  try {
    if (options.input === undefined) {
      return {
        success: false,
        message: 'Usage: ax agent register --input <json-string>',
        data: undefined,
        exitCode: 1,
      };
    }

    let profile: AgentProfile;
    try {
      profile = JSON.parse(options.input);
    } catch {
      return {
        success: false,
        message: 'Invalid JSON input. Please provide a valid JSON string.',
        data: undefined,
        exitCode: 1,
      };
    }

    const registry = await getRegistry();
    await registry.register(profile);

    return {
      success: true,
      message: `Agent registered: ${profile.agentId}`,
      data: profile,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to register agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Run an agent
 */
async function runAgent(args: string[], options: CLIOptions): Promise<CommandResult> {
  const agentId = args[0];

  if (agentId === undefined) {
    return {
      success: false,
      message: 'Usage: ax agent run <agent-id> [--input <json>]',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    const registry = await getRegistry();
    const executor = createAgentExecutor(registry, DEFAULT_AGENT_DOMAIN_CONFIG);

    let input: Record<string, unknown> = {};
    if (options.input !== undefined) {
      try {
        input = JSON.parse(options.input);
      } catch {
        return {
          success: false,
          message: 'Invalid JSON input. Please provide a valid JSON string.',
          data: undefined,
          exitCode: 1,
        };
      }
    }

    const result = await executor.execute(agentId, input);

    if (options.format === 'json') {
      return {
        success: result.success,
        message: undefined,
        data: result,
        exitCode: result.success ? 0 : 1,
      };
    }

    if (result.success) {
      const lines = [
        `Agent executed successfully: ${agentId}`,
        `Duration: ${result.totalDurationMs}ms`,
      ];

      if (result.stepResults !== undefined && result.stepResults.length > 0) {
        lines.push(`Steps completed: ${result.stepResults.filter((s) => s.success).length}/${result.stepResults.length}`);
      }

      return {
        success: true,
        message: lines.join('\n'),
        data: result,
        exitCode: 0,
      };
    } else {
      return {
        success: false,
        message: `Agent execution failed: ${result.error?.message ?? 'Unknown error'}`,
        data: result,
        exitCode: 1,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to run agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Remove an agent
 */
async function removeAgent(args: string[], _options: CLIOptions): Promise<CommandResult> {
  const agentId = args[0];

  if (agentId === undefined) {
    return {
      success: false,
      message: 'Usage: ax agent remove <agent-id>',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    const registry = await getRegistry();
    await registry.remove(agentId);

    return {
      success: true,
      message: `Agent removed: ${agentId}`,
      data: { agentId },
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to remove agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}
