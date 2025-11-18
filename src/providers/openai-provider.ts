/**
 * OpenAIProvider - Pure CLI Wrapper (v8.3.0)
 *
 * Uses `codex exec "<prompt>"` for non-interactive execution
 * No model selection, no API keys, no cost tracking
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig } from '../types/provider.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export class OpenAIProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  protected getCLICommand(): string {
    // Return 'codex exec' for streaming execution
    return 'codex exec';
  }

  /**
   * Get CLI arguments for Codex
   * Enables JSONL streaming output for real-time progress
   */
  protected override getCLIArgs(): string[] {
    return ['--json'];  // Output events as JSONL (streaming JSON)
  }

  /**
   * Override executeCLI to use 'codex exec' subcommand for non-interactive execution
   * This avoids "stdout is not a terminal" errors while keeping CLI detection working
   *
   * NOTE: This override is deprecated in favor of BaseProvider's streaming support.
   * Keeping for backward compatibility but should use BaseProvider.executeCLI with getCLIArgs().
   */
  protected override async executeCLI(prompt: string): Promise<string> {
    // Mock mode for tests
    if (process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true') {
      logger.debug('Mock mode: returning test response');
      return this.getMockResponse();
    }

    try {
      const escapedPrompt = this.escapeShellArg(prompt);
      const cliCommand = 'codex exec'; // Use 'exec' subcommand for non-interactive mode

      logger.debug('Executing codex exec CLI', {
        command: cliCommand,
        promptLength: prompt.length
      });

      const { stdout, stderr } = await execAsync(
        `${cliCommand} ${escapedPrompt}`,
        {
          timeout: this.config.timeout || 120000,
          maxBuffer: 10 * 1024 * 1024,
          shell: '/bin/bash',
          env: {
            ...process.env,
            // Force non-interactive mode for CLIs
            TERM: 'dumb',
            NO_COLOR: '1',
            FORCE_COLOR: '0',
            CI: 'true',
            NO_UPDATE_NOTIFIER: '1',
            DEBIAN_FRONTEND: 'noninteractive'
          }
        }
      );

      if (stderr) {
        // codex CLI outputs session info to stderr (normal behavior)
        // Only show in debug mode to reduce token usage
        logger.debug('codex exec CLI stderr output', { stderr: stderr.trim() });
      }

      if (!stdout) {
        throw new Error(`codex exec CLI returned empty output. stderr: ${stderr || 'none'}`);
      }

      logger.debug('codex exec CLI execution successful', {
        outputLength: stdout.length
      });

      return stdout.trim();
    } catch (error: any) {
      logger.error('codex exec CLI execution failed', { error });
      throw error;
    }
  }

  protected getMockResponse(): string {
    return `[Mock OpenAI/Codex Response]\n\nThis is a mock response for testing purposes.`;
  }
}
