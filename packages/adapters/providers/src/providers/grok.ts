/**
 * Grok CLI provider configuration
 *
 * CLI: ax-grok
 * Auth: Handled entirely by ax-grok CLI
 * Model: Uses CLI's default model (we don't specify)
 *
 * @see https://github.com/defai-digital/ax-cli
 */

import { TIMEOUT_PROVIDER_SHORT } from '@defai.digital/contracts';
import type { CLIProviderConfig } from '../types.js';

/**
 * Detects when ax-grok has output a complete JSON response.
 * ax-grok outputs informational text followed by JSON like:
 *   ℹ️  Recommendation: ...
 *   {"messages":[...],"model":"...","timestamp":"..."}
 *   Gracefully shutting down... (hangs here)
 *
 * We detect completion by finding a valid JSON line with the expected structure.
 *
 * @param stdout - Accumulated stdout output
 * @returns true if complete JSON response detected
 */
function isGrokOutputComplete(stdout: string): boolean {
  // Look for a JSON line within the output (ax-grok outputs info text before JSON)
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
 * Grok provider configuration
 *
 * Design: AutomatosX does NOT manage credentials or model selection.
 * The ax-grok CLI handles all authentication and uses its configured default model.
 */
export const grokConfig: CLIProviderConfig = {
  providerId: 'grok',
  command: 'ax-grok',
  args: ['--json', '--prompt'],  // --json for JSONL output, --prompt for headless mode
  promptStyle: 'arg',  // Pass prompt as command-line argument after --prompt
  env: {
    // Non-interactive mode flags
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'stream-json',  // ax-grok outputs JSON Lines: {"role":"assistant","content":"..."}
  timeout: TIMEOUT_PROVIDER_SHORT, // Fallback timeout (early termination usually triggers first)
  // Early termination: kill process as soon as we have complete JSON output
  // ax-grok hangs during shutdown after producing valid output, so we don't wait
  earlyTerminateOn: isGrokOutputComplete,
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
