/**
 * Qwen CLI provider configuration
 *
 * CLI: qwen
 * Auth: Handled by Qwen CLI (DashScope auth)
 */

import type { CLIProviderConfig } from '../types.js';

/**
 * Qwen provider configuration
 */
export const qwenConfig: CLIProviderConfig = {
  providerId: 'qwen',
  command: 'qwen',
  args: [],
  env: {
    // Non-interactive mode
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'text',
  timeout: 120000, // 2 minutes
  models: [
    {
      modelId: 'qwen-max',
      name: 'Qwen Max',
      contextWindow: 32000,
      capabilities: ['text', 'code'],
      isDefault: true,
    },
    {
      modelId: 'qwen-plus',
      name: 'Qwen Plus',
      contextWindow: 131000,
      capabilities: ['text', 'code'],
    },
    {
      modelId: 'qwen-turbo',
      name: 'Qwen Turbo',
      contextWindow: 1000000,
      capabilities: ['text', 'code'],
    },
    {
      modelId: 'qwen-coder-plus',
      name: 'Qwen Coder Plus',
      contextWindow: 131000,
      capabilities: ['code'],
    },
    {
      modelId: 'qwen-vl-max',
      name: 'Qwen VL Max',
      contextWindow: 32000,
      capabilities: ['text', 'code', 'vision'],
    },
  ],
};
