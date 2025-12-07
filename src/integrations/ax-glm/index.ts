/**
 * ax-glm Integration Module
 *
 * Provides SDK-first access to Zhipu AI's GLM models with CLI fallback.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 *
 * @module integrations/ax-glm
 */

export { GLMHybridAdapter, type GLMHybridAdapterOptions } from './hybrid-adapter.js';
export { GLMSdkAdapter } from './sdk-adapter.js';
export { GLMCliWrapper } from './cli-wrapper.js';
export {
  type GLMModel,
  type GLMSDKConfig,
  type GLMCLIConfig,
  type GLMExecutionOptions,
  GLM_MODEL_MAPPING,
  GLM_DEFAULT_BASE_URL,
  GLM_DEFAULT_MODEL,
  GLM_DEFAULT_COMMAND,
  normalizeGLMModel
} from './types.js';
