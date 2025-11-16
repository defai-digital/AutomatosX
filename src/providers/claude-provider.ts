/**
 * ClaudeProvider - Pure CLI Wrapper (v8.3.0)
 *
 * Simply invokes `claude "<prompt>"` command
 * No model selection, no API keys, no cost tracking
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig } from '../types/provider.js';
import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { findOnPath } from '../core/cli-provider-detector.js';

const execAsync = promisify(exec);

export class ClaudeProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  /**
   * Execute CLI command: claude "<prompt>"
   */
  protected async executeCLI(prompt: string): Promise<string> {
    // Check if running in mock mode for tests
    if (process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true') {
      return `[Mock Claude Response]\n\n${prompt.substring(0, 100)}...\n\nMock response.`;
    }

    try {
      // Escape quotes in prompt
      const escapedPrompt = this.escapeShellArg(prompt);

      // Execute: claude "prompt"
      const { stdout, stderr } = await execAsync(
        `claude "${escapedPrompt}"`,
        {
          timeout: this.config.timeout || 120000, // 2 min default
          maxBuffer: 10 * 1024 * 1024 // 10MB
        }
      );

      if (stderr && !stdout) {
        throw new Error(`Claude CLI error: ${stderr}`);
      }

      return stdout.trim();
    } catch (error) {
      logger.error('Claude CLI execution failed', { error });
      throw this.handleError(error);
    }
  }

  /**
   * Check if claude CLI is available
   */
  protected async checkCLIAvailable(): Promise<boolean> {
    try {
      const path = await findOnPath('claude');
      return path !== null;
    } catch {
      return false;
    }
  }
}
