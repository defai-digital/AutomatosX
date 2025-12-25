/**
 * MCP Policy Resources
 *
 * Read-only access to governance policies via MCP resources protocol.
 *
 * Invariants:
 * - INV-MCP-RES-001: Resources are read-only
 * - INV-MCP-RES-002: Invalid URIs return clear error
 */

import type { MCPResource, MCPResourceContent, ResourceHandler } from '../types.js';
import { getPolicy, listPolicies } from '@defai.digital/guard';

// ============================================================================
// Resource Definitions
// ============================================================================

/**
 * Policies list resource
 */
export const policiesListResource: MCPResource = {
  uri: 'automatosx://policies',
  name: 'Policies',
  description: 'List of all governance policies',
  mimeType: 'application/json',
};

/**
 * Policy by ID resource template
 */
export const policyByIdResource: MCPResource = {
  uri: 'automatosx://policies/{id}',
  name: 'Policy by ID',
  description: 'Get a specific governance policy by its ID',
  mimeType: 'application/json',
};

// ============================================================================
// Resource Handlers
// ============================================================================

/**
 * Handler for automatosx://policies
 *
 * INV-MCP-RES-001: Read-only - returns policy list from guard
 */
export const handlePoliciesList: ResourceHandler = async () => {
  const policyIds = listPolicies();

  const policySummaries = policyIds.map((policyId) => {
    const policy = getPolicy(policyId);
    if (policy === undefined) {
      return {
        policyId,
        allowedPaths: [],
        forbiddenPaths: [],
        gateCount: 0,
      };
    }
    return {
      policyId: policy.policyId,
      allowedPaths: policy.allowedPaths,
      forbiddenPaths: policy.forbiddenPaths,
      gateCount: policy.gates.length,
      changeRadiusLimit: policy.changeRadiusLimit,
    };
  });

  return {
    uri: 'automatosx://policies',
    mimeType: 'application/json',
    text: JSON.stringify({ policies: policySummaries, total: policyIds.length }, null, 2),
  };
};

/**
 * Handler for automatosx://policies/{id}
 *
 * INV-MCP-RES-001: Read-only - returns policy details
 * INV-MCP-RES-002: Returns error for invalid ID
 */
export const handlePolicyById: ResourceHandler = async (
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
        message: 'Policy ID is required',
      }),
    };
  }

  const policy = getPolicy(id);

  if (policy === undefined) {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        error: 'RESOURCE_NOT_FOUND',
        message: `Policy "${id}" not found`,
        availablePolicies: listPolicies(),
      }),
    };
  }

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(
      {
        policyId: policy.policyId,
        allowedPaths: policy.allowedPaths,
        forbiddenPaths: policy.forbiddenPaths,
        gates: policy.gates,
        changeRadiusLimit: policy.changeRadiusLimit,
      },
      null,
      2
    ),
  };
};

/**
 * All policy resources
 */
export const POLICY_RESOURCES: MCPResource[] = [
  policiesListResource,
  policyByIdResource,
];

/**
 * Policy resource handlers map
 */
export const POLICY_RESOURCE_HANDLERS: Record<string, ResourceHandler> = {
  'automatosx://policies': handlePoliciesList,
  'automatosx://policies/{id}': handlePolicyById,
};
