import { parseArgs, formatOutput } from './parser.js';
import {
  runCommand,
  listCommand,
  traceCommand,
  helpCommand,
  versionCommand,
} from './commands/index.js';
import type { CommandHandler } from './types.js';

/**
 * Command registry
 */
const COMMANDS: Record<string, CommandHandler> = {
  run: runCommand,
  list: listCommand,
  trace: traceCommand,
  help: helpCommand,
  version: versionCommand,
};

/**
 * Main CLI entry point
 */
export async function run(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);

  // Get command handler
  const handler = COMMANDS[parsed.command];

  if (handler === undefined) {
    console.error(`Unknown command: ${parsed.command}`);
    console.error('Run "automatosx help" for usage information.');
    return 1;
  }

  try {
    const result = await handler(parsed.args, parsed.options);

    // Output result
    if (result.message !== undefined) {
      if (result.success) {
        console.log(result.message);
      } else {
        console.error(result.message);
      }
    }

    // Output data if JSON format
    if (parsed.options.format === 'json' && result.data !== undefined) {
      console.log(formatOutput(result.data, 'json'));
    }

    return result.exitCode;
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return 1;
  }
}

/**
 * Creates a CLI instance for testing
 */
export function createCLI(): {
  run: (argv: string[]) => Promise<number>;
  parseArgs: typeof parseArgs;
  formatOutput: typeof formatOutput;
} {
  return {
    run,
    parseArgs,
    formatOutput,
  };
}
