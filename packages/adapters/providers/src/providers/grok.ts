/**
 * Grok CLI provider configuration
 *
 * CLI: ax-grok
 * Auth: Handled entirely by ax-grok CLI
 * Model: Uses CLI's default model (we don't specify)
 *
 * @see https://github.com/anthropics/ax-cli
 */

import { TIMEOUT_PROVIDER_SHORT } from '@defai.digital/contracts';
import type { CLIProviderConfig } from '../types.js';

/**
 * Grok provider configuration
 *
 * Design: AutomatosX does NOT manage credentials or model selection.
 * The ax-grok CLI handles all authentication and uses its configured default model.
 */
export const grokConfig: CLIProviderConfig = {
  providerId: 'grok',
  command: 'ax-grok',
  args: ['--prompt'],  // Prompt text will be appended as next argument
  promptStyle: 'arg',  // Pass prompt as command-line argument (not stdin)
  env: {
    // Non-interactive mode flags
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'stream-json',  // ax-grok outputs JSON Lines: {"role":"assistant","content":"..."}
  timeout: TIMEOUT_PROVIDER_SHORT, // ax-grok has shutdown hang issue, timeout kills it
  models: [
    {
      modelId: 'default',
      name: 'Grok Default',
      contextWindow: 131000,
      capabilities: ['text', 'code'],
      isDefault: true,
    },
  ],
};
