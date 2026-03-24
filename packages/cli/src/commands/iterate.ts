/**
 * Iterate Command
 *
 * Repeat a runnable command until it succeeds, the iteration budget is
 * exhausted, or the time budget is exceeded.
 *
 * Usage:
 *   ax iterate run <workflow-id>
 *   ax iterate run <workflow-id> --max-iterations 5
 *   ax iterate run <workflow-id> --max-time 10m
 *   ax ship --iterate --max-iterations 3          (flag form on any command)
 */

import type { CLIOptions, CommandResult } from '../types.js';
import { failure, success } from '../utils/formatters.js';
import { runCommand } from './run.js';

const DEFAULT_MAX_ITERATIONS = 3;
const DEFAULT_MAX_TIME_MS    = 10 * 60 * 1000; // 10 minutes

function parseMaxTime(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_MAX_TIME_MS;
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)$/.exec(raw.trim());
  if (match === null) return DEFAULT_MAX_TIME_MS;
  const value = parseFloat(match[1]!);
  switch (match[2]) {
    case 'ms': return value;
    case 's':  return value * 1000;
    case 'm':  return value * 60_000;
    case 'h':  return value * 3_600_000;
    default:   return DEFAULT_MAX_TIME_MS;
  }
}

const SUBCOMMAND_HANDLERS: Record<string, (args: string[], opts: CLIOptions) => Promise<CommandResult>> = {
  run: runCommand,
};

export async function iterateCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  if (args.length === 0 || args[0] === 'help' || options.help) {
    return success(
      'Usage: ax iterate <command> [args...]\n\n' +
      'Commands:\n' +
      '  run <workflow-id>   Repeat a workflow run until success or budget exceeded\n\n' +
      'Options:\n' +
      `  --max-iterations <n>  Maximum attempts (default: ${DEFAULT_MAX_ITERATIONS})\n` +
      `  --max-time <duration> Time budget: 30s, 5m, 1h (default: ${DEFAULT_MAX_TIME_MS / 60_000}m)\n\n` +
      'Examples:\n' +
      '  ax iterate run ship --max-iterations 3\n' +
      '  ax iterate run release --max-time 5m\n' +
      '  ax ship --iterate --max-iterations 3',
    );
  }

  const subcommand = args[0];
  const subArgs    = args.slice(1);
  const handler    = SUBCOMMAND_HANDLERS[subcommand];

  if (handler === undefined) {
    return failure(
      `Unknown command for iterate: "${subcommand}"\n` +
      'Supported: run\n' +
      'Run "ax iterate help" for usage.',
    );
  }

  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const maxTimeMs     = parseMaxTime(options.maxTime);
  const deadline      = Date.now() + maxTimeMs;

  let lastResult: CommandResult | undefined;

  for (let attempt = 1; attempt <= maxIterations; attempt++) {
    if (Date.now() >= deadline) {
      return failure(
        `Iterate time budget exceeded after ${attempt - 1} attempt(s). Last result: ${lastResult?.message ?? 'none'}`,
        { attempts: attempt - 1, lastResult },
      );
    }

    lastResult = await handler(subArgs, options);

    if (lastResult.success) {
      return success(
        `Succeeded on attempt ${attempt}/${maxIterations}.\n${lastResult.message ?? ''}`.trim(),
        { attempts: attempt, lastResult },
      );
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    if (attempt < maxIterations) {
      process.stderr.write(
        `[iterate] Attempt ${attempt}/${maxIterations} failed: ${lastResult.message ?? 'unknown error'}. Retrying...\n`,
      );
    }
  }

  return failure(
    `All ${maxIterations} attempt(s) failed. Last error: ${lastResult?.message ?? 'unknown'}`,
    { attempts: maxIterations, lastResult },
  );
}
