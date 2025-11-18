/**
 * GeminiProvider - Pure CLI Wrapper (v8.3.0)
 *
 * Invokes Google's Gemini CLI: `gemini "prompt"`
 * Uses CLI's default model and authentication
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig } from '../types/provider.js';

export class GeminiProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  protected getCLICommand(): string {
    return 'gemini';
  }

  /**
   * Get CLI arguments for Gemini
   * Enables auto-approval for edit tools and native streaming JSON output
   */
  protected override getCLIArgs(): string[] {
    return [
      '--approval-mode', 'auto_edit',  // Auto-approve file edit operations
      '--output-format', 'stream-json'  // Enable streaming JSON output
    ];
  }

  protected getMockResponse(): string {
    return `[Mock Gemini Response]\n\nThis is a mock response for testing purposes.`;
  }
}
