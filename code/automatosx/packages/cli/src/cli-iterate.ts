import { failUnknownCommand } from './cli-builtin-command-service.js';
import { runCommand } from './commands/run.js';
import type { CLIOptions, CommandHandler, CommandResult } from './types.js';
import { failure, success } from './utils/formatters.js';

const DEFAULT_MAX_ITERATIONS = 3;
const DEFAULT_MAX_TIME_MS = 10 * 60 * 1000;
const ITERATE_TARGET_HANDLERS: Readonly<Record<string, CommandHandler>> = {
  run: runCommand,
};

export const ITERATE_HELP_TEXT = [
  'Usage: ax iterate <command> [args...]',
  '',
  'Commands:',
  '  run <workflow-id>   Repeat a workflow run until success or budget exceeded',
  '',
  'Options:',
  `  --max-iterations <n>  Maximum attempts (default: ${DEFAULT_MAX_ITERATIONS})`,
  `  --max-time <duration> Time budget: 30s, 5m, 1h (default: ${DEFAULT_MAX_TIME_MS / 60_000}m)`,
  '',
  'Examples:',
  '  ax iterate run ship --max-iterations 3',
  '  ax iterate run release --max-time 5m',
  '  ax ship --iterate --max-iterations 3',
].join('\n');

export async function executeIterateCommand(
  args: string[],
  options: CLIOptions,
): Promise<CommandResult> {
  const targetCommand = args[0];
  if (targetCommand === undefined || targetCommand.length === 0) {
    return success(ITERATE_HELP_TEXT);
  }
  if (targetCommand === 'help' || options.help) {
    return success(ITERATE_HELP_TEXT);
  }
  if (targetCommand === 'iterate') {
    return failure('ax iterate cannot target itself.');
  }

  const handler = ITERATE_TARGET_HANDLERS[targetCommand];
  if (handler === undefined) {
    return failUnknownCommand(targetCommand);
  }

  return runIterativeHandler(targetCommand, handler, args.slice(1), {
    ...options,
    iterate: false,
  });
}

export async function runIterativeHandler(
  commandName: string,
  handler: CommandHandler,
  args: string[],
  options: CLIOptions,
): Promise<CommandResult> {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const maxTimeMs = parseMaxTimeMs(options.maxTime);
  const startedAt = Date.now();
  let iterationsRun = 0;
  let lastResult: CommandResult | undefined;

  while (iterationsRun < maxIterations && Date.now() - startedAt <= maxTimeMs) {
    iterationsRun += 1;
    const iterationTraceId = options.traceId === undefined
      ? undefined
      : `${options.traceId}-iter-${iterationsRun}`;
    lastResult = await handler(args, {
      ...options,
      iterate: false,
      traceId: iterationTraceId,
    });

    if (lastResult.success) {
      return success(
        `${lastResult.message ?? `${commandName} completed.`}\n\nIterate completed after ${iterationsRun} iteration(s).`,
        {
          iterationsRun,
          lastResult: lastResult.data,
        },
      );
    }
  }

  return failure(
    `${lastResult?.message ?? `${commandName} failed.`}\n\nIterate exhausted ${iterationsRun} iteration(s).`,
    {
      iterationsRun,
      lastResult: lastResult?.data,
    },
  );
}

function parseMaxTimeMs(value: string | undefined): number {
  if (value === undefined || value.length === 0) {
    return DEFAULT_MAX_TIME_MS;
  }

  const match = value.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  if (match === null) {
    return DEFAULT_MAX_TIME_MS;
  }

  const amount = Number.parseFloat(match[1]!);
  const unit = match[2] ?? 'ms';
  switch (unit) {
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 's':
      return amount * 1000;
    default:
      return amount;
  }
}
