/**
 * Local LLM provider configuration
 *
 * CLI: ax-cli
 * Auth: Handled entirely by ax-cli
 * Model: Uses CLI's configured local model
 *
 * @see https://github.com/defai-digital/ax-cli
 */

import { TIMEOUT_PROVIDER_SHORT } from '@defai.digital/contracts';
import type { CLIProviderConfig } from '../types.js';

/**
 * Detects when ax-cli has output a complete JSON response.
 * Similar to ax-grok, ax-cli outputs JSON with messages array.
 *
 * @param stdout - Accumulated stdout output
 * @returns true if complete JSON response detected
 */
function isLocalLlmOutputComplete(stdout: string): boolean {
  const lines = stdout.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || !trimmed.startsWith('{')) {
      continue;
    }

    try {
      const data = JSON.parse(trimmed) as Record<string, unknown>;
      // Verify it has the expected structure (messages array and model string)
      if (
        Array.isArray(data.messages) &&
        data.messages.length > 0 &&
        typeof data.model === 'string'
      ) {
        return true;
      }
    } catch {
      // Not valid JSON, continue to next line
    }
  }

  return false;
}

/**
 * Local LLM provider configuration
 *
 * Design: AutomatosX does NOT manage credentials or model selection.
 * The ax-cli handles all configuration and uses its configured local model.
 */
export const localLlmConfig: CLIProviderConfig = {
  providerId: 'local-llm',
  command: 'ax-cli',
  args: ['--json', '--prompt'],  // --json for JSONL output, --prompt for headless mode
  promptStyle: 'arg',  // Pass prompt as command-line argument after --prompt
  env: {
    // Non-interactive mode flags
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'stream-json',  // ax-cli outputs JSON Lines
  timeout: TIMEOUT_PROVIDER_SHORT,
  earlyTerminateOn: isLocalLlmOutputComplete,
  models: [
    {
      modelId: 'default',
      name: 'Local LLM Default',
      contextWindow: 32000,
      capabilities: ['text', 'code'],
      isDefault: true,
    },
  ],
};
