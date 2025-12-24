/**
 * MCP Resources Registry
 *
 * Combines all resource definitions and handlers.
 *
 * Invariants:
 * - INV-MCP-RES-001: Resources are read-only
 * - INV-MCP-RES-002: Invalid URIs return clear error
 * - INV-MCP-RES-003: Sensitive data is never exposed via resources
 */

import type { MCPResource, MCPResourceContent, ResourceHandler } from '../types.js';

// Import resource definitions and handlers
import {
  WORKFLOW_RESOURCES,
  WORKFLOW_RESOURCE_HANDLERS,
} from './workflows.js';
import {
  AGENT_RESOURCES,
  AGENT_RESOURCE_HANDLERS,
} from './agents.js';
import {
  POLICY_RESOURCES,
  POLICY_RESOURCE_HANDLERS,
} from './policies.js';
import {
  SESSION_RESOURCES,
  SESSION_RESOURCE_HANDLERS,
} from './sessions.js';
import {
  CONFIG_RESOURCES,
  CONFIG_RESOURCE_HANDLERS,
} from './config.js';

// ============================================================================
// Combined Exports
// ============================================================================

/**
 * All MCP resources
 */
export const ALL_RESOURCES: MCPResource[] = [
  ...WORKFLOW_RESOURCES,
  ...AGENT_RESOURCES,
  ...POLICY_RESOURCES,
  ...SESSION_RESOURCES,
  ...CONFIG_RESOURCES,
];

/**
 * All resource handlers
 */
export const RESOURCE_HANDLERS: Record<string, ResourceHandler> = {
  ...WORKFLOW_RESOURCE_HANDLERS,
  ...AGENT_RESOURCE_HANDLERS,
  ...POLICY_RESOURCE_HANDLERS,
  ...SESSION_RESOURCE_HANDLERS,
  ...CONFIG_RESOURCE_HANDLERS,
};

// ============================================================================
// URI Pattern Matching
// ============================================================================

/**
 * Parses a URI template and extracts parameter names
 * e.g., "automatosx://workflows/{id}" -> ["id"]
 */
function extractTemplateParams(template: string): string[] {
  const matches = template.match(/\{([^}]+)\}/g);
  if (matches === null) {
    return [];
  }
  return matches.map((m) => m.slice(1, -1));
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches a URI against a template and extracts parameters
 * e.g., matchUriTemplate("automatosx://workflows/abc", "automatosx://workflows/{id}")
 * returns { id: "abc" }
 */
function matchUriTemplate(
  uri: string,
  template: string
): { match: boolean; params: Record<string, string> } {
  // Convert template to regex, escaping special characters first
  const paramNames = extractTemplateParams(template);
  // First escape all regex special chars, then replace escaped \{...\} with capture groups
  const escaped = escapeRegex(template);
  const regexPattern = escaped.replace(/\\\{([^}]+)\\\}/g, '([^/]+)');
  const regex = new RegExp(`^${regexPattern}$`);

  const matchResult = uri.match(regex);
  if (matchResult === null) {
    return { match: false, params: {} };
  }

  // Extract parameter values
  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    const value = matchResult[index + 1];
    if (value !== undefined) {
      params[name] = value;
    }
  });

  return { match: true, params };
}

/**
 * Finds the matching resource handler for a URI
 */
export function findResourceHandler(
  uri: string
): { handler: ResourceHandler; params: Record<string, string> } | undefined {
  // First try exact match
  const exactHandler = RESOURCE_HANDLERS[uri];
  if (exactHandler !== undefined) {
    return { handler: exactHandler, params: {} };
  }

  // Try template matching
  for (const [template, handler] of Object.entries(RESOURCE_HANDLERS)) {
    if (template.includes('{')) {
      const result = matchUriTemplate(uri, template);
      if (result.match) {
        return { handler, params: result.params };
      }
    }
  }

  return undefined;
}

/**
 * Reads a resource by URI
 *
 * INV-MCP-RES-002: Returns error for invalid URI
 */
export async function readResource(uri: string): Promise<MCPResourceContent> {
  const result = findResourceHandler(uri);

  if (result === undefined) {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        error: 'RESOURCE_NOT_FOUND',
        message: `No resource handler for URI: ${uri}`,
        availableResources: ALL_RESOURCES.map((r) => r.uri),
      }),
    };
  }

  return result.handler(uri, result.params);
}

// Re-export individual resources for direct access
export * from './workflows.js';
export * from './agents.js';
export * from './policies.js';
export * from './sessions.js';
export * from './config.js';
