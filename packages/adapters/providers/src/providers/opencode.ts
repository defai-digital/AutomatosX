/**
 * OpenCode CLI provider configuration
 *
 * CLI: opencode
 * Auth: Handled entirely by OpenCode CLI (API keys configured in opencode)
 * Model: Uses CLI's default model (configurable in opencode)
 *
 * @see https://github.com/opencode-ai/opencode
 */

import { TIMEOUT_PROVIDER_DEFAULT } from '@defai.digital/contracts';
import type { CLIProviderConfig } from '../types.js';

/**
 * OpenCode provider configuration
 *
 * Design: AutomatosX does NOT manage credentials or model selection.
 * The OpenCode CLI handles all authentication and uses its configured default model.
 */
export const opencodeConfig: CLIProviderConfig = {
  providerId: 'opencode',
  command: 'opencode',
  args: ['run', '--format', 'json'],  // Use 'run' subcommand with JSON format
  promptStyle: 'arg',  // Append prompt as argument after 'run --format json'
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
      name: 'OpenCode Default',
      contextWindow: 128000,
      capabilities: ['text', 'code'],
      isDefault: true,
    },
  ],
};
