/**
 * GeminiProvider - CLI-based Gemini CLI Provider (v10.5.0)
 *
 * Invokes Gemini CLI: `gemini --approval-mode auto_edit "prompt"`
 *
 * Note: Gemini CLI users (8%) access AutomatosX via MCP CLIENT.
 * This provider is used for cross-provider routing when Gemini is
 * selected as the best provider for a task from another AI assistant.
 *
 * Gemini CLI does not have native MCP server support.
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig, ExecutionRequest, ExecutionResponse } from '../types/provider.js';
import { logger } from '../utils/logger.js';

export class GeminiProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
    logger.debug('[Gemini Provider] Initialized (CLI mode)');
  }

  /**
   * Execute request via CLI
   */
  override async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    logger.debug('[Gemini Provider] Executing via CLI', {
      promptLength: request.prompt.length,
    });

    return super.execute(request);
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

  /**
   * Get extended capabilities
   */
  override get capabilities(): any {
    return {
      ...super.capabilities,
      integrationMode: 'cli',
      supportsMcp: false,  // Gemini doesn't have MCP server support
    };
  }
}
