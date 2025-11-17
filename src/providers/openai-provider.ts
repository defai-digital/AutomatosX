/**
 * OpenAIProvider - Pure CLI Wrapper (v8.3.0)
 *
 * Simply invokes `codex "<prompt>"` command
 * No model selection, no API keys, no cost tracking
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig } from '../types/provider.js';

export class OpenAIProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  protected getCLICommand(): string {
    return 'codex';
  }

  protected getMockResponse(): string {
    return `[Mock OpenAI/Codex Response]\n\nThis is a mock response for testing purposes.`;
  }
}
