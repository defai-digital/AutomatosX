/**
 * Codex (OpenAI) CLI provider configuration
 *
 * CLI: codex --json
 * Auth: Handled by Codex CLI (OpenAI auth)
 */

import type { CLIProviderConfig } from '../types.js';

/**
 * Codex provider configuration
 */
export const codexConfig: CLIProviderConfig = {
  providerId: 'codex',
  command: 'codex',
  args: ['--json'],
  env: {
    // Non-interactive mode
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'json',
  timeout: 120000, // 2 minutes
  models: [
    {
      modelId: 'gpt-4o',
      name: 'GPT-4o',
      contextWindow: 128000,
      capabilities: ['text', 'code', 'vision'],
      isDefault: true,
    },
    {
      modelId: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      contextWindow: 128000,
      capabilities: ['text', 'code', 'vision'],
    },
    {
      modelId: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      contextWindow: 128000,
      capabilities: ['text', 'code', 'vision'],
    },
    {
      modelId: 'o1',
      name: 'o1',
      contextWindow: 200000,
      capabilities: ['text', 'code'],
    },
    {
      modelId: 'o1-mini',
      name: 'o1 Mini',
      contextWindow: 128000,
      capabilities: ['text', 'code'],
    },
  ],
};
