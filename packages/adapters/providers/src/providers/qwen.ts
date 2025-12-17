/**
 * Qwen CLI provider configuration
 *
 * CLI: qwen
 * Auth: Handled entirely by Qwen CLI (DashScope auth)
 * Model: Uses CLI's default model (we don't specify)
 *
 * @see https://github.com/QwenLM/qwen-code
 */

import type { CLIProviderConfig } from '../types.js';

/**
 * Qwen provider configuration
 *
 * Design: AutomatosX does NOT manage credentials or model selection.
 * The Qwen CLI handles all authentication and uses its configured default model.
 */
export const qwenConfig: CLIProviderConfig = {
  providerId: 'qwen',
  command: 'qwen',
  args: [],
  env: {
    // Non-interactive mode flags
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'text',
  timeout: 120000, // 2 minutes
  models: [
    {
      modelId: 'default',
      name: 'Qwen Default',
      contextWindow: 131000,
      capabilities: ['text', 'code'],
      isDefault: true,
    },
  ],
};
