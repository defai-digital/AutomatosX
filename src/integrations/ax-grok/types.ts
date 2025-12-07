/**
 * Type definitions for ax-grok integration
 *
 * @module integrations/ax-grok/types
 */

/**
 * Supported Grok models
 */
export type GrokModel =
  | 'grok-3'         // 131K context, reasoning effort (extended thinking)
  | 'grok-3-mini'    // Fast, cost-effective
  | 'grok-2-vision'  // Image understanding
  | 'grok-2'         // Live web search
  // Legacy alias
  | 'grok-beta';     // Maps to grok-3

/**
 * Model mapping from legacy to current names
 */
export const GROK_MODEL_MAPPING: Record<string, string> = {
  'grok-beta': 'grok-3'
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
 * Default model
 */
export const GROK_DEFAULT_MODEL: GrokModel = 'grok-3';

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
