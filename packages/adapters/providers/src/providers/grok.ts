/**
 * Grok CLI provider configuration
 *
 * CLI: ax-grok
 * Auth: Handled by ax-grok CLI (XAI_API_KEY)
 *
 * Grok is xAI's language model.
 * @see https://x.ai/
 */

import type { CLIProviderConfig } from '../types.js';

/**
 * Grok provider configuration
 */
export const grokConfig: CLIProviderConfig = {
  providerId: 'grok',
  command: 'ax-grok',
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
      modelId: 'grok-3',
      name: 'Grok 3',
      contextWindow: 131000,
      capabilities: ['text', 'code'],
      isDefault: true,
    },
    {
      modelId: 'grok-3-fast',
      name: 'Grok 3 Fast',
      contextWindow: 131000,
      capabilities: ['text', 'code'],
    },
    {
      modelId: 'grok-2',
      name: 'Grok 2',
      contextWindow: 131000,
      capabilities: ['text', 'code'],
    },
    {
      modelId: 'grok-2-vision',
      name: 'Grok 2 Vision',
      contextWindow: 32000,
      capabilities: ['text', 'code', 'vision'],
    },
  ],
};
