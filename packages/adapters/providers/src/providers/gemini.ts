/**
 * Gemini CLI provider configuration
 *
 * CLI: gemini --approval-mode auto_edit --output-format stream-json
 * Auth: Handled by Gemini CLI (Google Cloud auth or ~/.gemini/ config)
 */

import type { CLIProviderConfig } from '../types.js';

/**
 * Gemini provider configuration
 */
export const geminiConfig: CLIProviderConfig = {
  providerId: 'gemini',
  command: 'gemini',
  args: ['--approval-mode', 'auto_edit', '--output-format', 'stream-json'],
  env: {
    // Non-interactive mode
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'stream-json',
  timeout: 120000, // 2 minutes
  models: [
    {
      modelId: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      contextWindow: 1000000,
      capabilities: ['text', 'code', 'vision'],
      isDefault: true,
    },
    {
      modelId: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      contextWindow: 1000000,
      capabilities: ['text', 'code', 'vision'],
    },
    {
      modelId: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      contextWindow: 1000000,
      capabilities: ['text', 'code'],
    },
    {
      modelId: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      contextWindow: 2000000,
      capabilities: ['text', 'code', 'vision'],
    },
    {
      modelId: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      contextWindow: 1000000,
      capabilities: ['text', 'code', 'vision'],
    },
  ],
};
