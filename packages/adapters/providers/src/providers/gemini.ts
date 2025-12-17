/**
 * Gemini CLI provider configuration
 *
 * CLI: gemini
 * Auth: Handled entirely by Gemini CLI (Google Cloud auth)
 * Model: Uses CLI's default model (we don't specify)
 *
 * @see https://github.com/google-gemini/gemini-cli
 */

import type { CLIProviderConfig } from '../types.js';

/**
 * Gemini provider configuration
 *
 * Design: AutomatosX does NOT manage credentials or model selection.
 * The Gemini CLI handles all authentication and uses its configured default model.
 */
export const geminiConfig: CLIProviderConfig = {
  providerId: 'gemini',
  command: 'gemini',
  args: ['--approval-mode', 'auto_edit', '--output-format', 'stream-json'],
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
      name: 'Gemini Default',
      contextWindow: 1000000,
      capabilities: ['text', 'code', 'vision'],
      isDefault: true,
    },
  ],
};
