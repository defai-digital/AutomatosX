/**
 * GrokProvider - Pure CLI Wrapper for Grok (v8.4.0)
 *
 * Supports two CLI implementations:
 * 1. Z.AI GLM 4.6: `grok "prompt"` (free tier, Chinese model)
 * 2. X.AI Grok: `grok "prompt"` (official Grok, requires API key)
 *
 * Uses CLI's default model and authentication.
 * Configuration via YAML files for advanced setups.
 *
 * @see docs/providers/grok.md for detailed documentation
 * @see examples/providers/grok-*.yaml for configuration examples
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig } from '../types/provider.js';
import { logger } from '../utils/logger.js';

export class GrokProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);

    logger.debug('GrokProvider initialized', {
      name: config.name,
      enabled: config.enabled,
      priority: config.priority,
      command: config.command || 'grok'
    });
  }

  /**
   * Get the CLI command name for Grok
   * Returns 'grok' which can point to either:
   * - Z.AI GLM 4.6 CLI
   * - X.AI Official Grok CLI
   */
  protected getCLICommand(): string {
    // Allow custom command override via config (e.g., 'grok-z-ai' or 'grok-x-ai')
    // Handle empty string explicitly
    const command = this.config.command;
    return command && command.trim() !== '' ? command : 'grok';
  }

  /**
   * Get CLI arguments for headless mode
   * Grok CLI requires -p flag for non-interactive mode
   *
   * NOTE: The -p flag is currently hardcoded. If Grok CLI changes
   * its non-interactive flag in the future, this will need updating.
   * Consider making this configurable if multiple Grok CLI versions exist.
   */
  protected override getCLIArgs(): string[] {
    return ['-p'];  // -p = prompt mode (headless, single execution)
  }

  /**
   * Get mock response for testing
   * Returns a realistic Grok-style response
   */
  protected getMockResponse(): string {
    return `[Mock Grok Response]

This is a mock response from Grok for testing purposes.

Grok is designed to provide helpful, accurate, and witty responses to your queries. This mock response simulates the typical output you would receive from the Grok CLI.

Key features:
- Direct and informative answers
- Occasional humor and personality
- Factual accuracy
- Clear formatting

For actual Grok responses, ensure:
1. Grok CLI is installed (grok --version)
2. API credentials are configured (if using X.AI)
3. AUTOMATOSX_MOCK_PROVIDERS is not set to 'true'`;
  }
}
