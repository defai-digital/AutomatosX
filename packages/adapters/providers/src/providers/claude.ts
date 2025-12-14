/**
 * Claude CLI provider configuration
 *
 * CLI: claude --print --output-format stream-json
 * Auth: Handled by Claude CLI (~/.claude/ config)
 */

import type { CLIProviderConfig } from '../types.js';

/**
 * Claude provider configuration
 */
export const claudeConfig: CLIProviderConfig = {
  providerId: 'claude',
  command: 'claude',
  args: ['--print', '--output-format', 'stream-json'],
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
      modelId: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      contextWindow: 200000,
      capabilities: ['text', 'code', 'vision'],
      isDefault: true,
    },
    {
      modelId: 'claude-opus-4-20250514',
      name: 'Claude Opus 4',
      contextWindow: 200000,
      capabilities: ['text', 'code', 'vision'],
    },
    {
      modelId: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      contextWindow: 200000,
      capabilities: ['text', 'code', 'vision'],
    },
    {
      modelId: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      contextWindow: 200000,
      capabilities: ['text', 'code'],
    },
    {
      modelId: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      contextWindow: 200000,
      capabilities: ['text', 'code', 'vision'],
    },
  ],
};
