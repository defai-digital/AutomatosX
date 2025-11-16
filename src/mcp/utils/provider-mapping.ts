/**
 * MCP Provider Name Mapping
 *
 * Maps simplified MCP provider names to actual AutomatosX provider names.
 * This allows MCP clients to use simple names ('gemini') while the system
 * uses full provider identifiers ('gemini-cli').
 */

/**
 * Map MCP provider names (simplified) to actual provider names in config
 *
 * MCP API uses simple names: 'claude', 'gemini', 'openai'
 * System uses full names: 'claude-code', 'gemini-cli', 'openai'
 *
 * @param mcpProvider - MCP provider name from client request
 * @returns Actual provider name used in system configuration, or undefined if not provided
 *
 * @example
 * mapMcpProviderToActual('gemini') // Returns: 'gemini-cli'
 * mapMcpProviderToActual('claude') // Returns: 'claude-code'
 * mapMcpProviderToActual('openai') // Returns: 'openai'
 * mapMcpProviderToActual(undefined) // Returns: undefined
 */
export function mapMcpProviderToActual(mcpProvider?: string): string | undefined {
  if (mcpProvider === undefined) return undefined;

  const providerMap: Record<string, string> = {
    'claude': 'claude-code',
    'gemini': 'gemini-cli',
    'openai': 'openai'
  };

  return providerMap[mcpProvider] || mcpProvider;
}

/**
 * Map actual provider name back to MCP provider name
 *
 * @param actualProvider - Actual provider name from system
 * @returns MCP provider name for API responses
 *
 * @example
 * mapActualProviderToMcp('gemini-cli') // Returns: 'gemini'
 * mapActualProviderToMcp('claude-code') // Returns: 'claude'
 * mapActualProviderToMcp('openai') // Returns: 'openai'
 */
export function mapActualProviderToMcp(actualProvider: string): string {
  const reverseMap: Record<string, string> = {
    'claude-code': 'claude',
    'gemini-cli': 'gemini',
    'openai': 'openai'
  };

  return reverseMap[actualProvider] || actualProvider;
}
