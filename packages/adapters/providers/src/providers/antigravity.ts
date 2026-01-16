/**
 * Antigravity CLI provider configuration
 *
 * CLI: antigravity
 * Auth: Handled entirely by Antigravity CLI (Google account)
 * Model: Uses CLI's default model (Gemini 2.5 Pro/Flash)
 *
 * @see https://developers.google.com/agentic-experience
 */

import { TIMEOUT_PROVIDER_DEFAULT } from '@defai.digital/contracts';
import type { CLIProviderConfig } from '../types.js';

/**
 * Antigravity provider configuration
 *
 * Design: AutomatosX does NOT manage credentials or model selection.
 * The Antigravity CLI handles all authentication and uses its configured default model.
 */
export const antigravityConfig: CLIProviderConfig = {
  providerId: 'antigravity',
  command: 'antigravity',
  args: ['--print', '--output-format', 'stream-json'],
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
      name: 'Antigravity Default',
      contextWindow: 1000000, // Gemini 2.5 Pro has 1M context
      capabilities: ['text', 'code', 'vision'],
      isDefault: true,
    },
  ],
};
