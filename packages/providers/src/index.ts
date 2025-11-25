/**
 * AutomatosX Providers
 *
 * Provider implementations for multi-provider AI orchestration.
 *
 * Supported providers:
 * - Claude Code (MCP)
 * - Gemini CLI (MCP)
 * - ax-cli (SDK)
 * - OpenAI Codex (Bash)
 *
 * @packageDocumentation
 * @module @ax/providers
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// Base provider
export { BaseProvider, type ProviderEvents } from './base.js';

// Provider implementations
export { ClaudeProvider } from './claude.js';
export { GeminiProvider } from './gemini.js';
export { AxCliProvider } from './ax-cli.js';
export { OpenAIProvider } from './openai.js';

// Re-export types from schemas
export type {
  ProviderType,
  IntegrationMode,
  ExecutionRequest,
  ExecutionResponse,
  ProviderHealth,
  ProviderConfig,
} from '@ax/schemas';

// =============================================================================
// Provider Factory
// =============================================================================

import { type ProviderType } from '@ax/schemas';
import { BaseProvider } from './base.js';
import { ClaudeProvider } from './claude.js';
import { GeminiProvider } from './gemini.js';
import { AxCliProvider } from './ax-cli.js';
import { OpenAIProvider } from './openai.js';

/**
 * Provider factory options
 */
export interface ProviderFactoryOptions {
  claude?: { command?: string; args?: string[] };
  gemini?: { command?: string; args?: string[] };
  'ax-cli'?: { enableCheckpoints?: boolean; enableSubagents?: boolean };
  openai?: { command?: string; args?: string[] };
}

/**
 * Create a provider instance by type
 */
export function createProvider(
  type: ProviderType,
  options?: ProviderFactoryOptions
): BaseProvider {
  switch (type) {
    case 'claude':
      return new ClaudeProvider(options?.claude);
    case 'gemini':
      return new GeminiProvider(options?.gemini);
    case 'ax-cli':
      return new AxCliProvider(options?.['ax-cli']);
    case 'openai':
      return new OpenAIProvider(options?.openai);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * Create all providers
 */
export function createAllProviders(
  options?: ProviderFactoryOptions
): Map<ProviderType, BaseProvider> {
  const providers = new Map<ProviderType, BaseProvider>();

  providers.set('claude', new ClaudeProvider(options?.claude));
  providers.set('gemini', new GeminiProvider(options?.gemini));
  providers.set('ax-cli', new AxCliProvider(options?.['ax-cli']));
  providers.set('openai', new OpenAIProvider(options?.openai));

  return providers;
}

/**
 * Get integration mode for a provider type
 */
export function getIntegrationMode(type: ProviderType): 'mcp' | 'sdk' | 'bash' {
  switch (type) {
    case 'claude':
    case 'gemini':
      return 'mcp';
    case 'ax-cli':
      return 'sdk';
    case 'openai':
      return 'bash';
    default: {
      // Exhaustiveness check - TypeScript will error if a new provider is added
      const _exhaustive: never = type;
      throw new Error(`Unknown provider type: ${_exhaustive}`);
    }
  }
}
