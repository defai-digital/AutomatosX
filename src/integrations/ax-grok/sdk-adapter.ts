/**
 * Grok SDK Adapter
 *
 * Provides direct SDK access to xAI's Grok models.
 * Uses the @ai-sdk/xai package if available, otherwise falls back to
 * OpenAI-compatible API with xAI's endpoint.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 * v12.8.4: Refactored to extend shared OpenAICompatibleSdkAdapter base class.
 *
 * @module integrations/ax-grok/sdk-adapter
 */

import { OpenAICompatibleSdkAdapter } from '../shared/openai-compatible-sdk-adapter.js';
import {
  type GrokSDKConfig,
  type GrokModel,
  GROK_DEFAULT_BASE_URL,
  GROK_DEFAULT_MODEL,
  normalizeGrokModel
} from './types.js';

/**
 * Grok SDK Adapter
 *
 * Uses OpenAI SDK with xAI's OpenAI-compatible endpoint for Grok access.
 * Extends the shared OpenAICompatibleSdkAdapter to reduce code duplication.
 *
 * **Setup:**
 * ```bash
 * export XAI_API_KEY=your_api_key
 * ```
 *
 * **Usage:**
 * ```typescript
 * const adapter = new GrokSdkAdapter({ model: 'grok-3' });
 * const response = await adapter.execute({ prompt: 'Hello' });
 * ```
 */
export class GrokSdkAdapter extends OpenAICompatibleSdkAdapter {
  constructor(config: GrokSDKConfig = {}) {
    super({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || GROK_DEFAULT_BASE_URL,
      model: config.model || GROK_DEFAULT_MODEL,
      timeout: config.timeout,
      providerName: 'Grok',
      apiKeyEnvVar: 'XAI_API_KEY',
      normalizeModel: normalizeGrokModel
    });
  }

  /**
   * Get the configured model
   */
  override getModel(): GrokModel {
    return this.config.model as GrokModel;
  }
}
