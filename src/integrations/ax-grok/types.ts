/**
 * Type definitions for ax-grok integration
 *
 * v12.8.0: Updated to match ax-cli v4.3.15 SDK
 *
 * @module integrations/ax-grok/types
 */

/**
 * Supported Grok models (ax-cli v4.3.15)
 *
 * @see https://github.com/defai-digital/ax-cli
 */
export type GrokModel =
  | 'grok-4-0709'        // 131K context, most capable
  | 'grok-4.1-fast'      // 131K context, with agent tools
  | 'grok-3'             // 131K context, extended reasoning
  | 'grok-3-mini'        // 131K context, fast/economical
  | 'grok-2-vision-1212' // 32K context, vision capability
  | 'grok-2-image-1212'  // 32K context, image generation
  | 'grok-2'             // Live web search (legacy)
  // Convenience aliases
  | 'grok-latest'        // Maps to grok-4-0709
  | 'grok-fast'          // Maps to grok-4.1-fast
  | 'grok-mini'          // Maps to grok-3-mini
  | 'grok-vision'        // Maps to grok-2-vision-1212
  | 'grok-image'         // Maps to grok-2-image-1212
  // Legacy aliases (deprecated)
  | 'grok-beta'          // Maps to grok-3
  | 'grok-2-vision';     // Maps to grok-2-vision-1212

/**
 * Model mapping from aliases/legacy to current names
 */
export const GROK_MODEL_MAPPING: Record<string, string> = {
  // Convenience aliases (ax-cli v4.3.15)
  'grok-latest': 'grok-4-0709',
  'grok-fast': 'grok-4.1-fast',
  'grok-mini': 'grok-3-mini',
  'grok-vision': 'grok-2-vision-1212',
  'grok-image': 'grok-2-image-1212',
  // Legacy aliases (deprecated)
  'grok-beta': 'grok-3',
  'grok-2-vision': 'grok-2-vision-1212'
};

/**
 * Grok SDK configuration
 */
export interface GrokSDKConfig {
  /** API key (defaults to XAI_API_KEY env var) */
  apiKey?: string;
  /** Base URL (defaults to xAI's endpoint) */
  baseUrl?: string;
  /** Model to use */
  model?: GrokModel;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Grok CLI configuration
 */
export interface GrokCLIConfig {
  /** CLI command (default: ax-grok) */
  command?: string;
  /** Model to use */
  model?: GrokModel;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Grok execution options
 */
export interface GrokExecutionOptions {
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for sampling */
  temperature?: number;
  /** Top-p sampling */
  topP?: number;
  /** Stop sequences */
  stop?: string[];
  /** Enable streaming */
  stream?: boolean;
  /** Enable web search */
  webSearch?: boolean;
}

/**
 * Default Grok base URL (xAI's OpenAI-compatible endpoint)
 */
export const GROK_DEFAULT_BASE_URL = 'https://api.x.ai/v1';

/**
 * Default model (ax-cli v4.3.15: grok-4-0709 is most capable)
 */
export const GROK_DEFAULT_MODEL: GrokModel = 'grok-4-0709';

/**
 * Default CLI command
 */
export const GROK_DEFAULT_COMMAND = 'ax-grok';

/**
 * Normalize model name (handle legacy aliases)
 */
export function normalizeGrokModel(model: string): string {
  return GROK_MODEL_MAPPING[model] || model;
}
