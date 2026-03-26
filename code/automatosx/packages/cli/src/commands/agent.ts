import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { parseOptionalJsonInput, asOptionalString, asOptionalRecord, asStringArray } from '../utils/validation.js';
import {
  getDefaultAgentCatalogEntry,
  getStableAgentEntry,
  isStableCatalogAgentEntry,
  listStableAgentCapabilities,
  listStableAgentEntries,
  recommendStableAgents,
} from '../agent-catalog.js';
import { listWorkflowCatalog } from '../workflow-adapter.js';

interface AgentRegistrationInput {
  agentId: string;
  name: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export async function agentCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const subcommand = args[0] ?? 'list';
  const runtime = createRuntime(options);

  switch (subcommand) {
    case 'list': {
      const agents = listStableAgentEntries(await runtime.listAgents());
      if (agents.length === 0) {
        return success('No agents available.', agents);
      }

      const lines = [
        'Available agents:',
        ...agents.map((agent) => formatAgentListLine(agent)),
      ];

      return success(lines.join('\n'), agents);
    }
    case 'get': {
      const agentId = args[1] ?? options.agent;
      if (agentId === undefined || agentId.length === 0) {
        return usageError('ax agent get <agent-id>');
      }

      const agent = getStableAgentEntry(agentId, await runtime.getAgent(agentId));
      if (agent === undefined) {
        return failure(`Agent not found: ${agentId}`);
      }

      const lines = [
        `Agent: ${agent.agentId}`,
        `Name: ${agent.name}`,
        renderAgentAvailability(agent),
        renderAgentDescription(agent),
        renderAgentTeam(agent),
        `Capabilities: ${agent.capabilities.length > 0 ? agent.capabilities.join(', ') : 'none'}`,
        renderOwnedWorkflows(agent),
        renderRecommendedCommands(agent),
        renderUseCases(agent),
        renderNotFor(agent),
        renderRegistrationTimestamp(agent),
        renderUpdateTimestamp(agent),
      ].filter((line): line is string => line !== undefined);

      return success(lines.join('\n'), agent);
    }
    case 'register': {
      const parsed = parseRegistrationInput(options.input);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }

      const registered = await runtime.registerAgent(parsed.value);
      return success(`Agent registered: ${registered.agentId}`, registered);
    }
    case 'remove': {
      const agentId = args[1] ?? options.agent;
      if (agentId === undefined || agentId.length === 0) {
        return usageError('ax agent remove <agent-id>');
      }

      const removed = await runtime.removeAgent(agentId);
      if (!removed) {
        return failure(`Agent not found: ${agentId}`);
      }
      return success(`Agent removed: ${agentId}`, { removed: true, agentId });
    }
    case 'capabilities': {
      const capabilities = listStableAgentCapabilities(await runtime.listAgents());
      if (capabilities.length === 0) {
        return success('No agent capabilities available.', capabilities);
      }
      return success([
        'Agent capabilities:',
        ...capabilities.map((capability) => `- ${capability}`),
      ].join('\n'), capabilities);
    }
    case 'run': {
      const agentId = args[1] ?? options.agent;
      if (agentId === undefined || agentId.length === 0) {
        return usageError('ax agent run <agent-id> --task <text> [--input <json-object>]');
      }

      const parsed = parseOptionalJsonInput(options.input, 'Agent run');
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }

      const result = await runtime.runAgent({
        agentId,
        task: options.task,
        input: parsed.value,
        provider: options.provider,
        traceId: options.traceId,
        surface: 'cli',
      });
      const stableCatalogEntry = result.success ? undefined : getDefaultAgentCatalogEntry(agentId);
      const stableWorkflowCommands = stableCatalogEntry === undefined
        ? []
        : getOwnedWorkflowIds(agentId, undefined)
          .map((workflowId) => `ax ${workflowId}`);

      const lines = [
        `Agent run: ${result.agentId}`,
        `Trace: ${result.traceId}`,
        `Provider: ${result.provider}`,
        `Mode: ${result.executionMode}`,
        `Success: ${result.success ? 'yes' : 'no'}`,
        result.content.length > 0 ? `Output:\n${result.content}` : undefined,
        result.error?.message ? `Error: ${result.error.message}` : undefined,
        stableCatalogEntry === undefined || result.error?.code !== 'AGENT_NOT_FOUND'
          ? undefined
          : 'Hint: This built-in agent is part of the stable catalog, but direct agent execution requires runtime registration via "ax setup".',
        stableWorkflowCommands.length === 0 || result.error?.code !== 'AGENT_NOT_FOUND'
          ? undefined
          : `Stable workflow commands: ${stableWorkflowCommands.join(', ')}`,
        ...(result.warnings.map((warning) => `Warning: ${warning}`)),
      ].filter((value): value is string => value !== undefined);

      return result.success
        ? success(lines.join('\n'), result)
        : failure(lines.join('\n'), result);
    }
    case 'recommend': {
      const task = options.task ?? args.slice(1).join(' ').trim();
      if (task.length === 0) {
        return usageError('ax agent recommend --task <text>');
      }

      const recommendations = await runtime.recommendAgents({
        task,
        limit: options.limit,
        team: options.team,
      });
      const resolvedRecommendations = recommendations.length > 0
        ? recommendations
        : recommendStableAgents({
          agents: await runtime.listAgents(),
          task,
          limit: options.limit,
          team: options.team,
        });
      if (resolvedRecommendations.length === 0) {
        return success('No matching agents found.', resolvedRecommendations);
      }

      const lines = [
        `Agent recommendations for: ${task}`,
        ...resolvedRecommendations.map((entry) => (
          `- ${entry.agentId}: ${entry.name} (confidence ${entry.confidence.toFixed(2)})${entry.reasons.length > 0 ? ` — ${entry.reasons.join('; ')}` : ''}`
        )),
      ];

      return success(lines.join('\n'), resolvedRecommendations);
    }
    default:
      return usageError('ax agent [list|get|register|remove|capabilities|run|recommend]');
  }
}

function formatAgentListLine(agent: {
  agentId: string;
  name: string;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}): string {
  const capabilityText = agent.capabilities.length > 0 ? ` [${agent.capabilities.join(', ')}]` : '';
  const description = readAgentMetadataString(agent.metadata, 'description');
  const ownedWorkflows = getOwnedWorkflowIds(agent.agentId, agent.metadata);
  const details: string[] = [];

  if (description !== undefined) {
    details.push(description);
  }

  if (ownedWorkflows.length > 0) {
    details.push(`Owns: ${ownedWorkflows.join(', ')}`);
  }

  return `- ${agent.agentId}: ${agent.name}${capabilityText}${details.length > 0 ? ` — ${details.join(' | ')}` : ''}`;
}

function renderAgentAvailability(agent: {
  registrationKey: string;
  metadata?: Record<string, unknown>;
}): string {
  return `Availability: ${isStableCatalogAgentEntry(agent) ? 'built-in stable surface' : 'registered in runtime'}`;
}

function renderAgentDescription(agent: { metadata?: Record<string, unknown> }): string | undefined {
  const description = readAgentMetadataString(agent.metadata, 'description');
  return description === undefined ? undefined : `Description: ${description}`;
}

function renderAgentTeam(agent: { metadata?: Record<string, unknown> }): string | undefined {
  const team = readAgentMetadataString(agent.metadata, 'team');
  return team === undefined ? undefined : `Team: ${team}`;
}

function renderOwnedWorkflows(agent: { agentId: string; metadata?: Record<string, unknown> }): string | undefined {
  const workflows = getOwnedWorkflowIds(agent.agentId, agent.metadata);
  return workflows.length === 0 ? undefined : `Owns workflows: ${workflows.join(', ')}`;
}

function renderRecommendedCommands(agent: { agentId: string; metadata?: Record<string, unknown> }): string | undefined {
  const commands = getRecommendedCommands(agent.agentId, agent.metadata);
  return commands.length === 0 ? undefined : `Recommended commands: ${commands.join(', ')}`;
}

function renderUseCases(agent: { metadata?: Record<string, unknown> }): string | undefined {
  const useCases = readAgentMetadataStringArray(agent.metadata, 'useCases');
  return useCases.length === 0 ? undefined : `Use this when: ${useCases.join('; ')}`;
}

function renderNotFor(agent: { metadata?: Record<string, unknown> }): string | undefined {
  const notFor = readAgentMetadataStringArray(agent.metadata, 'notFor');
  return notFor.length === 0 ? undefined : `Avoid this for: ${notFor.join('; ')}`;
}

function renderRegistrationTimestamp(agent: {
  registrationKey: string;
  registeredAt: string;
  metadata?: Record<string, unknown>;
}): string | undefined {
  if (isStableCatalogAgentEntry(agent)) {
    return 'Runtime registration: not seeded';
  }
  return `Registered: ${agent.registeredAt}`;
}

function renderUpdateTimestamp(agent: {
  registrationKey: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}): string | undefined {
  if (isStableCatalogAgentEntry(agent) || agent.updatedAt.length === 0) {
    return undefined;
  }
  return `Updated: ${agent.updatedAt}`;
}

function getOwnedWorkflowIds(agentId: string, metadata: Record<string, unknown> | undefined): string[] {
  const explicit = readAgentMetadataStringArray(metadata, 'ownedWorkflows');
  const fromCatalog = listWorkflowCatalog()
    .filter((workflow) => workflow.agentId === agentId)
    .map((workflow) => workflow.commandId);

  return [...new Set([...explicit, ...fromCatalog])];
}

function getRecommendedCommands(agentId: string, metadata: Record<string, unknown> | undefined): string[] {
  const explicit = readAgentMetadataStringArray(metadata, 'recommendedCommands');
  const owned = getOwnedWorkflowIds(agentId, metadata).map((workflowId) => `ax ${workflowId}`);
  return [...new Set([...explicit, ...owned])];
}

function readAgentMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  return metadata === undefined ? undefined : asOptionalString(metadata[key]);
}

function readAgentMetadataStringArray(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string[] {
  return metadata === undefined ? [] : (asStringArray(metadata[key]) ?? []);
}

function parseRegistrationInput(input: string | undefined): { value: AgentRegistrationInput; error?: string } {
  if (input === undefined) {
    return {
      value: { agentId: '', name: '' },
      error: 'Usage: ax agent register --input <json-object>',
    };
  }

  const parsed = parseOptionalJsonInput(input, 'Agent register');
  if (parsed.error !== undefined) {
    return { value: { agentId: '', name: '' }, error: parsed.error };
  }

  const value = parsed.value ?? {};
  const agentId = asOptionalString(value.agentId);
  const name = asOptionalString(value.name);

  if (agentId === undefined) {
    return { value: { agentId: '', name: '' }, error: 'Agent register input requires "agentId".' };
  }

  if (name === undefined) {
    return { value: { agentId, name: '' }, error: 'Agent register input requires "name".' };
  }

  return {
    value: {
      agentId,
      name,
      capabilities: asStringArray(value.capabilities),
      metadata: asOptionalRecord(value.metadata),
    },
  };
}
