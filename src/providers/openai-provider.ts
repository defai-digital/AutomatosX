/**
 * OpenAIProvider - Pure CLI Wrapper (v8.3.0)
 *
 * Simply invokes `codex "<prompt>"` command
 * No model selection, no API keys, no cost tracking
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig } from '../types/provider.js';
import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { findOnPath } from '../core/cli-provider-detector.js';

const execAsync = promisify(exec);

export class OpenAIProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  /**
   * Execute CLI command: codex "<prompt>"
   */
  protected async executeCLI(prompt: string): Promise<string> {
    // Check if running in mock mode for tests
    if (process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true') {
      return `[Mock OpenAI/Codex Response]\n\n${prompt.substring(0, 100)}...\n\nMock response.`;
    }

    try {
      // Escape quotes in prompt
      const escapedPrompt = this.escapeShellArg(prompt);

      // Execute: codex "prompt"
      const { stdout, stderr } = await execAsync(
        `codex "${escapedPrompt}"`,
        {
          timeout: this.config.timeout || 120000, // 2 min default
          maxBuffer: 10 * 1024 * 1024 // 10MB
        }
      );

      if (stderr && !stdout) {
        throw new Error(`Codex CLI error: ${stderr}`);
      }

      return stdout.trim();
    } catch (error) {
      logger.error('Codex CLI execution failed', { error });
      throw this.handleError(error);
    }
  }

  /**
   * Check if codex CLI is available
   */
  protected async checkCLIAvailable(): Promise<boolean> {
    try {
      const path = await findOnPath('codex');
      return path !== null;
    } catch {
      return false;
    }
  }
}
