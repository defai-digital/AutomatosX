/**
 * Claude CLI provider configuration
 *
 * CLI: claude
 * Auth: Handled entirely by Claude CLI (~/.claude/ config)
 * Model: Uses CLI's default model (we don't specify)
 *
 * @see https://github.com/anthropics/claude-code
 */

import type { CLIProviderConfig } from '../types.js';

/**
 * Claude provider configuration
 *
 * Design: AutomatosX does NOT manage credentials or model selection.
 * The Claude CLI handles all authentication and uses its configured default model.
 */
export const claudeConfig: CLIProviderConfig = {
  providerId: 'claude',
  command: 'claude',
  args: ['--print', '--output-format', 'stream-json', '--verbose'],
  env: {
    // Non-interactive mode flags
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'stream-json',
  timeout: 120000, // 2 minutes
  models: [
    {
      modelId: 'default',
      name: 'Claude Default',
      contextWindow: 200000,
      capabilities: ['text', 'code', 'vision'],
      isDefault: true,
    },
  ],
};
