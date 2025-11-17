/**
 * ClaudeProvider - Pure CLI Wrapper (v8.3.0)
 *
 * Simply invokes `claude "<prompt>"` command
 * No model selection, no API keys, no cost tracking
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig } from '../types/provider.js';

export class ClaudeProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  protected getCLICommand(): string {
    return 'claude';
  }

  protected getMockResponse(): string {
    return `[Mock Claude Response]\n\nThis is a mock response for testing purposes.`;
  }
}
