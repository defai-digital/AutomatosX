/**
 * Type definitions for ax-glm integration
 *
 * v12.8.0: Updated to match ax-cli v4.3.15 SDK
 *
 * @module integrations/ax-glm/types
 */

/**
 * Supported GLM models (ax-cli v4.3.15)
 *
 * @see https://github.com/defai-digital/ax-cli
 */
export type GLMModel =
  | 'glm-4.6'      // 200K context, thinking mode (most capable)
  | 'glm-4.6v'     // 128K context, vision + thinking
  | 'glm-4-flash'  // 128K context, fast
  | 'cogview-4'    // Image generation
  // Convenience aliases
  | 'glm-latest'   // Maps to glm-4.6
  | 'glm-vision'   // Maps to glm-4.6v
  | 'glm-fast'     // Maps to glm-4-flash
  | 'glm-image'    // Maps to cogview-4
  // Legacy aliases (deprecated)
  | 'glm-4-plus'   // Maps to glm-4.6
  | 'glm-4.5v'     // Maps to glm-4.6v (upgraded)
  | 'glm-4v'       // Maps to glm-4.6v
  | 'glm-4'        // Maps to glm-4.6 (default upgraded)
  | 'glm-4-air'    // Maps to glm-4-flash
  | 'glm-4-airx';  // Maps to glm-4-flash

/**
 * Model mapping from aliases/legacy to current names
 */
export const GLM_MODEL_MAPPING: Record<string, string> = {
  // Convenience aliases (ax-cli v4.3.15)
  'glm-latest': 'glm-4.6',
  'glm-vision': 'glm-4.6v',
  'glm-fast': 'glm-4-flash',
  'glm-image': 'cogview-4',
  // Legacy aliases (deprecated)
  'glm-4-plus': 'glm-4.6',
  'glm-4.5v': 'glm-4.6v',
  'glm-4v': 'glm-4.6v',
  'glm-4': 'glm-4.6',
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
 * Default model (ax-cli v4.3.15: glm-4.6 is most capable)
 */
export const GLM_DEFAULT_MODEL: GLMModel = 'glm-4.6';

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
