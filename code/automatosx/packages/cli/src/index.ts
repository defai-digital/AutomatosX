import packageJson from '../../../package.json' with { type: 'json' };
import { executeBuiltinCliCommand, failUnknownCommand } from './cli-builtin-command-service.js';
import { CLI_COMMAND_NAMES } from './command-metadata.js';
import { getCommandHelp } from './cli-help.js';
import { runIterativeHandler } from './cli-iterate.js';
import { parseCommand } from './cli-parser.js';
import { getCommandHandler } from './command-manifest.js';
import type { CLIOptions, CommandResult, ParsedCommand } from './types.js';
import { failure, success } from './utils/formatters.js';

export const CLI_VERSION = packageJson.version;
export { CLI_COMMAND_NAMES };
export { getCommandHelp, parseCommand };

export async function executeCli(argv: string[]): Promise<CommandResult> {
  return executeParsedCli(parseCommand(argv));
}

export async function executeParsedCli(parsed: ParsedCommand): Promise<CommandResult> {
  if (parsed.parseError !== undefined) {
    return failure(parsed.parseError);
  }

  const builtinResult = await executeBuiltinCliCommand(parsed, CLI_VERSION);
  if (builtinResult !== undefined) {
    return builtinResult;
  }

  const handler = getCommandHandler(parsed.command);
  if (handler === undefined) {
    return failUnknownCommand(parsed.command);
  }

  if (parsed.options.iterate) {
    return runIterativeHandler(parsed.command, handler, parsed.args, parsed.options);
  }

  return handler(parsed.args, parsed.options);
}

export function renderCommandResult(result: CommandResult, options: CLIOptions): string {
  if (options.format === 'json') {
    return `${JSON.stringify({
      success: result.success,
      message: result.message,
      data: result.data,
      exitCode: result.exitCode,
    }, null, 2)}\n`;
  }

  if (result.message !== undefined) {
    return `${result.message}\n`;
  }

  if (result.data !== undefined) {
    return `${JSON.stringify(result.data, null, 2)}\n`;
  }

  return '';
}
