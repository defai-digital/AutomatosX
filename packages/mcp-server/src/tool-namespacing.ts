import type { MCPTool } from './types.js';
import { MCP_TOOL_PREFIX_DEFAULT, ENV_MCP_TOOL_PREFIX } from '@automatosx/contracts';

/**
 * Reads and sanitizes the tool prefix from environment or provided override.
 *
 * Priority order:
 * 1. prefixOverride parameter (for testing/programmatic use)
 * 2. AX_MCP_TOOL_PREFIX environment variable
 * 3. MCP_TOOL_PREFIX_DEFAULT constant ('ax')
 *
 * Prefix is limited to [a-zA-Z0-9_-] per SEP-986 and will be suffixed with '_'.
 * To disable prefixing, set AX_MCP_TOOL_PREFIX='' (empty string).
 *
 * Example tool names with default prefix:
 * - ax_config_set
 * - ax_agent_list
 * - ax_workflow_run
 */
export function getToolPrefix(prefixOverride?: string): string {
  // Check for explicit override first
  if (prefixOverride !== undefined) {
    const rawPrefix = prefixOverride.trim();
    if (rawPrefix === '') {
      return '';
    }
    const sanitized = rawPrefix.replace(/[^a-zA-Z0-9_-]/g, '_');
    return sanitized.endsWith('_') ? sanitized : `${sanitized}_`;
  }

  // Check environment variable (explicit empty string disables prefixing)
  const envPrefix = process.env[ENV_MCP_TOOL_PREFIX];
  if (envPrefix !== undefined) {
    const rawPrefix = envPrefix.trim();
    if (rawPrefix === '') {
      return '';
    }
    const sanitized = rawPrefix.replace(/[^a-zA-Z0-9_-]/g, '_');
    return sanitized.endsWith('_') ? sanitized : `${sanitized}_`;
  }

  // Use default prefix
  const sanitized = MCP_TOOL_PREFIX_DEFAULT.replace(/[^a-zA-Z0-9_-]/g, '_');
  return sanitized.endsWith('_') ? sanitized : `${sanitized}_`;
}

/**
 * Applies the configured prefix to tool names and drops duplicates after prefixing.
 * Returns a new array to avoid mutating the original tool definitions.
 */
export function namespaceTools(tools: MCPTool[], prefixOverride?: string): MCPTool[] {
  const prefix = getToolPrefix(prefixOverride);
  if (prefix === '') {
    return tools;
  }

  const seen = new Set<string>();
  const duplicates: string[] = [];

  const namespaced = tools
    .map((tool) => {
      const namespacedName = tool.name.startsWith(prefix) ? tool.name : `${prefix}${tool.name}`;
      if (seen.has(namespacedName)) {
        duplicates.push(namespacedName);
        return null;
      }
      seen.add(namespacedName);
      return { ...tool, name: namespacedName };
    })
    .filter((tool): tool is MCPTool => tool !== null);

  if (duplicates.length > 0) {
    // stderr to avoid polluting MCP protocol stdout
    console.warn(`[MCP] Dropping duplicate tool names after prefixing: ${duplicates.join(', ')}`);
  }

  return namespaced;
}

/**
 * Strips the configured prefix from a tool name when dispatching calls.
 */
export function resolveToolName(requestedName: string, prefixOverride?: string): string {
  const prefix = getToolPrefix(prefixOverride);
  if (prefix !== '' && requestedName.startsWith(prefix)) {
    return requestedName.slice(prefix.length);
  }
  return requestedName;
}
