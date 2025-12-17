/**
 * MCP Agent Resources
 *
 * Read-only access to agent registry via MCP resources protocol.
 *
 * Invariants:
 * - INV-MCP-RES-001: Resources are read-only
 * - INV-MCP-RES-002: Invalid URIs return clear error
 */

import type { MCPResource, MCPResourceContent, ResourceHandler } from '../types.js';
import type { AgentProfile } from '@automatosx/contracts';
import { getSharedRegistry } from '../shared-registry.js';

// ============================================================================
// Resource Definitions
// ============================================================================

/**
 * Agents list resource
 */
export const agentsListResource: MCPResource = {
  uri: 'automatosx://agents',
  name: 'Agents',
  description: 'List of all registered agents',
  mimeType: 'application/json',
};

/**
 * Agent by ID resource template
 */
export const agentByIdResource: MCPResource = {
  uri: 'automatosx://agents/{id}',
  name: 'Agent by ID',
  description: 'Get a specific agent by its ID',
  mimeType: 'application/json',
};

// ============================================================================
// Resource Handlers
// ============================================================================

/**
 * Handler for automatosx://agents
 *
 * INV-MCP-RES-001: Read-only - returns agent list from registry
 */
export const handleAgentsList: ResourceHandler = async () => {
  const registry = await getSharedRegistry();
  const agents = await registry.list();

  const agentSummaries = agents.map((a: AgentProfile) => ({
    agentId: a.agentId,
    displayName: a.displayName,
    description: a.description,
    team: a.team,
    enabled: a.enabled,
    capabilities: a.capabilities,
  }));

  return {
    uri: 'automatosx://agents',
    mimeType: 'application/json',
    text: JSON.stringify({ agents: agentSummaries, total: agents.length }, null, 2),
  };
};

/**
 * Handler for automatosx://agents/{id}
 *
 * INV-MCP-RES-001: Read-only - returns agent details
 * INV-MCP-RES-002: Returns error for invalid ID
 */
export const handleAgentById: ResourceHandler = async (
  uri: string,
  params?: Record<string, string>
): Promise<MCPResourceContent> => {
  const id = params?.id;

  if (id === undefined) {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        error: 'INVALID_URI',
        message: 'Agent ID is required',
      }),
    };
  }

  const registry = await getSharedRegistry();
  const agent = await registry.get(id);

  if (agent === undefined) {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        error: 'RESOURCE_NOT_FOUND',
        message: `Agent "${id}" not found`,
      }),
    };
  }

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(
      {
        agentId: agent.agentId,
        displayName: agent.displayName,
        version: agent.version,
        description: agent.description,
        role: agent.role,
        expertise: agent.expertise,
        capabilities: agent.capabilities,
        team: agent.team,
        tags: agent.tags,
        enabled: agent.enabled,
        workflow: agent.workflow?.map((s) => ({
          stepId: s.stepId,
          name: s.name,
          type: s.type,
        })),
      },
      null,
      2
    ),
  };
};

/**
 * All agent resources
 */
export const AGENT_RESOURCES: MCPResource[] = [
  agentsListResource,
  agentByIdResource,
];

/**
 * Agent resource handlers map
 */
export const AGENT_RESOURCE_HANDLERS: Record<string, ResourceHandler> = {
  'automatosx://agents': handleAgentsList,
  'automatosx://agents/{id}': handleAgentById,
};
