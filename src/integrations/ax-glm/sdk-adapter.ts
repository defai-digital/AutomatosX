/**
 * GLM SDK Adapter
 *
 * Provides direct SDK access to Zhipu AI's GLM models using OpenAI-compatible API.
 * Since there's no official @zhipuai/sdk package, we use the OpenAI SDK with
 * Zhipu's OpenAI-compatible endpoint.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 * v12.8.4: Refactored to extend shared OpenAICompatibleSdkAdapter base class.
 *
 * @module integrations/ax-glm/sdk-adapter
 */

import { OpenAICompatibleSdkAdapter } from '../shared/openai-compatible-sdk-adapter.js';
import {
  type GLMSDKConfig,
  type GLMModel,
  GLM_DEFAULT_BASE_URL,
  GLM_DEFAULT_MODEL,
  normalizeGLMModel
} from './types.js';

/**
 * GLM SDK Adapter
 *
 * Uses OpenAI SDK with Zhipu's OpenAI-compatible endpoint for GLM access.
 * Extends the shared OpenAICompatibleSdkAdapter to reduce code duplication.
 *
 * **Setup:**
 * ```bash
 * export ZAI_API_KEY=your_api_key
 * ```
 *
 * **Usage:**
 * ```typescript
 * const adapter = new GLMSdkAdapter({ model: 'glm-4.6' });
 * const response = await adapter.execute({ prompt: 'Hello' });
 * ```
 */
export class GLMSdkAdapter extends OpenAICompatibleSdkAdapter {
  constructor(config: GLMSDKConfig = {}) {
    super({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || GLM_DEFAULT_BASE_URL,
      model: config.model || GLM_DEFAULT_MODEL,
      timeout: config.timeout,
      providerName: 'GLM',
      apiKeyEnvVar: 'ZAI_API_KEY',
      normalizeModel: normalizeGLMModel
    });
  }

  /**
   * Get the configured model
   */
  override getModel(): GLMModel {
    return this.config.model as GLMModel;
  }
}
