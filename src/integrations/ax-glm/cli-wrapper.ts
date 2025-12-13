/**
 * GLM CLI Wrapper
 *
 * Wraps the ax-glm CLI for fallback execution when SDK is unavailable.
 * Extends OpenAICompatibleCliWrapper to reduce code duplication.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 * v12.8.4: Refactored to extend shared OpenAICompatibleCliWrapper base class.
 *
 * @module integrations/ax-glm/cli-wrapper
 */

import { OpenAICompatibleCliWrapper } from '../shared/openai-compatible-cli-wrapper.js';
import {
  type GLMCLIConfig,
  type GLMModel,
  GLM_DEFAULT_COMMAND,
  GLM_DEFAULT_MODEL,
  normalizeGLMModel
} from './types.js';
import { TIMEOUTS } from '../../core/validation-limits.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * GLM CLI Wrapper
 *
 * Executes prompts via the ax-glm CLI tool.
 * Extends the shared OpenAICompatibleCliWrapper to reduce code duplication.
 *
 * **Setup:**
 * ```bash
 * npm install -g @defai.digital/ax-glm
 * export ZAI_API_KEY=your_api_key
 * ```
 *
 * **Usage:**
 * ```typescript
 * const cli = new GLMCliWrapper({ model: 'glm-4.6' });
 * const response = await cli.execute({ prompt: 'Hello' });
 * ```
 */
export class GLMCliWrapper extends OpenAICompatibleCliWrapper {
  constructor(config: GLMCLIConfig = {}) {
    super({
      command: config.command || GLM_DEFAULT_COMMAND,
      model: config.model || GLM_DEFAULT_MODEL,
      timeout: config.timeout || TIMEOUTS.PROVIDER_DEFAULT,
      providerName: 'GLM',
      defaultModel: 'glm-4',
      normalizeModel: normalizeGLMModel
    });

    logger.debug('[GLM CLI] Wrapper created (extends OpenAICompatibleCliWrapper)', {
      command: this.config.command,
      model: this.config.model
    });
  }

  /**
   * Get the configured model (typed as GLMModel)
   */
  override getModel(): GLMModel {
    return this.config.model as GLMModel;
  }
}
