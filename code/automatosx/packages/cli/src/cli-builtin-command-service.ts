import { helpCommand } from './commands/index.js';
import { getCommandHelp } from './cli-help.js';
import type { CommandResult, ParsedCommand } from './types.js';
import { failure, success } from './utils/formatters.js';

export async function executeBuiltinCliCommand(
  parsed: ParsedCommand,
  cliVersion: string,
): Promise<CommandResult | undefined> {
  if (parsed.options.version) {
    return createVersionResult(cliVersion);
  }

  if (parsed.command === 'help' && parsed.options.help) {
    return success(getCommandHelp('help') ?? 'Command help is not available.', { command: 'help' });
  }

  if (parsed.command === 'help' && parsed.args[0] !== undefined) {
    const helpTarget = parsed.args[0];
    const commandHelp = getCommandHelp(helpTarget);
    if (commandHelp !== undefined) {
      return success(commandHelp, { command: helpTarget });
    }
    return failUnknownCommand(helpTarget);
  }

  if (parsed.options.help && parsed.command !== 'help') {
    const commandHelp = getCommandHelp(parsed.command);
    if (commandHelp !== undefined) {
      return success(commandHelp, { command: parsed.command });
    }
    return helpCommand([], parsed.options);
  }

  if (parsed.command === 'version') {
    return createVersionResult(cliVersion);
  }

  return undefined;
}

export function createVersionResult(cliVersion: string): CommandResult {
  return success(`AutomatosX v${cliVersion}`, { version: cliVersion });
}

export function failUnknownCommand(command: string): CommandResult {
  return failure(`Unknown command: ${command}\nRun "ax help" to see the available commands.`);
}
