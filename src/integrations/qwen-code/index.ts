/**
 * Qwen Code Integration Module
 *
 * Provides SDK-first access to Qwen models with CLI fallback.
 *
 * v12.7.0: Added as part of Qwen Code provider integration.
 *
 * @module integrations/qwen-code
 */

export { QwenHybridAdapter, type QwenHybridAdapterOptions } from './hybrid-adapter.js';
export { QwenSdkAdapter } from './sdk-adapter.js';
export { QwenCliWrapper } from './cli-wrapper.js';
export {
  type QwenModel,
  type QwenSDKConfig,
  type QwenCLIConfig,
  type QwenExecutionOptions,
  QWEN_MODEL_MAPPING,
  QWEN_DEFAULT_BASE_URL,
  QWEN_DEFAULT_MODEL,
  QWEN_DEFAULT_COMMAND,
  normalizeQwenModel,
  isVisionModel,
  getModelContextWindow
} from './types.js';
