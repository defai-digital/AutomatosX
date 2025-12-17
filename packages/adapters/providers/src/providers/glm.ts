/**
 * GLM CLI provider configuration
 *
 * CLI: ax-glm
 * Auth: Handled entirely by ax-glm CLI
 * Model: Uses CLI's default model (we don't specify)
 *
 * @see https://github.com/anthropics/ax-cli
 */

import type { CLIProviderConfig } from '../types.js';

/**
 * GLM provider configuration
 *
 * Design: AutomatosX does NOT manage credentials or model selection.
 * The ax-glm CLI handles all authentication and uses its configured default model.
 */
export const glmConfig: CLIProviderConfig = {
  providerId: 'glm',
  command: 'ax-glm',
  args: ['--prompt'],  // Prompt text will be appended as next argument
  promptStyle: 'arg',  // Pass prompt as command-line argument (not stdin)
  env: {
    // Non-interactive mode flags
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'stream-json',  // ax-glm outputs JSON Lines: {"role":"assistant","content":"..."}
  timeout: 60000, // 1 minute (ax-glm has shutdown hang issue, timeout kills it)
  models: [
    {
      modelId: 'default',
      name: 'GLM Default',
      contextWindow: 128000,
      capabilities: ['text', 'code'],
      isDefault: true,
    },
  ],
};
