/**
 * GLM CLI provider configuration
 *
 * CLI: ax-glm
 * Auth: Handled by ax-glm CLI (ZAI_API_KEY)
 *
 * GLM (Zhipu AI) is a Chinese AI model provider.
 * @see https://open.bigmodel.cn/
 */

import type { CLIProviderConfig } from '../types.js';

/**
 * GLM provider configuration
 */
export const glmConfig: CLIProviderConfig = {
  providerId: 'glm',
  command: 'ax-glm',
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
      modelId: 'glm-4-plus',
      name: 'GLM-4 Plus',
      contextWindow: 128000,
      capabilities: ['text', 'code'],
      isDefault: true,
    },
    {
      modelId: 'glm-4-air',
      name: 'GLM-4 Air',
      contextWindow: 128000,
      capabilities: ['text', 'code'],
    },
    {
      modelId: 'glm-4-flash',
      name: 'GLM-4 Flash',
      contextWindow: 128000,
      capabilities: ['text', 'code'],
    },
    {
      modelId: 'glm-4v-plus',
      name: 'GLM-4V Plus',
      contextWindow: 8000,
      capabilities: ['text', 'code', 'vision'],
    },
  ],
};
