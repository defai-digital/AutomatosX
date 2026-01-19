/**
 * Agent Command
 *
 * CLI command for managing agents.
 * Integrates with trace store for dashboard visibility.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CommandResult, CLIOptions } from '../types.js';
import {
  createPersistentAgentRegistry,
  createAgentExecutor,
  createEnhancedAgentExecutor,
  createProviderPromptExecutor,
  createAgentLoader,
  DEFAULT_AGENT_DOMAIN_CONFIG,
  type AgentRegistry,
  type EnhancedAgentDomainConfig,
} from '@defai.digital/agent-domain';
import type { AgentProfile, TraceEvent, TraceHierarchy } from '@defai.digital/contracts';
import { DATA_DIR_NAME, AGENTS_FILENAME, getErrorMessage, createRootTraceHierarchy, TIMEOUT_AGENT_STEP_DEFAULT } from '@defai.digital/contracts';
import { bootstrap, getTraceStore, getProviderRegistry } from '../bootstrap.js';

// Storage path for persistent agents (matches MCP server)
const AGENT_STORAGE_PATH = path.join(process.cwd(), DATA_DIR_NAME, AGENTS_FILENAME);

// Path to example agents (relative to workspace root)
const EXAMPLE_AGENTS_DIR = path.join(process.cwd(), 'examples', 'agents');

/**
 * Compare semver versions to check if newVersion is newer than oldVersion
 * Returns true if newVersion > oldVersion
 */
function isNewerVersion(newVersion: string | undefined, oldVersion: string | undefined): boolean {
  if (!newVersion) return false;
  if (!oldVersion) return true;

  const parseVersion = (v: string): number[] => {
    return v.split('.').map(part => parseInt(part, 10) || 0);
  };

  const newParts = parseVersion(newVersion);
  const oldParts = parseVersion(oldVersion);

  for (let i = 0; i < Math.max(newParts.length, oldParts.length); i++) {
    const newPart = newParts[i] ?? 0;
    const oldPart = oldParts[i] ?? 0;
    if (newPart > oldPart) return true;
    if (newPart < oldPart) return false;
  }

  return false; // Versions are equal
}

// Singleton registry - initialized lazily
let _registry: AgentRegistry | null = null;
let _initPromise: Promise<AgentRegistry> | null = null;

/**
 * Get or create the shared agent registry
 * Loads example agents on first access
 * Uses atomic promise assignment to prevent race conditions
 */
async function getRegistry(): Promise<AgentRegistry> {
  if (_registry !== null) {
    return _registry;
  }

  if (_initPromise === null) {
    // Assign promise immediately before any async work to prevent race condition
    _initPromise = initializeRegistry().then(registry => {
      _registry = registry;
      return registry;
    });
  }

  return _initPromise;
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
        const existing = await registry.get(agent.agentId);
        if (!existing) {
          // Agent doesn't exist - register it
          try {
            await registry.register(agent);
          } catch {
            // Ignore duplicate registration errors
          }
        } else if (isNewerVersion(agent.version, existing.version)) {
          // Example agent has newer version - update the persisted agent
          try {
            await registry.update(agent.agentId, agent);
          } catch {
            // Ignore update errors
          }
        }
      }
    } catch (error) {
      // Log but don't fail - example agents are optional
      console.warn('Failed to load example agents:', getErrorMessage(error));
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
 *
 * Note: This is a read-only operation with no LLM involvement,
 * so trace recording is intentionally omitted (PRD R3.1).
 */
async function listAgents(options: CLIOptions): Promise<CommandResult> {
  try {
    const registry = await getRegistry();
    const filter = options.team ? { team: options.team } : undefined;
    const agents = await registry.list(filter);

    // Apply limit if specified
    const limited = options.limit !== undefined
      ? agents.slice(0, options.limit)
      : agents;

    if (agents.length === 0) {
      const teamMsg = options.team ? ` in team "${options.team}"` : '';
      return {
        success: true,
        message: `No agents registered${teamMsg}.`,
        data: [],
        exitCode: 0,
      };
    }

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
    const rows = limited.map((agent) =>
      `${(agent.agentId ?? '').padEnd(20)} | ${(agent.description ?? '').slice(0, 32).padEnd(32)} | ${(agent.team ?? '-').padEnd(10)} | ${agent.enabled ? 'Yes' : 'No'}`
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
      message: `Failed to list agents: ${getErrorMessage(error)}`,
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
      message: `Failed to get agent: ${getErrorMessage(error)}`,
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
      message: `Failed to register agent: ${getErrorMessage(error)}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Run an agent with trace integration for dashboard visibility
 */
async function runAgent(args: string[], options: CLIOptions): Promise<CommandResult> {
  const agentId = args[0];

  if (agentId === undefined) {
    return {
      success: false,
      message: 'Usage: ax agent run <agent-id> [--input <text|json>] [--provider <provider>] [task...]',
      data: undefined,
      exitCode: 1,
    };
  }

  // Initialize bootstrap to get trace store
  await bootstrap();
  const traceStore = getTraceStore();
  const traceId = randomUUID();
  const startTime = new Date().toISOString();

  // Extract task from remaining args (if any)
  const task = args.slice(1).join(' ') || undefined;

  // Create trace hierarchy context for this root trace (INV-TR-020 through INV-TR-024)
  const traceHierarchy: TraceHierarchy = createRootTraceHierarchy(traceId, undefined);

  // Emit run.start trace event with full details
  // INV-TR-011: Agent executions MUST include agentId in context
  const startEvent: TraceEvent = {
    eventId: randomUUID(),
    traceId,
    type: 'run.start',
    timestamp: startTime,
    context: {
      workflowId: agentId, // Use workflowId to store agent ID
      agentId, // INV-TR-011: Enable agent drill-down
      // Include hierarchy in context (INV-TR-020 through INV-TR-024)
      parentTraceId: traceHierarchy.parentTraceId,
      rootTraceId: traceHierarchy.rootTraceId,
      traceDepth: traceHierarchy.traceDepth,
      sessionId: traceHierarchy.sessionId,
    },
    payload: {
      agentId,
      task, // The task/prompt if provided
      command: `ax agent run ${agentId}`,
      hasInput: options.input !== undefined,
      inputPreview: options.input?.slice(0, 200),
    },
  };
  await traceStore.write(startEvent);

  try {
    const registry = await getRegistry();

    // Create executor - use enhanced executor with real provider when --provider is specified
    let executor;
    if (options.provider !== undefined) {
      // Create prompt executor with specified provider
      const providerRegistry = getProviderRegistry();
      const promptExecutor = createProviderPromptExecutor(providerRegistry, {
        defaultProvider: options.provider,
        defaultTimeout: TIMEOUT_AGENT_STEP_DEFAULT,
      });

      const config: EnhancedAgentDomainConfig = {
        ...DEFAULT_AGENT_DOMAIN_CONFIG,
        promptExecutor,
      };

      executor = createEnhancedAgentExecutor(registry, config);
    } else {
      // Use default executor (stub) when no provider specified
      executor = createAgentExecutor(registry, DEFAULT_AGENT_DOMAIN_CONFIG);
    }

    // Parse input: supports JSON objects or plain strings
    // Plain strings are wrapped as { prompt: string } for executor compatibility
    let input: unknown = {};
    if (options.input !== undefined) {
      const trimmedInput = options.input.trim();
      // Check if input looks like JSON (starts with { or [)
      if (trimmedInput.startsWith('{') || trimmedInput.startsWith('[')) {
        try {
          input = JSON.parse(options.input);
        } catch {
          // JSON-like input that failed to parse - treat as plain string
          input = options.input;
        }
      } else {
        // Plain string input - pass directly to executor
        input = options.input;
      }
    } else if (task !== undefined && task.length > 0) {
      // Use task from positional args if no --input provided
      input = task;
    }

    // Execute agent with provider option
    const execOptions = options.provider !== undefined ? { provider: options.provider } : undefined;
    const result = await executor.execute(agentId, input, execOptions);

    // Emit step events for each step result (in parallel for performance)
    // INV-TR-011: Agent executions MUST include agentId in context
    if (result.stepResults) {
      await Promise.all(
        result.stepResults.map((step) =>
          traceStore.write({
            eventId: randomUUID(),
            traceId,
            type: 'step.end',
            timestamp: new Date().toISOString(),
            durationMs: step.durationMs,
            status: step.success ? 'success' : 'failure',
            context: {
              workflowId: agentId,
              agentId, // INV-TR-011: Enable agent drill-down
              stepId: step.stepId,
              // Include hierarchy in context (INV-TR-020 through INV-TR-024)
              parentTraceId: traceHierarchy.parentTraceId,
              rootTraceId: traceHierarchy.rootTraceId,
              traceDepth: traceHierarchy.traceDepth,
              sessionId: traceHierarchy.sessionId,
            },
            payload: {
              stepId: step.stepId,
              success: step.success,
              output: step.output,
              error: step.error,
              agentId,
            },
          })
        )
      );
    }

    // Emit run.end trace event with full details
    // INV-TR-011: Agent executions MUST include agentId in context
    const endEvent: TraceEvent = {
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: result.totalDurationMs,
      status: result.success ? 'success' : 'failure',
      context: {
        workflowId: agentId,
        agentId, // INV-TR-011: Enable agent drill-down
        // Include hierarchy in context (INV-TR-020 through INV-TR-024)
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: result.success,
        output: result.output,
        // Format result as string for dashboard display
        result: typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2),
        error: result.error?.message ?? result.error,
        stepCount: result.stepResults?.length ?? 0,
        successfulSteps: result.stepResults?.filter(s => s.success).length ?? 0,
        agentId,
        command: `ax agent run ${agentId}`,
      },
    };
    await traceStore.write(endEvent);

    if (options.format === 'json') {
      return {
        success: result.success,
        message: undefined,
        data: { ...result, traceId },
        exitCode: result.success ? 0 : 1,
      };
    }

    if (result.success) {
      const lines = [
        `Agent executed successfully: ${agentId}`,
        `Trace ID: ${traceId.slice(0, 8)}`,
        `Duration: ${result.totalDurationMs}ms`,
      ];

      if (result.stepResults !== undefined && result.stepResults.length > 0) {
        lines.push(`Steps completed: ${result.stepResults.filter((s) => s.success).length}/${result.stepResults.length}`);
      }

      return {
        success: true,
        message: lines.join('\n'),
        data: { ...result, traceId },
        exitCode: 0,
      };
    } else {
      return {
        success: false,
        message: `Agent execution failed: ${result.error?.message ?? 'Unknown error'}\nTrace ID: ${traceId.slice(0, 8)}`,
        data: { ...result, traceId },
        exitCode: 1,
      };
    }
  } catch (error) {
    // Emit error trace event
    // INV-TR-011: Agent executions MUST include agentId in context
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'error',
      timestamp: new Date().toISOString(),
      status: 'failure',
      context: {
        workflowId: agentId,
        agentId,
        // Include hierarchy in context (INV-TR-020 through INV-TR-024)
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: { error: getErrorMessage(error), agentId },
    });
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      status: 'failure',
      context: {
        workflowId: agentId,
        agentId,
        // Include hierarchy in context (INV-TR-020 through INV-TR-024)
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: { success: false, error: getErrorMessage(error), agentId },
    });
    return {
      success: false,
      message: `Failed to run agent: ${getErrorMessage(error)}\nTrace ID: ${traceId.slice(0, 8)}`,
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
      message: `Failed to remove agent: ${getErrorMessage(error)}`,
      data: undefined,
      exitCode: 1,
    };
  }
}
