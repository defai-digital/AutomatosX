/**
 * Type definitions for ax-glm integration
 *
 * @module integrations/ax-glm/types
 */

/**
 * Supported GLM models
 */
export type GLMModel =
  | 'glm-4.6'      // 200K context, thinking mode
  | 'glm-4.5v'     // 64K context, vision capability
  | 'glm-4'        // 128K context (default)
  | 'glm-4-flash'  // Fast, cost-effective
  // Legacy aliases
  | 'glm-4-plus'   // Maps to glm-4.6
  | 'glm-4v'       // Maps to glm-4.5v
  | 'glm-4-air'    // Maps to glm-4-flash
  | 'glm-4-airx';  // Maps to glm-4-flash

/**
 * Model mapping from legacy to current names
 */
export const GLM_MODEL_MAPPING: Record<string, string> = {
  'glm-4-plus': 'glm-4.6',
  'glm-4v': 'glm-4.5v',
  'glm-4-air': 'glm-4-flash',
  'glm-4-airx': 'glm-4-flash'
};

/**
 * GLM SDK configuration
 */
export interface GLMSDKConfig {
  /** API key (defaults to ZAI_API_KEY env var) */
  apiKey?: string;
  /** Base URL (defaults to Zhipu AI's endpoint) */
  baseUrl?: string;
  /** Model to use */
  model?: GLMModel;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * GLM CLI configuration
 */
export interface GLMCLIConfig {
  /** CLI command (default: ax-glm) */
  command?: string;
  /** Model to use */
  model?: GLMModel;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * GLM execution options
 */
export interface GLMExecutionOptions {
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
}

/**
 * Default GLM base URL (Zhipu AI's OpenAI-compatible endpoint)
 */
export const GLM_DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

/**
 * Default model
 */
export const GLM_DEFAULT_MODEL: GLMModel = 'glm-4';

/**
 * Default CLI command
 */
export const GLM_DEFAULT_COMMAND = 'ax-glm';

/**
 * Normalize model name (handle legacy aliases)
 */
export function normalizeGLMModel(model: string): string {
  return GLM_MODEL_MAPPING[model] || model;
}
