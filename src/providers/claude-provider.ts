/**
 * ClaudeProvider - CLI-based Claude Code Provider (v10.5.0)
 *
 * Invokes Claude Code CLI: `claude --print "<prompt>"`
 *
 * Note: Claude Code users (80%) access AutomatosX via MCP CLIENT.
 * This provider is used for cross-provider routing when Claude is
 * selected as the best provider for a task from another AI assistant.
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig, ExecutionRequest, ExecutionResponse, ProviderCapabilities } from '../types/provider.js';
import { logger } from '../shared/logging/logger.js';

export class ClaudeProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
    logger.debug('[Claude Provider] Initialized (CLI mode)');
  }

  /**
   * Execute request via CLI
   */
  override async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    logger.debug('[Claude Provider] Executing via CLI', {
      promptLength: request.prompt.length,
    });

    return super.execute(request);
  }

  protected getCLICommand(): string {
    return 'claude';
  }

  /**
   * Get CLI arguments for Claude Code
   * Enables native streaming JSON output for real-time progress
   */
  protected override getCLIArgs(): string[] {
    return [
      '--print',  // Non-interactive mode
      '--output-format', 'stream-json'  // Enable streaming JSON output
    ];
  }

  protected getMockResponse(): string {
    return `[Mock Claude Response]\n\nThis is a mock response for testing purposes.`;
  }

  /**
   * Get extended capabilities
   */
  override get capabilities(): ProviderCapabilities {
    return {
      ...super.capabilities,
      integrationMode: 'cli',
      supportsMcp: true,
      mcpCommand: 'claude mcp serve',
    };
  }
}
