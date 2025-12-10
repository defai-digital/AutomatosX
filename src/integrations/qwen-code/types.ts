/**
 * Qwen Code Integration Types
 *
 * Type definitions for Qwen Code CLI integration.
 *
 * v12.7.0: Added as part of Qwen Code provider integration.
 *
 * @module integrations/qwen-code/types
 */

/**
 * Supported Qwen models
 *
 * Models available through Qwen Code CLI and Qwen API.
 */
export type QwenModel =
  | 'qwen3-coder-480b-a35b-instruct'   // Flagship 480B model with A35B active params
  | 'qwen3-coder-30b-a3b-instruct'     // 30B model with A3B active params
  | 'qwen2.5-coder-32b-instruct'       // Qwen 2.5 coder (alternative)
  | 'qwen-max'                          // Max model via API
  | 'qwen-plus'                         // Plus model via API
  | 'qwen-turbo';                       // Turbo model (fast, cost-effective)

/**
 * Qwen SDK configuration
 *
 * Configuration for OpenAI-compatible API access to Qwen models.
 */
export interface QwenSDKConfig {
  /** API key (defaults to DASHSCOPE_API_KEY or QWEN_API_KEY env var) */
  apiKey?: string;
  /** Base URL for OpenAI-compatible API */
  baseUrl?: string;
  /** Model to use */
  model?: QwenModel;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Qwen CLI configuration
 *
 * Configuration for Qwen Code CLI execution.
 */
export interface QwenCLIConfig {
  /** CLI command name (default: 'qwen') */
  command?: string;
  /** VLM switch mode: 'once' | 'session' | 'persist' */
  vlmSwitchMode?: 'once' | 'session' | 'persist';
  /** Enable auto vision switching */
  yolo?: boolean;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Qwen execution options
 */
export interface QwenExecutionOptions {
  /** Override model for this request */
  model?: QwenModel;
  /** Override timeout for this request */
  timeout?: number;
  /** Vision mode options */
  vision?: {
    enabled?: boolean;
    switchMode?: 'once' | 'session' | 'persist';
  };
}

/**
 * Default Qwen API base URL (Alibaba Cloud DashScope)
 */
export const QWEN_DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

/**
 * Default model
 */
export const QWEN_DEFAULT_MODEL: QwenModel = 'qwen-turbo';

/**
 * Default CLI command
 */
export const QWEN_DEFAULT_COMMAND = 'qwen';

/**
 * Model mapping for normalization
 */
export const QWEN_MODEL_MAPPING: Record<string, string> = {
  // Normalize common aliases
  'qwen-coder': 'qwen3-coder-480b-a35b-instruct',
  'qwen-coder-480b': 'qwen3-coder-480b-a35b-instruct',
  'qwen-coder-30b': 'qwen3-coder-30b-a3b-instruct',
  'qwen2.5-coder': 'qwen2.5-coder-32b-instruct',
};

/**
 * Normalize Qwen model name
 *
 * @param model - Model name to normalize
 * @returns Normalized model name
 */
export function normalizeQwenModel(model: string): string {
  return QWEN_MODEL_MAPPING[model] || model;
}

/**
 * Check if model supports vision
 *
 * @param model - Model name to check
 * @returns true if model supports vision capabilities
 */
export function isVisionModel(model: string): boolean {
  // Qwen3-Coder models with vision support
  return model.includes('qwen3-coder') || model.includes('qwen-max');
}

/**
 * Get context window for model
 *
 * @param model - Model name
 * @returns Max context tokens
 */
export function getModelContextWindow(model: string): number {
  const normalizedModel = normalizeQwenModel(model);

  // Context windows vary by model
  if (normalizedModel.includes('480b')) return 128000;
  if (normalizedModel.includes('30b')) return 64000;
  if (normalizedModel.includes('qwen-max')) return 128000;
  if (normalizedModel.includes('qwen-plus')) return 128000;
  if (normalizedModel.includes('qwen-turbo')) return 128000;

  return 64000; // Default
}
