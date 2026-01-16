/**
 * OpenCode CLI provider configuration
 *
 * CLI: opencode
 * Auth: Handled entirely by OpenCode CLI (API keys configured in opencode)
 * Model: Uses CLI's default model (configurable in opencode)
 *
 * @see https://github.com/opencode-ai/opencode
 */

import { TIMEOUT_PROVIDER_SHORT } from '@defai.digital/contracts';
import type { CLIProviderConfig } from '../types.js';

/**
 * OpenCode provider configuration
 *
 * Design: AutomatosX does NOT manage credentials or model selection.
 * The OpenCode CLI handles all authentication and uses its configured default model.
 *
 * PREREQUISITES: Run `opencode auth login` to configure credentials before use.
 * Without credentials, the CLI will hang indefinitely.
 */
export const opencodeConfig: CLIProviderConfig = {
  providerId: 'opencode',
  command: 'opencode',
  args: ['run', '--format', 'json'],  // Use 'run' with JSON format
  promptStyle: 'stdin',  // Pass prompt via stdin - more reliable for long prompts
  env: {
    // Non-interactive mode flags
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'json',  // OpenCode with --format json outputs single JSON object
  timeout: TIMEOUT_PROVIDER_SHORT,  // Shorter timeout - fails faster if no credentials
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
