/**
 * ax-grok Integration Module
 *
 * Provides SDK-first access to xAI's Grok models with CLI fallback.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 *
 * @module integrations/ax-grok
 */

export { GrokHybridAdapter, type GrokHybridAdapterOptions } from './hybrid-adapter.js';
export { GrokSdkAdapter } from './sdk-adapter.js';
export { GrokCliWrapper } from './cli-wrapper.js';
// v13.0.0: SDK-only adapter for direct execution (no CLI fallback)
export { GrokSdkOnlyAdapter, type GrokSdkOnlyAdapterOptions } from './sdk-only-adapter.js';
// v13.0.0: MCP Client Mode for AutomatosX integration
export { AxGrokWithMcp, type GrokMcpChatOptions, type AgentInfo, type MemoryEntry, type AgentContext } from './mcp-client-mode.js';
export {
  type GrokModel,
  type GrokSDKConfig,
  type GrokCLIConfig,
  type GrokExecutionOptions,
  GROK_MODEL_MAPPING,
  GROK_DEFAULT_BASE_URL,
  GROK_DEFAULT_MODEL,
  GROK_DEFAULT_COMMAND,
  normalizeGrokModel
} from './types.js';
