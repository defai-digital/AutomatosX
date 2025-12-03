/**
 * Codex CLI/SDK Integration
 *
 * v11.1.0: SDK-first with CLI fallback (no MCP)
 *
 * @module integrations/openai-codex
 */

// CLI adapter
export { CodexCLI, getDefaultCLI } from './cli-wrapper.js';

// SDK adapter
export { CodexSdkAdapter } from './sdk-adapter.js';
export type { CodexSdkOptions } from './sdk-adapter.js';

// Hybrid adapter - SDK-first with CLI fallback
export { HybridCodexAdapter } from './hybrid-adapter.js';
export type { CodexAdapterMode, HybridCodexAdapterOptions } from './hybrid-adapter.js';

// Types
export type {
  CodexConfig,
  CodexExecutionOptions,
  CodexExecutionResult,
} from './types.js';
export { CodexError, CodexErrorType } from './types.js';
