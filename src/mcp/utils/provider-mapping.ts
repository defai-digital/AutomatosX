/**
 * MCP Provider Name Mapping (v10.6.0)
 *
 * Unified mapping between MCP names, actual provider names, and normalized names.
 * Single source of truth for all provider name transformations.
 */

/** Provider name mappings - single source of truth */
const PROVIDER_MAP = {
  // MCP name → Actual name
  mcpToActual: {
    'claude': 'claude-code',
    'gemini': 'gemini-cli',
    'openai': 'openai'
  } as Record<string, string>,

  // Actual name → MCP name
  actualToMcp: {
    'claude-code': 'claude',
    'gemini-cli': 'gemini',
    'openai': 'openai'
  } as Record<string, string>,

  // Normalized caller → Actual name (for Smart Routing)
  normalizedToActual: {
    'claude': 'claude-code',
    'gemini': 'gemini-cli',
    'codex': 'openai',
    'ax-cli': 'ax-cli'
  } as Record<string, string>
} as const;

/**
 * Map MCP provider name to actual provider name
 */
export function mapMcpProviderToActual(mcpProvider?: string): string | undefined {
  if (mcpProvider === undefined) return undefined;
  return PROVIDER_MAP.mcpToActual[mcpProvider] ?? mcpProvider;
}

/**
 * Map actual provider name to MCP provider name
 */
export function mapActualProviderToMcp(actualProvider: string): string {
  return PROVIDER_MAP.actualToMcp[actualProvider] ?? actualProvider;
}

/**
 * Map normalized caller (from MCP session) to actual provider name
 * Used for Smart Routing caller detection
 */
export function mapNormalizedCallerToActual(
  caller: 'claude' | 'gemini' | 'codex' | 'ax-cli' | 'unknown'
): string {
  return PROVIDER_MAP.normalizedToActual[caller] ?? 'unknown';
}
