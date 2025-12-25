/**
 * Iterate Command - Shorthand for iterate mode
 *
 * Usage: ax iterate <provider> <prompt>
 *        ax iterate --max-iterations 50 <provider> <prompt>
 *
 * This is a convenience command that wraps `ax call --iterate`.
 */

import type { CommandResult, CLIOptions } from '../types.js';
import { callCommand } from './call.js';
import { DEFAULT_MAX_ITERATIONS, DEFAULT_MAX_TIME_MS } from '@defai.digital/iterate-domain';

/**
 * Shows iterate command help
 */
function showIterateHelp(): CommandResult {
  const helpText = `
Iterate Command - Autonomous multi-step execution

Usage:
  ax iterate <provider> <prompt>
  ax iterate --max-iterations 50 <provider> <prompt>

Arguments:
  <provider>    AI provider to use (claude, gemini, codex, qwen, glm, grok)
  <prompt>      The task to complete autonomously

Options:
  --max-iterations  Maximum iterations (default: ${DEFAULT_MAX_ITERATIONS})
  --max-time        Maximum time: 30s, 5m, 1h (default: ${Math.round(DEFAULT_MAX_TIME_MS / 60000)}m)
  --no-context      Skip loading project context
  --model           Specific model to use
  --system          System prompt to prepend
  --format          Output format: text (default) or json

How It Works:
  1. Sends your prompt to the AI provider
  2. AI works on the task and responds
  3. If task incomplete, AI continues automatically
  4. Pauses when AI needs your input (questions, decisions)
  5. Stops when task is complete or budget exceeded

Examples:
  ax iterate claude "implement user authentication"
  ax iterate gemini --max-iterations 50 "refactor the entire API layer"
  ax iterate codex --max-time 10m "add comprehensive unit tests"

This is equivalent to: ax call --iterate <provider> <prompt>
`.trim();

  return {
    success: true,
    message: helpText,
    data: undefined,
    exitCode: 0,
  };
}

/**
 * Iterate command handler
 *
 * This command is a convenience wrapper around `ax call --iterate`.
 */
export async function iterateCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  // Show help if requested
  if (args.length === 0 || args[0] === 'help' || options.help) {
    return showIterateHelp();
  }

  // Enable iterate mode and delegate to call command
  const iterateOptions: CLIOptions = {
    ...options,
    iterate: true,
  };

  return callCommand(args, iterateOptions);
}
