/**
 * GeminiProvider - Pure CLI Wrapper (v8.3.0)
 *
 * Invokes Google's Gemini CLI: `gemini "prompt"`
 * Uses CLI's default model and authentication
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig } from '../types/provider.js';
import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { findOnPath } from '../core/cli-provider-detector.js';

const execAsync = promisify(exec);

export class GeminiProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  /**
   * Execute: gemini "prompt"
   */
  protected async executeCLI(prompt: string): Promise<string> {
    // Mock mode for tests
    if (process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true') {
      logger.debug('Using mock Gemini provider');
      return `[Mock Gemini Response]\n\nReceived: ${prompt.substring(0, 100)}...\n\nThis is a mock response.`;
    }

    try {
      // Escape prompt for shell safety
      const escapedPrompt = this.escapeShellArg(prompt);

      logger.debug('Executing Gemini CLI', {
        command: 'gemini',
        promptLength: prompt.length
      });

      // Execute CLI command
      const { stdout, stderr } = await execAsync(
        `gemini "${escapedPrompt}"`,
        {
          timeout: this.config.timeout || 120000, // 2 min default
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          env: { ...process.env }
        }
      );

      if (stderr && !stdout) {
        throw new Error(`Gemini CLI error: ${stderr}`);
      }

      const result = stdout.trim();

      logger.debug('Gemini CLI execution successful', {
        responseLength: result.length
      });

      return result;
    } catch (error) {
      logger.error('Gemini CLI execution failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw this.handleError(error);
    }
  }

  /**
   * Check if gemini CLI is available on PATH
   */
  protected async checkCLIAvailable(): Promise<boolean> {
    try {
      const path = await findOnPath('gemini');
      const available = path !== null;

      logger.debug('Gemini CLI availability check', {
        available,
        path: path || 'not found'
      });

      return available;
    } catch (error) {
      logger.debug('Gemini CLI availability check failed', { error });
      return false;
    }
  }
}
