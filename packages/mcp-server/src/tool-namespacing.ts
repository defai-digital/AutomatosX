import type { MCPTool } from './types.js';

/**
 * Reads and sanitizes the tool prefix from environment or provided override.
 * Prefix is limited to [a-zA-Z0-9_-] and will be suffixed with '_' if missing.
 */
export function getToolPrefix(prefixOverride?: string): string {
  const rawPrefix = (prefixOverride ?? process.env.AX_MCP_TOOL_PREFIX ?? '').trim();

  if (rawPrefix === '') {
    return '';
  }

  const sanitized = rawPrefix.replace(/[^a-zA-Z0-9_-]/g, '_');
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
