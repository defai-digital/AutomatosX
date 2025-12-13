/**
 * Grok CLI Wrapper
 *
 * Wraps the ax-grok CLI for fallback execution when SDK is unavailable.
 * Extends OpenAICompatibleCliWrapper to reduce code duplication.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 * v12.8.4: Refactored to extend shared OpenAICompatibleCliWrapper base class.
 *
 * @module integrations/ax-grok/cli-wrapper
 */

import { OpenAICompatibleCliWrapper } from '../shared/openai-compatible-cli-wrapper.js';
import {
  type GrokCLIConfig,
  type GrokModel,
  GROK_DEFAULT_COMMAND,
  GROK_DEFAULT_MODEL,
  normalizeGrokModel
} from './types.js';
import { TIMEOUTS } from '../../core/validation-limits.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * Grok CLI Wrapper
 *
 * Executes prompts via the ax-grok CLI tool.
 * Extends the shared OpenAICompatibleCliWrapper to reduce code duplication.
 *
 * **Setup:**
 * ```bash
 * npm install -g @defai.digital/ax-grok
 * export XAI_API_KEY=your_api_key
 * ```
 *
 * **Usage:**
 * ```typescript
 * const cli = new GrokCliWrapper({ model: 'grok-3' });
 * const response = await cli.execute({ prompt: 'Hello' });
 * ```
 */
export class GrokCliWrapper extends OpenAICompatibleCliWrapper {
  constructor(config: GrokCLIConfig = {}) {
    super({
      command: config.command || GROK_DEFAULT_COMMAND,
      model: config.model || GROK_DEFAULT_MODEL,
      timeout: config.timeout || TIMEOUTS.PROVIDER_DEFAULT,
      providerName: 'Grok',
      defaultModel: 'grok-3',
      normalizeModel: normalizeGrokModel
    });

    logger.debug('[Grok CLI] Wrapper created (extends OpenAICompatibleCliWrapper)', {
      command: this.config.command,
      model: this.config.model
    });
  }

  /**
   * Get the configured model (typed as GrokModel)
   */
  override getModel(): GrokModel {
    return this.config.model as GrokModel;
  }
}
