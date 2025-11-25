import { BaseProvider } from './base.js';
export { ProviderEvents } from './base.js';
export { ClaudeProvider } from './claude.js';
export { GeminiProvider } from './gemini.js';
export { AxCliProvider } from './ax-cli.js';
export { OpenAIProvider } from './openai.js';
import { ProviderType } from '@ax/schemas';
export { ExecutionRequest, ExecutionResponse, IntegrationMode, ProviderConfig, ProviderHealth, ProviderType } from '@ax/schemas';

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

/**
 * Provider factory options
 */
interface ProviderFactoryOptions {
    claude?: {
        command?: string;
        args?: string[];
    };
    gemini?: {
        command?: string;
        args?: string[];
    };
    'ax-cli'?: {
        enableCheckpoints?: boolean;
        enableSubagents?: boolean;
    };
    openai?: {
        command?: string;
        args?: string[];
    };
}
/**
 * Create a provider instance by type
 */
declare function createProvider(type: ProviderType, options?: ProviderFactoryOptions): BaseProvider;
/**
 * Create all providers
 */
declare function createAllProviders(options?: ProviderFactoryOptions): Map<ProviderType, BaseProvider>;
/**
 * Get integration mode for a provider type
 */
declare function getIntegrationMode(type: ProviderType): 'mcp' | 'sdk' | 'bash';

export { BaseProvider, type ProviderFactoryOptions, createAllProviders, createProvider, getIntegrationMode };
