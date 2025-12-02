/**
 * OpenAIProvider - CLI-based Codex Provider (v10.5.0)
 *
 * Invokes Codex CLI: `codex exec "<prompt>"`
 *
 * Note: Codex CLI users (10%) access AutomatosX via MCP CLIENT.
 * This provider is used for cross-provider routing when Codex is
 * selected as the best provider for a task from another AI assistant.
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig, ExecutionRequest, ExecutionResponse } from '../types/provider.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export class OpenAIProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
    logger.debug('[OpenAI/Codex] Initialized (CLI mode)');
  }

  /**
   * Execute request via CLI
   */
  override async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    logger.debug('[OpenAI/Codex] Executing via CLI', {
      promptLength: request.prompt.length,
    });

    return super.execute(request);
  }

  protected getCLICommand(): string {
    // Return 'codex' as the base command (not 'codex exec')
    // The 'exec' subcommand is added in executeCLI() when building the full command
    return 'codex';
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
   */
  protected override async executeCLI(prompt: string): Promise<string> {
    // Mock mode for tests
    if (process.env.AX_MOCK_PROVIDERS === 'true') {
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

      // v9.0.3 Windows Fix: Detect correct shell for platform
      const shell = process.platform === 'win32' ? process.env.COMSPEC || 'cmd.exe' : '/bin/sh';

      const { stdout, stderr } = await execAsync(
        `${cliCommand} ${escapedPrompt}`,
        {
          timeout: this.config.timeout || 120000,
          maxBuffer: 10 * 1024 * 1024,
          shell,  // Platform-specific shell
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

  /**
   * Get extended capabilities
   */
  override get capabilities(): any {
    return {
      ...super.capabilities,
      integrationMode: 'cli',
      supportsMcp: true,
      mcpCommand: 'codex mcp-server',
    };
  }
}
