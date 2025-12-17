/**
 * MCP Workflow Resources
 *
 * Read-only access to workflow data via MCP resources protocol.
 *
 * Invariants:
 * - INV-MCP-RES-001: Resources are read-only
 * - INV-MCP-RES-002: Invalid URIs return clear error
 */

import type { MCPResource, MCPResourceContent, ResourceHandler } from '../types.js';

// ============================================================================
// Sample Workflow Data
// ============================================================================

const SAMPLE_WORKFLOWS = [
  {
    id: 'data-pipeline',
    name: 'Data Pipeline',
    version: '1.0.0',
    description: 'Automated data processing pipeline',
    status: 'active',
    steps: [
      { stepId: 'step-1', name: 'Extract', type: 'tool' },
      { stepId: 'step-2', name: 'Transform', type: 'tool' },
      { stepId: 'step-3', name: 'Load', type: 'tool' },
    ],
  },
  {
    id: 'code-review',
    name: 'Code Review',
    version: '2.1.0',
    description: 'Automated code review workflow',
    status: 'active',
    steps: [
      { stepId: 'step-1', name: 'Lint', type: 'tool' },
      { stepId: 'step-2', name: 'Test', type: 'tool' },
      { stepId: 'step-3', name: 'Review', type: 'agent' },
    ],
  },
  {
    id: 'deploy-staging',
    name: 'Deploy to Staging',
    version: '1.2.0',
    description: 'Deployment workflow for staging environment',
    status: 'active',
    steps: [
      { stepId: 'step-1', name: 'Build', type: 'tool' },
      { stepId: 'step-2', name: 'Test', type: 'tool' },
      { stepId: 'step-3', name: 'Deploy', type: 'tool' },
    ],
  },
];

// ============================================================================
// Resource Definitions
// ============================================================================

/**
 * Workflows list resource
 */
export const workflowsListResource: MCPResource = {
  uri: 'automatosx://workflows',
  name: 'Workflows',
  description: 'List of all available workflows',
  mimeType: 'application/json',
};

/**
 * Workflow by ID resource template
 */
export const workflowByIdResource: MCPResource = {
  uri: 'automatosx://workflows/{id}',
  name: 'Workflow by ID',
  description: 'Get a specific workflow by its ID',
  mimeType: 'application/json',
};

// ============================================================================
// Resource Handlers
// ============================================================================

/**
 * Handler for automatosx://workflows
 *
 * INV-MCP-RES-001: Read-only - returns workflow list
 */
export const handleWorkflowsList: ResourceHandler = async () => {
  const workflows = SAMPLE_WORKFLOWS.map((w) => ({
    id: w.id,
    name: w.name,
    version: w.version,
    status: w.status,
    stepCount: w.steps.length,
  }));

  return {
    uri: 'automatosx://workflows',
    mimeType: 'application/json',
    text: JSON.stringify({ workflows, total: workflows.length }, null, 2),
  };
};

/**
 * Handler for automatosx://workflows/{id}
 *
 * INV-MCP-RES-001: Read-only - returns workflow details
 * INV-MCP-RES-002: Returns error for invalid ID
 */
export const handleWorkflowById: ResourceHandler = async (
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
        message: 'Workflow ID is required',
      }),
    };
  }

  const workflow = SAMPLE_WORKFLOWS.find((w) => w.id === id);

  if (workflow === undefined) {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        error: 'RESOURCE_NOT_FOUND',
        message: `Workflow "${id}" not found`,
      }),
    };
  }

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(workflow, null, 2),
  };
};

/**
 * All workflow resources
 */
export const WORKFLOW_RESOURCES: MCPResource[] = [
  workflowsListResource,
  workflowByIdResource,
];

/**
 * Workflow resource handlers map
 */
export const WORKFLOW_RESOURCE_HANDLERS: Record<string, ResourceHandler> = {
  'automatosx://workflows': handleWorkflowsList,
  'automatosx://workflows/{id}': handleWorkflowById,
};
