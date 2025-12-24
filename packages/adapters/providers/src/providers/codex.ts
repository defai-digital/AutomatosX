/**
 * Codex (OpenAI) CLI provider configuration
 *
 * CLI: codex
 * Auth: Handled entirely by Codex CLI (OpenAI auth)
 * Model: Uses CLI's default model (we don't specify)
 *
 * @see https://github.com/openai/codex
 */

import { TIMEOUT_PROVIDER_DEFAULT } from '@automatosx/contracts';
import type { CLIProviderConfig } from '../types.js';

/**
 * Codex provider configuration
 *
 * Design: AutomatosX does NOT manage credentials or model selection.
 * The Codex CLI handles all authentication and uses its configured default model.
 */
export const codexConfig: CLIProviderConfig = {
  providerId: 'codex',
  command: 'codex',
  args: ['exec', '--json', '--skip-git-repo-check'],
  env: {
    // Non-interactive mode flags
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'stream-json',
  timeout: TIMEOUT_PROVIDER_DEFAULT,
  models: [
    {
      modelId: 'default',
      name: 'Codex Default',
      contextWindow: 128000,
      capabilities: ['text', 'code', 'vision'],
      isDefault: true,
    },
  ],
};
